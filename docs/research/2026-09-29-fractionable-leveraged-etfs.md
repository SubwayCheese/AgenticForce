# Fractionable check: leveraged ETFs on the live Alpaca account

Read-only verification (`getAsset`, `GET /assets/:symbol`, via `bus/city/survive-alpaca-live-client.js`, no orders placed) run
2026-09-29 against C1's LIVE Alpaca account. Resolves the `unverified` flag in `docs/C1-diagnosis-2026-09-26.md` and the
backtest prereg's unverified list.

## Raw findings

| symbol | tradable | fractionable | marginable | shortable | status | exchange |
|---|---|---|---|---|---|---|
| TQQQ | true | true | true | true | active | NASDAQ |
| SOXL | true | true | true | true | active | ARCA |
| UPRO | true | true | true | true | active | ARCA |
| QLD  | true | true | true | true | active | ARCA |
| SSO  | true | true | true | true | active | ARCA |
| SPXL | true | true | true | true | active | ARCA |
| SQQQ | true | true | true | false | active | NASDAQ |

All 7 requested symbols resolved cleanly (no errors, no delistings). Note: the task listed "UPRO" twice; it was checked once
(the table above has 7 unique symbols, not 8). All are `class: us_equity`, `status: active`.

## What this means for the 2026-09-26 backtest

**The whole-share "$20-cap variant can basically never buy" finding is moot for C1 as it actually operates.** C1's real order
path (`survive-executor.js` -> `submitOrder({ notional: decision.notionalUsd, ... })`) has always used Alpaca's `notional`
field, not `qty`. The whole-share table in `lev-backtest-descriptive-results.md` modeled a constraint C1 doesn't actually have:
since every one of these 7 leveraged/inverse ETFs is `fractionable: true` on the live account, C1 CAN legally place a $20
notional buy order in TQQQ/QLD/UPRO/SSO/SPXL/SOXL/SQQQ right now -- it does not need share price under $20 and does not need
to buy a whole share.

**This does NOT remove the $20 position cap.** Fractionability only removes the *whole-share-purchase* blocker; the account's
$50 equity and the diagnosis's ~40% position-cap policy still limit any single opening order to roughly $20 notional, same as
before. The idealized-fractional numbers already in `lev-backtest-descriptive-results.md` (S1/S2 CAGR, drawdown, Calmar vs.
TQQQ/QQQ buy-and-hold) were computed assuming continuous fractional position sizing -- i.e. they already assume exactly the
capability this check just confirmed exists. So the fractional/idealized rows of that backtest are the ones that are actually
representative of what C1 can do; the whole-share rows were never C1's real constraint and can be set aside. The caveats on
those idealized numbers stand as written: S1 traded only 3x in 6 years (too few to mean anything), S2's edge shrinks hard at
15bps costs (113 round trips = heavy whipsaw) and comes mostly from sidestepping the 2022 bear, and the sample lacks a
2008-2009-style stress period.

## Recommendation for next research-loop cycle

Since fractional trading works for all 7 symbols, the next angle should be: re-run (or relabel) the descriptive backtest's
sizing assumption explicitly as "NOTIONAL, capped at $20/position" rather than presenting a whole-share table that was never
reachable -- i.e. confirm the existing idealized-fractional S1/S2 results in `lev-backtest-descriptive-results.md` are already
the correct $20-notional-cap numbers (they should be, since the engine sizes by dollar allocation, not share count) and drop or
clearly relabel the whole-share variant as "not applicable to C1's real order path" so it stops looking like an open blocker.
If that check confirms the engine's fractional sizing already equals a $20 notional cap, the live blocker moves entirely to
strategy quality (S1's too-few trades, S2's cost sensitivity), not to instrument access -- so the follow-on angle after that is
either a third strategy family with fewer, higher-conviction trades than S2 but more signal than S1, or widening the data
window once `TIINGO_API_KEY` exists to get a pre-2020 tune sample.
