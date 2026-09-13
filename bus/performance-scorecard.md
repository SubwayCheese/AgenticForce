# Paper-trading performance scorecard

Generated 2026-09-13T05:24:31.537Z from `bus/paper-trades.jsonl` + `bus/trading-journal.jsonl`.

> Cost-adjusted figures subtract an **estimated** round-trip transaction cost of 0.2% (equities) / 0.05% (crypto). These are assumptions, not measured costs -- the paper account fills commission- and spread-free. Recalibrate before treating any net figure as real.

## Headline

Across 4 closed trade(s): **-0.13% per trade raw**, **-0.29% cost-adjusted**, versus **-0.39%** for the benchmark over the same periods (3 of 4 trade(s) benchmarked). Win rate 0.0%. Mean entry slippage +0.29% -- larger in magnitude than the mean P&L itself, i.e. execution quality, not thesis quality, dominates these results.

> Short positions are present. The benchmark is a LONG hold of SPY/BTC, so "excess vs benchmark" on a short row is not alpha -- see the per-trade caveats.

**Overall** -- 4 closed trade(s), 4 with usable fill prices.

| Metric | Value |
| --- | --- |
| Win rate | 0.0% (0W / 4L) |
| Mean P&L per trade | -0.13% |
| Mean cost-adjusted P&L per trade | -0.29% |
| Total realized P&L (dollars) | -$14.32 |
| Mean entry slippage (positive = adverse) | +0.29% across 3 trade(s) |
| Mean benchmark return, same periods | -0.39% |
| Mean excess vs benchmark (cost-adjusted) | +0.05% |

> **Trades from more than one sizing era are present -- "overall" equal-weights them despite very different real dollar exposure per trade. Use byEra for an honest read; treat "overall" as a rough, cost-of-doing-business number only.**

**Equities (benchmark SPY)** -- 3 closed trade(s), 3 with usable fill prices.

| Metric | Value |
| --- | --- |
| Win rate | 0.0% (0W / 3L) |
| Mean P&L per trade | -0.14% |
| Mean cost-adjusted P&L per trade | -0.34% |
| Total realized P&L (dollars) | -$14.31 |
| Mean entry slippage (positive = adverse) | +0.29% across 3 trade(s) |
| Mean benchmark return, same periods | -0.39% |
| Mean excess vs benchmark (cost-adjusted) | +0.05% |

**Crypto (benchmark BTC/USD)** -- 1 closed trade(s), 1 with usable fill prices.

| Metric | Value |
| --- | --- |
| Win rate | 0.0% (0W / 1L) |
| Mean P&L per trade | -0.12% |
| Mean cost-adjusted P&L per trade | -0.17% |
| Total realized P&L (dollars) | -$0.01 |
| Mean entry slippage (positive = adverse) | not measurable (1/1 entries have no modeledEntry) |
| Mean benchmark return, same periods | n/a |
| Mean excess vs benchmark (cost-adjusted) | n/a |

## By sizing era

**larger-sized (>=$100)** -- 3 closed trade(s), 3 with usable fill prices.

| Metric | Value |
| --- | --- |
| Win rate | 0.0% (0W / 3L) |
| Mean P&L per trade | -0.14% |
| Mean cost-adjusted P&L per trade | -0.34% |
| Total realized P&L (dollars) | -$14.31 |
| Mean entry slippage (positive = adverse) | +0.29% across 3 trade(s) |
| Mean benchmark return, same periods | -0.39% |
| Mean excess vs benchmark (cost-adjusted) | +0.05% |

**micro-sized (<$100)** -- 1 closed trade(s), 1 with usable fill prices.

| Metric | Value |
| --- | --- |
| Win rate | 0.0% (0W / 1L) |
| Mean P&L per trade | -0.12% |
| Mean cost-adjusted P&L per trade | -0.17% |
| Total realized P&L (dollars) | -$0.01 |
| Mean entry slippage (positive = adverse) | not measurable (1/1 entries have no modeledEntry) |
| Mean benchmark return, same periods | n/a |
| Mean excess vs benchmark (cost-adjusted) | n/a |

## Per-trade detail

| Symbol | Dir | Entry -> Exit | P&L | Cost-adj | Slippage | Benchmark | Excess |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TSLA | short | 2026-09-08 -> 2026-09-08 (9.7h) | -0.19% | -0.39% | +0.37% | SPY -0.39% | +0.00% |
| GOOGL | short | 2026-09-08 -> 2026-09-08 (9.7h) | -0.08% | -0.28% | +0.29% | SPY -0.39% | +0.11% |
| CSCO | short | 2026-09-08 -> 2026-09-08 (9.7h) | -0.15% | -0.35% | +0.19% | SPY -0.39% | +0.04% |
| BTC/USD | long | 2026-09-09 -> 2026-09-09 (2.6h) | -0.12% | -0.17% | n/a | BTC/USD -0.22% | +0.05% |

### Per-trade notes

- **TSLA** (short, lot `legacy/none`): entered $366.404, exited $367.096, -0.19% raw / -0.39% cost-adjusted, vs SPY -0.39% over the same period (single-session-open-to-close). Entry slippage +0.37% vs modeled $367.77.
  - benchmark basis: entry and exit fall in the same ET session (2026-09-08); daily bars cannot express a shorter hold, so this is that session's own open-to-close move -- an APPROXIMATION, not the exact overlapping window
  - CAVEAT: short position measured against a long benchmark -- a positive excess here does NOT mean the short worked, only that the market moved less favourably than the loss
  - exit: reconciled: position no longer open on account (stop order or manual close), no matching exit record existed
  - journal lesson: No: the valuation/profitability-disconnect thesis did not predict the immediate move, because the short entered at $366.404 and exited higher at $367.096. The bear case correctly identified extreme valuation and an unproven rally catalyst, but it did not establish near-term downside timing; the cited 11.15% rally remained the dominant short-horizon signal.
- **GOOGL** (short, lot `legacy/none`): entered $338.151, exited $338.41, -0.08% raw / -0.28% cost-adjusted, vs SPY -0.39% over the same period (single-session-open-to-close). Entry slippage +0.29% vs modeled $339.14.
  - benchmark basis: entry and exit fall in the same ET session (2026-09-08); daily bars cannot express a shorter hold, so this is that session's own open-to-close move -- an APPROXIMATION, not the exact overlapping window
  - CAVEAT: short position measured against a long benchmark -- a positive excess here does NOT mean the short worked, only that the market moved less favourably than the loss
  - exit: reconciled: position no longer open on account (stop order or manual close), no matching exit record existed
  - journal lesson: No: despite negative prior price confirmation and concerns about the anomalous EPS figure, GOOGL rose from the $338.151 short entry to the $338.410 exit. The thesis emphasized earnings-quality and valuation-reset risk, but the small immediate reversal suggests those concerns were not enough to overcome the revenue beat and strong 31.83% ROE on this trade's horizon.
- **CSCO** (short, lot `legacy/none`): entered $108.84, exited $109, -0.15% raw / -0.35% cost-adjusted, vs SPY -0.39% over the same period (single-session-open-to-close). Entry slippage +0.19% vs modeled $109.05.
  - benchmark basis: entry and exit fall in the same ET session (2026-09-08); daily bars cannot express a shorter hold, so this is that session's own open-to-close move -- an APPROXIMATION, not the exact overlapping window
  - CAVEAT: short position measured against a long benchmark -- a positive excess here does NOT mean the short worked, only that the market moved less favourably than the loss
  - exit: reconciled: position no longer open on account (stop order or manual close), no matching exit record existed
  - journal lesson: No: the prior 11.03% decline and unfavorable valuation did not continue after entry; the short entered at $108.840 and exited at $109.000. The thesis correctly recognized weak trailing price action, but shorting after an already deep decline ignored that CSCO had beaten both EPS and revenue and was trading below stated target ranges, leaving reversal risk insufficiently addressed.
- **BTC/USD** (long, lot `legacy/none`): entered $78670.342, exited $78579.314, -0.12% raw / -0.17% cost-adjusted, vs BTC/USD -0.22% over the same period (single-session-open-to-close). Slippage not measurable: entry record has no modeledEntry (pre-2026-09-11 records hardcoded null).
  - benchmark basis: entry and exit fall in the same UTC day (2026-09-09); daily bars cannot express a shorter hold, so this is that session's own open-to-close move -- an APPROXIMATION, not the exact overlapping window -- NOTE: this trade IS the benchmark asset, so its excess return is definitionally near zero and carries no information
  - exit: time-based exit: 2.6 hours elapsed, deadline was 2
  - journal lesson: The stated reasoning cannot be evaluated because the stance, bull case, bear case, and rationale were undefined. Concretely, BTC/USD fell from $78,670.342 to $78,579.314 before the 2.6-hour time-based exit, so the long lost $90. followed by a scheduled exit without a documented thesis or invalidation level.

## Still open (not scored)

- ETH/USD -- entered 2026-09-10T23:11:35.731Z, lot `legacy/none`, from crypto_pilot_20260910_synthesis_r3_portfolio_v2
- VZ -- entered 2026-09-11T17:06:08.002Z, lot `legacy/none`, from fleet_pilot_20260910_synthesis_r3_portfolio_v2
- VZ -- entered 2026-09-11T19:12:22.465Z, lot `legacy/none`, from fleet_pilot_20260911_synthesis_r3_portfolio
- MSFT -- entered 2026-09-11T19:42:22.284Z, lot `legacy/none`, from fleet_pilot_20260910_synthesis_r3_portfolio_v2
- ARB/USD -- entered 2026-09-12T02:42:23.763Z, lot `5376b6d6-a2e7-4c58-b16b-2b8c5a942849`, from crypto_pilot_20260912_synthesis_r3_portfolio
- LTC/USD -- entered 2026-09-12T02:42:36.749Z, lot `550497d7-02cf-4763-a872-2ebd70ce40f6`, from crypto_pilot_20260912_synthesis_r3_portfolio
