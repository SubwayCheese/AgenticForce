# Proposal (needs owner review -- protected file): a hard deadline on every live Alpaca request

**Status: PROPOSED, not applied ("apply with changes" per independent review: tests now written below and verified passing in a
scratch copy).** `bus/city/survive-alpaca-live-client.js` is protected.

**APPLY ORDER, load-bearing, not optional: `docs/proposals/executor-submit-try-catch/` FIRST, this patch SECOND.** That patch's
error classification (`survive-executor.js`) treats any error without a recognized `-> 4xx:` client message, or a client-side
pre-network refusal, as an UNKNOWN outcome and freezes C1 pending human reconciliation. A `fetchWithTimeout` timeout
(`code: 'ALPACA_TIMEOUT'`, `outcomeUnknown: true` for non-GET) is designed to land exactly in that bucket -- on a submit whose
outcome is genuinely unknown, the executor must not guess and must not blindly retry the same client-order-id. **Applying this
patch WITHOUT the try/catch patch already in place restores the pre-existing wedge, just reachable sooner**: an unwrapped
`client.submitOrder()`/`client.getOrder()` (`survive-executor.js:293`, `:301`) would let a bare `ALPACA_TIMEOUT` exception escape
`executeEntry()` exactly as any other exception does today. Verified by stacking all three patches in order in a scratch copy
(see "What I ran" below); the try/catch patch's own `getOrderByClientOrderId` patch (optional) was also re-checked to apply with
only a line-offset after this one, as that proposal's own doc claims.

## The gap
Both Alpaca clients call `fetch()` with no deadline: live client `survive-alpaca-live-client.js:43` (`apiRequest`, used by every
account/order call) and `:72` (`getLatestQuote`); paper client `bus/fleet/alpaca-client.js:36`, `:70`, `:137`. The supervisor
acknowledges it (`survive-supervisor.js:70-76`) and works around it for the candidate pre-fetch with a `Promise.race`
(`:230-249`); the executor's `freshBid` (`survive-executor.js:236-241`) does the same. Neither race cancels the request. Everything
else has no protection: `reconcilePosition` (the first thing every wake does, `survive-supervisor.js:490`), the entry fill poll
(`survive-executor.js:301`), cancel, stop placement, exit. `survive-supervisor.service` is a `Type=oneshot` with no `TimeoutStartSec`,
so systemd will not cut a stalled wake short. Node's built-in fetch (undici) has its own defaults (documented as 10s connect,
300s headers and body; I did not verify that on this Node 20.20.2), so the practical risk is a wake stalled for minutes, not forever.
Still, on a 2h cadence with a possibly unprotected position, a stalled `reconcilePosition` delays every other step by minutes.

## The fix
`fetchWithTimeout(url, options, timeoutMs = 15000)` in the live client, using an `AbortController`:
- The deadline covers the response body as well: the wrapper does `fetch` and `res.text()` inside the timer and returns
  `{ res, text }` (a wrapper that returned the `Response` and cleared the timer would leave `res.text()` unbounded).
- On timeout it throws an `Error` whose message names the method and path (query string dropped), with `code = 'ALPACA_TIMEOUT'`
  and `outcomeUnknown = true` for non-GET requests. A timed-out `POST /orders` or `DELETE` may still have been accepted by Alpaca;
  the message says so, so nobody treats it as "the order did not happen".
- Nothing is retried in this layer. Non-timeout errors are rethrown unchanged.
- `apiRequest` and `getLatestQuote` use it. Exports `fetchWithTimeout` and `FETCH_TIMEOUT_MS` (for tests).

Diff size: +29 / -5 lines, one file. Error messages for HTTP errors are unchanged.

## Important interaction: a timed-out order is not a failed order
This patch makes a hang into an exception, which the executor currently does not catch around `submitOrder` / `getOrder`
(`survive-executor.js:293`, `:301`). A timeout on the entry POST or on the fill poll is precisely the "accepted but unrecorded"
case in the try/catch proposal (owned by another writer). Apply the try/catch patch first (or together), and have it look the order
up by `client_order_id` on `outcomeUnknown` instead of blindly retrying. Without it, this patch converts a slow hang into a
retry-forever wedge sooner. That ordering, not the timeout itself, is the main risk of this change.

## Other risks
- 15s could cut off a legitimately slow response. These endpoints are expected to answer in about a second (not measured here); if 15s proves too
  tight, the constant is the only thing to change. A false timeout on a GET is harmless (the next wake retries); on a POST it falls
  under the section above.
- The fill poll runs up to 10 iterations (`survive-executor.js:299-303`): worst case grows from unbounded to about 10 x (1s + 15s).
- Test stubs: the sandbox replaces `globalThis.fetch` with a function that throws (`bus/tests/survive/_sandbox.js`); the wrapper
  passes an extra `signal` option and rethrows that error unchanged, so existing tests should be unaffected (not run).
- Not covered: the paper client `bus/fleet/alpaca-client.js` (protected, used by the rehearsal path and the paused fleet). The same
  wrapper can be copied there, changing the three `fetch` sites at `:36`, `:70`, `:137`; I did not write that patch.
- Not covered: `survive-executor.js:236-241` (`freshBid`) and `survive-supervisor.js:230-249` still race a timer, harmlessly; with
  the client deadline they no longer leave a request running after they give up.

## Files (this folder: `docs/proposals/fetch-timeouts/`)
- `survive-alpaca-live-client.patch` -- unified diff against the current `bus/city/survive-alpaca-live-client.js` (use `-p1`)

## What I ran (real results, 2026-09-26)
```
cd ~/AgentVault && patch -p1 --dry-run < docs/proposals/fetch-timeouts/survive-alpaca-live-client.patch
  -> checking file bus/city/survive-alpaca-live-client.js   (clean)
sha256sum -c (before/after)  -> live file unchanged (OK)
# scratch copy (cd <scratchpad>/verify; NOT the live tree)
patch -p1 < .../fetch-timeouts/survive-alpaca-live-client.patch ; node --check bus/city/survive-alpaca-live-client.js  -> OK
```
NOT run: any behavioural test, the survive suite, any network call.

## Tests (written, run, all passing -- `docs/proposals/fetch-timeouts/proposed-test.js`)
9 cases, `node:test` + `node:assert/strict`, `makeSandbox`, calling `fetchWithTimeout` directly (no credentials needed --
`apiRequest`/`getLatestQuote` need `loadConfig()`, which this sandbox never provides by design, so those two are exercised
only far enough to prove they route through `fetchWithTimeout` and fail on the credentials check, not on a hang or a
`TypeError`):
1. A `fetch` that never resolves on its own is aborted at the deadline: `code: 'ALPACA_TIMEOUT'`, `outcomeUnknown: true` for
   POST, `false` for GET, message names the method/timeout and has no query string.
2. The deadline also covers a hanging `res.text()` (fetch resolves fast, the body read hangs) -- still times out.
3. A normal fast response passes through unchanged as `{ res, text }`, and the controller is left `aborted: false`.
4. The sandbox's own synchronous-throwing `fetch` stub (`TEST NETWORK BLOCKED: fetch called`) is rethrown byte-for-byte
   unchanged -- no `ALPACA_TIMEOUT` code, no `outcomeUnknown` property added.
5. An ordinary async-rejected `fetch` (e.g. DNS failure) before the deadline is also rethrown unchanged.
6. The timer is cleared on success (spied `setTimeout`/`clearTimeout`, asserts the exact handle created is the one cleared).
7. The timer is also cleared when the call throws, not just on success.
8. The timeout error message carries no secrets: a URL with `apikey=...` in the query string and `APCA-API-*` headers is
   used, and the message contains neither the header values nor any query string at all (the whole query string is
   stripped, not selectively redacted).
9. `apiRequest`/`getLatestQuote` reach the credentials check (proving the network call path is wired through
   `fetchWithTimeout` correctly) and fail there, not by hanging.

## What I ran (real results, 2026-09-26 and 2026-09-29)
Original run (2026-09-26): dry-run + scratch `node --check`, as below. Full verification added 2026-09-29 after independent
review, including the load-bearing 3-way stack with the try/catch and allow-list patches:
```
cd ~/AgentVault && patch -p1 --dry-run < docs/proposals/fetch-timeouts/survive-alpaca-live-client.patch
  -> checking file bus/city/survive-alpaca-live-client.js   (clean)
sha256sum -c (before/after)  -> live file unchanged (OK; re-checked 2026-09-29, still matches)

# Same full scratch repo copy as the allow-list proposal (<scratchpad>/stack2), patches applied IN ORDER:
patch -p1 < .../executor-submit-try-catch/survive-executor.patch
patch -p1 < .../executor-submit-try-catch/survive-alpaca-live-client.patch
patch -p1 < .../entry-symbol-allowlist/survive-executor.patch
patch -p1 < .../fetch-timeouts/survive-alpaca-live-client.patch     # applies with one hunk offset (+6 lines) only, no fuzz, no rejects -- confirms the other
                                                                      proposal's own claim that its getOrderByClientOrderId patch and this one compose
node --check bus/city/survive-alpaca-live-client.js   -> OK

cp docs/proposals/fetch-timeouts/proposed-test.js bus/tests/survive/fetch-timeouts.test.js
node --test bus/tests/survive/fetch-timeouts.test.js
  -> # tests 9  # pass 9  # fail 0

node bus/platform/build-system-map.js --write; node --test bus/tests/survive/architecture.test.js
  -> map diff: survive-shadow's inbound count 2 -> 3 (the allow-list patch's new import; this patch adds no new require);
     architecture suite # tests 8  # pass 8  # fail 0

node bus/platform/run-survive-tests.js --verbose (full suite, all three 2026-09-26 patches + all three proposed test files)
  -> # tests 161  # pass 145  # fail 16 (all 16 in the try/catch proposal's OWN entry-submit-errors.test.js, a fixture gap
     unrelated to timeouts specifically -- see the allow-list proposal's doc for the root cause and the fix needed there)
```
This patch's own 9 tests, and the try/catch proposal's 17, each pass 100% in isolation; the only failures appear once all
three are stacked, and are attributable to the allow-list patch's stricter precondition, not to this one. No fetch-timeouts
test failed under any combination tried.

## To apply (owner)
```bash
cd ~/AgentVault
# FIRST: docs/proposals/executor-submit-try-catch/ (see the callout at the top of this doc)
patch -p1 --dry-run < docs/proposals/fetch-timeouts/survive-alpaca-live-client.patch
patch -p1 < docs/proposals/fetch-timeouts/survive-alpaca-live-client.patch
node --check bus/city/survive-alpaca-live-client.js
cp docs/proposals/fetch-timeouts/proposed-test.js bus/tests/survive/fetch-timeouts.test.js
node bus/platform/run-survive-tests.js
git add bus/city/survive-alpaca-live-client.js bus/tests/survive/fetch-timeouts.test.js && git diff --cached --stat
```
The running supervisor is a fresh process each wake, so it picks the change up on the next wake; no restart is needed. (The
hand-started queue daemon does not import this client, as far as I looked; not verified.)
