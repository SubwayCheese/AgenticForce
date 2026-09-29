# Leveraged-ETF trend backtest: DESCRIPTIVE results (prereg v2)

> **SENSITIVITY RUN: position cap $50** per strategy entry, instead of the prereg's $20 (C1's real budget-envelope rule). This is a what-if on the cap only; it is not the prereg's canonical run, and C1's live cap is unchanged. Benchmarks are uncapped as always.

Prereg v2 sha256 (verified): `16fc0c616d0563b4a8b9acc306e468628af90f8c7ed641b60f0de0b291fbdfa1`. Mode: descriptive. Canonical configs fixed in advance; nothing was tuned and no config was picked from any table. Cost model: 5 bps/side base, 15 bps/side stress, no added expense ratio, cash leg BIL. Warm-up 250 aligned bars.

## Verdict on the two primary hypotheses: INCONCLUSIVE

> This mode can only return INCONCLUSIVE or FAIL. Even INCONCLUSIVE means only that the canonical rules beat the benchmarks on one short sample; it is not evidence the strategy will work going forward.

FAIL if either primary hypothesis (S1 or S2 on QQQ->TQQQ, full span, 5 bps) does not beat TQQQ buy-and-hold on max drawdown AND Calmar, or does not beat QQQ buy-and-hold CAGR after costs. INCONCLUSIVE otherwise.

### S1 on QQQ->TQQQ: both criteria met

| criterion | result | values |
|---|---|---|
| max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span) | met | maxDD 50.6% vs 81.7%; Calmar 0.44 vs 0.23 |
| after-cost CAGR (5 bps) > underlying buy-and-hold (full span) | met | 22.2% vs 15.5% |

at 15 bps (informational, not gating): maxDD 50.7% vs 81.7%; Calmar 0.44 vs 0.23; CAGR 22.1% vs 15.5%

### S2 on QQQ->TQQQ: both criteria met

| criterion | result | values |
|---|---|---|
| max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span) | met | maxDD 42.7% vs 81.7%; Calmar 0.58 vs 0.23 |
| after-cost CAGR (5 bps) > underlying buy-and-hold (full span) | met | 25.0% vs 15.5% |

at 15 bps (informational, not gating): maxDD 43.7% vs 81.7%; Calmar 0.52 vs 0.23; CAGR 22.8% vs 15.5%

Completed round trips on QQQ->TQQQ, full span, 5 bps: S1 3, S2 113. Counts this small are too few for confidence intervals to mean anything, so none are computed.

## Disclosures (verbatim from the prereg)

- Stress period 2008-2009 is absent from Alpaca IEX history; maximum-drawdown figures are NOT the historical worst case for these instruments.
- IEX bars are one exchange's prints; the 'open' is IEX's first trade, not the official opening auction.
- Round-trip counts in the evaluation span will be small; confidence intervals are illustrative only.
- Sample is 2020-07-27 to 2026-09-25 (~6 years) with essentially one bear market; the tune window is not used; nothing here can establish a durable edge.

## Data

Bars dated before 2020-07-27 are dropped before any computation. Cached bars per symbol:

| symbol | cached bars | first cached date | dropped (before start) | last date used |
|---|---|---|---|---|
| QQQ | 1550 | 2020-07-27 | none | 2026-09-25 |
| SPY | 1551 | 2018-11-01 | 2018-11-01 | 2026-09-25 |
| TQQQ | 1550 | 2020-07-27 | none | 2026-09-25 |
| QLD | 1550 | 2020-07-27 | none | 2026-09-25 |
| UPRO | 1550 | 2020-07-27 | none | 2026-09-25 |
| SSO | 1550 | 2020-07-27 | none | 2026-09-25 |
| BIL | 1536 | 2020-07-27 | none | 2026-09-25 |
| SHY | 1550 | 2020-07-27 | none | 2026-09-25 |

Each pair is aligned by INTERSECTION of underlying, traded ETF and BIL dates; dates lost to alignment:

- QQQ->TQQQ: 1536 aligned days (2020-07-27 to 2026-09-25); lost to alignment: QQQ 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12; TQQQ 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12
- QQQ->QLD: 1536 aligned days (2020-07-27 to 2026-09-25); lost to alignment: QQQ 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12; QLD 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12
- QQQ->QQQ: 1536 aligned days (2020-07-27 to 2026-09-25); lost to alignment: QQQ 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12; QQQ 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12
- SPY->UPRO: 1536 aligned days (2020-07-27 to 2026-09-25); lost to alignment: SPY 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12; UPRO 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12
- SPY->SSO: 1536 aligned days (2020-07-27 to 2026-09-25); lost to alignment: SPY 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12; SSO 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12
- SPY->SPY: 1536 aligned days (2020-07-27 to 2026-09-25); lost to alignment: SPY 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12; SPY 2020-10-29, 2020-11-12, 2020-12-17, 2021-01-20, 2021-03-16, 2021-04-05, 2021-05-21, 2021-06-16, 2021-06-18, 2021-07-22, 2021-08-10, 2021-08-30, 2021-09-15, 2021-10-12

Signals use the underlying's close at t and fill at the traded ETF's open at t+1; each span's equity curve starts at the close before its first possible fill. Signals are causal and computed on all earlier history. Sharpe is daily, annualised by sqrt(252), rf=0; CAGR uses years = daily returns / 252; ulcer index is in percent units. Fills are IEX first prints.

Multiple testing: N = 186 configs (the sensitivity grid: 31 configs x 6 pairs, listed in the prereg). Deflated Sharpe uses V[SR] = 1/(T-1).

## Canonical configs by pair and span

### QQQ->TQQQ (leverage 3)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 178.5% | 22.2% | 50.6% | 0.44 | 0.69 | -35.4% (2022-01) | 24.73 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 177.3% | 22.1% | 50.7% | 0.44 | 0.69 | -35.5% (2022-01) | 24.78 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 211.7% | 25.0% | 42.7% | 0.58 | 0.90 | -29.2% (2022-01) | 22.02 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 185.6% | 22.8% | 43.7% | 0.52 | 0.82 | -30.0% (2022-01) | 22.82 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 69.7% | 10.9% | 27.6% | 0.40 | 0.61 | -21.6% (2022-01) | 14.76 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 69.2% | 10.9% | 27.6% | 0.39 | 0.60 | -21.6% (2022-01) | 14.79 | 3 | 1.4 | 76% |
| buy-and-hold TQQQ | 144.4% | 19.1% | 81.7% | 0.23 | 0.60 | -37.2% (2022-04) | 41.89 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -35.3% | -35.4% | 37.4% | -0.95 | -2.12 | -36.1% (2022-01) | 36.28 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -35.4% | -35.5% | 37.4% | -0.95 | -2.12 | -36.3% (2022-01) | 36.34 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -36.3% | -36.5% | 38.4% | -0.95 | -2.23 | -30.1% (2022-01) | 37.12 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -37.4% | -37.5% | 39.3% | -0.95 | -2.30 | -30.9% (2022-01) | 38.01 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -8.9% | -9.0% | 10.7% | -0.84 | -1.86 | -10.2% (2022-01) | 10.14 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.0% | -9.0% | 10.7% | -0.84 | -1.87 | -10.2% (2022-01) | 10.15 | 1 | 2.0 | 6% |
| buy-and-hold TQQQ | -79.3% | -79.4% | 81.0% | -0.98 | -1.15 | -37.2% (2022-04) | 61.20 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 229.8% | 37.9% | 37.3% | 1.02 | 0.96 | -20.5% (2025-03) | 17.92 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 228.9% | 37.8% | 37.3% | 1.01 | 0.96 | -20.6% (2025-03) | 17.98 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 271.5% | 42.4% | 19.5% | 2.17 | 1.53 | -7.4% (2026-07) | 6.75 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 250.1% | 40.1% | 21.5% | 1.86 | 1.44 | -8.3% (2023-10) | 7.47 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 90.7% | 19.0% | 20.9% | 0.91 | 0.92 | -10.7% (2025-03) | 8.72 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 90.3% | 18.9% | 20.9% | 0.91 | 0.92 | -10.7% (2025-03) | 8.74 | 2 | 1.3 | 92% |
| buy-and-hold TQQQ | 838.6% | 82.7% | 58.0% | 1.43 | 1.30 | -23.3% (2025-03) | 15.69 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 94.5% | 29.8% | 50.6% | 0.59 | 0.84 | -35.4% (2022-01) | 29.42 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 94.0% | 29.6% | 50.7% | 0.58 | 0.84 | -35.5% (2022-01) | 29.47 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 101.0% | 31.5% | 42.7% | 0.74 | 0.96 | -29.2% (2022-01) | 29.95 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 91.5% | 29.0% | 43.7% | 0.66 | 0.90 | -30.0% (2022-01) | 30.78 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 30.6% | 11.0% | 27.6% | 0.40 | 0.66 | -21.6% (2022-01) | 18.23 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 30.4% | 11.0% | 27.6% | 0.40 | 0.66 | -21.6% (2022-01) | 18.26 | 1 | 1.2 | 60% |
| buy-and-hold TQQQ | -6.9% | -2.7% | 81.7% | -0.03 | 0.33 | -37.2% (2022-04) | 55.66 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 83.7% | 26.9% | 37.3% | 0.72 | 0.73 | -20.5% (2025-03) | 17.87 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 83.1% | 26.7% | 37.3% | 0.72 | 0.72 | -20.6% (2025-03) | 17.91 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 104.2% | 32.3% | 30.4% | 1.06 | 0.90 | -13.4% (2026-07) | 14.25 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 87.9% | 28.0% | 31.0% | 0.90 | 0.80 | -15.0% (2026-07) | 15.78 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 31.8% | 11.4% | 18.2% | 0.63 | 0.63 | -9.2% (2025-03) | 8.49 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 31.6% | 11.4% | 18.2% | 0.62 | 0.62 | -9.2% (2025-03) | 8.51 | 2 | 2.0 | 92% |
| buy-and-hold TQQQ | 167.8% | 47.1% | 58.0% | 0.81 | 0.92 | -23.3% (2025-03) | 17.44 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR 3.1% points, max drawdown -31.1% points (negative = less drawdown), Calmar 0.21, time in market 76% (average exposure 65%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR 5.8% points, max drawdown -39.0% points (negative = less drawdown), Calmar 0.35, time in market 63% (average exposure 42%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -8.2% points, max drawdown -54.1% points (negative = less drawdown), Calmar 0.16, time in market 76% (average exposure 32%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0435, SR0 0.0765 (annualised 1.21), DSR 0.121, round trips 3
- S2: daily SR 0.0565, SR0 0.0765 (annualised 1.21), DSR 0.239, round trips 113
- S3: daily SR 0.0381, SR0 0.0765 (annualised 1.21), DSR 0.087, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 32.55 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 136.60 | 21.8% | 39.0% | 3 | 0 | 136.26 | 0 |
| full | S2 | 144.66 | 23.1% | 32.6% | 91 | 86 | 137.18 | 86 |
| full | S3 | 78.58 | 9.3% | 19.6% | 2 | 251 | 78.46 | 251 |
| y2022 | S1 | 36.06 | -28.0% | 29.9% | 1 | 0 | 35.99 | 0 |
| y2022 | S2 | 35.08 | -29.9% | 31.9% | 8 | 0 | 34.55 | 0 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 160.68 | 36.9% | 37.2% | 2 | 0 | 160.37 | 0 |
| from2023 | S2 | 166.91 | 38.3% | 17.3% | 75 | 86 | 160.61 | 86 |
| from2023 | S3 | 77.79 | 12.6% | 19.7% | 2 | 138 | 77.66 | 138 |
| firstHalf | S1 | 97.76 | 30.1% | 39.0% | 1 | 0 | 97.66 | 0 |
| firstHalf | S2 | 92.44 | 27.2% | 32.6% | 40 | 0 | 89.46 | 0 |
| firstHalf | S3 | 70.89 | 14.7% | 11.1% | 0 | 113 | 70.87 | 113 |
| secondHalf | S1 | 89.58 | 25.7% | 30.2% | 2 | 0 | 89.39 | 0 |
| secondHalf | S2 | 98.60 | 30.5% | 21.1% | 51 | 86 | 91.80 | 86 |
| secondHalf | S3 | 46.00 | -3.2% | 31.8% | 2 | 234 | 45.85 | 234 |

### QQQ->QLD (leverage 2)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 138.3% | 18.6% | 36.1% | 0.51 | 0.75 | -25.3% (2022-01) | 16.45 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 137.2% | 18.4% | 36.2% | 0.51 | 0.75 | -25.4% (2022-01) | 16.51 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 157.8% | 20.4% | 28.7% | 0.71 | 1.02 | -19.9% (2022-01) | 14.44 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 131.8% | 17.9% | 29.9% | 0.60 | 0.89 | -21.0% (2022-01) | 15.40 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 73.6% | 11.4% | 26.9% | 0.42 | 0.70 | -21.9% (2022-01) | 13.35 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 72.9% | 11.3% | 27.0% | 0.42 | 0.69 | -21.9% (2022-01) | 13.40 | 3 | 1.4 | 76% |
| buy-and-hold QLD | 152.7% | 19.9% | 63.7% | 0.31 | 0.63 | -26.1% (2022-04) | 28.23 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -24.5% | -24.6% | 26.4% | -0.93 | -2.14 | -25.6% (2022-01) | 25.54 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -24.7% | -24.8% | 26.5% | -0.94 | -2.16 | -25.7% (2022-01) | 25.61 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -25.5% | -25.5% | 27.6% | -0.93 | -2.19 | -20.8% (2022-01) | 26.24 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -26.6% | -26.7% | 28.6% | -0.94 | -2.28 | -21.8% (2022-01) | 27.29 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -9.6% | -9.6% | 11.2% | -0.85 | -1.96 | -10.8% (2022-01) | 10.69 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.6% | -9.7% | 11.3% | -0.86 | -1.97 | -10.9% (2022-01) | 10.71 | 1 | 2.0 | 6% |
| buy-and-hold QLD | -61.2% | -61.3% | 63.1% | -0.97 | -1.17 | -26.1% (2022-04) | 45.09 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 164.2% | 29.9% | 26.3% | 1.14 | 1.04 | -13.8% (2025-03) | 10.58 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 163.4% | 29.8% | 26.3% | 1.13 | 1.03 | -13.9% (2025-03) | 10.62 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 182.9% | 32.3% | 14.5% | 2.22 | 1.59 | -5.9% (2026-07) | 4.91 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 161.7% | 29.6% | 17.1% | 1.73 | 1.45 | -6.9% (2026-07) | 5.76 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 93.7% | 19.5% | 16.6% | 1.17 | 1.08 | -8.4% (2025-03) | 6.13 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 93.2% | 19.4% | 16.6% | 1.17 | 1.08 | -8.5% (2025-03) | 6.15 | 2 | 1.3 | 92% |
| buy-and-hold QLD | 446.7% | 58.0% | 42.4% | 1.37 | 1.33 | -15.8% (2025-03) | 10.06 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 67.0% | 22.2% | 36.1% | 0.62 | 0.88 | -25.3% (2022-01) | 20.24 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 66.5% | 22.1% | 36.2% | 0.61 | 0.88 | -25.4% (2022-01) | 20.30 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 74.3% | 24.3% | 28.7% | 0.85 | 1.08 | -19.9% (2022-01) | 19.61 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 64.8% | 21.6% | 29.9% | 0.72 | 0.97 | -21.0% (2022-01) | 20.66 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 28.5% | 10.3% | 26.9% | 0.38 | 0.67 | -21.9% (2022-01) | 17.52 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 28.2% | 10.2% | 27.0% | 0.38 | 0.66 | -21.9% (2022-01) | 17.58 | 1 | 1.2 | 60% |
| buy-and-hold QLD | 13.9% | 5.2% | 63.7% | 0.08 | 0.35 | -26.1% (2022-04) | 38.27 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 66.5% | 22.1% | 26.4% | 0.84 | 0.77 | -13.8% (2025-03) | 11.45 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 65.9% | 21.9% | 26.4% | 0.83 | 0.76 | -13.9% (2025-03) | 11.49 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 78.0% | 25.4% | 21.3% | 1.19 | 0.97 | -9.4% (2026-07) | 9.10 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 62.1% | 20.8% | 22.0% | 0.95 | 0.81 | -11.1% (2026-07) | 10.55 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 36.3% | 12.9% | 17.6% | 0.73 | 0.72 | -9.0% (2025-03) | 7.46 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 36.0% | 12.8% | 17.6% | 0.73 | 0.72 | -9.0% (2025-03) | 7.49 | 2 | 2.0 | 92% |
| buy-and-hold QLD | 125.1% | 37.4% | 42.4% | 0.88 | 0.96 | -15.8% (2025-03) | 11.15 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -1.4% points, max drawdown -27.6% points (negative = less drawdown), Calmar 0.20, time in market 76% (average exposure 66%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR 0.5% points, max drawdown -34.9% points (negative = less drawdown), Calmar 0.40, time in market 63% (average exposure 44%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -8.5% points, max drawdown -36.8% points (negative = less drawdown), Calmar 0.11, time in market 76% (average exposure 42%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0474, SR0 0.0765 (annualised 1.21), DSR 0.151, round trips 3
- S2: daily SR 0.0643, SR0 0.0765 (annualised 1.21), DSR 0.332, round trips 113
- S3: daily SR 0.0438, SR0 0.0765 (annualised 1.21), DSR 0.124, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 38.33 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 82.81 | 10.4% | 25.8% | 3 | 125 | 82.54 | 125 |
| full | S2 | 90.25 | 12.3% | 23.9% | 66 | 292 | 84.63 | 292 |
| full | S3 | 76.14 | 8.6% | 23.2% | 2 | 358 | 75.98 | 358 |
| y2022 | S1 | 39.17 | -21.7% | 23.5% | 1 | 0 | 39.09 | 0 |
| y2022 | S2 | 38.51 | -23.1% | 25.1% | 8 | 0 | 37.87 | 0 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 109.21 | 23.4% | 25.3% | 2 | 125 | 108.95 | 125 |
| from2023 | S2 | 97.24 | 19.6% | 12.2% | 50 | 292 | 93.07 | 292 |
| from2023 | S3 | 81.43 | 14.0% | 16.8% | 1 | 357 | 81.35 | 357 |
| firstHalf | S1 | 67.48 | 12.5% | 25.8% | 1 | 0 | 67.38 | 0 |
| firstHalf | S2 | 80.00 | 20.2% | 23.9% | 40 | 0 | 77.14 | 0 |
| firstHalf | S3 | 69.00 | 13.5% | 23.2% | 1 | 22 | 68.90 | 22 |
| secondHalf | S1 | 64.05 | 10.2% | 23.3% | 2 | 125 | 63.84 | 125 |
| secondHalf | S2 | 57.53 | 5.7% | 19.6% | 26 | 292 | 55.05 | 292 |
| secondHalf | S3 | 54.78 | 3.6% | 23.6% | 1 | 399 | 54.69 | 399 |

### QQQ->QQQ (leverage 1)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 86.9% | 13.0% | 18.4% | 0.71 | 0.94 | -13.1% (2022-01) | 8.09 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 85.9% | 12.9% | 18.5% | 0.70 | 0.93 | -13.2% (2022-01) | 8.15 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 80.3% | 12.2% | 16.4% | 0.75 | 1.08 | -10.9% (2022-01) | 8.20 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 55.1% | 9.0% | 17.9% | 0.50 | 0.77 | -11.9% (2022-01) | 9.30 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 81.5% | 12.4% | 17.7% | 0.70 | 0.94 | -13.1% (2022-01) | 7.92 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 80.6% | 12.3% | 17.8% | 0.69 | 0.93 | -13.2% (2022-01) | 7.98 | 3 | 1.4 | 76% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -12.3% | -12.4% | 14.1% | -0.88 | -2.03 | -13.5% (2022-01) | 13.43 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -12.5% | -12.5% | 14.1% | -0.89 | -2.06 | -13.7% (2022-01) | 13.51 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -13.2% | -13.2% | 14.9% | -0.89 | -2.17 | -11.3% (2022-01) | 14.19 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -14.6% | -14.6% | 16.2% | -0.90 | -2.36 | -12.3% (2022-01) | 15.41 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -10.2% | -10.2% | 11.9% | -0.86 | -1.99 | -11.4% (2022-01) | 11.31 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -10.3% | -10.4% | 12.0% | -0.87 | -2.01 | -11.6% (2022-01) | 11.38 | 1 | 2.0 | 6% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 94.6% | 19.6% | 13.5% | 1.45 | 1.26 | -6.9% (2025-03) | 4.69 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 94.0% | 19.5% | 13.5% | 1.45 | 1.26 | -6.9% (2025-03) | 4.72 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 93.3% | 19.4% | 8.2% | 2.38 | 1.67 | -4.0% (2026-07) | 2.91 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 72.2% | 15.8% | 11.4% | 1.39 | 1.33 | -5.4% (2023-10) | 4.02 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 89.2% | 18.7% | 12.4% | 1.51 | 1.29 | -6.3% (2025-03) | 4.27 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 88.5% | 18.6% | 12.4% | 1.50 | 1.28 | -6.4% (2025-03) | 4.30 | 2 | 1.3 | 92% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 38.8% | 13.7% | 18.4% | 0.75 | 1.02 | -13.1% (2022-01) | 10.17 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 38.4% | 13.6% | 18.5% | 0.73 | 1.01 | -13.2% (2022-01) | 10.24 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 36.1% | 12.8% | 16.4% | 0.78 | 1.09 | -10.9% (2022-01) | 11.06 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 27.2% | 9.9% | 17.9% | 0.55 | 0.85 | -11.9% (2022-01) | 12.22 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 34.3% | 12.2% | 17.7% | 0.69 | 0.98 | -13.1% (2022-01) | 10.13 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 33.9% | 12.1% | 17.8% | 0.68 | 0.97 | -13.2% (2022-01) | 10.20 | 1 | 1.2 | 60% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 43.7% | 15.3% | 13.5% | 1.13 | 0.94 | -6.9% (2025-03) | 5.30 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 43.1% | 15.1% | 13.5% | 1.11 | 0.93 | -7.0% (2025-03) | 5.35 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 41.2% | 14.5% | 10.9% | 1.32 | 1.03 | -5.6% (2026-07) | 4.70 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 25.6% | 9.3% | 11.7% | 0.80 | 0.67 | -7.3% (2026-07) | 6.17 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 41.6% | 14.6% | 13.5% | 1.08 | 0.94 | -6.9% (2025-03) | 5.27 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 41.0% | 14.4% | 13.5% | 1.06 | 0.93 | -7.0% (2025-03) | 5.31 | 2 | 2.0 | 92% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -2.5% points, max drawdown -16.6% points (negative = less drawdown), Calmar 0.27, time in market 76% (average exposure 67%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -3.3% points, max drawdown -18.6% points (negative = less drawdown), Calmar 0.30, time in market 63% (average exposure 50%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -3.1% points, max drawdown -17.3% points (negative = less drawdown), Calmar 0.26, time in market 76% (average exposure 64%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0590, SR0 0.0765 (annualised 1.21), DSR 0.268, round trips 3
- S2: daily SR 0.0678, SR0 0.0765 (annualised 1.21), DSR 0.379, round trips 113
- S3: daily SR 0.0593, SR0 0.0765 (annualised 1.21), DSR 0.271, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 356.56 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 59.79 | 3.6% | 0.1% | 0 | 975 | 59.79 | 975 |
| full | S2 | 59.79 | 3.6% | 0.1% | 0 | 810 | 59.79 | 810 |
| full | S3 | 59.79 | 3.6% | 0.1% | 0 | 975 | 59.79 | 975 |
| y2022 | S1 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| y2022 | S2 | 50.69 | 1.4% | 0.0% | 0 | 10 | 50.69 | 10 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 59.00 | 4.6% | 0.0% | 0 | 862 | 59.00 | 862 |
| from2023 | S2 | 59.00 | 4.6% | 0.0% | 0 | 709 | 59.00 | 709 |
| from2023 | S3 | 59.00 | 4.6% | 0.0% | 0 | 862 | 59.00 | 862 |
| firstHalf | S1 | 53.66 | 2.8% | 0.1% | 0 | 385 | 53.66 | 385 |
| firstHalf | S2 | 53.66 | 2.8% | 0.1% | 0 | 322 | 53.66 | 322 |
| firstHalf | S3 | 53.66 | 2.8% | 0.1% | 0 | 385 | 53.66 | 385 |
| secondHalf | S1 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |
| secondHalf | S2 | 55.71 | 4.3% | 0.0% | 0 | 488 | 55.71 | 488 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |

### SPY->UPRO (leverage 3)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 96.7% | 14.2% | 49.2% | 0.29 | 0.57 | -18.9% (2022-04) | 23.76 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 95.2% | 14.0% | 49.4% | 0.28 | 0.56 | -19.0% (2022-04) | 23.91 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 121.6% | 16.9% | 24.1% | 0.70 | 0.77 | -14.8% (2021-09) | 9.76 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 93.2% | 13.8% | 26.8% | 0.51 | 0.64 | -15.3% (2021-09) | 11.53 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 60.9% | 9.8% | 23.9% | 0.41 | 0.65 | -9.4% (2025-03) | 11.63 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 60.2% | 9.7% | 24.0% | 0.40 | 0.64 | -9.5% (2025-03) | 11.69 | 5 | 2.2 | 79% |
| buy-and-hold UPRO | 154.8% | 20.1% | 63.9% | 0.31 | 0.62 | -27.2% (2022-09) | 29.50 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -39.9% | -40.0% | 41.2% | -0.97 | -1.79 | -18.9% (2022-04) | 36.61 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -40.1% | -40.2% | 41.4% | -0.97 | -1.80 | -19.0% (2022-04) | 36.76 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -2.4% | -2.4% | 16.3% | -0.15 | -0.10 | -5.7% (2022-01) | 5.04 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -4.3% | -4.3% | 16.7% | -0.26 | -0.24 | -6.5% (2022-01) | 6.52 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -14.5% | -14.5% | 15.9% | -0.91 | -1.71 | -6.8% (2022-01) | 14.08 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -14.6% | -14.6% | 16.0% | -0.91 | -1.72 | -6.8% (2022-01) | 14.13 | 2 | 4.0 | 22% |
| buy-and-hold UPRO | -57.3% | -57.5% | 63.9% | -0.90 | -0.83 | -27.2% (2022-09) | 44.07 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 144.5% | 27.2% | 30.0% | 0.91 | 0.91 | -16.0% (2025-03) | 10.84 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 143.3% | 27.1% | 30.0% | 0.90 | 0.91 | -16.0% (2025-03) | 10.88 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 121.7% | 23.9% | 20.7% | 1.15 | 1.00 | -11.1% (2023-09) | 7.84 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 100.6% | 20.6% | 23.6% | 0.87 | 0.86 | -12.8% (2023-09) | 9.13 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 76.4% | 16.5% | 16.4% | 1.01 | 0.99 | -9.4% (2025-03) | 5.81 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 75.8% | 16.4% | 16.4% | 1.00 | 0.99 | -9.5% (2025-03) | 5.83 | 3 | 1.9 | 93% |
| buy-and-hold UPRO | 374.0% | 52.0% | 48.9% | 1.06 | 1.17 | -17.6% (2025-03) | 10.90 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 15.5% | 5.8% | 49.2% | 0.12 | 0.34 | -18.9% (2022-04) | 31.94 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 14.7% | 5.5% | 49.4% | 0.11 | 0.33 | -19.0% (2022-04) | 32.14 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 60.9% | 20.5% | 24.1% | 0.85 | 0.82 | -14.8% (2021-09) | 12.11 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 45.3% | 15.8% | 26.8% | 0.59 | 0.67 | -15.3% (2021-09) | 14.11 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 16.6% | 6.2% | 23.9% | 0.26 | 0.46 | -9.2% (2022-01) | 15.24 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 16.2% | 6.1% | 24.0% | 0.25 | 0.46 | -9.2% (2022-01) | 15.32 | 3 | 2.7 | 66% |
| buy-and-hold UPRO | 8.6% | 3.3% | 63.9% | 0.05 | 0.33 | -27.2% (2022-09) | 40.00 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 79.5% | 25.8% | 26.4% | 0.98 | 0.85 | -17.6% (2026-03) | 10.35 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 78.9% | 25.6% | 26.4% | 0.97 | 0.85 | -17.7% (2026-03) | 10.39 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 58.2% | 19.7% | 27.7% | 0.71 | 0.77 | -8.8% (2024-04) | 9.62 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 46.0% | 16.0% | 28.3% | 0.56 | 0.65 | -9.8% (2024-04) | 11.10 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 39.8% | 14.0% | 17.8% | 0.79 | 0.79 | -10.3% (2025-03) | 6.79 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 39.5% | 13.9% | 17.8% | 0.78 | 0.79 | -10.3% (2025-03) | 6.82 | 2 | 2.0 | 92% |
| buy-and-hold UPRO | 137.8% | 40.4% | 48.9% | 0.83 | 0.96 | -17.6% (2025-03) | 11.27 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -5.9% points, max drawdown -14.8% points (negative = less drawdown), Calmar -0.03, time in market 79% (average exposure 73%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -3.2% points, max drawdown -39.9% points (negative = less drawdown), Calmar 0.39, time in market 66% (average exposure 50%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -10.3% points, max drawdown -40.1% points (negative = less drawdown), Calmar 0.09, time in market 79% (average exposure 37%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0358, SR0 0.0765 (annualised 1.21), DSR 0.074, round trips 5
- S2: daily SR 0.0485, SR0 0.0765 (annualised 1.21), DSR 0.160, round trips 109
- S3: daily SR 0.0406, SR0 0.0765 (annualised 1.21), DSR 0.102, round trips 5

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 59.70 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 89.47 | 12.1% | 23.9% | 2 | 491 | 89.26 | 491 |
| full | S2 | 81.26 | 10.0% | 16.1% | 34 | 580 | 78.14 | 580 |
| full | S3 | 59.79 | 3.6% | 0.1% | 0 | 1019 | 59.79 | 1019 |
| y2022 | S1 | 50.69 | 1.4% | 0.0% | 0 | 54 | 50.69 | 54 |
| y2022 | S2 | 50.69 | 1.4% | 0.0% | 0 | 18 | 50.69 | 18 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 54 | 50.69 | 54 |
| from2023 | S1 | 88.67 | 16.7% | 24.1% | 2 | 338 | 88.46 | 338 |
| from2023 | S2 | 80.47 | 13.7% | 16.3% | 34 | 474 | 77.35 | 474 |
| from2023 | S3 | 59.00 | 4.6% | 0.0% | 0 | 866 | 59.00 | 866 |
| firstHalf | S1 | 74.51 | 16.9% | 23.0% | 1 | 153 | 74.39 | 153 |
| firstHalf | S2 | 76.84 | 18.3% | 16.1% | 33 | 106 | 74.10 | 106 |
| firstHalf | S3 | 53.66 | 2.8% | 0.1% | 0 | 426 | 53.66 | 426 |
| secondHalf | S1 | 55.71 | 4.3% | 0.0% | 0 | 593 | 55.71 | 593 |
| secondHalf | S2 | 55.71 | 4.3% | 0.0% | 0 | 503 | 55.71 | 503 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 593 | 55.71 | 593 |

### SPY->SSO (leverage 2)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 78.2% | 12.0% | 35.3% | 0.34 | 0.63 | -12.6% (2022-04) | 16.16 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 76.7% | 11.8% | 35.6% | 0.33 | 0.62 | -12.7% (2022-04) | 16.32 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 80.3% | 12.2% | 16.8% | 0.73 | 0.77 | -10.0% (2021-09) | 6.96 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 53.3% | 8.7% | 20.3% | 0.43 | 0.56 | -10.6% (2021-09) | 8.87 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 63.1% | 10.1% | 23.5% | 0.43 | 0.70 | -8.8% (2022-01) | 11.01 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 62.1% | 9.9% | 23.7% | 0.42 | 0.70 | -8.8% (2022-01) | 11.10 | 5 | 2.2 | 79% |
| buy-and-hold SSO | 130.0% | 17.7% | 46.9% | 0.38 | 0.65 | -18.5% (2022-09) | 19.14 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -27.8% | -27.9% | 29.2% | -0.95 | -1.71 | -12.6% (2022-04) | 25.77 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -28.1% | -28.2% | 29.4% | -0.96 | -1.73 | -12.7% (2022-04) | 25.95 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -2.3% | -2.3% | 11.9% | -0.20 | -0.19 | -4.6% (2022-01) | 4.38 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -4.3% | -4.3% | 12.3% | -0.35 | -0.39 | -5.4% (2022-01) | 5.95 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -14.8% | -14.8% | 16.3% | -0.91 | -1.61 | -6.8% (2022-01) | 14.39 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -15.0% | -15.0% | 16.4% | -0.92 | -1.63 | -6.9% (2022-01) | 14.48 | 2 | 4.0 | 22% |
| buy-and-hold SSO | -39.5% | -39.6% | 46.8% | -0.85 | -0.80 | -18.5% (2022-09) | 30.56 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 104.7% | 21.3% | 20.5% | 1.04 | 1.00 | -10.6% (2025-03) | 7.01 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 103.8% | 21.1% | 20.5% | 1.03 | 1.00 | -10.7% (2025-03) | 7.06 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 81.1% | 17.3% | 14.8% | 1.17 | 1.01 | -7.7% (2023-09) | 5.74 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 60.3% | 13.5% | 18.2% | 0.75 | 0.79 | -9.4% (2023-09) | 7.17 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 77.5% | 16.7% | 13.3% | 1.26 | 1.10 | -7.9% (2025-03) | 4.82 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 76.8% | 16.6% | 13.3% | 1.25 | 1.09 | -7.9% (2025-03) | 4.84 | 3 | 1.9 | 93% |
| buy-and-hold SSO | 223.9% | 37.2% | 35.1% | 1.06 | 1.22 | -11.9% (2025-03) | 7.09 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 16.5% | 6.2% | 35.3% | 0.17 | 0.38 | -12.6% (2022-04) | 21.83 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 15.6% | 5.9% | 35.6% | 0.16 | 0.37 | -12.7% (2022-04) | 22.06 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 38.1% | 13.5% | 16.8% | 0.80 | 0.78 | -10.0% (2021-09) | 8.45 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 23.9% | 8.7% | 20.3% | 0.43 | 0.54 | -10.6% (2021-09) | 10.57 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 17.0% | 6.4% | 23.5% | 0.27 | 0.48 | -8.8% (2022-01) | 14.77 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 16.5% | 6.2% | 23.7% | 0.26 | 0.47 | -8.8% (2022-01) | 14.89 | 3 | 2.7 | 66% |
| buy-and-hold SSO | 18.0% | 6.7% | 46.9% | 0.14 | 0.36 | -18.5% (2022-09) | 26.05 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 59.4% | 20.0% | 17.7% | 1.13 | 0.92 | -11.9% (2026-03) | 6.79 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 58.8% | 19.9% | 17.7% | 1.12 | 0.92 | -12.0% (2026-03) | 6.84 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 40.0% | 14.1% | 19.0% | 0.74 | 0.77 | -6.4% (2024-04) | 6.75 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 28.0% | 10.2% | 19.6% | 0.52 | 0.58 | -7.5% (2026-02) | 8.26 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 42.3% | 14.8% | 16.0% | 0.93 | 0.87 | -9.6% (2025-03) | 6.10 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 41.8% | 14.7% | 16.0% | 0.92 | 0.86 | -9.7% (2025-03) | 6.14 | 2 | 2.0 | 92% |
| buy-and-hold SSO | 96.5% | 30.3% | 35.1% | 0.86 | 1.01 | -11.9% (2025-03) | 7.31 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -5.7% points, max drawdown -11.6% points (negative = less drawdown), Calmar -0.04, time in market 79% (average exposure 73%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -5.5% points, max drawdown -30.1% points (negative = less drawdown), Calmar 0.35, time in market 66% (average exposure 54%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -7.7% points, max drawdown -23.4% points (negative = less drawdown), Calmar 0.05, time in market 79% (average exposure 50%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0395, SR0 0.0765 (annualised 1.21), DSR 0.094, round trips 5
- S2: daily SR 0.0485, SR0 0.0765 (annualised 1.21), DSR 0.161, round trips 109
- S3: daily SR 0.0444, SR0 0.0765 (annualised 1.21), DSR 0.128, round trips 5

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 30.84 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 71.25 | 7.2% | 22.6% | 5 | 118 | 70.88 | 118 |
| full | S2 | 71.49 | 7.3% | 13.7% | 85 | 177 | 65.38 | 177 |
| full | S3 | 70.85 | 7.1% | 18.8% | 5 | 153 | 70.48 | 153 |
| y2022 | S1 | 39.91 | -20.3% | 21.6% | 2 | 0 | 39.78 | 0 |
| y2022 | S2 | 49.20 | -1.6% | 8.5% | 10 | 0 | 48.55 | 0 |
| y2022 | S3 | 46.40 | -7.2% | 10.4% | 1 | 28 | 46.33 | 28 |
| from2023 | S1 | 76.53 | 12.1% | 19.7% | 3 | 118 | 76.25 | 118 |
| from2023 | S2 | 71.61 | 10.2% | 13.7% | 64 | 177 | 66.47 | 177 |
| from2023 | S3 | 76.60 | 12.2% | 12.2% | 3 | 124 | 76.37 | 124 |
| firstHalf | S1 | 56.28 | 4.7% | 22.6% | 3 | 0 | 56.07 | 0 |
| firstHalf | S2 | 59.49 | 7.0% | 13.7% | 54 | 0 | 56.46 | 0 |
| firstHalf | S3 | 58.46 | 6.3% | 18.8% | 3 | 15 | 58.25 | 15 |
| secondHalf | S1 | 64.58 | 10.6% | 14.3% | 2 | 118 | 64.40 | 118 |
| secondHalf | S2 | 61.25 | 8.3% | 15.6% | 31 | 177 | 58.48 | 177 |
| secondHalf | S3 | 61.76 | 8.6% | 14.9% | 2 | 138 | 61.58 | 138 |

### SPY->SPY (leverage 1)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 56.4% | 9.2% | 17.7% | 0.52 | 0.86 | -6.3% (2022-04) | 7.63 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 55.0% | 9.0% | 18.1% | 0.50 | 0.84 | -6.4% (2022-04) | 7.80 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 50.2% | 8.3% | 8.6% | 0.97 | 0.96 | -5.3% (2021-09) | 3.23 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 25.0% | 4.5% | 11.6% | 0.38 | 0.51 | -5.9% (2021-09) | 5.20 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 57.9% | 9.4% | 16.8% | 0.56 | 0.88 | -5.3% (2022-01) | 7.17 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 56.5% | 9.2% | 17.1% | 0.53 | 0.86 | -5.4% (2022-04) | 7.32 | 5 | 2.2 | 79% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -13.9% | -13.9% | 15.3% | -0.91 | -1.63 | -6.3% (2022-04) | 13.25 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -14.2% | -14.3% | 15.5% | -0.92 | -1.68 | -6.4% (2022-04) | 13.47 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -0.0% | -0.0% | 5.8% | -0.00 | 0.02 | -2.1% (2022-01) | 1.68 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -2.0% | -2.0% | 6.2% | -0.32 | -0.42 | -2.9% (2022-01) | 3.24 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -12.9% | -13.0% | 14.3% | -0.91 | -1.59 | -5.6% (2022-01) | 12.53 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -13.3% | -13.3% | 14.6% | -0.91 | -1.64 | -5.7% (2022-01) | 12.72 | 2 | 4.0 | 22% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 64.9% | 14.4% | 9.9% | 1.45 | 1.30 | -5.0% (2025-03) | 3.22 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 64.1% | 14.3% | 9.9% | 1.44 | 1.29 | -5.1% (2025-03) | 3.26 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 49.1% | 11.4% | 8.6% | 1.32 | 1.21 | -4.1% (2023-09) | 2.92 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 29.3% | 7.2% | 11.5% | 0.62 | 0.75 | -5.7% (2023-09) | 4.44 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 64.9% | 14.4% | 9.9% | 1.45 | 1.30 | -5.0% (2025-03) | 3.22 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 64.1% | 14.3% | 9.9% | 1.44 | 1.29 | -5.1% (2025-03) | 3.26 | 3 | 1.9 | 93% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 15.3% | 5.7% | 17.7% | 0.32 | 0.56 | -6.3% (2022-04) | 10.31 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 14.5% | 5.4% | 18.1% | 0.30 | 0.53 | -6.4% (2022-04) | 10.54 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 23.0% | 8.5% | 8.3% | 1.01 | 0.94 | -5.3% (2021-09) | 3.68 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 10.7% | 4.0% | 11.6% | 0.35 | 0.48 | -5.9% (2021-09) | 5.93 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 16.5% | 6.2% | 16.8% | 0.37 | 0.60 | -5.3% (2022-01) | 9.63 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 15.7% | 5.9% | 17.1% | 0.34 | 0.58 | -5.4% (2022-04) | 9.84 | 3 | 2.7 | 66% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 38.9% | 13.7% | 9.3% | 1.48 | 1.20 | -5.9% (2026-03) | 3.22 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 38.3% | 13.5% | 9.3% | 1.46 | 1.18 | -6.0% (2026-03) | 3.27 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 25.3% | 9.2% | 10.4% | 0.89 | 0.93 | -3.5% (2026-02) | 3.39 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 13.5% | 5.1% | 10.9% | 0.46 | 0.53 | -4.7% (2026-02) | 4.87 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 38.9% | 13.7% | 9.3% | 1.48 | 1.20 | -5.9% (2026-03) | 3.22 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 38.3% | 13.5% | 9.3% | 1.46 | 1.18 | -6.0% (2026-03) | 3.27 | 2 | 2.0 | 92% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -3.9% points, max drawdown -6.8% points (negative = less drawdown), Calmar -0.02, time in market 79% (average exposure 73%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -4.8% points, max drawdown -15.9% points (negative = less drawdown), Calmar 0.44, time in market 66% (average exposure 56%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -3.7% points, max drawdown -7.7% points (negative = less drawdown), Calmar 0.02, time in market 79% (average exposure 73%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0540, SR0 0.0765 (annualised 1.21), DSR 0.213, round trips 5
- S2: daily SR 0.0602, SR0 0.0765 (annualised 1.21), DSR 0.283, round trips 109
- S3: daily SR 0.0555, SR0 0.0765 (annualised 1.21), DSR 0.228, round trips 5

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 412.16 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 59.79 | 3.6% | 0.1% | 0 | 1019 | 59.79 | 1019 |
| full | S2 | 59.79 | 3.6% | 0.1% | 0 | 846 | 59.79 | 846 |
| full | S3 | 59.79 | 3.6% | 0.1% | 0 | 1019 | 59.79 | 1019 |
| y2022 | S1 | 50.69 | 1.4% | 0.0% | 0 | 54 | 50.69 | 54 |
| y2022 | S2 | 50.69 | 1.4% | 0.0% | 0 | 18 | 50.69 | 18 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 54 | 50.69 | 54 |
| from2023 | S1 | 59.00 | 4.6% | 0.0% | 0 | 866 | 59.00 | 866 |
| from2023 | S2 | 59.00 | 4.6% | 0.0% | 0 | 740 | 59.00 | 740 |
| from2023 | S3 | 59.00 | 4.6% | 0.0% | 0 | 866 | 59.00 | 866 |
| firstHalf | S1 | 53.66 | 2.8% | 0.1% | 0 | 426 | 53.66 | 426 |
| firstHalf | S2 | 53.66 | 2.8% | 0.1% | 0 | 343 | 53.66 | 343 |
| firstHalf | S3 | 53.66 | 2.8% | 0.1% | 0 | 426 | 53.66 | 426 |
| secondHalf | S1 | 55.71 | 4.3% | 0.0% | 0 | 593 | 55.71 | 593 |
| secondHalf | S2 | 55.71 | 4.3% | 0.0% | 0 | 503 | 55.71 | 503 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 593 | 55.71 | 593 |

## Sensitivity grid (DESCRIPTIVE ONLY: nothing is chosen from this table)

Same grids as v1, full span, 5 bps, idealized fractional. It feeds no verdict; no config is promoted or preferred. Rows marked canonical are the fixed configs above.

| pair | strategy | params | canonical | CAGR | max DD | Calmar | Sharpe | round trips |
|---|---|---|---|---|---|---|---|---|
| QQQ->TQQQ | S1 | {"n":150,"bandPct":0} |  | 23.8% | 39.7% | 0.60 | 0.76 | 14 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":1} |  | 22.9% | 39.3% | 0.58 | 0.74 | 6 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":2} |  | 19.5% | 40.7% | 0.48 | 0.66 | 6 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":3} |  | 26.6% | 37.3% | 0.71 | 0.79 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":0} |  | 26.6% | 34.6% | 0.77 | 0.84 | 10 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":1} |  | 30.0% | 37.3% | 0.80 | 0.85 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":2} |  | 25.4% | 42.8% | 0.59 | 0.76 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":3} |  | 23.3% | 43.1% | 0.54 | 0.71 | 3 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":0} |  | 22.9% | 53.5% | 0.43 | 0.70 | 10 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":1} |  | 24.5% | 48.4% | 0.51 | 0.73 | 5 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":2} | yes | 22.2% | 50.6% | 0.44 | 0.69 | 3 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":3} |  | 21.7% | 50.6% | 0.43 | 0.68 | 3 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":0} |  | 18.8% | 63.3% | 0.30 | 0.61 | 13 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":1} |  | 16.2% | 65.3% | 0.25 | 0.56 | 7 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":2} |  | 19.6% | 58.3% | 0.34 | 0.63 | 5 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":3} |  | 24.1% | 45.8% | 0.53 | 0.73 | 3 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":0} |  | 18.2% | 65.8% | 0.28 | 0.59 | 14 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":1} |  | 18.4% | 57.6% | 0.32 | 0.60 | 7 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":2} |  | 18.2% | 58.7% | 0.31 | 0.59 | 7 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":3} |  | 19.4% | 64.5% | 0.30 | 0.61 | 4 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":8} |  | 21.9% | 36.9% | 0.59 | 0.84 | 101 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":10} |  | 21.9% | 36.9% | 0.59 | 0.84 | 101 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":15} |  | 21.9% | 36.9% | 0.59 | 0.84 | 101 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":8} |  | 25.0% | 42.7% | 0.58 | 0.90 | 113 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":10} | yes | 25.0% | 42.7% | 0.58 | 0.90 | 113 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":15} |  | 25.0% | 42.7% | 0.58 | 0.90 | 113 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":8} |  | 21.6% | 46.7% | 0.46 | 0.77 | 123 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":10} |  | 21.6% | 46.7% | 0.46 | 0.77 | 123 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":15} |  | 21.6% | 46.7% | 0.46 | 0.77 | 123 |
| QQQ->TQQQ | S3 | {"targetVolPct":15} |  | 9.3% | 21.1% | 0.44 | 0.63 | 3 |
| QQQ->TQQQ | S3 | {"targetVolPct":20} | yes | 10.9% | 27.6% | 0.40 | 0.61 | 3 |
| QQQ->QLD | S1 | {"n":150,"bandPct":0} |  | 19.2% | 27.3% | 0.70 | 0.83 | 14 |
| QQQ->QLD | S1 | {"n":150,"bandPct":1} |  | 19.1% | 25.2% | 0.76 | 0.83 | 6 |
| QQQ->QLD | S1 | {"n":150,"bandPct":2} |  | 16.7% | 26.2% | 0.64 | 0.74 | 6 |
| QQQ->QLD | S1 | {"n":150,"bandPct":3} |  | 21.5% | 26.4% | 0.82 | 0.85 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":0} |  | 21.5% | 24.2% | 0.89 | 0.93 | 10 |
| QQQ->QLD | S1 | {"n":175,"bandPct":1} |  | 23.8% | 26.4% | 0.90 | 0.93 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":2} |  | 20.9% | 29.3% | 0.71 | 0.82 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":3} |  | 19.3% | 29.6% | 0.65 | 0.78 | 3 |
| QQQ->QLD | S1 | {"n":200,"bandPct":0} |  | 18.6% | 39.7% | 0.47 | 0.75 | 10 |
| QQQ->QLD | S1 | {"n":200,"bandPct":1} |  | 20.1% | 34.4% | 0.58 | 0.80 | 5 |
| QQQ->QLD | S1 | {"n":200,"bandPct":2} | yes | 18.6% | 36.1% | 0.51 | 0.75 | 3 |
| QQQ->QLD | S1 | {"n":200,"bandPct":3} |  | 18.2% | 36.1% | 0.50 | 0.74 | 3 |
| QQQ->QLD | S1 | {"n":225,"bandPct":0} |  | 15.6% | 47.8% | 0.33 | 0.64 | 13 |
| QQQ->QLD | S1 | {"n":225,"bandPct":1} |  | 14.1% | 49.7% | 0.28 | 0.59 | 7 |
| QQQ->QLD | S1 | {"n":225,"bandPct":2} |  | 16.7% | 42.7% | 0.39 | 0.68 | 5 |
| QQQ->QLD | S1 | {"n":225,"bandPct":3} |  | 19.7% | 32.2% | 0.61 | 0.79 | 3 |
| QQQ->QLD | S1 | {"n":250,"bandPct":0} |  | 15.3% | 49.8% | 0.31 | 0.62 | 14 |
| QQQ->QLD | S1 | {"n":250,"bandPct":1} |  | 15.4% | 42.2% | 0.37 | 0.63 | 7 |
| QQQ->QLD | S1 | {"n":250,"bandPct":2} |  | 15.5% | 42.7% | 0.36 | 0.63 | 7 |
| QQQ->QLD | S1 | {"n":250,"bandPct":3} |  | 15.7% | 49.2% | 0.32 | 0.61 | 4 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":8} |  | 18.4% | 21.7% | 0.85 | 0.97 | 101 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":10} |  | 18.4% | 21.7% | 0.85 | 0.97 | 101 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":15} |  | 18.4% | 21.7% | 0.85 | 0.97 | 101 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":8} |  | 20.4% | 28.7% | 0.71 | 1.02 | 113 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":10} | yes | 20.4% | 28.7% | 0.71 | 1.02 | 113 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":15} |  | 20.4% | 28.7% | 0.71 | 1.02 | 113 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":8} |  | 18.1% | 31.2% | 0.58 | 0.89 | 123 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":10} |  | 18.1% | 31.2% | 0.58 | 0.89 | 123 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":15} |  | 18.1% | 31.2% | 0.58 | 0.89 | 123 |
| QQQ->QLD | S3 | {"targetVolPct":15} |  | 9.6% | 20.5% | 0.47 | 0.73 | 3 |
| QQQ->QLD | S3 | {"targetVolPct":20} | yes | 11.4% | 26.9% | 0.42 | 0.70 | 3 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":0} |  | 13.3% | 13.4% | 1.00 | 1.03 | 14 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":1} |  | 13.1% | 12.6% | 1.04 | 1.01 | 6 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":2} |  | 11.7% | 13.6% | 0.86 | 0.91 | 6 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":3} |  | 14.6% | 13.5% | 1.08 | 1.05 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":0} |  | 14.5% | 13.0% | 1.11 | 1.13 | 10 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":1} |  | 15.8% | 13.5% | 1.17 | 1.13 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":2} |  | 14.3% | 14.4% | 0.99 | 1.01 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":3} |  | 13.4% | 14.4% | 0.93 | 0.96 | 3 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":0} |  | 13.2% | 19.9% | 0.66 | 0.94 | 10 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":1} |  | 13.9% | 17.2% | 0.81 | 0.99 | 5 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":2} | yes | 13.0% | 18.4% | 0.71 | 0.94 | 3 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":3} |  | 12.8% | 18.4% | 0.70 | 0.93 | 3 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":0} |  | 11.4% | 26.1% | 0.44 | 0.81 | 13 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":1} |  | 10.7% | 27.3% | 0.39 | 0.76 | 7 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":2} |  | 12.1% | 22.6% | 0.54 | 0.86 | 5 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":3} |  | 13.7% | 15.8% | 0.87 | 0.98 | 3 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":0} |  | 11.2% | 27.9% | 0.40 | 0.78 | 14 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":1} |  | 11.2% | 22.3% | 0.50 | 0.79 | 7 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":2} |  | 11.1% | 23.0% | 0.48 | 0.78 | 7 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":3} |  | 11.4% | 26.4% | 0.43 | 0.76 | 4 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":8} |  | 10.9% | 12.6% | 0.87 | 1.00 | 101 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":10} |  | 10.9% | 12.6% | 0.87 | 1.00 | 101 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":15} |  | 10.9% | 12.6% | 0.87 | 1.00 | 101 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":8} |  | 12.2% | 16.4% | 0.75 | 1.08 | 113 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":10} | yes | 12.2% | 16.4% | 0.75 | 1.08 | 113 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":15} |  | 12.2% | 16.4% | 0.75 | 1.08 | 113 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":8} |  | 10.6% | 18.5% | 0.57 | 0.91 | 123 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":10} |  | 10.6% | 18.5% | 0.57 | 0.91 | 123 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":15} |  | 10.6% | 18.5% | 0.57 | 0.91 | 123 |
| QQQ->QQQ | S3 | {"targetVolPct":15} |  | 10.6% | 16.4% | 0.65 | 0.94 | 3 |
| QQQ->QQQ | S3 | {"targetVolPct":20} | yes | 12.4% | 17.7% | 0.70 | 0.94 | 3 |
| SPY->UPRO | S1 | {"n":150,"bandPct":0} |  | 17.3% | 49.1% | 0.35 | 0.66 | 16 |
| SPY->UPRO | S1 | {"n":150,"bandPct":1} |  | 12.7% | 59.1% | 0.21 | 0.53 | 9 |
| SPY->UPRO | S1 | {"n":150,"bandPct":2} |  | 9.9% | 60.2% | 0.16 | 0.45 | 7 |
| SPY->UPRO | S1 | {"n":150,"bandPct":3} |  | 12.4% | 45.6% | 0.27 | 0.53 | 5 |
| SPY->UPRO | S1 | {"n":175,"bandPct":0} |  | 6.7% | 67.6% | 0.10 | 0.36 | 21 |
| SPY->UPRO | S1 | {"n":175,"bandPct":1} |  | 11.9% | 59.1% | 0.20 | 0.50 | 9 |
| SPY->UPRO | S1 | {"n":175,"bandPct":2} |  | 12.3% | 56.1% | 0.22 | 0.52 | 7 |
| SPY->UPRO | S1 | {"n":175,"bandPct":3} |  | 11.4% | 50.4% | 0.23 | 0.49 | 5 |
| SPY->UPRO | S1 | {"n":200,"bandPct":0} |  | 15.0% | 49.7% | 0.30 | 0.59 | 15 |
| SPY->UPRO | S1 | {"n":200,"bandPct":1} |  | 13.4% | 53.5% | 0.25 | 0.55 | 9 |
| SPY->UPRO | S1 | {"n":200,"bandPct":2} | yes | 14.2% | 49.2% | 0.29 | 0.57 | 5 |
| SPY->UPRO | S1 | {"n":200,"bandPct":3} |  | 10.9% | 59.0% | 0.18 | 0.48 | 4 |
| SPY->UPRO | S1 | {"n":225,"bandPct":0} |  | 16.1% | 47.1% | 0.34 | 0.62 | 14 |
| SPY->UPRO | S1 | {"n":225,"bandPct":1} |  | 15.5% | 44.3% | 0.35 | 0.61 | 7 |
| SPY->UPRO | S1 | {"n":225,"bandPct":2} |  | 13.9% | 54.9% | 0.25 | 0.56 | 4 |
| SPY->UPRO | S1 | {"n":225,"bandPct":3} |  | 11.6% | 62.0% | 0.19 | 0.49 | 3 |
| SPY->UPRO | S1 | {"n":250,"bandPct":0} |  | 15.4% | 45.6% | 0.34 | 0.59 | 17 |
| SPY->UPRO | S1 | {"n":250,"bandPct":1} |  | 13.6% | 56.7% | 0.24 | 0.53 | 6 |
| SPY->UPRO | S1 | {"n":250,"bandPct":2} |  | 10.6% | 60.3% | 0.18 | 0.46 | 4 |
| SPY->UPRO | S1 | {"n":250,"bandPct":3} |  | 13.0% | 55.7% | 0.23 | 0.52 | 4 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":8} |  | 14.8% | 35.2% | 0.42 | 0.68 | 99 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":10} |  | 14.8% | 35.2% | 0.42 | 0.68 | 99 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":15} |  | 14.8% | 35.2% | 0.42 | 0.68 | 99 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":8} |  | 16.9% | 24.1% | 0.70 | 0.77 | 109 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":10} | yes | 16.9% | 24.1% | 0.70 | 0.77 | 109 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":15} |  | 16.9% | 24.1% | 0.70 | 0.77 | 109 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":8} |  | 9.8% | 48.4% | 0.20 | 0.47 | 127 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":10} |  | 9.8% | 48.4% | 0.20 | 0.47 | 127 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":15} |  | 9.8% | 48.4% | 0.20 | 0.47 | 127 |
| SPY->UPRO | S3 | {"targetVolPct":15} |  | 8.4% | 18.1% | 0.46 | 0.69 | 5 |
| SPY->UPRO | S3 | {"targetVolPct":20} | yes | 9.8% | 23.9% | 0.41 | 0.65 | 5 |
| SPY->SSO | S1 | {"n":150,"bandPct":0} |  | 13.9% | 35.4% | 0.39 | 0.72 | 16 |
| SPY->SSO | S1 | {"n":150,"bandPct":1} |  | 10.7% | 44.3% | 0.24 | 0.57 | 9 |
| SPY->SSO | S1 | {"n":150,"bandPct":2} |  | 8.8% | 45.0% | 0.20 | 0.49 | 7 |
| SPY->SSO | S1 | {"n":150,"bandPct":3} |  | 10.5% | 32.5% | 0.32 | 0.58 | 5 |
| SPY->SSO | S1 | {"n":175,"bandPct":0} |  | 6.3% | 52.6% | 0.12 | 0.38 | 21 |
| SPY->SSO | S1 | {"n":175,"bandPct":1} |  | 10.0% | 44.0% | 0.23 | 0.54 | 9 |
| SPY->SSO | S1 | {"n":175,"bandPct":2} |  | 10.5% | 41.3% | 0.25 | 0.56 | 7 |
| SPY->SSO | S1 | {"n":175,"bandPct":3} |  | 10.2% | 36.3% | 0.28 | 0.55 | 5 |
| SPY->SSO | S1 | {"n":200,"bandPct":0} |  | 12.2% | 36.0% | 0.34 | 0.64 | 15 |
| SPY->SSO | S1 | {"n":200,"bandPct":1} |  | 11.2% | 38.8% | 0.29 | 0.60 | 9 |
| SPY->SSO | S1 | {"n":200,"bandPct":2} | yes | 12.0% | 35.3% | 0.34 | 0.63 | 5 |
| SPY->SSO | S1 | {"n":200,"bandPct":3} |  | 9.7% | 44.0% | 0.22 | 0.53 | 4 |
| SPY->SSO | S1 | {"n":225,"bandPct":0} |  | 13.0% | 33.6% | 0.39 | 0.67 | 14 |
| SPY->SSO | S1 | {"n":225,"bandPct":1} |  | 12.7% | 31.4% | 0.40 | 0.65 | 7 |
| SPY->SSO | S1 | {"n":225,"bandPct":2} |  | 11.8% | 40.1% | 0.30 | 0.61 | 4 |
| SPY->SSO | S1 | {"n":225,"bandPct":3} |  | 10.3% | 46.7% | 0.22 | 0.52 | 3 |
| SPY->SSO | S1 | {"n":250,"bandPct":0} |  | 12.4% | 33.2% | 0.37 | 0.63 | 17 |
| SPY->SSO | S1 | {"n":250,"bandPct":1} |  | 11.2% | 41.9% | 0.27 | 0.56 | 6 |
| SPY->SSO | S1 | {"n":250,"bandPct":2} |  | 9.7% | 44.3% | 0.22 | 0.50 | 4 |
| SPY->SSO | S1 | {"n":250,"bandPct":3} |  | 10.8% | 40.4% | 0.27 | 0.55 | 4 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":8} |  | 11.0% | 24.9% | 0.44 | 0.69 | 99 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":10} |  | 11.0% | 24.9% | 0.44 | 0.69 | 99 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":15} |  | 11.0% | 24.9% | 0.44 | 0.69 | 99 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":8} |  | 12.2% | 16.8% | 0.73 | 0.77 | 109 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":10} | yes | 12.2% | 16.8% | 0.73 | 0.77 | 109 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":15} |  | 12.2% | 16.8% | 0.73 | 0.77 | 109 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":8} |  | 7.3% | 35.1% | 0.21 | 0.46 | 127 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":10} |  | 7.3% | 35.1% | 0.21 | 0.46 | 127 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":15} |  | 7.3% | 35.1% | 0.21 | 0.46 | 127 |
| SPY->SSO | S3 | {"targetVolPct":15} |  | 8.6% | 17.8% | 0.48 | 0.76 | 5 |
| SPY->SSO | S3 | {"targetVolPct":20} | yes | 10.1% | 23.5% | 0.43 | 0.70 | 5 |
| SPY->SPY | S1 | {"n":150,"bandPct":0} |  | 10.1% | 18.1% | 0.56 | 0.95 | 16 |
| SPY->SPY | S1 | {"n":150,"bandPct":1} |  | 8.5% | 23.2% | 0.37 | 0.81 | 9 |
| SPY->SPY | S1 | {"n":150,"bandPct":2} |  | 7.5% | 24.0% | 0.31 | 0.71 | 7 |
| SPY->SPY | S1 | {"n":150,"bandPct":3} |  | 8.3% | 16.4% | 0.51 | 0.82 | 5 |
| SPY->SPY | S1 | {"n":175,"bandPct":0} |  | 6.1% | 29.5% | 0.21 | 0.59 | 21 |
| SPY->SPY | S1 | {"n":175,"bandPct":1} |  | 8.0% | 23.6% | 0.34 | 0.76 | 9 |
| SPY->SPY | S1 | {"n":175,"bandPct":2} |  | 8.3% | 21.9% | 0.38 | 0.78 | 7 |
| SPY->SPY | S1 | {"n":175,"bandPct":3} |  | 8.2% | 18.4% | 0.45 | 0.78 | 5 |
| SPY->SPY | S1 | {"n":200,"bandPct":0} |  | 9.3% | 18.3% | 0.51 | 0.88 | 15 |
| SPY->SPY | S1 | {"n":200,"bandPct":1} |  | 8.7% | 20.4% | 0.42 | 0.82 | 9 |
| SPY->SPY | S1 | {"n":200,"bandPct":2} | yes | 9.2% | 17.7% | 0.52 | 0.86 | 5 |
| SPY->SPY | S1 | {"n":200,"bandPct":3} |  | 8.0% | 23.3% | 0.34 | 0.75 | 4 |
| SPY->SPY | S1 | {"n":225,"bandPct":0} |  | 9.6% | 17.1% | 0.56 | 0.90 | 14 |
| SPY->SPY | S1 | {"n":225,"bandPct":1} |  | 9.4% | 15.3% | 0.62 | 0.88 | 7 |
| SPY->SPY | S1 | {"n":225,"bandPct":2} |  | 9.1% | 20.8% | 0.44 | 0.84 | 4 |
| SPY->SPY | S1 | {"n":225,"bandPct":3} |  | 8.0% | 25.3% | 0.32 | 0.71 | 3 |
| SPY->SPY | S1 | {"n":250,"bandPct":0} |  | 9.2% | 16.5% | 0.56 | 0.84 | 17 |
| SPY->SPY | S1 | {"n":250,"bandPct":1} |  | 8.5% | 21.9% | 0.39 | 0.76 | 6 |
| SPY->SPY | S1 | {"n":250,"bandPct":2} |  | 7.7% | 23.5% | 0.33 | 0.69 | 4 |
| SPY->SPY | S1 | {"n":250,"bandPct":3} |  | 8.3% | 20.8% | 0.40 | 0.74 | 4 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":8} |  | 7.7% | 11.8% | 0.65 | 0.87 | 99 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":10} |  | 7.7% | 11.8% | 0.65 | 0.87 | 99 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":15} |  | 7.7% | 11.8% | 0.65 | 0.87 | 99 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":8} |  | 8.3% | 8.6% | 0.97 | 0.96 | 109 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":10} | yes | 8.3% | 8.6% | 0.97 | 0.96 | 109 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":15} |  | 8.3% | 8.6% | 0.97 | 0.96 | 109 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":8} |  | 5.2% | 19.0% | 0.27 | 0.57 | 127 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":10} |  | 5.2% | 19.0% | 0.27 | 0.57 | 127 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":15} |  | 5.2% | 19.0% | 0.27 | 0.57 | 127 |
| SPY->SPY | S3 | {"targetVolPct":15} |  | 9.3% | 15.2% | 0.62 | 0.93 | 5 |
| SPY->SPY | S3 | {"targetVolPct":20} | yes | 9.4% | 16.8% | 0.56 | 0.88 | 5 |

## Not verified

- Alpaca free-tier history start date (recorded at first fetch: 2020-07-27)
- fractionability of traded ETFs (getAsset)
- cash-account good-faith/settlement handling beyond the same-day rule
