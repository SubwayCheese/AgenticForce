# Research loop status (auto-updated every cycle)

Last updated: 2026-09-29, cycle 2. Full history: `bus/fleet/data/research-loop-log.jsonl`. Loop mechanics, boundaries,
and durability caveat: `docs/HANDOFF.md` ("2026-09-29: autonomous research/revenue loop").

## Current bottom line
The 2026-09-26 leveraged-ETF trend-following idea (S1 200-day trend, S2 fast-exit), run correctly against C1's real
$20 position cap and a correctly-uncapped buy-and-hold benchmark: **FAIL**. Neither S1 nor S2 beats plain buy-and-hold
QQQ on after-cost CAGR (13.9%/15.2% vs 15.5%), even though both beat buy-and-hold TQQQ on drawdown. Not a data
problem, not a statistics problem -- a real, tested result on the (short, ~6-year) sample available.

**This supersedes two earlier, wrong readings from the same day:** (1) "moot for C1 -- can't even buy" was wrong,
fractionability is confirmed (see `docs/research/2026-09-29-fractionable-leveraged-etfs.md`). (2) The
follow-up "INCONCLUSIVE, both strategies beat their benchmarks" was ALSO wrong -- caused by a real bug in
`bus/fleet/lev-backtest-engine.js` where the $20 cap was silently unenforced on the fractional sizing path (and,
once partially fixed, was wrongly also capping the buy-and-hold benchmark). Both are now fixed and covered by 2 new
regression tests (35/35 pass, `node bus/fleet/lev-backtest-selftest.js`; each new test verified to fail against the
pre-fix code).

## What's proven out
- Fractional trading of TQQQ/SOXL/UPRO/QLD/SSO/SPXL/SQQQ works on the live account (confirmed, read-only, no orders).
- The backtest engine is now honest about C1's real constraints: a $20-capped single entry, no rebalancing while
  holding (C1 can't place a second order on an open position), vs. a properly uncapped buy-and-hold benchmark.
- The $20 cap (40% of a $50 account) appears to be the real drag, not the trend rules themselves -- S1/S2 both win on
  risk (drawdown, Calmar) but lose on raw CAGR to a benchmark that gets to use the whole account.

## Not yet tried (queued)
- **Cap sensitivity:** rerun the same descriptive backtest at cap=30/40/50 (still `bus/fleet/data/`, still descriptive,
  no code/policy change) to see whether the CAGR gap is cap-driven (testable, non-defeatist next step -- if a larger
  cap flips the verdict, that's a real lever: whether C1's budget-envelope policy itself is worth revisiting becomes
  the owner's call, not mine to decide or apply).
- Third strategy family with fewer, higher-conviction trades than S2 (113 round trips = heavy whipsaw) but a real
  signal, unlike S1 (only 3 trades in 6 years).
- Free data source with no signup, to widen the sample past 2020-07-27 (owner could not get a `TIINGO_API_KEY`).
- `executeExit`'s try/catch gap (same class of bug already fixed on the entry side 2026-09-29).
- Productizing this backtest/research pipeline itself as a separate revenue line from the course.

## Boundaries unchanged
No live orders. No edits to protected files without an owner-reviewed proposal. Nothing here changes C1's live
behavior -- all of it is descriptive backtesting in unprotected `bus/fleet/` files.
