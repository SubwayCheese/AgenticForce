# Leveraged-ETF trend backtest: DESCRIPTIVE results (prereg v2)

> **SENSITIVITY RUN: position cap $30** per strategy entry, instead of the prereg's $20 (C1's real budget-envelope rule). This is a what-if on the cap only; it is not the prereg's canonical run, and C1's live cap is unchanged. Benchmarks are uncapped as always.

Prereg v2 sha256 (verified): `16fc0c616d0563b4a8b9acc306e468628af90f8c7ed641b60f0de0b291fbdfa1`. Mode: descriptive. Canonical configs fixed in advance; nothing was tuned and no config was picked from any table. Cost model: 5 bps/side base, 15 bps/side stress, no added expense ratio, cash leg BIL. Warm-up 250 aligned bars.

## Verdict on the two primary hypotheses: INCONCLUSIVE

> This mode can only return INCONCLUSIVE or FAIL. Even INCONCLUSIVE means only that the canonical rules beat the benchmarks on one short sample; it is not evidence the strategy will work going forward.

FAIL if either primary hypothesis (S1 or S2 on QQQ->TQQQ, full span, 5 bps) does not beat TQQQ buy-and-hold on max drawdown AND Calmar, or does not beat QQQ buy-and-hold CAGR after costs. INCONCLUSIVE otherwise.

### S1 on QQQ->TQQQ: both criteria met

| criterion | result | values |
|---|---|---|
| max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span) | met | maxDD 34.8% vs 81.7%; Calmar 0.51 vs 0.23 |
| after-cost CAGR (5 bps) > underlying buy-and-hold (full span) | met | 17.8% vs 15.5% |

at 15 bps (informational, not gating): maxDD 34.8% vs 81.7%; Calmar 0.51 vs 0.23; CAGR 17.8% vs 15.5%

### S2 on QQQ->TQQQ: both criteria met

| criterion | result | values |
|---|---|---|
| max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span) | met | maxDD 29.9% vs 81.7%; Calmar 0.65 vs 0.23 |
| after-cost CAGR (5 bps) > underlying buy-and-hold (full span) | met | 19.6% vs 15.5% |

at 15 bps (informational, not gating): maxDD 31.0% vs 81.7%; Calmar 0.58 vs 0.23; CAGR 18.1% vs 15.5%

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
| S1 {"n":200,"bandPct":2} (5 bps) | 131.1% | 17.8% | 34.8% | 0.51 | 0.68 | -22.8% (2022-01) | 18.48 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 130.4% | 17.8% | 34.8% | 0.51 | 0.68 | -22.9% (2022-01) | 18.53 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 149.0% | 19.6% | 29.9% | 0.65 | 0.96 | -18.8% (2022-01) | 15.21 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 133.9% | 18.1% | 31.0% | 0.58 | 0.89 | -19.5% (2022-01) | 15.93 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 69.7% | 10.9% | 27.6% | 0.40 | 0.61 | -21.6% (2022-01) | 14.76 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 69.2% | 10.9% | 27.6% | 0.39 | 0.60 | -21.6% (2022-01) | 14.79 | 3 | 1.4 | 76% |
| buy-and-hold TQQQ | 144.4% | 19.1% | 81.7% | 0.23 | 0.60 | -37.2% (2022-04) | 41.89 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -20.6% | -20.7% | 22.6% | -0.92 | -2.04 | -21.7% (2022-01) | 21.81 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -20.7% | -20.8% | 22.6% | -0.92 | -2.04 | -21.8% (2022-01) | 21.84 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -25.2% | -25.3% | 27.1% | -0.93 | -2.19 | -20.0% (2022-01) | 26.00 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -26.1% | -26.2% | 27.9% | -0.94 | -2.26 | -20.7% (2022-01) | 26.82 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -8.9% | -9.0% | 10.7% | -0.84 | -1.86 | -10.2% (2022-01) | 10.14 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.0% | -9.0% | 10.7% | -0.84 | -1.87 | -10.2% (2022-01) | 10.15 | 1 | 2.0 | 6% |
| buy-and-hold TQQQ | -79.3% | -79.4% | 81.0% | -0.98 | -1.15 | -37.2% (2022-04) | 61.20 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 145.1% | 27.3% | 30.6% | 0.89 | 0.91 | -16.3% (2025-03) | 14.31 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 144.5% | 27.2% | 30.6% | 0.89 | 0.91 | -16.4% (2025-03) | 14.35 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 170.1% | 30.7% | 14.4% | 2.13 | 1.52 | -6.1% (2026-07) | 5.19 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 157.3% | 29.0% | 15.9% | 1.82 | 1.43 | -6.7% (2026-07) | 5.73 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 90.7% | 19.0% | 20.9% | 0.91 | 0.92 | -10.7% (2025-03) | 8.72 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 90.3% | 18.9% | 20.9% | 0.91 | 0.92 | -10.7% (2025-03) | 8.74 | 2 | 1.3 | 92% |
| buy-and-hold TQQQ | 838.6% | 82.7% | 58.0% | 1.43 | 1.30 | -23.3% (2025-03) | 15.69 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 76.6% | 25.0% | 34.8% | 0.72 | 0.93 | -22.8% (2022-01) | 19.40 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 76.4% | 24.9% | 34.8% | 0.71 | 0.92 | -22.9% (2022-01) | 19.43 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 76.2% | 24.9% | 29.9% | 0.83 | 1.05 | -18.8% (2022-01) | 20.68 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 71.1% | 23.4% | 31.0% | 0.76 | 0.98 | -19.5% (2022-01) | 21.52 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 30.6% | 11.0% | 27.6% | 0.40 | 0.66 | -21.6% (2022-01) | 18.23 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 30.4% | 11.0% | 27.6% | 0.40 | 0.66 | -21.6% (2022-01) | 18.26 | 1 | 1.2 | 60% |
| buy-and-hold TQQQ | -6.9% | -2.7% | 81.7% | -0.03 | 0.33 | -37.2% (2022-04) | 55.66 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 54.9% | 18.7% | 25.0% | 0.75 | 0.68 | -13.0% (2025-03) | 12.12 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 54.5% | 18.6% | 25.0% | 0.74 | 0.68 | -13.0% (2025-03) | 12.14 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 68.5% | 22.7% | 20.9% | 1.09 | 0.90 | -9.8% (2026-07) | 9.55 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 59.1% | 20.0% | 21.4% | 0.93 | 0.80 | -10.8% (2026-07) | 10.44 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 31.8% | 11.4% | 18.2% | 0.63 | 0.63 | -9.2% (2025-03) | 8.49 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 31.6% | 11.4% | 18.2% | 0.62 | 0.62 | -9.2% (2025-03) | 8.51 | 2 | 2.0 | 92% |
| buy-and-hold TQQQ | 167.8% | 47.1% | 58.0% | 0.81 | 0.92 | -23.3% (2025-03) | 17.44 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -1.3% points, max drawdown -46.9% points (negative = less drawdown), Calmar 0.28, time in market 76% (average exposure 49%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR 0.4% points, max drawdown -51.8% points (negative = less drawdown), Calmar 0.42, time in market 63% (average exposure 29%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -8.2% points, max drawdown -54.1% points (negative = less drawdown), Calmar 0.16, time in market 76% (average exposure 32%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0428, SR0 0.0765 (annualised 1.21), DSR 0.116, round trips 3
- S2: daily SR 0.0607, SR0 0.0765 (annualised 1.21), DSR 0.286, round trips 113
- S3: daily SR 0.0381, SR0 0.0765 (annualised 1.21), DSR 0.087, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 32.55 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 87.53 | 11.6% | 33.1% | 2 | 372 | 87.37 | 372 |
| full | S2 | 100.54 | 14.7% | 10.0% | 44 | 490 | 98.30 | 490 |
| full | S3 | 76.23 | 8.6% | 18.5% | 1 | 449 | 76.18 | 449 |
| y2022 | S1 | 47.32 | -5.4% | 6.7% | 1 | 13 | 47.26 | 13 |
| y2022 | S2 | 50.38 | 0.8% | 0.6% | 1 | 9 | 50.33 | 9 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 91.87 | 17.8% | 28.0% | 1 | 336 | 91.78 | 336 |
| from2023 | S2 | 97.78 | 19.8% | 10.3% | 40 | 393 | 95.82 | 393 |
| from2023 | S3 | 75.44 | 11.7% | 18.7% | 1 | 336 | 75.39 | 336 |
| firstHalf | S1 | 83.50 | 22.3% | 33.1% | 1 | 36 | 83.41 | 36 |
| firstHalf | S2 | 84.60 | 22.9% | 10.0% | 28 | 97 | 83.43 | 97 |
| firstHalf | S3 | 70.89 | 14.7% | 11.1% | 0 | 113 | 70.87 | 113 |
| secondHalf | S1 | 53.65 | 2.8% | 24.8% | 1 | 336 | 53.58 | 336 |
| secondHalf | S2 | 62.68 | 9.3% | 15.7% | 16 | 393 | 61.70 | 393 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |

### QQQ->QLD (leverage 2)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 97.5% | 14.3% | 23.3% | 0.61 | 0.77 | -16.1% (2022-01) | 11.20 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 96.9% | 14.2% | 23.3% | 0.61 | 0.77 | -16.1% (2022-01) | 11.24 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 107.0% | 15.3% | 18.9% | 0.81 | 1.11 | -12.6% (2022-01) | 9.40 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 92.1% | 13.6% | 19.9% | 0.68 | 0.97 | -13.3% (2022-01) | 10.10 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 79.2% | 12.1% | 20.9% | 0.58 | 0.77 | -16.1% (2022-01) | 10.23 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 78.6% | 12.0% | 21.0% | 0.57 | 0.77 | -16.1% (2022-01) | 10.26 | 3 | 1.4 | 76% |
| buy-and-hold QLD | 152.7% | 19.9% | 63.7% | 0.31 | 0.63 | -26.1% (2022-04) | 28.23 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -14.2% | -14.2% | 15.9% | -0.89 | -2.05 | -15.3% (2022-01) | 15.27 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -14.3% | -14.3% | 16.0% | -0.90 | -2.06 | -15.4% (2022-01) | 15.31 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -16.6% | -16.7% | 18.5% | -0.90 | -2.12 | -13.4% (2022-01) | 17.45 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -17.5% | -17.6% | 19.3% | -0.91 | -2.22 | -14.1% (2022-01) | 18.29 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -9.6% | -9.6% | 11.2% | -0.85 | -1.96 | -10.8% (2022-01) | 10.69 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.6% | -9.7% | 11.3% | -0.86 | -1.97 | -10.9% (2022-01) | 10.71 | 1 | 2.0 | 6% |
| buy-and-hold QLD | -61.2% | -61.3% | 63.1% | -0.97 | -1.17 | -26.1% (2022-04) | 45.09 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 105.7% | 21.4% | 20.2% | 1.06 | 1.03 | -10.3% (2025-03) | 7.77 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 105.3% | 21.4% | 20.2% | 1.06 | 1.03 | -10.4% (2025-03) | 7.80 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 116.9% | 23.2% | 9.9% | 2.34 | 1.63 | -4.5% (2026-07) | 3.50 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 104.2% | 21.2% | 11.7% | 1.81 | 1.48 | -5.2% (2026-07) | 4.08 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 90.8% | 19.0% | 16.6% | 1.14 | 1.07 | -8.4% (2025-03) | 6.10 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 90.4% | 18.9% | 16.6% | 1.14 | 1.07 | -8.5% (2025-03) | 6.12 | 2 | 1.3 | 92% |
| buy-and-hold QLD | 446.7% | 58.0% | 42.4% | 1.37 | 1.33 | -15.8% (2025-03) | 10.06 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 49.3% | 17.0% | 23.3% | 0.73 | 0.97 | -16.1% (2022-01) | 12.83 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 49.1% | 16.9% | 23.3% | 0.73 | 0.97 | -16.1% (2022-01) | 12.87 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 51.6% | 17.7% | 18.9% | 0.93 | 1.17 | -12.6% (2022-01) | 12.70 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 46.4% | 16.1% | 19.9% | 0.81 | 1.06 | -13.3% (2022-01) | 13.52 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 33.3% | 11.9% | 20.9% | 0.57 | 0.86 | -16.1% (2022-01) | 12.66 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 33.1% | 11.9% | 21.0% | 0.56 | 0.85 | -16.1% (2022-01) | 12.69 | 1 | 1.2 | 60% |
| buy-and-hold QLD | 13.9% | 5.2% | 63.7% | 0.08 | 0.35 | -26.1% (2022-04) | 38.27 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 44.5% | 15.5% | 17.1% | 0.91 | 0.78 | -8.7% (2025-03) | 7.37 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 44.1% | 15.4% | 17.1% | 0.90 | 0.77 | -8.7% (2025-03) | 7.40 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 51.8% | 17.8% | 13.9% | 1.28 | 1.02 | -6.6% (2026-07) | 5.78 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 42.5% | 14.9% | 14.4% | 1.03 | 0.86 | -7.6% (2026-07) | 6.62 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 36.3% | 12.9% | 17.1% | 0.76 | 0.73 | -8.7% (2025-03) | 7.21 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 36.0% | 12.8% | 17.1% | 0.75 | 0.73 | -8.7% (2025-03) | 7.24 | 2 | 2.0 | 92% |
| buy-and-hold QLD | 125.1% | 37.4% | 42.4% | 0.88 | 0.96 | -15.8% (2025-03) | 11.15 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -5.7% points, max drawdown -40.4% points (negative = less drawdown), Calmar 0.30, time in market 76% (average exposure 47%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -4.6% points, max drawdown -44.7% points (negative = less drawdown), Calmar 0.50, time in market 63% (average exposure 30%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -7.8% points, max drawdown -42.7% points (negative = less drawdown), Calmar 0.27, time in market 76% (average exposure 40%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0485, SR0 0.0765 (annualised 1.21), DSR 0.160, round trips 3
- S2: daily SR 0.0697, SR0 0.0765 (annualised 1.21), DSR 0.405, round trips 113
- S3: daily SR 0.0486, SR0 0.0765 (annualised 1.21), DSR 0.162, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 38.33 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 80.71 | 9.8% | 16.9% | 1 | 449 | 80.64 | 449 |
| full | S2 | 71.55 | 7.3% | 7.1% | 12 | 696 | 70.76 | 696 |
| full | S3 | 82.22 | 10.2% | 16.6% | 1 | 470 | 82.15 | 470 |
| y2022 | S1 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| y2022 | S2 | 50.69 | 1.4% | 0.0% | 0 | 10 | 50.69 | 10 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 79.92 | 13.5% | 17.1% | 1 | 336 | 79.85 | 336 |
| from2023 | S2 | 70.75 | 9.8% | 7.2% | 12 | 595 | 69.97 | 595 |
| from2023 | S3 | 81.43 | 14.0% | 16.8% | 1 | 357 | 81.35 | 357 |
| firstHalf | S1 | 73.11 | 16.1% | 11.7% | 0 | 113 | 73.08 | 113 |
| firstHalf | S2 | 64.21 | 10.3% | 7.1% | 12 | 208 | 63.50 | 208 |
| firstHalf | S3 | 74.46 | 16.9% | 11.5% | 0 | 134 | 74.44 | 134 |
| secondHalf | S1 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |
| secondHalf | S2 | 55.71 | 4.3% | 0.0% | 0 | 488 | 55.71 | 488 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |

### QQQ->QQQ (leverage 1)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 61.2% | 9.8% | 10.8% | 0.91 | 1.04 | -8.1% (2022-01) | 5.02 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 60.7% | 9.7% | 10.9% | 0.90 | 1.03 | -8.2% (2022-01) | 5.05 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 57.2% | 9.3% | 10.4% | 0.89 | 1.24 | -6.7% (2022-01) | 5.04 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 42.3% | 7.2% | 11.5% | 0.62 | 0.94 | -7.4% (2022-01) | 5.77 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 61.2% | 9.8% | 10.8% | 0.91 | 1.04 | -8.1% (2022-01) | 5.02 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 60.7% | 9.7% | 10.9% | 0.90 | 1.03 | -8.2% (2022-01) | 5.05 | 3 | 1.4 | 76% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -6.8% | -6.9% | 8.5% | -0.81 | -1.87 | -8.1% (2022-01) | 7.96 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -6.9% | -7.0% | 8.5% | -0.82 | -1.90 | -8.2% (2022-01) | 8.01 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -7.9% | -7.9% | 9.5% | -0.83 | -2.04 | -7.0% (2022-01) | 8.89 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -8.8% | -8.8% | 10.4% | -0.85 | -2.23 | -7.7% (2022-01) | 9.74 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -6.8% | -6.9% | 8.5% | -0.81 | -1.87 | -8.1% (2022-01) | 7.96 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -6.9% | -7.0% | 8.5% | -0.82 | -1.90 | -8.2% (2022-01) | 8.01 | 1 | 2.0 | 6% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 64.0% | 14.2% | 9.3% | 1.53 | 1.37 | -4.6% (2025-03) | 3.10 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 63.6% | 14.2% | 9.3% | 1.53 | 1.36 | -4.7% (2025-03) | 3.12 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 63.2% | 14.1% | 5.2% | 2.72 | 1.83 | -2.8% (2026-07) | 1.82 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 50.5% | 11.6% | 7.0% | 1.67 | 1.49 | -3.6% (2026-07) | 2.48 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 64.0% | 14.2% | 9.3% | 1.53 | 1.37 | -4.6% (2025-03) | 3.10 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 63.6% | 14.2% | 9.3% | 1.53 | 1.36 | -4.7% (2025-03) | 3.12 | 2 | 1.3 | 92% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 27.3% | 9.9% | 10.8% | 0.92 | 1.15 | -8.1% (2022-01) | 6.12 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 27.1% | 9.8% | 10.9% | 0.91 | 1.14 | -8.2% (2022-01) | 6.16 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 25.7% | 9.4% | 10.4% | 0.90 | 1.24 | -6.7% (2022-01) | 6.81 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 20.6% | 7.6% | 11.5% | 0.66 | 1.00 | -7.4% (2022-01) | 7.64 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 27.3% | 9.9% | 10.8% | 0.92 | 1.15 | -8.1% (2022-01) | 6.12 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 27.1% | 9.8% | 10.9% | 0.91 | 1.14 | -8.2% (2022-01) | 6.16 | 1 | 1.2 | 60% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 30.8% | 11.1% | 8.3% | 1.33 | 1.07 | -4.2% (2025-03) | 3.21 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 30.4% | 11.0% | 8.3% | 1.32 | 1.06 | -4.2% (2025-03) | 3.23 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 29.4% | 10.6% | 6.8% | 1.57 | 1.19 | -3.6% (2026-07) | 2.71 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 20.2% | 7.5% | 7.2% | 1.03 | 0.83 | -4.5% (2026-07) | 3.54 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 30.8% | 11.1% | 8.3% | 1.33 | 1.07 | -4.2% (2025-03) | 3.21 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 30.4% | 11.0% | 8.3% | 1.32 | 1.06 | -4.2% (2025-03) | 3.23 | 2 | 2.0 | 92% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -5.7% points, max drawdown -24.2% points (negative = less drawdown), Calmar 0.47, time in market 76% (average exposure 45%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -6.2% points, max drawdown -24.6% points (negative = less drawdown), Calmar 0.45, time in market 63% (average exposure 33%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -5.7% points, max drawdown -24.2% points (negative = less drawdown), Calmar 0.47, time in market 76% (average exposure 45%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0656, SR0 0.0765 (annualised 1.21), DSR 0.351, round trips 3
- S2: daily SR 0.0784, SR0 0.0765 (annualised 1.21), DSR 0.527, round trips 113
- S3: daily SR 0.0656, SR0 0.0765 (annualised 1.21), DSR 0.351, round trips 3

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
| S1 {"n":200,"bandPct":2} (5 bps) | 76.3% | 11.8% | 34.3% | 0.34 | 0.59 | -13.3% (2025-03) | 15.78 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 75.5% | 11.6% | 34.5% | 0.34 | 0.58 | -13.4% (2025-03) | 15.88 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 83.9% | 12.7% | 15.8% | 0.80 | 0.84 | -9.2% (2021-09) | 6.06 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 69.2% | 10.9% | 16.5% | 0.66 | 0.71 | -9.6% (2021-09) | 7.18 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 60.9% | 9.8% | 23.9% | 0.41 | 0.65 | -9.4% (2025-03) | 11.63 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 60.2% | 9.7% | 24.0% | 0.40 | 0.64 | -9.5% (2025-03) | 11.69 | 5 | 2.2 | 79% |
| buy-and-hold UPRO | 154.8% | 20.1% | 63.9% | 0.31 | 0.62 | -27.2% (2022-09) | 29.50 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -26.5% | -26.6% | 27.8% | -0.95 | -1.83 | -13.5% (2022-04) | 24.33 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -26.7% | -26.7% | 28.0% | -0.96 | -1.84 | -13.6% (2022-04) | 24.44 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -0.2% | -0.2% | 10.2% | -0.02 | 0.02 | -2.9% (2022-01) | 2.50 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -1.4% | -1.4% | 10.5% | -0.13 | -0.12 | -3.4% (2022-01) | 3.33 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -14.5% | -14.5% | 15.9% | -0.91 | -1.71 | -6.8% (2022-01) | 14.08 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -14.6% | -14.6% | 16.0% | -0.91 | -1.72 | -6.8% (2022-01) | 14.13 | 2 | 4.0 | 22% |
| buy-and-hold UPRO | -57.3% | -57.5% | 63.9% | -0.90 | -0.83 | -27.2% (2022-09) | 44.07 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 94.9% | 19.7% | 20.3% | 0.97 | 0.93 | -11.9% (2025-03) | 7.69 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 94.3% | 19.6% | 20.3% | 0.97 | 0.92 | -12.0% (2025-03) | 7.72 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 82.3% | 17.5% | 13.7% | 1.28 | 1.06 | -6.8% (2023-09) | 5.15 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 70.6% | 15.5% | 15.4% | 1.01 | 0.93 | -7.7% (2023-09) | 5.94 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 76.4% | 16.5% | 16.4% | 1.01 | 0.99 | -9.4% (2025-03) | 5.81 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 75.8% | 16.4% | 16.4% | 1.00 | 0.99 | -9.5% (2025-03) | 5.83 | 3 | 1.9 | 93% |
| buy-and-hold UPRO | 374.0% | 52.0% | 48.9% | 1.06 | 1.17 | -17.6% (2025-03) | 10.90 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 19.3% | 7.2% | 34.3% | 0.21 | 0.42 | -12.0% (2022-04) | 20.55 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 18.9% | 7.0% | 34.5% | 0.20 | 0.41 | -12.1% (2022-04) | 20.68 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 42.2% | 14.8% | 15.8% | 0.94 | 0.88 | -9.2% (2021-09) | 7.31 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 35.3% | 12.6% | 16.5% | 0.76 | 0.75 | -9.6% (2021-09) | 8.65 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 16.6% | 6.2% | 23.9% | 0.26 | 0.46 | -9.2% (2022-01) | 15.24 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 16.2% | 6.1% | 24.0% | 0.25 | 0.46 | -9.2% (2022-01) | 15.32 | 3 | 2.7 | 66% |
| buy-and-hold UPRO | 8.6% | 3.3% | 63.9% | 0.05 | 0.33 | -27.2% (2022-09) | 40.00 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 52.3% | 17.9% | 18.1% | 0.99 | 0.85 | -12.2% (2026-03) | 6.95 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 51.9% | 17.8% | 18.0% | 0.99 | 0.85 | -12.2% (2026-03) | 6.98 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 39.9% | 14.1% | 18.2% | 0.77 | 0.82 | -5.5% (2026-02) | 6.06 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 32.9% | 11.8% | 18.6% | 0.63 | 0.69 | -6.2% (2026-02) | 6.86 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 39.8% | 14.0% | 17.8% | 0.79 | 0.79 | -10.3% (2025-03) | 6.79 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 39.5% | 13.9% | 17.8% | 0.78 | 0.79 | -10.3% (2025-03) | 6.82 | 2 | 2.0 | 92% |
| buy-and-hold UPRO | 137.8% | 40.4% | 48.9% | 0.83 | 0.96 | -17.6% (2025-03) | 11.27 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -8.4% points, max drawdown -29.7% points (negative = less drawdown), Calmar 0.03, time in market 79% (average exposure 52%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -7.4% points, max drawdown -48.2% points (negative = less drawdown), Calmar 0.49, time in market 66% (average exposure 33%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -10.3% points, max drawdown -40.1% points (negative = less drawdown), Calmar 0.09, time in market 79% (average exposure 37%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0371, SR0 0.0765 (annualised 1.21), DSR 0.081, round trips 5
- S2: daily SR 0.0528, SR0 0.0765 (annualised 1.21), DSR 0.200, round trips 109
- S3: daily SR 0.0406, SR0 0.0765 (annualised 1.21), DSR 0.102, round trips 5

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 59.70 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

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

### SPY->SSO (leverage 2)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 58.7% | 9.5% | 23.0% | 0.41 | 0.69 | -8.0% (2025-03) | 10.16 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 57.9% | 9.4% | 23.2% | 0.40 | 0.68 | -8.1% (2025-03) | 10.27 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 57.5% | 9.3% | 10.7% | 0.87 | 0.88 | -6.2% (2021-09) | 4.16 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 42.9% | 7.2% | 12.1% | 0.60 | 0.67 | -6.5% (2021-09) | 5.32 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 61.7% | 9.9% | 20.2% | 0.49 | 0.74 | -7.8% (2025-03) | 9.03 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 61.0% | 9.8% | 20.4% | 0.48 | 0.73 | -7.9% (2025-03) | 9.11 | 5 | 2.2 | 79% |
| buy-and-hold SSO | 130.0% | 17.7% | 46.9% | 0.38 | 0.65 | -18.5% (2022-09) | 19.14 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -17.5% | -17.6% | 19.0% | -0.93 | -1.71 | -8.5% (2022-04) | 16.49 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -17.7% | -17.8% | 19.1% | -0.93 | -1.73 | -8.6% (2022-04) | 16.62 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -0.5% | -0.5% | 7.4% | -0.07 | -0.06 | -2.5% (2022-01) | 2.31 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -1.7% | -1.8% | 7.7% | -0.23 | -0.25 | -3.1% (2022-01) | 3.26 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -14.6% | -14.6% | 16.1% | -0.91 | -1.61 | -6.7% (2022-01) | 14.20 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -14.8% | -14.8% | 16.2% | -0.91 | -1.64 | -6.7% (2022-01) | 14.29 | 2 | 4.0 | 22% |
| buy-and-hold SSO | -39.5% | -39.6% | 46.8% | -0.85 | -0.80 | -18.5% (2022-09) | 30.56 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 70.0% | 15.4% | 12.8% | 1.20 | 1.07 | -7.4% (2025-03) | 4.64 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 69.5% | 15.3% | 12.8% | 1.19 | 1.06 | -7.5% (2025-03) | 4.67 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 56.8% | 12.9% | 9.7% | 1.32 | 1.13 | -4.6% (2023-09) | 3.56 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 45.2% | 10.6% | 11.3% | 0.93 | 0.91 | -5.6% (2023-09) | 4.39 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 70.0% | 15.4% | 12.7% | 1.21 | 1.07 | -7.4% (2025-03) | 4.63 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 69.5% | 15.3% | 12.7% | 1.20 | 1.07 | -7.5% (2025-03) | 4.65 | 3 | 1.9 | 93% |
| buy-and-hold SSO | 223.9% | 37.2% | 35.1% | 1.06 | 1.22 | -11.9% (2025-03) | 7.09 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 15.3% | 5.7% | 23.0% | 0.25 | 0.46 | -7.8% (2022-04) | 13.47 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 14.9% | 5.6% | 23.2% | 0.24 | 0.45 | -7.9% (2022-04) | 13.61 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 27.1% | 9.9% | 10.7% | 0.92 | 0.88 | -6.2% (2021-09) | 4.95 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 20.3% | 7.5% | 12.1% | 0.62 | 0.67 | -6.5% (2021-09) | 6.32 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 18.1% | 6.7% | 20.2% | 0.33 | 0.55 | -6.7% (2022-01) | 11.79 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 17.7% | 6.6% | 20.4% | 0.32 | 0.55 | -6.7% (2022-01) | 11.90 | 3 | 2.7 | 66% |
| buy-and-hold SSO | 18.0% | 6.7% | 46.9% | 0.14 | 0.36 | -18.5% (2022-09) | 26.05 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 40.2% | 14.2% | 11.6% | 1.22 | 0.99 | -7.9% (2026-03) | 4.35 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 39.8% | 14.0% | 11.6% | 1.21 | 0.98 | -7.9% (2026-03) | 4.38 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 28.7% | 10.4% | 12.0% | 0.87 | 0.87 | -3.9% (2026-02) | 4.02 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 21.7% | 8.0% | 12.4% | 0.65 | 0.68 | -4.6% (2026-02) | 4.85 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 39.0% | 13.8% | 11.6% | 1.18 | 1.00 | -6.8% (2025-03) | 4.29 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 38.6% | 13.7% | 11.6% | 1.17 | 0.99 | -6.9% (2025-03) | 4.31 | 2 | 2.0 | 92% |
| buy-and-hold SSO | 96.5% | 30.3% | 35.1% | 0.86 | 1.01 | -11.9% (2025-03) | 7.31 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -8.3% points, max drawdown -24.0% points (negative = less drawdown), Calmar 0.03, time in market 79% (average exposure 49%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -8.4% points, max drawdown -36.2% points (negative = less drawdown), Calmar 0.49, time in market 66% (average exposure 35%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -7.8% points, max drawdown -26.7% points (negative = less drawdown), Calmar 0.11, time in market 79% (average exposure 47%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0432, SR0 0.0765 (annualised 1.21), DSR 0.119, round trips 5
- S2: daily SR 0.0554, SR0 0.0765 (annualised 1.21), DSR 0.228, round trips 109
- S3: daily SR 0.0464, SR0 0.0765 (annualised 1.21), DSR 0.143, round trips 5

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 30.84 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 69.40 | 6.6% | 18.6% | 4 | 358 | 69.13 | 358 |
| full | S2 | 71.20 | 7.2% | 6.8% | 39 | 556 | 68.83 | 556 |
| full | S3 | 69.43 | 6.6% | 18.5% | 4 | 361 | 69.16 | 361 |
| y2022 | S1 | 48.56 | -2.9% | 10.6% | 2 | 26 | 48.44 | 26 |
| y2022 | S2 | 51.70 | 3.4% | 0.0% | 1 | 17 | 51.64 | 17 |
| y2022 | S3 | 48.75 | -2.5% | 10.3% | 2 | 28 | 48.63 | 28 |
| from2023 | S1 | 71.97 | 10.3% | 11.4% | 2 | 338 | 71.84 | 338 |
| from2023 | S2 | 67.37 | 8.4% | 7.3% | 34 | 474 | 65.36 | 474 |
| from2023 | S3 | 71.97 | 10.3% | 11.4% | 2 | 338 | 71.84 | 338 |
| firstHalf | S1 | 59.38 | 7.0% | 18.6% | 3 | 20 | 59.18 | 20 |
| firstHalf | S2 | 65.32 | 11.0% | 6.8% | 38 | 82 | 63.22 | 82 |
| firstHalf | S3 | 59.41 | 7.0% | 18.5% | 3 | 23 | 59.21 | 23 |
| secondHalf | S1 | 55.71 | 4.3% | 0.0% | 0 | 593 | 55.71 | 593 |
| secondHalf | S2 | 55.71 | 4.3% | 0.0% | 0 | 503 | 55.71 | 503 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 593 | 55.71 | 593 |

### SPY->SPY (leverage 1)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 42.1% | 7.1% | 10.4% | 0.68 | 1.03 | -3.8% (2022-04) | 4.52 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 41.3% | 7.0% | 10.6% | 0.66 | 1.01 | -3.9% (2022-04) | 4.60 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 38.2% | 6.5% | 5.4% | 1.21 | 1.19 | -3.3% (2021-09) | 1.83 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 23.6% | 4.2% | 6.8% | 0.63 | 0.75 | -3.6% (2021-09) | 2.87 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 42.1% | 7.1% | 10.4% | 0.68 | 1.03 | -3.8% (2022-04) | 4.52 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 41.3% | 7.0% | 10.6% | 0.66 | 1.01 | -3.9% (2022-04) | 4.60 | 5 | 2.2 | 79% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -8.1% | -8.2% | 9.5% | -0.86 | -1.55 | -4.0% (2022-04) | 8.11 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -8.4% | -8.4% | 9.7% | -0.87 | -1.60 | -4.0% (2022-04) | 8.25 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 0.6% | 0.6% | 3.5% | 0.18 | 0.23 | -1.2% (2022-01) | 0.92 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -0.6% | -0.6% | 3.8% | -0.16 | -0.20 | -1.7% (2022-01) | 1.81 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -8.1% | -8.2% | 9.5% | -0.86 | -1.55 | -4.0% (2022-04) | 8.11 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -8.4% | -8.4% | 9.7% | -0.87 | -1.60 | -4.0% (2022-04) | 8.25 | 2 | 4.0 | 22% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 46.2% | 10.8% | 5.9% | 1.81 | 1.52 | -3.2% (2025-03) | 1.94 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 45.6% | 10.7% | 5.9% | 1.79 | 1.50 | -3.3% (2025-03) | 1.96 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 36.9% | 8.8% | 5.5% | 1.61 | 1.48 | -2.4% (2023-09) | 1.63 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 25.3% | 6.3% | 6.7% | 0.94 | 1.03 | -3.3% (2023-09) | 2.46 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 46.2% | 10.8% | 5.9% | 1.81 | 1.52 | -3.2% (2025-03) | 1.94 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 45.6% | 10.7% | 5.9% | 1.79 | 1.50 | -3.3% (2025-03) | 1.96 | 3 | 1.9 | 93% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 12.3% | 4.7% | 10.4% | 0.45 | 0.70 | -3.8% (2022-04) | 6.06 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 11.9% | 4.5% | 10.6% | 0.42 | 0.68 | -3.9% (2022-04) | 6.18 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 17.0% | 6.3% | 5.2% | 1.22 | 1.13 | -3.3% (2021-09) | 2.10 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 10.1% | 3.9% | 6.8% | 0.57 | 0.69 | -3.6% (2021-09) | 3.32 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 12.3% | 4.7% | 10.4% | 0.45 | 0.70 | -3.8% (2022-04) | 6.06 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 11.9% | 4.5% | 10.6% | 0.42 | 0.68 | -3.9% (2022-04) | 6.18 | 3 | 2.7 | 66% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 27.9% | 10.1% | 5.8% | 1.74 | 1.40 | -3.7% (2026-03) | 1.93 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 27.5% | 10.0% | 5.8% | 1.72 | 1.39 | -3.7% (2026-03) | 1.95 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 19.8% | 7.3% | 6.3% | 1.16 | 1.18 | -2.1% (2026-02) | 1.84 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 12.7% | 4.8% | 6.7% | 0.72 | 0.78 | -2.7% (2026-02) | 2.63 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 27.9% | 10.1% | 5.8% | 1.74 | 1.40 | -3.7% (2026-03) | 1.93 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 27.5% | 10.0% | 5.8% | 1.72 | 1.39 | -3.7% (2026-03) | 1.95 | 2 | 2.0 | 92% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -5.9% points, max drawdown -14.1% points (negative = less drawdown), Calmar 0.15, time in market 79% (average exposure 47%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -6.5% points, max drawdown -19.1% points (negative = less drawdown), Calmar 0.67, time in market 66% (average exposure 35%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -5.9% points, max drawdown -14.1% points (negative = less drawdown), Calmar 0.15, time in market 79% (average exposure 47%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0650, SR0 0.0765 (annualised 1.21), DSR 0.342, round trips 5
- S2: daily SR 0.0750, SR0 0.0765 (annualised 1.21), DSR 0.480, round trips 109
- S3: daily SR 0.0650, SR0 0.0765 (annualised 1.21), DSR 0.342, round trips 5

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
| QQQ->TQQQ | S1 | {"n":150,"bandPct":0} |  | 17.9% | 26.7% | 0.67 | 0.76 | 14 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":1} |  | 17.1% | 27.0% | 0.63 | 0.73 | 6 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":2} |  | 14.7% | 28.5% | 0.52 | 0.65 | 6 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":3} |  | 20.4% | 32.1% | 0.64 | 0.76 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":0} |  | 19.7% | 27.5% | 0.71 | 0.83 | 10 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":1} |  | 23.1% | 32.1% | 0.72 | 0.84 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":2} |  | 20.5% | 32.9% | 0.62 | 0.74 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":3} |  | 19.0% | 32.9% | 0.58 | 0.71 | 3 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":0} |  | 20.8% | 39.2% | 0.53 | 0.72 | 10 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":1} |  | 20.4% | 33.7% | 0.61 | 0.73 | 5 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":2} | yes | 17.8% | 34.8% | 0.51 | 0.68 | 3 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":3} |  | 17.5% | 34.8% | 0.50 | 0.67 | 3 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":0} |  | 18.0% | 50.0% | 0.36 | 0.63 | 13 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":1} |  | 15.1% | 52.1% | 0.29 | 0.57 | 7 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":2} |  | 17.0% | 43.7% | 0.39 | 0.63 | 5 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":3} |  | 18.8% | 32.8% | 0.58 | 0.71 | 3 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":0} |  | 17.0% | 53.7% | 0.32 | 0.60 | 14 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":1} |  | 16.8% | 43.1% | 0.39 | 0.61 | 7 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":2} |  | 16.7% | 44.2% | 0.38 | 0.60 | 7 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":3} |  | 15.8% | 50.5% | 0.31 | 0.57 | 4 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":8} |  | 17.2% | 24.3% | 0.71 | 0.90 | 101 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":10} |  | 17.2% | 24.3% | 0.71 | 0.90 | 101 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":15} |  | 17.2% | 24.3% | 0.71 | 0.90 | 101 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":8} |  | 19.6% | 29.9% | 0.65 | 0.96 | 113 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":10} | yes | 19.6% | 29.9% | 0.65 | 0.96 | 113 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":15} |  | 19.6% | 29.9% | 0.65 | 0.96 | 113 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":8} |  | 16.8% | 33.4% | 0.50 | 0.81 | 123 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":10} |  | 16.8% | 33.4% | 0.50 | 0.81 | 123 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":15} |  | 16.8% | 33.4% | 0.50 | 0.81 | 123 |
| QQQ->TQQQ | S3 | {"targetVolPct":15} |  | 9.3% | 21.1% | 0.44 | 0.63 | 3 |
| QQQ->TQQQ | S3 | {"targetVolPct":20} | yes | 10.9% | 27.6% | 0.40 | 0.61 | 3 |
| QQQ->QLD | S1 | {"n":150,"bandPct":0} |  | 14.3% | 17.4% | 0.82 | 0.87 | 14 |
| QQQ->QLD | S1 | {"n":150,"bandPct":1} |  | 14.0% | 17.5% | 0.80 | 0.86 | 6 |
| QQQ->QLD | S1 | {"n":150,"bandPct":2} |  | 12.4% | 18.5% | 0.67 | 0.77 | 6 |
| QQQ->QLD | S1 | {"n":150,"bandPct":3} |  | 16.0% | 20.9% | 0.77 | 0.86 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":0} |  | 15.7% | 18.2% | 0.86 | 0.96 | 10 |
| QQQ->QLD | S1 | {"n":175,"bandPct":1} |  | 17.8% | 20.9% | 0.85 | 0.94 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":2} |  | 16.1% | 21.4% | 0.75 | 0.84 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":3} |  | 15.0% | 21.4% | 0.70 | 0.79 | 3 |
| QQQ->QLD | S1 | {"n":200,"bandPct":0} |  | 15.6% | 26.9% | 0.58 | 0.78 | 10 |
| QQQ->QLD | S1 | {"n":200,"bandPct":1} |  | 15.9% | 22.4% | 0.71 | 0.81 | 5 |
| QQQ->QLD | S1 | {"n":200,"bandPct":2} | yes | 14.3% | 23.3% | 0.61 | 0.77 | 3 |
| QQQ->QLD | S1 | {"n":200,"bandPct":3} |  | 14.0% | 23.3% | 0.60 | 0.76 | 3 |
| QQQ->QLD | S1 | {"n":225,"bandPct":0} |  | 13.8% | 34.2% | 0.40 | 0.67 | 13 |
| QQQ->QLD | S1 | {"n":225,"bandPct":1} |  | 12.1% | 35.9% | 0.34 | 0.62 | 7 |
| QQQ->QLD | S1 | {"n":225,"bandPct":2} |  | 13.6% | 29.3% | 0.46 | 0.70 | 5 |
| QQQ->QLD | S1 | {"n":225,"bandPct":3} |  | 14.9% | 20.9% | 0.72 | 0.80 | 3 |
| QQQ->QLD | S1 | {"n":250,"bandPct":0} |  | 13.6% | 36.4% | 0.37 | 0.65 | 14 |
| QQQ->QLD | S1 | {"n":250,"bandPct":1} |  | 13.0% | 28.9% | 0.45 | 0.66 | 7 |
| QQQ->QLD | S1 | {"n":250,"bandPct":2} |  | 13.1% | 29.4% | 0.45 | 0.66 | 7 |
| QQQ->QLD | S1 | {"n":250,"bandPct":3} |  | 12.6% | 35.1% | 0.36 | 0.61 | 4 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":8} |  | 13.7% | 13.2% | 1.04 | 1.05 | 101 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":10} |  | 13.7% | 13.2% | 1.04 | 1.05 | 101 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":15} |  | 13.7% | 13.2% | 1.04 | 1.05 | 101 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":8} |  | 15.3% | 18.9% | 0.81 | 1.11 | 113 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":10} | yes | 15.3% | 18.9% | 0.81 | 1.11 | 113 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":15} |  | 15.3% | 18.9% | 0.81 | 1.11 | 113 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":8} |  | 13.6% | 20.8% | 0.66 | 0.96 | 123 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":10} |  | 13.6% | 20.8% | 0.66 | 0.96 | 123 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":15} |  | 13.6% | 20.8% | 0.66 | 0.96 | 123 |
| QQQ->QLD | S3 | {"targetVolPct":15} |  | 9.8% | 19.7% | 0.50 | 0.74 | 3 |
| QQQ->QLD | S3 | {"targetVolPct":20} | yes | 12.1% | 20.9% | 0.58 | 0.77 | 3 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":0} |  | 9.9% | 8.0% | 1.25 | 1.16 | 14 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":1} |  | 9.7% | 8.2% | 1.19 | 1.14 | 6 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":2} |  | 8.8% | 8.9% | 0.99 | 1.03 | 6 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":3} |  | 10.7% | 9.4% | 1.14 | 1.14 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":0} |  | 10.6% | 8.9% | 1.19 | 1.26 | 10 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":1} |  | 11.6% | 9.4% | 1.22 | 1.23 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":2} |  | 10.7% | 9.6% | 1.11 | 1.11 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":3} |  | 10.1% | 9.6% | 1.05 | 1.06 | 3 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":0} |  | 10.3% | 12.0% | 0.85 | 1.05 | 10 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":1} |  | 10.6% | 10.9% | 0.97 | 1.09 | 5 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":2} | yes | 9.8% | 10.8% | 0.91 | 1.04 | 3 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":3} |  | 9.7% | 10.8% | 0.90 | 1.03 | 3 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":0} |  | 9.2% | 16.5% | 0.56 | 0.91 | 13 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":1} |  | 8.6% | 17.3% | 0.49 | 0.86 | 7 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":2} |  | 9.4% | 13.8% | 0.68 | 0.96 | 5 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":3} |  | 10.2% | 9.4% | 1.08 | 1.08 | 3 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":0} |  | 9.1% | 18.0% | 0.51 | 0.88 | 14 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":1} |  | 8.9% | 13.7% | 0.65 | 0.89 | 7 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":2} |  | 8.8% | 14.2% | 0.62 | 0.88 | 7 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":3} |  | 8.9% | 16.6% | 0.53 | 0.84 | 4 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":8} |  | 8.4% | 7.0% | 1.19 | 1.17 | 101 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":10} |  | 8.4% | 7.0% | 1.19 | 1.17 | 101 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":15} |  | 8.4% | 7.0% | 1.19 | 1.17 | 101 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":8} |  | 9.3% | 10.4% | 0.89 | 1.24 | 113 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":10} | yes | 9.3% | 10.4% | 0.89 | 1.24 | 113 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":15} |  | 9.3% | 10.4% | 0.89 | 1.24 | 113 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":8} |  | 8.1% | 11.9% | 0.69 | 1.07 | 123 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":10} |  | 8.1% | 11.9% | 0.69 | 1.07 | 123 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":15} |  | 8.1% | 11.9% | 0.69 | 1.07 | 123 |
| QQQ->QQQ | S3 | {"targetVolPct":15} |  | 9.8% | 10.8% | 0.91 | 1.04 | 3 |
| QQQ->QQQ | S3 | {"targetVolPct":20} | yes | 9.8% | 10.8% | 0.91 | 1.04 | 3 |
| SPY->UPRO | S1 | {"n":150,"bandPct":0} |  | 14.1% | 35.2% | 0.40 | 0.68 | 16 |
| SPY->UPRO | S1 | {"n":150,"bandPct":1} |  | 11.3% | 45.9% | 0.25 | 0.54 | 9 |
| SPY->UPRO | S1 | {"n":150,"bandPct":2} |  | 9.0% | 46.5% | 0.19 | 0.46 | 7 |
| SPY->UPRO | S1 | {"n":150,"bandPct":3} |  | 10.1% | 30.9% | 0.33 | 0.55 | 5 |
| SPY->UPRO | S1 | {"n":175,"bandPct":0} |  | 7.2% | 57.3% | 0.13 | 0.38 | 21 |
| SPY->UPRO | S1 | {"n":175,"bandPct":1} |  | 10.4% | 45.7% | 0.23 | 0.51 | 9 |
| SPY->UPRO | S1 | {"n":175,"bandPct":2} |  | 10.6% | 41.9% | 0.25 | 0.52 | 7 |
| SPY->UPRO | S1 | {"n":175,"bandPct":3} |  | 10.0% | 35.3% | 0.28 | 0.52 | 5 |
| SPY->UPRO | S1 | {"n":200,"bandPct":0} |  | 12.5% | 35.4% | 0.35 | 0.61 | 15 |
| SPY->UPRO | S1 | {"n":200,"bandPct":1} |  | 11.4% | 39.4% | 0.29 | 0.56 | 9 |
| SPY->UPRO | S1 | {"n":200,"bandPct":2} | yes | 11.8% | 34.3% | 0.34 | 0.59 | 5 |
| SPY->UPRO | S1 | {"n":200,"bandPct":3} |  | 10.6% | 43.7% | 0.24 | 0.52 | 4 |
| SPY->UPRO | S1 | {"n":225,"bandPct":0} |  | 13.3% | 33.3% | 0.40 | 0.64 | 14 |
| SPY->UPRO | S1 | {"n":225,"bandPct":1} |  | 12.7% | 30.1% | 0.42 | 0.63 | 7 |
| SPY->UPRO | S1 | {"n":225,"bandPct":2} |  | 12.3% | 39.7% | 0.31 | 0.59 | 4 |
| SPY->UPRO | S1 | {"n":225,"bandPct":3} |  | 10.1% | 47.0% | 0.22 | 0.49 | 3 |
| SPY->UPRO | S1 | {"n":250,"bandPct":0} |  | 13.0% | 31.7% | 0.41 | 0.62 | 17 |
| SPY->UPRO | S1 | {"n":250,"bandPct":1} |  | 12.7% | 42.2% | 0.30 | 0.57 | 6 |
| SPY->UPRO | S1 | {"n":250,"bandPct":2} |  | 10.3% | 45.1% | 0.23 | 0.48 | 4 |
| SPY->UPRO | S1 | {"n":250,"bandPct":3} |  | 11.0% | 40.6% | 0.27 | 0.51 | 4 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":8} |  | 11.7% | 23.5% | 0.50 | 0.74 | 99 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":10} |  | 11.7% | 23.5% | 0.50 | 0.74 | 99 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":15} |  | 11.7% | 23.5% | 0.50 | 0.74 | 99 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":8} |  | 12.7% | 15.8% | 0.80 | 0.84 | 109 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":10} | yes | 12.7% | 15.8% | 0.80 | 0.84 | 109 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":15} |  | 12.7% | 15.8% | 0.80 | 0.84 | 109 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":8} |  | 8.7% | 35.7% | 0.24 | 0.53 | 127 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":10} |  | 8.7% | 35.7% | 0.24 | 0.53 | 127 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":15} |  | 8.7% | 35.7% | 0.24 | 0.53 | 127 |
| SPY->UPRO | S3 | {"targetVolPct":15} |  | 8.4% | 18.1% | 0.46 | 0.69 | 5 |
| SPY->UPRO | S3 | {"targetVolPct":20} | yes | 9.8% | 23.9% | 0.41 | 0.65 | 5 |
| SPY->SSO | S1 | {"n":150,"bandPct":0} |  | 10.9% | 23.5% | 0.46 | 0.77 | 16 |
| SPY->SSO | S1 | {"n":150,"bandPct":1} |  | 8.9% | 31.3% | 0.28 | 0.62 | 9 |
| SPY->SSO | S1 | {"n":150,"bandPct":2} |  | 7.5% | 31.6% | 0.24 | 0.53 | 7 |
| SPY->SSO | S1 | {"n":150,"bandPct":3} |  | 8.3% | 20.7% | 0.40 | 0.64 | 5 |
| SPY->SSO | S1 | {"n":175,"bandPct":0} |  | 6.3% | 39.8% | 0.16 | 0.44 | 21 |
| SPY->SSO | S1 | {"n":175,"bandPct":1} |  | 8.4% | 30.9% | 0.27 | 0.58 | 9 |
| SPY->SSO | S1 | {"n":175,"bandPct":2} |  | 8.6% | 28.3% | 0.30 | 0.61 | 7 |
| SPY->SSO | S1 | {"n":175,"bandPct":3} |  | 8.3% | 23.7% | 0.35 | 0.61 | 5 |
| SPY->SSO | S1 | {"n":200,"bandPct":0} |  | 9.7% | 23.8% | 0.41 | 0.69 | 15 |
| SPY->SSO | S1 | {"n":200,"bandPct":1} |  | 9.1% | 26.2% | 0.35 | 0.65 | 9 |
| SPY->SSO | S1 | {"n":200,"bandPct":2} | yes | 9.5% | 23.0% | 0.41 | 0.69 | 5 |
| SPY->SSO | S1 | {"n":200,"bandPct":3} |  | 8.6% | 30.1% | 0.29 | 0.60 | 4 |
| SPY->SSO | S1 | {"n":225,"bandPct":0} |  | 10.3% | 22.0% | 0.47 | 0.72 | 14 |
| SPY->SSO | S1 | {"n":225,"bandPct":1} |  | 9.9% | 20.0% | 0.50 | 0.71 | 7 |
| SPY->SSO | S1 | {"n":225,"bandPct":2} |  | 9.8% | 26.9% | 0.37 | 0.68 | 4 |
| SPY->SSO | S1 | {"n":225,"bandPct":3} |  | 8.3% | 32.4% | 0.25 | 0.55 | 3 |
| SPY->SSO | S1 | {"n":250,"bandPct":0} |  | 9.9% | 21.6% | 0.46 | 0.69 | 17 |
| SPY->SSO | S1 | {"n":250,"bandPct":1} |  | 9.6% | 28.7% | 0.34 | 0.62 | 6 |
| SPY->SSO | S1 | {"n":250,"bandPct":2} |  | 8.2% | 30.2% | 0.27 | 0.53 | 4 |
| SPY->SSO | S1 | {"n":250,"bandPct":3} |  | 8.7% | 27.1% | 0.32 | 0.57 | 4 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":8} |  | 8.7% | 15.6% | 0.56 | 0.80 | 99 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":10} |  | 8.7% | 15.6% | 0.56 | 0.80 | 99 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":15} |  | 8.7% | 15.6% | 0.56 | 0.80 | 99 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":8} |  | 9.3% | 10.7% | 0.87 | 0.88 | 109 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":10} | yes | 9.3% | 10.7% | 0.87 | 0.88 | 109 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":15} |  | 9.3% | 10.7% | 0.87 | 0.88 | 109 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":8} |  | 6.4% | 23.9% | 0.27 | 0.56 | 127 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":10} |  | 6.4% | 23.9% | 0.27 | 0.56 | 127 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":15} |  | 6.4% | 23.9% | 0.27 | 0.56 | 127 |
| SPY->SSO | S3 | {"targetVolPct":15} |  | 8.6% | 17.8% | 0.48 | 0.76 | 5 |
| SPY->SSO | S3 | {"targetVolPct":20} | yes | 9.9% | 20.2% | 0.49 | 0.74 | 5 |
| SPY->SPY | S1 | {"n":150,"bandPct":0} |  | 7.7% | 11.0% | 0.70 | 1.12 | 16 |
| SPY->SPY | S1 | {"n":150,"bandPct":1} |  | 6.8% | 14.3% | 0.47 | 0.97 | 9 |
| SPY->SPY | S1 | {"n":150,"bandPct":2} |  | 6.1% | 14.9% | 0.41 | 0.87 | 7 |
| SPY->SPY | S1 | {"n":150,"bandPct":3} |  | 6.5% | 9.5% | 0.69 | 1.00 | 5 |
| SPY->SPY | S1 | {"n":175,"bandPct":0} |  | 5.4% | 19.2% | 0.28 | 0.75 | 21 |
| SPY->SPY | S1 | {"n":175,"bandPct":1} |  | 6.5% | 14.6% | 0.44 | 0.92 | 9 |
| SPY->SPY | S1 | {"n":175,"bandPct":2} |  | 6.6% | 13.4% | 0.50 | 0.95 | 7 |
| SPY->SPY | S1 | {"n":175,"bandPct":3} |  | 6.5% | 10.8% | 0.60 | 0.95 | 5 |
| SPY->SPY | S1 | {"n":200,"bandPct":0} |  | 7.2% | 10.8% | 0.67 | 1.05 | 15 |
| SPY->SPY | S1 | {"n":200,"bandPct":1} |  | 6.9% | 12.3% | 0.56 | 0.99 | 9 |
| SPY->SPY | S1 | {"n":200,"bandPct":2} | yes | 7.1% | 10.4% | 0.68 | 1.03 | 5 |
| SPY->SPY | S1 | {"n":200,"bandPct":3} |  | 6.6% | 14.3% | 0.46 | 0.92 | 4 |
| SPY->SPY | S1 | {"n":225,"bandPct":0} |  | 7.4% | 10.0% | 0.75 | 1.07 | 14 |
| SPY->SPY | S1 | {"n":225,"bandPct":1} |  | 7.3% | 8.8% | 0.83 | 1.05 | 7 |
| SPY->SPY | S1 | {"n":225,"bandPct":2} |  | 7.3% | 12.5% | 0.58 | 1.01 | 4 |
| SPY->SPY | S1 | {"n":225,"bandPct":3} |  | 6.5% | 15.7% | 0.42 | 0.86 | 3 |
| SPY->SPY | S1 | {"n":250,"bandPct":0} |  | 7.2% | 9.6% | 0.75 | 1.00 | 17 |
| SPY->SPY | S1 | {"n":250,"bandPct":1} |  | 7.0% | 13.3% | 0.52 | 0.92 | 6 |
| SPY->SPY | S1 | {"n":250,"bandPct":2} |  | 6.4% | 14.4% | 0.44 | 0.83 | 4 |
| SPY->SPY | S1 | {"n":250,"bandPct":3} |  | 6.7% | 12.5% | 0.54 | 0.88 | 4 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":8} |  | 6.2% | 6.5% | 0.95 | 1.11 | 99 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":10} |  | 6.2% | 6.5% | 0.95 | 1.11 | 99 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":15} |  | 6.2% | 6.5% | 0.95 | 1.11 | 99 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":8} |  | 6.5% | 5.4% | 1.21 | 1.19 | 109 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":10} | yes | 6.5% | 5.4% | 1.21 | 1.19 | 109 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":15} |  | 6.5% | 5.4% | 1.21 | 1.19 | 109 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":8} |  | 4.7% | 11.5% | 0.40 | 0.78 | 127 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":10} |  | 4.7% | 11.5% | 0.40 | 0.78 | 127 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":15} |  | 4.7% | 11.5% | 0.40 | 0.78 | 127 |
| SPY->SPY | S3 | {"targetVolPct":15} |  | 7.1% | 10.4% | 0.68 | 1.03 | 5 |
| SPY->SPY | S3 | {"targetVolPct":20} | yes | 7.1% | 10.4% | 0.68 | 1.03 | 5 |

## Not verified

- Alpaca free-tier history start date (recorded at first fetch: 2020-07-27)
- fractionability of traded ETFs (getAsset)
- cash-account good-faith/settlement handling beyond the same-day rule
