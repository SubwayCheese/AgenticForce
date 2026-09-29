# Proposal (needs owner review -- protected file): a failed entry submit or status read wedges C1 or loses a fill

**Status: PROPOSED, not applied (revision 2, after independent review).** `bus/city/survive-executor.js` is protected (change gate:
human-review-required). Patch and tests were run on scratch copies only; no file under `bus/` was touched, no order was placed,
Alpaca was never called.

## READ FIRST: what a freeze means for C1's money (owner action, time-sensitive)
The patch freezes C1 (`cityRegistry.quarantineCitizen`) and sends a priority-5 alert to the private survive ntfy topic in exactly two
situations: (1) an entry order MAY have been placed but could not be confirmed either way, (2) an entry order was placed but its fill
status could not be read. While C1 is frozen:
- **Exits are blocked** (`executeExit` refuses a quarantined citizen, `survive-executor.js:352`; entries likewise at `:276`; the supervisor skips it, `survive-supervisor.js:513`).
- **A filled position has NO protection.** The stop is only placed after the fill is recorded, so a fill the code never saw gets no stop. And even
  a normally protected fractional position has no lasting server-side stop: Alpaca allows only DAY stops on fractional quantities, so
  the stop expires at the close (this is what happened to mission010's SGOV stop; a GTC stop does not exist for it). Do not treat the
  freeze as "safe": a real position may be sitting unprotected until you act.

So reconcile and release promptly. Exact steps (all read-only until step 3):
1. `node bus/city/survive-alpaca-live-client.js positions` and `node bus/city/survive-alpaca-live-client.js orders`
   (also `node bus/city/city-security.js status` shows the freeze reason, which names the client order id or order id).
2. Decide from what you see:
   - **Nothing bought** (no position, order canceled/absent): nothing to record.
   - **Position exists, keep it:** record the buy so the ledger matches (this writes live state, owner-run; fill the placeholders from the account):
     `node -e "require('./bus/city/survive-budget-envelope.js').recordOrderFill({citizenId:'C1',type:'order-fill-buy',lotId:'survive_C1_manual_'+Date.now(),symbol:'<SYM>',qty:<QTY>,price:<AVG_PRICE>,grossUsd:<QTY>*<AVG_PRICE>,orderId:'<ALPACA_ORDER_ID>',missionId:'<missionNNN>'})"`
     then place a day stop by hand in Alpaca (re-place it every trading day; see "Still open" in the stop-price proposal).
   - **Position exists, flatten it:** sell it in Alpaca, then record both the buy (above) and the sell so cash and P&L are right.
     (Untested against live state; check `computeLifetimeLedger('C1')` afterwards.)
   - If an entry order is still pending in Alpaca, cancel it first.
3. Release: `node bus/city/city-security.js unquarantine C1 "reconciled: <what you found>"` (the one human-only release path; I did not run it).

## Problem
`executeEntry()` calls the broker with no error handling in two places:

1. `bus/city/survive-executor.js:293` -- `const entryOrder = await client.submitOrder({...})` with `clientOrderId: survive-<citizen>-<mission>-entry`.
   Any rejection (422 non-fractionable, minimum notional, buying power, limit order without `limitPrice`, a network error or timeout) rejects
   `executeEntry` -> `runForCitizen` (`:445`).
2. `:299-303` -- the poll loop `filled = await client.getOrder(entryOrder.id)`. One transient network error throws out of the loop.

`bus/city/survive-supervisor.js:500-506` catches the rejection, logs `execution FAILED` and moves on. **No `mission-resolved` event is
written**, so on every later wake `findLatestUnresolvedDecision` (`survive-executor.js:404`) returns the same decision and the entry is
re-submitted with the same deterministic client order id. `isMissionDue` (`survive-supervisor.js:114`) stays false while a decision is
unresolved, so no new mission is ever authored: **C1 is wedged permanently** (until someone hand-edits the log).

Worse, case 2 (and a lost/timed-out submit response) is a money-integrity bug: the order was already accepted, so a real fill can occur while
`budgetEnvelope.recordOrderFill` and `mission-entered` (`:334-335`) are never reached. The account then holds a position the ledger does not
know about, with no stop. (`reconcilePosition`, `:137`, only handles the opposite case: ledger open, account flat.)

## Evidence (reproduced on scratch copies, fake client, no network)
Original executor, `wedge-demo.js` (submit always rejects with a 422):
```
wake 1 THREW: Live Alpaca API POST /orders -> 422: boom
  unresolved after wake: {"taskId":"survive/survive_cT1_mission001_decision","missionId":"mission001"}
wake 2 / wake 3: THREW again, unresolved again
submit attempts with ids: survive-T1-mission001-entry, survive-T1-mission001-entry, survive-T1-mission001-entry
```
Patched executor, same script: every wake returns, `unresolved` is `null`, exactly one submit attempt.

## The change
### `survive-executor.patch` (executor only; +98 / -6 lines: `executeEntry` plus four small helpers)
1. **Classify the submit error.** A submit failure is a *definite refusal* only if the broker answered with a 4xx in this client's own message
   format (`... -> 4xx: <msg>`, `survive-alpaca-live-client.js:57`) that is not a duplicate-`client_order_id` complaint, or the client refused before any
   network call (`submitOrder requires...`, `limitPrice required...`, `Budget envelope refused...`, long-only, credentials/host guards), and the error is not flagged
   `outcomeUnknown`. **Everything else is an unknown outcome** (timeout, `ALPACA_TIMEOUT`, connection reset, 5xx, unrecognised text).
2. **Definite refusal:** `mission-resolved` `outcome:'error'`, reason `entry order was not placed: <Alpaca message, 300 chars>`, returns `entry-submit-failed`. No freeze, no lookup, no second submit.
3. **Unknown outcome:** look for the order (`findOrderByClientOrderId`): the exact endpoint `client.getOrderByClientOrderId` if the client has it (see below),
   else a scan of `getOrders('all')`; the id is normalized with the client's own `normalizeClientOrderId` before matching; the lookup is **tried twice, 1s apart**
   (a just-accepted order can lag; a 404 or transient error counts as "not seen"). Found: the order is adopted and flows through the normal poll / record / stop path.
   **Not seen (even if the lookup itself succeeded and returned nothing):** resolve as error, freeze C1, alert (`entry-submit-unknown`). "Empty list" is not proof of absence:
   the order can still be processing, or fall outside Alpaca's default page (the client sends no limit).
4. **Poll loop:** a failing `getOrder` no longer throws; the existing 10 x 1s loop retries. If the last read still failed: one more read, then a best-effort `cancelOrder`
   (a no-op on an order that already filled; stops a still-pending one filling unrecorded later) and one final read. If any read succeeds the original code continues
   **byte-for-byte unchanged**. If none does: resolve as error with `entry order <id> was placed but its fill status could not be read (...) -- it may be filled and is NOT recorded in the
   ledger; the real account must be reconciled`, freeze, alert (`entry-fill-unknown`, result carries `orderId`).

### `survive-alpaca-live-client.patch` (optional, second protected file; +7 lines)
Adds `getOrderByClientOrderId(id)` -> `GET /orders:by_client_order_id?client_order_id=<normalized id>` (Alpaca's exact lookup; the client throws on its 404). The executor
works without it (falls back to the list scan) and uses it automatically when present. It applies to the current file AND after
`docs/proposals/fetch-timeouts/survive-alpaca-live-client.patch` (checked, offset only). The endpoint path/behaviour is from Alpaca's documented API; **I could not call Alpaca**, so its live
response was not verified (only the request URL, in test (k)).

### How this prevents a double buy
- Every failure resolves the mission, so `findLatestUnresolvedDecision` skips it: the same decision is never re-run and the same client order id is never resubmitted
  (and Alpaca would reject a duplicate id anyway).
- A LATER mission has a new id (and a new client order id), so duplicate-id protection alone would not stop it. That is why every "may have been placed" case
  quarantines the citizen: entries are refused while quarantined until you have looked at the real account (steps above). Only a definite refusal, where nothing can exist, skips the freeze.

## Verification (real output, 2026-09-26; scratch dir `/tmp/claude-1000/.../scratchpad/work/`)
```
$ cmp ~/AgentVault/bus/city/survive-executor.js survive-executor.orig.js   -> identical (real file untouched)
$ patch --dry-run -p1 < docs/proposals/executor-submit-try-catch/survive-executor.patch          -> checking file bus/city/survive-executor.js (rc=0)
$ patch --dry-run -p1 < docs/proposals/executor-submit-try-catch/survive-alpaca-live-client.patch -> checking file bus/city/survive-alpaca-live-client.js (rc=0)
$ node --check survive-executor.new.js                                                            -> ok
$ EXECUTOR_UNDER_TEST=survive-executor.orig.js node --test docs/proposals/executor-submit-try-catch/proposed-test.js
    # tests 17  # pass 3  # fail 14   (passes are (d) happy path, (d2) canceled path, (k) client URL: the unchanged behaviours; every submit/poll-failure case fails: exception escapes)
$ EXECUTOR_UNDER_TEST=survive-executor.new.js node --test .../proposed-test.js      (client = the current, unpatched one)
    # tests 17  # pass 16  # fail 0  # skipped 1   ((k) skips: the unpatched client has no getOrderByClientOrderId)
Copy of bus/ with BOTH patches applied + the proposed test installed:
$ node --test bus/tests/survive/stop-price.test.js bus/tests/survive/supervisor.test.js bus/tests/survive/entry-submit-errors.test.js
    # tests 61  # pass 61  # fail 0  # skipped 0
```
Test cases (`proposed-test.js`, run in the repo's `_sandbox.js`; the sandbox's live client is a stub forwarding to an injected fake; network blocked; the 1s waits are shortened to 0 by a timer shim):
(a) submit 422 -> error, not wedged, no resubmit; (b) `getOrder` fails twice then succeeds -> fill recorded; (c) `getOrder` always fails -> error with order id, freeze, alert, no second buy;
(d)/(d2) happy and canceled paths unchanged; (e)/(h) order found after a failed submit / duplicate-id 422 -> adopted; (f) unknown + account unreadable -> freeze; (g) 4xx with lookup down -> plain error;
**(i) submit TIMES OUT (`outcomeUnknown`), lookup returns `[]` -> freeze + alert, lookup tried twice, no second submit; (i2) plain `fetch failed` + empty lookup -> freeze;
(ii) definite 422 / pre-network refusals + empty lookup -> error, NOT frozen, no alert; (ii2) `outcomeUnknown` overrides a `-> 422:` in the text; (iii) lookup empty first try, found on the
second -> adopted; (iii2) exact lookup preferred, 404 then found, normalized id; (iii3) list scan matches the normalized id;** (k) the client method's request URL.
An earlier attempt at (iii*) failed only because my sandbox stub answered every property name as a function; fixed in the test, not in the patch.
The full `bus/tests/survive/` suite was NOT run in the real tree (a partial copy gave 122/6 identically with the original because architecture/map tests need the whole repo); run it after applying.

## Risks / limits (honest list)
- The freeze is deliberately conservative: a timeout that in fact placed nothing still freezes C1 until you release it (minutes if you are prompt; see the top of this page for what is unprotected meanwhile).
  The pre-network refusal list is a set of message prefixes from the current client; a new client-side error text would default to "unknown" (freeze), the safe direction.
- Without the client patch the fallback scan uses `getOrders('all')`, Alpaca's default page (recent orders); fine for a $50 account, not exact.
- Test stub proves control flow, not Alpaca's real wording; the `-> 4xx:` match relies on this client's message format. The rehearsal (paper) client's format was not checked.
- No helper exists to record a missing buy; the one-liner above is a suggestion and untested against live state.
- A partially filled entry that ends `canceled` is still not recorded (pre-existing, unchanged).
- **Not covered:** `executeExit` (`:368-378`) has the identical unwrapped submit/poll and the same wedge; left for a follow-up (one system per change).
  `placeProtectiveStop` already has its own try/catch.
- Definite refusals send no ntfy (same as existing `error` outcomes); the supervisor log records the result.

## To apply (owner)
```bash
cd ~/AgentVault
patch --dry-run -p1 < docs/proposals/executor-submit-try-catch/survive-executor.patch
patch -p1 < docs/proposals/executor-submit-try-catch/survive-executor.patch
patch -p1 < docs/proposals/executor-submit-try-catch/survive-alpaca-live-client.patch     # optional, adds the exact lookup
cp docs/proposals/executor-submit-try-catch/proposed-test.js bus/tests/survive/entry-submit-errors.test.js
node --test bus/tests/survive/entry-submit-errors.test.js                                # expect 17 pass (16 + 1 skipped without the client patch)
node bus/platform/run-survive-tests.js                                                   # expect all green
git add bus/city/survive-executor.js bus/city/survive-alpaca-live-client.js bus/tests/survive/entry-submit-errors.test.js && git commit -m "Executor: resolve entry submit/poll failures instead of wedging"
```
(Stage the client file only if you applied its patch.) The supervisor runs fresh on each timer wake, so it picks the change up on its next run.
