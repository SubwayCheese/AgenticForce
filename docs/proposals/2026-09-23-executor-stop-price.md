# Proposal (needs owner review -- protected file): the protective stop used the ENTRY price

**Status:** patch written, tested on a scratch copy (36/36), cross-reviewed by codex in three rounds (each round reproduced real flaws and the patch was reworked;
round 3 findings were also fixed and re-tested but not re-reviewed by a fourth round). NOT applied: `bus/city/survive-executor.js` is protected (change gate: human-review-required).

## What happened (2026-09-23 11:01 PDT, mission010)
C1 entered SGOV ($20, 0.198672205 sh @ $100.618). The stop failed: `422: stop price must be less than current price`. The
decision's exit condition said "...falls more than 0.5% below the $100.61 entry-time bid...", and `parseStopPrice` (fleet
code written for text like "closes above $390.00") returns the FIRST dollar figure -> $100.61 == the live bid. Alpaca compares
a sell-stop with the live bid, so it was rejected; because a number was returned, the 5% fallback never ran. A real position
sat with no stop until it was placed by hand at $100.11 (day order) on the owner's delegation.

## The fix
`resolveStopPrice(condition, {fill, bid})` replaces the first-dollar heuristic. A $ amount counts only when phrased as a stop
("below $95", "stop at $95", "falls to $95" -- NOT a reference like "the $100.61 entry bid"); a percentage counts only when
measured off entry/bid ("5% below entry", not "1% below average"); negatives, ranges and exponents are rejected. Candidates
must be below the live bid and within 30% of it; the TIGHTEST valid one wins (0-2bp under the bid is clamped to 2bp under);
otherwise the 5% fallback off the fill clamped into the same band. Every result is re-validated after rounding (finite, > 0,
strictly below the market) or returns null so the existing loud "unprotected position" alert fires. `placeProtectiveStop`
fetches the live bid first (5s timeout, tolerates a client without `getLatestQuote`) and, if the broker still rejects, retries
with a FRESH bid and never a higher price. Exports `placeProtectiveStop` and `resolveStopPrice`.

**Better long-term (a decision for you, larger change):** have the decision JSON carry a structured `stopPrice` field that
code validates, and stop reading levels out of prose at all. The remaining ambiguity in free text is inherent.

## Files (this folder: `docs/proposals/executor-stop-price/`)
- `survive-executor.patch` -- the change (unified diff against the current file)
- `verify.test.js` -- 36 tests run against a SCRATCH copy: `node --test docs/proposals/executor-stop-price/verify.test.js`
  (includes every scenario codex reproduced against the first draft, a control test that reproduces the original bug on the
  unpatched code, and the mission010 text end to end)

## To apply (owner)
```bash
cd ~/AgentVault
node --test docs/proposals/executor-stop-price/verify.test.js     # expect 36 pass
patch -p1 < docs/proposals/executor-stop-price/survive-executor.patch
node bus/platform/run-survive-tests.js                            # expect all green
git add bus/city/survive-executor.js && git commit -m "Executor: resolve protective stop below the live bid"
```
Then move the CASES table from `verify.test.js` into `bus/tests/survive/` (it needs no scratch patching once applied).

## Still open (a decision, not part of this patch)
Fractional-quantity stops can only be `day` orders on Alpaca, so a placed stop expires at the close and is not re-armed --
an overnight gap is unprotected. Options: re-arm at every market-hours wake, or size entries in whole shares.
