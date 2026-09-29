# Proposal (needs owner review -- protected file): only allow entries in the universe the research saw

**Status: PROPOSED, not applied.** `bus/city/survive-executor.js` is protected (change gate: human-review-required). Patch written
against the current file (which already contains the stop-price fix); checked with `patch --dry-run` and `node --check` only,
behaviour NOT executed (this review was not allowed to run node beyond `--check`), so the tests listed below still need to be
written and run before applying.

## The gap
`validateDecision` (`survive-executor.js:82-92`) accepts an `enter` if `symbol` is truthy and `notionalUsd` is a positive number.
Nothing compares the symbol with the universe the mission actually analysed (fixed baseline `SGOV, BIL, SHY, VOO, SCHD`,
`survive-supervisor.js:68`, plus up to 5 scan symbols from the market-scan cache, `:301-303`). The research prompt even permits
recommending "a symbol NOT in the table" (`survive-supervisor.js:357`). So an LLM typo, a hallucinated ticker, an unrelated ETF
(leveraged, inverse, penny stock), or a non-equity string goes straight to `submitOrder`. The only backstop is Alpaca's own
rejection, and that rejection currently wedges C1 (unwrapped `submitOrder`, `survive-executor.js:293`, the try/catch proposal owned
by another writer): the same failing decision is retried every wake and blocks new missions. Validating before submission turns
that class of failure into an ordinary `mission-resolved outcome:error` (the existing path at `survive-executor.js:433-436`).

## The fix (smallest safe patch)
- New `allowedEntrySymbols(citizenId, missionId)`: reads the mission's own shadow snapshot (`bus/survive-shadow.jsonl`, written by
  `authorNewMission` at `survive-supervisor.js:323`, before the tasks exist) and returns the set of symbols in it. That set is
  exactly the table the research saw: baseline symbols whose Alpaca fetch succeeded, plus scan symbols that passed the spread
  floor. Returns `null` if there is no snapshot for that mission.
- `validateDecision(decision, opts = {})` gains an optional `opts.allowedSymbols`. When the key is present: `null` fails closed
  (an entry we cannot check is refused), and the symbol must be in the set (case-insensitive, trimmed). On success the symbol is
  normalized to upper case, since that exact string is sent to Alpaca. When the key is absent, behaviour is unchanged, so existing
  callers and tests are unaffected.
- `runForCitizen` passes `{ allowedSymbols: allowedEntrySymbols(citizenId, missionId) }` for `enter` decisions only. `exit` uses the
  ledger's open lot symbol, so it is untouched.
- Adds `require('./survive-shadow.js')` (same domain, no new cross-domain import, no cycle: the shadow module only requires
  `paths`, `fs`, `path`) and exports `allowedEntrySymbols`.

Diff size: +22 / -2 lines, one file.

## Why the snapshot and not a copy of the universe
The supervisor owns `SURVIVE_CANDIDATE_UNIVERSE` and already requires the executor, so the executor cannot import it without a
cycle, and a hard-coded second copy would drift. The per-mission snapshot is also more precise than "the universe": it includes
that mission's scan symbols and excludes a baseline symbol whose data fetch failed (the model was shown `DATA FETCH FAILED` for it).

## Risks and trade-offs (decisions for the owner)
1. **Policy change.** The research prompt currently allows an unverified out-of-table symbol if flagged. After this patch such a
   decision is refused with `outcome: error` and a reason naming the universe. For a $50 account this is the intended direction, but
   it is a deliberate removal of that freedom. A follow-up (not in this patch, since `survive-supervisor.js` is protected) would be to
   tell the decision prompt the rule, so a mission is not spent on a symbol that will be refused; today the refused mission just
   ends as an error and the normal cooldown applies (it is not counted as a `dispatchFailure`).
2. **Fail closed on a missing snapshot.** If the shadow write ever fails (`survive-supervisor.js:323` is wrapped in a try/catch that
   only logs), every entry for that mission is refused, even SGOV. That is the safe direction (no order), and a mission that decides
   `enter` after a lost snapshot is rare, but it is a new coupling between the shadow file and order placement. Missions authored
   before this patch are all resolved except the one in flight (mission026, which does have a snapshot: the shadow file's last
   record is from 08:32Z).
3. `readShadowEvents` reads the whole shadow file, only when an `enter` decision is being executed. The file is ~13 KB now (about
   0.7 KB per snapshot, ~6 per day), so this is negligible for a long time.
4. **Does not stop a wrong-but-listed symbol** (e.g. VOO instead of SGOV). It bounds the choice to the analysed set; the sizing cap
   and the stop are separate controls.
5. **Generated map.** The new import will change the inbound counts in `docs/SYSTEM-MAP.md`; the architecture test fails on a stale
   map, so run `node bus/platform/build-system-map.js --write` after applying (not run here).

## Files (this folder: `docs/proposals/entry-symbol-allowlist/`)
- `survive-executor.patch` -- unified diff against the current `bus/city/survive-executor.js` (`a/bus/...`, `b/bus/...`, use `-p1`)

## What I ran (real results, 2026-09-26)
Working copy in the scratchpad, `diff -u` against the original, then:
```
cd ~/AgentVault && patch -p1 --dry-run < docs/proposals/entry-symbol-allowlist/survive-executor.patch
  -> checking file bus/city/survive-executor.js            (clean, no offsets, no rejects)
sha256sum -c (before/after)  -> live bus/city/survive-executor.js unchanged (OK)
# scratch copy (cd <scratchpad>/verify; NOT the live tree)
patch -p1 < .../entry-symbol-allowlist/survive-executor.patch ; node --check bus/city/survive-executor.js  -> OK
# stacked on the other writer's try/catch patch (state of that file at 01:51 PDT)
patch -p1 < .../executor-submit-try-catch/survive-executor.patch && patch -p1 < .../entry-symbol-allowlist/survive-executor.patch
  -> both apply (my hunks 4 and 5 with offset 65 lines); node --check OK
```
NOT run: the survive test suite, any behavioural test, the map regeneration. If the try/catch patch changes again, re-run the
dry-run.

## Tests (written, run, all passing -- `docs/proposals/entry-symbol-allowlist/proposed-test.js`)
Written in the style of `bus/tests/survive/stop-price.test.js` (`node:test` + `node:assert/strict`, `makeSandbox`, network
blocked, no live credentials needed since only sandboxed fakes are called). 7 cases, all passing standalone AND stacked with
the other two 2026-09-26 patches (see "What I ran" below):
1. Entering a symbol present in the mission's own snapshot succeeds (`submitOrder` called once, `mission-resolved outcome:
   entered`).
2. A symbol NOT in the snapshot is refused: `outcome: error`, reason names the universe (asserted against the exact message),
   `submitOrder` is called **zero** times, no `mission-entered` event.
3. A missing snapshot fails closed: refused with a distinct reason, zero submits.
4. An unreadable/corrupt snapshot (a line that fails `JSON.parse`, written directly to the shadow file rather than via
   `recordSnapshot`) also fails closed the same way -- `readShadowEvents()` silently drops unparseable lines, so this reduces
   to "no valid snapshot for this mission", covered identically.
5. The allow-list covers a same-day SCAN-proposed symbol (`XLE`, not in the fixed 5-symbol baseline) exactly like a baseline
   one -- proves it is not hardcoded to `SURVIVE_CANDIDATE_UNIVERSE`, since the snapshot format carries no baseline/scan tag.
6. `hold` and `no-action` never consult the allow-list, even with zero snapshots recorded (confirms the `decision.decision
   === 'enter'` guard).
7. `exit` is unaffected even with no snapshot for that mission: it acts on the ledger's own open lot, not `decision.symbol`.

## What I ran (real results, 2026-09-26 and 2026-09-29)
Original run (2026-09-26): dry-run + scratch `node --check`, as below. Full verification added 2026-09-29 after independent
review asked for tests and a 3-way stack check with `docs/proposals/executor-submit-try-catch/` and
`docs/proposals/fetch-timeouts/`:
```
cd ~/AgentVault && patch -p1 --dry-run < docs/proposals/entry-symbol-allowlist/survive-executor.patch
  -> checking file bus/city/survive-executor.js            (clean, no offsets, no rejects)
sha256sum -c (before/after)  -> live bus/city/survive-executor.js unchanged (OK; re-checked 2026-09-29, still matches)

# Fresh scratch copy of the whole repo (rsync, secrets/*.jsonl/*.log excluded; bus/fleet/data and bus/platform/secrets-broker.js
# added back so the pre-existing suite's own unrelated tests -- antigravity/ask-agents/stop-price -- have what they need):
cd <scratchpad>/stack2   # a full repo copy, NOT the live tree
patch -p1 < .../executor-submit-try-catch/survive-executor.patch          # applied FIRST, per the ordering note in the fetch-timeouts proposal
patch -p1 < .../executor-submit-try-catch/survive-alpaca-live-client.patch
patch -p1 < .../entry-symbol-allowlist/survive-executor.patch             # applies with hunk offsets only (+95 lines), no fuzz, no rejects
patch -p1 < .../fetch-timeouts/survive-alpaca-live-client.patch
node --check bus/city/survive-executor.js bus/city/survive-alpaca-live-client.js   -> both OK

cp docs/proposals/entry-symbol-allowlist/proposed-test.js bus/tests/survive/entry-symbol-allowlist.test.js
node --test bus/tests/survive/entry-symbol-allowlist.test.js
  -> # tests 7  # pass 7  # fail 0

node bus/platform/build-system-map.js --write
  -> docs/SYSTEM-MAP.md changed by exactly one line: survive-shadow's inbound-reference count 2 -> 3 (the new
     survive-executor.js -> survive-shadow.js import); bus/lib/locations.json unchanged.
node --test bus/tests/survive/architecture.test.js   -> # tests 8  # pass 8  # fail 0 (was failing at "docs/SYSTEM-MAP.md ...
     up to date" before the --write regeneration above; passes after)

node bus/platform/run-survive-tests.js --verbose (full suite, all three 2026-09-26 patches + all three proposed test files
     installed, map regenerated)
  -> # tests 161  # pass 145  # fail 16
```

**The 16 failures are ALL in `bus/tests/survive/entry-submit-errors.test.js`** (the try/catch proposal's own test file, not
mine), and all 16 fail for the identical reason: that file's `setup()` writes a decision task directly without ever calling
`shadow.recordSnapshot()` first, so once this allow-list patch is also applied, every one of its `enter SGOV` fixtures is
refused by rule 3 above ("no candidate snapshot recorded for this mission") before reaching the submit/poll-failure scenario
each test means to exercise. This is a **test-fixture gap, not a logic conflict**: real missions always call
`shadow.recordSnapshot()` (`survive-supervisor.js:323`) before writing the decision task, so production behaviour is
unaffected. Confirmed directly: I copied that test file to a scratch location outside `docs/proposals/` (never touching the
owner's actual file), added one `sbx.load('survive-shadow').recordSnapshot(...)` call to its `setup()`, and re-ran it in the
same three-patch stack -- **17/17 pass**. **If both this patch and the try/catch patch are applied together, the try/catch
proposal's own test file needs that one-line fixture addition** (its owner's call, not made here).

## To apply (owner)
```bash
cd ~/AgentVault
patch -p1 --dry-run < docs/proposals/entry-symbol-allowlist/survive-executor.patch   # expect: checking file bus/city/survive-executor.js
patch -p1 < docs/proposals/entry-symbol-allowlist/survive-executor.patch
node --check bus/city/survive-executor.js
node bus/platform/build-system-map.js --write
cp docs/proposals/entry-symbol-allowlist/proposed-test.js bus/tests/survive/entry-symbol-allowlist.test.js
node bus/platform/run-survive-tests.js
# If docs/proposals/executor-submit-try-catch/ is ALSO being applied: add one shadow.recordSnapshot() call to that file's
# own bus/tests/survive/entry-submit-errors.test.js setup() first (see above), or its 16 tests will fail post-merge.
git add bus/city/survive-executor.js docs/SYSTEM-MAP.md bus/tests/survive/entry-symbol-allowlist.test.js && git diff --cached --stat
```
