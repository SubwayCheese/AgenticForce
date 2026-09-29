# Leveraged-ETF trend backtest: DESCRIPTIVE results (prereg v2)

> **SENSITIVITY RUN: position cap $40** per strategy entry, instead of the prereg's $20 (C1's real budget-envelope rule). This is a what-if on the cap only; it is not the prereg's canonical run, and C1's live cap is unchanged. Benchmarks are uncapped as always.

Prereg v2 sha256 (verified): `16fc0c616d0563b4a8b9acc306e468628af90f8c7ed641b60f0de0b291fbdfa1`. Mode: descriptive. Canonical configs fixed in advance; nothing was tuned and no config was picked from any table. Cost model: 5 bps/side base, 15 bps/side stress, no added expense ratio, cash leg BIL. Warm-up 250 aligned bars.

## Verdict on the two primary hypotheses: INCONCLUSIVE

> This mode can only return INCONCLUSIVE or FAIL. Even INCONCLUSIVE means only that the canonical rules beat the benchmarks on one short sample; it is not evidence the strategy will work going forward.

FAIL if either primary hypothesis (S1 or S2 on QQQ->TQQQ, full span, 5 bps) does not beat TQQQ buy-and-hold on max drawdown AND Calmar, or does not beat QQQ buy-and-hold CAGR after costs. INCONCLUSIVE otherwise.

### S1 on QQQ->TQQQ: both criteria met

| criterion | result | values |
|---|---|---|
| max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span) | met | maxDD 44.7% vs 81.7%; Calmar 0.48 vs 0.23 |
| after-cost CAGR (5 bps) > underlying buy-and-hold (full span) | met | 21.3% vs 15.5% |

at 15 bps (informational, not gating): maxDD 44.8% vs 81.7%; Calmar 0.47 vs 0.23; CAGR 21.3% vs 15.5%

### S2 on QQQ->TQQQ: both criteria met

| criterion | result | values |
|---|---|---|
| max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span) | met | maxDD 38.1% vs 81.7%; Calmar 0.61 vs 0.23 |
| after-cost CAGR (5 bps) > underlying buy-and-hold (full span) | met | 23.1% vs 15.5% |

at 15 bps (informational, not gating): maxDD 39.5% vs 81.7%; Calmar 0.53 vs 0.23; CAGR 21.2% vs 15.5%

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
| S1 {"n":200,"bandPct":2} (5 bps) | 168.3% | 21.3% | 44.7% | 0.48 | 0.69 | -29.3% (2022-01) | 22.53 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 167.4% | 21.3% | 44.8% | 0.47 | 0.69 | -29.4% (2022-01) | 22.59 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 188.7% | 23.1% | 38.1% | 0.61 | 0.93 | -24.5% (2022-01) | 19.40 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 166.2% | 21.2% | 39.5% | 0.53 | 0.85 | -25.5% (2022-01) | 20.36 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 69.7% | 10.9% | 27.6% | 0.40 | 0.61 | -21.6% (2022-01) | 14.76 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 69.2% | 10.9% | 27.6% | 0.39 | 0.60 | -21.6% (2022-01) | 14.79 | 3 | 1.4 | 76% |
| buy-and-hold TQQQ | 144.4% | 19.1% | 81.7% | 0.23 | 0.60 | -37.2% (2022-04) | 41.89 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -27.9% | -28.0% | 30.0% | -0.93 | -2.08 | -28.9% (2022-01) | 29.07 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -28.0% | -28.1% | 30.0% | -0.94 | -2.09 | -29.0% (2022-01) | 29.11 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -33.3% | -33.4% | 35.2% | -0.95 | -2.22 | -26.7% (2022-01) | 33.93 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -34.3% | -34.4% | 36.2% | -0.95 | -2.28 | -27.6% (2022-01) | 34.86 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -8.9% | -9.0% | 10.7% | -0.84 | -1.86 | -10.2% (2022-01) | 10.14 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.0% | -9.0% | 10.7% | -0.84 | -1.87 | -10.2% (2022-01) | 10.15 | 1 | 2.0 | 6% |
| buy-and-hold TQQQ | -79.3% | -79.4% | 81.0% | -0.98 | -1.15 | -37.2% (2022-04) | 61.20 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 187.4% | 32.9% | 34.5% | 0.95 | 0.93 | -18.7% (2025-03) | 16.38 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 186.7% | 32.8% | 34.5% | 0.95 | 0.93 | -18.8% (2025-03) | 16.42 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 220.8% | 36.9% | 17.2% | 2.14 | 1.52 | -6.8% (2026-07) | 6.08 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 203.7% | 34.9% | 19.1% | 1.83 | 1.44 | -7.5% (2026-07) | 6.72 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 90.7% | 19.0% | 20.9% | 0.91 | 0.92 | -10.7% (2025-03) | 8.72 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 90.3% | 18.9% | 20.9% | 0.91 | 0.92 | -10.7% (2025-03) | 8.74 | 2 | 1.3 | 92% |
| buy-and-hold TQQQ | 838.6% | 82.7% | 58.0% | 1.43 | 1.30 | -23.3% (2025-03) | 15.69 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 99.7% | 31.1% | 44.7% | 0.70 | 0.91 | -29.3% (2022-01) | 24.76 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 99.4% | 31.1% | 44.8% | 0.69 | 0.91 | -29.4% (2022-01) | 24.81 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 96.1% | 30.2% | 38.1% | 0.79 | 1.01 | -24.5% (2022-01) | 26.50 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 87.1% | 27.8% | 39.5% | 0.70 | 0.94 | -25.5% (2022-01) | 27.63 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 30.6% | 11.0% | 27.6% | 0.40 | 0.66 | -21.6% (2022-01) | 18.23 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 30.4% | 11.0% | 27.6% | 0.40 | 0.66 | -21.6% (2022-01) | 18.26 | 1 | 1.2 | 60% |
| buy-and-hold TQQQ | -6.9% | -2.7% | 81.7% | -0.03 | 0.33 | -37.2% (2022-04) | 55.66 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 69.4% | 22.9% | 31.5% | 0.73 | 0.70 | -16.9% (2025-03) | 15.20 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 68.9% | 22.8% | 31.5% | 0.72 | 0.70 | -16.9% (2025-03) | 15.23 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 87.5% | 27.9% | 26.4% | 1.06 | 0.90 | -11.7% (2026-07) | 12.04 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 75.0% | 24.5% | 27.1% | 0.90 | 0.81 | -13.0% (2026-07) | 13.23 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 31.8% | 11.4% | 18.2% | 0.63 | 0.63 | -9.2% (2025-03) | 8.49 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 31.6% | 11.4% | 18.2% | 0.62 | 0.62 | -9.2% (2025-03) | 8.51 | 2 | 2.0 | 92% |
| buy-and-hold TQQQ | 167.8% | 47.1% | 58.0% | 0.81 | 0.92 | -23.3% (2025-03) | 17.44 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR 2.2% points, max drawdown -37.0% points (negative = less drawdown), Calmar 0.24, time in market 76% (average exposure 59%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR 4.0% points, max drawdown -43.6% points (negative = less drawdown), Calmar 0.37, time in market 63% (average exposure 36%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -8.2% points, max drawdown -54.1% points (negative = less drawdown), Calmar 0.16, time in market 76% (average exposure 32%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0438, SR0 0.0765 (annualised 1.21), DSR 0.123, round trips 3
- S2: daily SR 0.0585, SR0 0.0765 (annualised 1.21), DSR 0.261, round trips 113
- S3: daily SR 0.0381, SR0 0.0765 (annualised 1.21), DSR 0.087, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 32.55 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 107.02 | 16.1% | 39.0% | 3 | 117 | 106.73 | 117 |
| full | S2 | 117.94 | 18.3% | 32.6% | 72 | 184 | 112.59 | 184 |
| full | S3 | 78.58 | 9.3% | 19.6% | 2 | 251 | 78.46 | 251 |
| y2022 | S1 | 36.06 | -28.0% | 29.9% | 1 | 0 | 35.99 | 0 |
| y2022 | S2 | 35.08 | -29.9% | 31.9% | 8 | 0 | 34.55 | 0 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 114.66 | 25.0% | 33.5% | 2 | 117 | 114.45 | 117 |
| from2023 | S2 | 130.07 | 29.4% | 14.5% | 56 | 184 | 125.94 | 184 |
| from2023 | S3 | 77.79 | 12.6% | 19.7% | 2 | 138 | 77.66 | 138 |
| firstHalf | S1 | 97.76 | 30.1% | 39.0% | 1 | 0 | 97.66 | 0 |
| firstHalf | S2 | 92.36 | 27.2% | 32.6% | 40 | 0 | 89.52 | 0 |
| firstHalf | S3 | 70.89 | 14.7% | 11.1% | 0 | 113 | 70.87 | 113 |
| secondHalf | S1 | 60.00 | 7.4% | 24.8% | 2 | 117 | 59.86 | 117 |
| secondHalf | S2 | 73.67 | 16.4% | 21.1% | 32 | 184 | 71.50 | 184 |
| secondHalf | S3 | 52.92 | 2.2% | 25.1% | 1 | 399 | 52.85 | 399 |

### QQQ->QLD (leverage 2)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 123.5% | 17.1% | 30.6% | 0.56 | 0.76 | -20.8% (2022-01) | 14.21 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 122.7% | 17.0% | 30.7% | 0.55 | 0.76 | -20.9% (2022-01) | 14.26 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 136.2% | 18.3% | 24.4% | 0.75 | 1.06 | -16.4% (2022-01) | 12.17 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 116.2% | 16.3% | 25.8% | 0.63 | 0.93 | -17.3% (2022-01) | 13.10 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 74.8% | 11.6% | 25.9% | 0.45 | 0.71 | -20.8% (2022-01) | 12.76 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 74.1% | 11.5% | 25.9% | 0.44 | 0.71 | -20.9% (2022-01) | 12.81 | 3 | 1.4 | 76% |
| buy-and-hold QLD | 152.7% | 19.9% | 63.7% | 0.31 | 0.63 | -26.1% (2022-04) | 28.23 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -19.4% | -19.4% | 21.2% | -0.92 | -2.11 | -20.5% (2022-01) | 20.42 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -19.5% | -19.5% | 21.2% | -0.92 | -2.12 | -20.6% (2022-01) | 20.47 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -22.6% | -22.6% | 24.6% | -0.92 | -2.17 | -17.9% (2022-01) | 23.29 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -23.8% | -23.9% | 25.7% | -0.93 | -2.27 | -18.8% (2022-01) | 24.40 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -9.6% | -9.6% | 11.2% | -0.85 | -1.96 | -10.8% (2022-01) | 10.69 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.6% | -9.7% | 11.3% | -0.86 | -1.97 | -10.9% (2022-01) | 10.71 | 1 | 2.0 | 6% |
| buy-and-hold QLD | -61.2% | -61.3% | 63.1% | -0.97 | -1.17 | -26.1% (2022-04) | 45.09 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 135.0% | 25.9% | 23.6% | 1.09 | 1.03 | -12.3% (2025-03) | 9.33 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 134.3% | 25.8% | 23.6% | 1.09 | 1.03 | -12.3% (2025-03) | 9.37 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 149.9% | 28.0% | 12.4% | 2.25 | 1.60 | -5.3% (2026-07) | 4.28 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 132.9% | 25.6% | 14.6% | 1.75 | 1.45 | -6.1% (2026-07) | 5.01 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 93.7% | 19.5% | 16.6% | 1.17 | 1.08 | -8.4% (2025-03) | 6.13 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 93.2% | 19.4% | 16.6% | 1.17 | 1.08 | -8.5% (2025-03) | 6.15 | 2 | 1.3 | 92% |
| buy-and-hold QLD | 446.7% | 58.0% | 42.4% | 1.37 | 1.33 | -15.8% (2025-03) | 10.06 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 63.3% | 21.2% | 30.6% | 0.69 | 0.94 | -20.8% (2022-01) | 16.71 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 63.0% | 21.1% | 30.7% | 0.69 | 0.94 | -20.9% (2022-01) | 16.76 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 66.3% | 22.1% | 24.4% | 0.90 | 1.13 | -16.4% (2022-01) | 16.52 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 59.5% | 20.1% | 25.8% | 0.78 | 1.02 | -17.3% (2022-01) | 17.63 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 29.4% | 10.6% | 25.9% | 0.41 | 0.70 | -20.8% (2022-01) | 16.62 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 29.1% | 10.5% | 25.9% | 0.41 | 0.69 | -20.9% (2022-01) | 16.68 | 1 | 1.2 | 60% |
| buy-and-hold QLD | 13.9% | 5.2% | 63.7% | 0.08 | 0.35 | -26.1% (2022-04) | 38.27 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 55.5% | 18.9% | 21.9% | 0.86 | 0.76 | -11.3% (2025-03) | 9.52 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 55.0% | 18.7% | 21.9% | 0.86 | 0.76 | -11.4% (2025-03) | 9.55 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 65.3% | 21.8% | 17.9% | 1.21 | 0.99 | -8.1% (2026-07) | 7.53 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 52.9% | 18.1% | 18.6% | 0.97 | 0.83 | -9.4% (2026-07) | 8.67 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 36.3% | 12.9% | 17.6% | 0.73 | 0.72 | -9.0% (2025-03) | 7.46 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 36.0% | 12.8% | 17.6% | 0.73 | 0.72 | -9.0% (2025-03) | 7.49 | 2 | 2.0 | 92% |
| buy-and-hold QLD | 125.1% | 37.4% | 42.4% | 0.88 | 0.96 | -15.8% (2025-03) | 11.15 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -2.9% points, max drawdown -33.1% points (negative = less drawdown), Calmar 0.24, time in market 76% (average exposure 58%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -1.6% points, max drawdown -39.2% points (negative = less drawdown), Calmar 0.44, time in market 63% (average exposure 38%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -8.4% points, max drawdown -37.8% points (negative = less drawdown), Calmar 0.13, time in market 76% (average exposure 41%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0478, SR0 0.0765 (annualised 1.21), DSR 0.155, round trips 3
- S2: daily SR 0.0669, SR0 0.0765 (annualised 1.21), DSR 0.366, round trips 113
- S3: daily SR 0.0447, SR0 0.0765 (annualised 1.21), DSR 0.130, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 38.33 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 74.44 | 8.1% | 25.8% | 2 | 336 | 74.28 | 336 |
| full | S2 | 82.87 | 10.4% | 20.1% | 42 | 475 | 79.65 | 475 |
| full | S3 | 76.14 | 8.6% | 23.2% | 2 | 358 | 75.98 | 358 |
| y2022 | S1 | 44.61 | -10.8% | 16.5% | 1 | 5 | 44.54 | 5 |
| y2022 | S2 | 44.71 | -10.6% | 12.1% | 4 | 6 | 44.41 | 6 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 79.92 | 13.5% | 17.1% | 1 | 336 | 79.85 | 336 |
| from2023 | S2 | 87.25 | 16.2% | 9.1% | 30 | 461 | 85.10 | 461 |
| from2023 | S3 | 81.43 | 14.0% | 16.8% | 1 | 357 | 81.35 | 357 |
| firstHalf | S1 | 67.48 | 12.5% | 25.8% | 1 | 0 | 67.38 | 0 |
| firstHalf | S2 | 71.41 | 15.0% | 20.1% | 36 | 14 | 68.96 | 14 |
| firstHalf | S3 | 69.00 | 13.5% | 23.2% | 1 | 22 | 68.90 | 22 |
| secondHalf | S1 | 59.44 | 7.0% | 22.1% | 1 | 367 | 59.35 | 367 |
| secondHalf | S2 | 61.15 | 8.2% | 2.7% | 5 | 483 | 60.71 | 483 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |

### QQQ->QQQ (leverage 1)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 75.1% | 11.6% | 14.8% | 0.79 | 0.97 | -10.7% (2022-01) | 6.63 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 74.4% | 11.5% | 14.9% | 0.77 | 0.97 | -10.7% (2022-01) | 6.68 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 69.8% | 10.9% | 13.7% | 0.80 | 1.14 | -8.8% (2022-01) | 6.73 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 49.9% | 8.3% | 15.1% | 0.55 | 0.84 | -9.8% (2022-01) | 7.73 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 75.1% | 11.6% | 14.8% | 0.79 | 0.97 | -10.7% (2022-01) | 6.63 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 74.4% | 11.5% | 14.9% | 0.77 | 0.97 | -10.7% (2022-01) | 6.68 | 3 | 1.4 | 76% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -9.6% | -9.6% | 11.3% | -0.85 | -1.97 | -10.8% (2022-01) | 10.70 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -9.7% | -9.7% | 11.3% | -0.86 | -2.00 | -10.9% (2022-01) | 10.76 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -10.9% | -11.0% | 12.6% | -0.87 | -2.13 | -9.4% (2022-01) | 11.93 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -12.2% | -12.3% | 13.8% | -0.89 | -2.33 | -10.3% (2022-01) | 13.07 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -9.6% | -9.6% | 11.3% | -0.85 | -1.97 | -10.8% (2022-01) | 10.70 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.7% | -9.7% | 11.3% | -0.86 | -2.00 | -10.9% (2022-01) | 10.76 | 1 | 2.0 | 6% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 79.3% | 17.0% | 11.6% | 1.47 | 1.30 | -5.8% (2025-03) | 3.95 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 78.8% | 16.9% | 11.6% | 1.47 | 1.29 | -5.9% (2025-03) | 3.97 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 78.2% | 16.8% | 6.6% | 2.55 | 1.73 | -3.4% (2026-07) | 2.40 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 61.4% | 13.8% | 9.3% | 1.48 | 1.38 | -4.5% (2026-07) | 3.29 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 79.3% | 17.0% | 11.6% | 1.47 | 1.30 | -5.8% (2025-03) | 3.95 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 78.8% | 16.9% | 11.6% | 1.47 | 1.29 | -5.9% (2025-03) | 3.97 | 2 | 1.3 | 92% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 33.9% | 12.1% | 14.8% | 0.82 | 1.07 | -10.7% (2022-01) | 8.19 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 33.6% | 12.0% | 14.9% | 0.81 | 1.07 | -10.7% (2022-01) | 8.25 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 31.8% | 11.4% | 13.7% | 0.83 | 1.15 | -8.8% (2022-01) | 9.10 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 25.0% | 9.1% | 15.1% | 0.60 | 0.92 | -9.8% (2022-01) | 10.23 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 33.9% | 12.1% | 14.8% | 0.82 | 1.07 | -10.7% (2022-01) | 8.19 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 33.6% | 12.0% | 14.9% | 0.81 | 1.07 | -10.7% (2022-01) | 8.25 | 1 | 1.2 | 60% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 37.2% | 13.2% | 11.0% | 1.20 | 0.99 | -5.5% (2025-03) | 4.28 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 36.8% | 13.1% | 11.0% | 1.19 | 0.98 | -5.6% (2025-03) | 4.31 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 35.4% | 12.6% | 9.0% | 1.41 | 1.09 | -4.6% (2026-07) | 3.74 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 23.1% | 8.5% | 9.6% | 0.88 | 0.73 | -5.9% (2026-07) | 4.89 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 37.2% | 13.2% | 11.0% | 1.20 | 0.99 | -5.5% (2025-03) | 4.28 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 36.8% | 13.1% | 11.0% | 1.19 | 0.98 | -5.6% (2025-03) | 4.31 | 2 | 2.0 | 92% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -3.9% points, max drawdown -20.2% points (negative = less drawdown), Calmar 0.34, time in market 76% (average exposure 57%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -4.6% points, max drawdown -21.3% points (negative = less drawdown), Calmar 0.36, time in market 63% (average exposure 42%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -3.9% points, max drawdown -20.2% points (negative = less drawdown), Calmar 0.34, time in market 76% (average exposure 57%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0613, SR0 0.0765 (annualised 1.21), DSR 0.296, round trips 3
- S2: daily SR 0.0721, SR0 0.0765 (annualised 1.21), DSR 0.438, round trips 113
- S3: daily SR 0.0613, SR0 0.0765 (annualised 1.21), DSR 0.296, round trips 3

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
| S1 {"n":200,"bandPct":2} (5 bps) | 92.8% | 13.7% | 44.2% | 0.31 | 0.58 | -16.4% (2022-04) | 20.30 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 91.3% | 13.6% | 44.4% | 0.31 | 0.57 | -16.4% (2022-04) | 20.44 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 105.3% | 15.1% | 20.4% | 0.74 | 0.80 | -12.1% (2021-09) | 7.89 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 85.7% | 12.9% | 22.2% | 0.58 | 0.68 | -12.6% (2021-09) | 9.38 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 60.9% | 9.8% | 23.9% | 0.41 | 0.65 | -9.4% (2025-03) | 11.63 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 60.2% | 9.7% | 24.0% | 0.40 | 0.64 | -9.5% (2025-03) | 11.69 | 5 | 2.2 | 79% |
| buy-and-hold UPRO | 154.8% | 20.1% | 63.9% | 0.31 | 0.62 | -27.2% (2022-09) | 29.50 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -35.5% | -35.6% | 36.8% | -0.97 | -1.83 | -18.9% (2022-04) | 32.28 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -35.7% | -35.8% | 36.9% | -0.97 | -1.84 | -19.0% (2022-04) | 32.42 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -0.7% | -0.7% | 13.6% | -0.05 | 0.00 | -3.9% (2022-01) | 3.38 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -2.3% | -2.3% | 14.0% | -0.17 | -0.14 | -4.6% (2022-01) | 4.51 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -14.5% | -14.5% | 15.9% | -0.91 | -1.71 | -6.8% (2022-01) | 14.08 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -14.6% | -14.6% | 16.0% | -0.91 | -1.72 | -6.8% (2022-01) | 14.13 | 2 | 4.0 | 22% |
| buy-and-hold UPRO | -57.3% | -57.5% | 63.9% | -0.90 | -0.83 | -27.2% (2022-09) | 44.07 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 120.5% | 23.7% | 25.1% | 0.95 | 0.92 | -14.2% (2025-03) | 9.42 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 119.8% | 23.6% | 25.1% | 0.94 | 0.91 | -14.3% (2025-03) | 9.46 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 103.7% | 21.1% | 17.1% | 1.24 | 1.02 | -8.9% (2023-09) | 6.58 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 88.1% | 18.5% | 20.0% | 0.93 | 0.90 | -10.1% (2023-09) | 7.61 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 76.4% | 16.5% | 16.4% | 1.01 | 0.99 | -9.4% (2025-03) | 5.81 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 75.8% | 16.4% | 16.4% | 1.00 | 0.99 | -9.5% (2025-03) | 5.83 | 3 | 1.9 | 93% |
| buy-and-hold UPRO | 374.0% | 52.0% | 48.9% | 1.06 | 1.17 | -17.6% (2025-03) | 10.90 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 21.6% | 8.0% | 44.2% | 0.18 | 0.40 | -16.4% (2022-04) | 26.77 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 20.8% | 7.7% | 44.4% | 0.17 | 0.40 | -16.4% (2022-04) | 26.96 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 53.8% | 18.4% | 20.4% | 0.90 | 0.85 | -12.1% (2021-09) | 9.68 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 44.7% | 15.6% | 22.2% | 0.70 | 0.73 | -12.6% (2021-09) | 11.47 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 16.6% | 6.2% | 23.9% | 0.26 | 0.46 | -9.2% (2022-01) | 15.24 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 16.2% | 6.1% | 24.0% | 0.25 | 0.46 | -9.2% (2022-01) | 15.32 | 3 | 2.7 | 66% |
| buy-and-hold UPRO | 8.6% | 3.3% | 63.9% | 0.05 | 0.33 | -27.2% (2022-09) | 40.00 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 65.9% | 21.9% | 22.5% | 0.97 | 0.85 | -15.1% (2026-03) | 8.76 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 65.4% | 21.8% | 22.5% | 0.97 | 0.84 | -15.2% (2026-03) | 8.79 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 49.4% | 17.0% | 23.2% | 0.74 | 0.79 | -7.0% (2026-02) | 7.89 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 40.0% | 14.1% | 23.7% | 0.59 | 0.67 | -8.0% (2026-02) | 8.97 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 39.8% | 14.0% | 17.8% | 0.79 | 0.79 | -10.3% (2025-03) | 6.79 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 39.5% | 13.9% | 17.8% | 0.78 | 0.79 | -10.3% (2025-03) | 6.82 | 2 | 2.0 | 92% |
| buy-and-hold UPRO | 137.8% | 40.4% | 48.9% | 0.83 | 0.96 | -17.6% (2025-03) | 11.27 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -6.4% points, max drawdown -19.7% points (negative = less drawdown), Calmar -0.00, time in market 79% (average exposure 67%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -5.0% points, max drawdown -43.5% points (negative = less drawdown), Calmar 0.43, time in market 66% (average exposure 42%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -10.3% points, max drawdown -40.1% points (negative = less drawdown), Calmar 0.09, time in market 79% (average exposure 37%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0363, SR0 0.0765 (annualised 1.21), DSR 0.076, round trips 5
- S2: daily SR 0.0505, SR0 0.0765 (annualised 1.21), DSR 0.178, round trips 109
- S3: daily SR 0.0406, SR0 0.0765 (annualised 1.21), DSR 0.102, round trips 5

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 59.70 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 57.20 | 2.7% | 23.0% | 1 | 828 | 57.11 | 828 |
| full | S2 | 65.04 | 5.3% | 15.2% | 17 | 712 | 63.62 | 712 |
| full | S3 | 59.79 | 3.6% | 0.1% | 0 | 1019 | 59.79 | 1019 |
| y2022 | S1 | 50.69 | 1.4% | 0.0% | 0 | 54 | 50.69 | 54 |
| y2022 | S2 | 50.69 | 1.4% | 0.0% | 0 | 18 | 50.69 | 18 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 54 | 50.69 | 54 |
| from2023 | S1 | 56.40 | 3.3% | 23.3% | 1 | 675 | 56.32 | 675 |
| from2023 | S2 | 64.25 | 7.0% | 15.4% | 17 | 606 | 62.82 | 606 |
| from2023 | S3 | 59.00 | 4.6% | 0.0% | 0 | 866 | 59.00 | 866 |
| firstHalf | S1 | 51.33 | 1.0% | 23.0% | 1 | 235 | 51.26 | 235 |
| firstHalf | S2 | 58.37 | 6.3% | 15.2% | 17 | 209 | 57.09 | 209 |
| firstHalf | S3 | 53.66 | 2.8% | 0.1% | 0 | 426 | 53.66 | 426 |
| secondHalf | S1 | 55.71 | 4.3% | 0.0% | 0 | 593 | 55.71 | 593 |
| secondHalf | S2 | 55.71 | 4.3% | 0.0% | 0 | 503 | 55.71 | 503 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 593 | 55.71 | 593 |

### SPY->SSO (leverage 2)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 71.7% | 11.2% | 30.4% | 0.37 | 0.64 | -10.6% (2022-04) | 13.41 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 70.6% | 11.0% | 30.6% | 0.36 | 0.64 | -10.6% (2022-04) | 13.55 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 70.1% | 11.0% | 14.0% | 0.78 | 0.81 | -8.2% (2021-09) | 5.57 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 50.6% | 8.4% | 16.7% | 0.50 | 0.61 | -8.6% (2021-09) | 7.15 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 63.1% | 10.1% | 23.4% | 0.43 | 0.71 | -8.7% (2022-01) | 10.97 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 62.1% | 9.9% | 23.6% | 0.42 | 0.70 | -8.7% (2022-01) | 11.06 | 5 | 2.2 | 79% |
| buy-and-hold SSO | 130.0% | 17.7% | 46.9% | 0.38 | 0.65 | -18.5% (2022-09) | 19.14 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -23.8% | -23.9% | 25.3% | -0.95 | -1.73 | -11.8% (2022-04) | 22.07 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -24.1% | -24.2% | 25.5% | -0.95 | -1.75 | -11.9% (2022-04) | 22.24 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -1.2% | -1.2% | 9.8% | -0.12 | -0.10 | -3.4% (2022-01) | 3.14 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -2.8% | -2.8% | 10.2% | -0.27 | -0.30 | -4.1% (2022-01) | 4.42 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -14.8% | -14.8% | 16.3% | -0.91 | -1.61 | -6.8% (2022-01) | 14.39 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -15.0% | -15.0% | 16.4% | -0.92 | -1.63 | -6.9% (2022-01) | 14.48 | 2 | 4.0 | 22% |
| buy-and-hold SSO | -39.5% | -39.6% | 46.8% | -0.85 | -0.80 | -18.5% (2022-09) | 30.56 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 87.4% | 18.4% | 16.8% | 1.10 | 1.03 | -9.1% (2025-03) | 5.90 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 86.6% | 18.3% | 16.8% | 1.09 | 1.02 | -9.2% (2025-03) | 5.93 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 69.8% | 15.3% | 12.2% | 1.26 | 1.05 | -6.1% (2023-09) | 4.70 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 54.3% | 12.4% | 15.1% | 0.82 | 0.84 | -7.4% (2023-09) | 5.83 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 77.5% | 16.7% | 13.3% | 1.26 | 1.10 | -7.9% (2025-03) | 4.82 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 76.8% | 16.6% | 13.3% | 1.25 | 1.09 | -7.9% (2025-03) | 4.84 | 3 | 1.9 | 93% |
| buy-and-hold SSO | 223.9% | 37.2% | 35.1% | 1.06 | 1.22 | -11.9% (2025-03) | 7.09 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 18.0% | 6.7% | 30.4% | 0.22 | 0.43 | -10.6% (2022-04) | 17.87 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 17.4% | 6.5% | 30.6% | 0.21 | 0.42 | -10.6% (2022-04) | 18.06 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 33.7% | 12.1% | 14.0% | 0.86 | 0.82 | -8.2% (2021-09) | 6.70 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 24.6% | 9.0% | 16.7% | 0.54 | 0.62 | -8.6% (2021-09) | 8.57 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 17.1% | 6.4% | 23.4% | 0.27 | 0.48 | -8.7% (2022-01) | 14.70 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 16.6% | 6.2% | 23.6% | 0.26 | 0.47 | -8.7% (2022-01) | 14.83 | 3 | 2.7 | 66% |
| buy-and-hold SSO | 18.0% | 6.7% | 46.9% | 0.14 | 0.36 | -18.5% (2022-09) | 26.05 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 49.8% | 17.2% | 14.8% | 1.16 | 0.94 | -10.0% (2026-03) | 5.63 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 49.3% | 17.0% | 14.8% | 1.15 | 0.94 | -10.1% (2026-03) | 5.67 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 34.5% | 12.3% | 15.6% | 0.79 | 0.81 | -5.1% (2026-02) | 5.42 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 25.1% | 9.2% | 16.1% | 0.57 | 0.61 | -6.1% (2026-02) | 6.55 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 41.3% | 14.5% | 14.8% | 0.98 | 0.90 | -8.8% (2025-03) | 5.57 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 40.9% | 14.4% | 14.8% | 0.97 | 0.90 | -8.9% (2025-03) | 5.60 | 2 | 2.0 | 92% |
| buy-and-hold SSO | 96.5% | 30.3% | 35.1% | 0.86 | 1.01 | -11.9% (2025-03) | 7.31 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -6.6% points, max drawdown -16.6% points (negative = less drawdown), Calmar -0.01, time in market 79% (average exposure 64%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -6.8% points, max drawdown -32.9% points (negative = less drawdown), Calmar 0.40, time in market 66% (average exposure 45%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -7.7% points, max drawdown -23.5% points (negative = less drawdown), Calmar 0.05, time in market 79% (average exposure 50%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0406, SR0 0.0765 (annualised 1.21), DSR 0.101, round trips 5
- S2: daily SR 0.0513, SR0 0.0765 (annualised 1.21), DSR 0.186, round trips 109
- S3: daily SR 0.0445, SR0 0.0765 (annualised 1.21), DSR 0.128, round trips 5

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 30.84 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 65.94 | 5.6% | 22.6% | 4 | 338 | 65.66 | 338 |
| full | S2 | 70.41 | 6.9% | 11.5% | 67 | 390 | 65.86 | 390 |
| full | S3 | 68.36 | 6.3% | 18.8% | 4 | 353 | 68.09 | 353 |
| y2022 | S1 | 39.91 | -20.3% | 21.6% | 2 | 0 | 39.78 | 0 |
| y2022 | S2 | 49.20 | -1.6% | 8.5% | 10 | 0 | 48.55 | 0 |
| y2022 | S3 | 46.40 | -7.2% | 10.4% | 1 | 28 | 46.33 | 28 |
| from2023 | S1 | 71.97 | 10.3% | 11.4% | 2 | 338 | 71.84 | 338 |
| from2023 | S2 | 70.53 | 9.7% | 9.7% | 46 | 390 | 67.54 | 390 |
| from2023 | S3 | 71.97 | 10.3% | 11.4% | 2 | 338 | 71.84 | 338 |
| firstHalf | S1 | 56.28 | 4.7% | 22.6% | 3 | 0 | 56.07 | 0 |
| firstHalf | S2 | 61.77 | 8.6% | 11.5% | 54 | 0 | 58.59 | 0 |
| firstHalf | S3 | 58.46 | 6.3% | 18.8% | 3 | 15 | 58.25 | 15 |
| secondHalf | S1 | 59.27 | 6.9% | 13.6% | 1 | 338 | 59.19 | 338 |
| secondHalf | S2 | 57.62 | 5.7% | 11.7% | 13 | 390 | 56.58 | 390 |
| secondHalf | S3 | 59.27 | 6.9% | 13.6% | 1 | 338 | 59.19 | 338 |

### SPY->SPY (leverage 1)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 49.5% | 8.2% | 14.3% | 0.57 | 0.92 | -5.1% (2022-04) | 6.09 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 48.5% | 8.1% | 14.6% | 0.55 | 0.90 | -5.2% (2022-04) | 6.23 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 44.4% | 7.5% | 7.0% | 1.06 | 1.05 | -4.3% (2021-09) | 2.54 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 25.0% | 4.5% | 9.4% | 0.47 | 0.61 | -4.8% (2021-09) | 4.04 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 49.5% | 8.2% | 14.3% | 0.57 | 0.92 | -5.1% (2022-04) | 6.09 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 48.5% | 8.1% | 14.6% | 0.55 | 0.90 | -5.2% (2022-04) | 6.23 | 5 | 2.2 | 79% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -11.3% | -11.3% | 12.7% | -0.89 | -1.61 | -5.4% (2022-04) | 10.92 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -11.6% | -11.6% | 12.9% | -0.90 | -1.66 | -5.5% (2022-04) | 11.11 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 0.4% | 0.4% | 4.7% | 0.08 | 0.12 | -1.6% (2022-01) | 1.25 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -1.3% | -1.3% | 5.1% | -0.25 | -0.32 | -2.3% (2022-01) | 2.49 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -11.2% | -11.2% | 12.6% | -0.89 | -1.61 | -5.3% (2022-04) | 10.81 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -11.5% | -11.5% | 12.8% | -0.90 | -1.66 | -5.4% (2022-04) | 10.99 | 2 | 4.0 | 22% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 55.5% | 12.6% | 7.9% | 1.60 | 1.38 | -4.1% (2025-03) | 2.60 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 54.9% | 12.5% | 7.9% | 1.59 | 1.37 | -4.2% (2025-03) | 2.63 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 43.2% | 10.2% | 7.1% | 1.43 | 1.31 | -3.2% (2023-09) | 2.29 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 27.7% | 6.8% | 9.2% | 0.74 | 0.86 | -4.5% (2023-09) | 3.47 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 55.5% | 12.6% | 7.9% | 1.60 | 1.38 | -4.1% (2025-03) | 2.60 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 54.9% | 12.5% | 7.9% | 1.59 | 1.37 | -4.2% (2025-03) | 2.63 | 3 | 1.9 | 93% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 14.0% | 5.3% | 14.3% | 0.37 | 0.61 | -5.1% (2022-04) | 8.19 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 13.4% | 5.0% | 14.6% | 0.35 | 0.58 | -5.2% (2022-04) | 8.38 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 20.2% | 7.5% | 6.8% | 1.09 | 1.01 | -4.3% (2021-09) | 2.89 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 11.1% | 4.2% | 9.4% | 0.44 | 0.57 | -4.8% (2021-09) | 4.64 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 14.0% | 5.3% | 14.3% | 0.37 | 0.61 | -5.1% (2022-04) | 8.19 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 13.4% | 5.0% | 14.6% | 0.35 | 0.58 | -5.2% (2022-04) | 8.38 | 3 | 2.7 | 66% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 33.4% | 11.9% | 7.6% | 1.57 | 1.27 | -4.8% (2026-03) | 2.59 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 32.9% | 11.8% | 7.6% | 1.55 | 1.26 | -4.9% (2026-03) | 2.62 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 22.5% | 8.3% | 8.4% | 0.99 | 1.03 | -2.8% (2026-02) | 2.62 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 13.2% | 5.0% | 8.8% | 0.56 | 0.62 | -3.7% (2026-02) | 3.74 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 33.4% | 11.9% | 7.6% | 1.57 | 1.27 | -4.8% (2026-03) | 2.59 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 32.9% | 11.8% | 7.6% | 1.55 | 1.26 | -4.9% (2026-03) | 2.62 | 2 | 2.0 | 92% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -4.9% points, max drawdown -10.2% points (negative = less drawdown), Calmar 0.04, time in market 79% (average exposure 61%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -5.6% points, max drawdown -17.5% points (negative = less drawdown), Calmar 0.53, time in market 66% (average exposure 46%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -4.9% points, max drawdown -10.2% points (negative = less drawdown), Calmar 0.04, time in market 79% (average exposure 61%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0577, SR0 0.0765 (annualised 1.21), DSR 0.253, round trips 5
- S2: daily SR 0.0658, SR0 0.0765 (annualised 1.21), DSR 0.354, round trips 109
- S3: daily SR 0.0577, SR0 0.0765 (annualised 1.21), DSR 0.253, round trips 5

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
| QQQ->TQQQ | S1 | {"n":150,"bandPct":0} |  | 21.4% | 34.4% | 0.62 | 0.76 | 14 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":1} |  | 20.4% | 33.6% | 0.61 | 0.73 | 6 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":2} |  | 17.6% | 34.9% | 0.50 | 0.65 | 6 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":3} |  | 24.4% | 35.8% | 0.68 | 0.78 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":0} |  | 23.5% | 31.4% | 0.75 | 0.83 | 10 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":1} |  | 27.5% | 35.8% | 0.77 | 0.85 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":2} |  | 24.5% | 36.8% | 0.67 | 0.76 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":3} |  | 22.7% | 36.8% | 0.62 | 0.72 | 3 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":0} |  | 22.0% | 49.2% | 0.45 | 0.70 | 10 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":1} |  | 23.9% | 42.9% | 0.56 | 0.74 | 5 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":2} | yes | 21.3% | 44.7% | 0.48 | 0.69 | 3 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":3} |  | 20.9% | 44.7% | 0.47 | 0.69 | 3 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":0} |  | 17.6% | 59.4% | 0.30 | 0.60 | 13 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":1} |  | 15.5% | 61.5% | 0.25 | 0.55 | 7 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":2} |  | 18.9% | 54.2% | 0.35 | 0.63 | 5 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":3} |  | 22.5% | 39.8% | 0.57 | 0.73 | 3 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":0} |  | 16.9% | 62.1% | 0.27 | 0.58 | 14 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":1} |  | 17.3% | 53.2% | 0.33 | 0.59 | 7 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":2} |  | 17.2% | 54.4% | 0.32 | 0.59 | 7 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":3} |  | 17.4% | 60.4% | 0.29 | 0.58 | 4 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":8} |  | 20.6% | 31.6% | 0.65 | 0.88 | 101 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":10} |  | 20.6% | 31.6% | 0.65 | 0.88 | 101 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":15} |  | 20.6% | 31.6% | 0.65 | 0.88 | 101 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":8} |  | 23.1% | 38.1% | 0.61 | 0.93 | 113 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":10} | yes | 23.1% | 38.1% | 0.61 | 0.93 | 113 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":15} |  | 23.1% | 38.1% | 0.61 | 0.93 | 113 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":8} |  | 19.6% | 42.4% | 0.46 | 0.78 | 123 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":10} |  | 19.6% | 42.4% | 0.46 | 0.78 | 123 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":15} |  | 19.6% | 42.4% | 0.46 | 0.78 | 123 |
| QQQ->TQQQ | S3 | {"targetVolPct":15} |  | 9.3% | 21.1% | 0.44 | 0.63 | 3 |
| QQQ->TQQQ | S3 | {"targetVolPct":20} | yes | 10.9% | 27.6% | 0.40 | 0.61 | 3 |
| QQQ->QLD | S1 | {"n":150,"bandPct":0} |  | 17.1% | 22.8% | 0.75 | 0.84 | 14 |
| QQQ->QLD | S1 | {"n":150,"bandPct":1} |  | 16.8% | 21.1% | 0.80 | 0.84 | 6 |
| QQQ->QLD | S1 | {"n":150,"bandPct":2} |  | 14.8% | 22.3% | 0.66 | 0.75 | 6 |
| QQQ->QLD | S1 | {"n":150,"bandPct":3} |  | 19.2% | 24.3% | 0.79 | 0.85 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":0} |  | 18.8% | 21.5% | 0.87 | 0.94 | 10 |
| QQQ->QLD | S1 | {"n":175,"bandPct":1} |  | 21.2% | 24.4% | 0.87 | 0.93 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":2} |  | 19.2% | 25.0% | 0.77 | 0.83 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":3} |  | 17.9% | 25.0% | 0.72 | 0.79 | 3 |
| QQQ->QLD | S1 | {"n":200,"bandPct":0} |  | 18.0% | 35.3% | 0.51 | 0.76 | 10 |
| QQQ->QLD | S1 | {"n":200,"bandPct":1} |  | 19.0% | 29.4% | 0.65 | 0.80 | 5 |
| QQQ->QLD | S1 | {"n":200,"bandPct":2} | yes | 17.1% | 30.6% | 0.56 | 0.76 | 3 |
| QQQ->QLD | S1 | {"n":200,"bandPct":3} |  | 16.8% | 30.6% | 0.55 | 0.75 | 3 |
| QQQ->QLD | S1 | {"n":225,"bandPct":0} |  | 14.8% | 43.8% | 0.34 | 0.64 | 13 |
| QQQ->QLD | S1 | {"n":225,"bandPct":1} |  | 13.6% | 45.8% | 0.30 | 0.60 | 7 |
| QQQ->QLD | S1 | {"n":225,"bandPct":2} |  | 16.2% | 38.3% | 0.42 | 0.69 | 5 |
| QQQ->QLD | S1 | {"n":225,"bandPct":3} |  | 17.9% | 27.0% | 0.66 | 0.79 | 3 |
| QQQ->QLD | S1 | {"n":250,"bandPct":0} |  | 14.4% | 45.9% | 0.31 | 0.62 | 14 |
| QQQ->QLD | S1 | {"n":250,"bandPct":1} |  | 14.8% | 37.7% | 0.39 | 0.64 | 7 |
| QQQ->QLD | S1 | {"n":250,"bandPct":2} |  | 14.9% | 38.3% | 0.39 | 0.64 | 7 |
| QQQ->QLD | S1 | {"n":250,"bandPct":3} |  | 14.4% | 45.0% | 0.32 | 0.60 | 4 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":8} |  | 16.4% | 17.7% | 0.93 | 1.01 | 101 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":10} |  | 16.4% | 17.7% | 0.93 | 1.01 | 101 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":15} |  | 16.4% | 17.7% | 0.93 | 1.01 | 101 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":8} |  | 18.3% | 24.4% | 0.75 | 1.06 | 113 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":10} | yes | 18.3% | 24.4% | 0.75 | 1.06 | 113 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":15} |  | 18.3% | 24.4% | 0.75 | 1.06 | 113 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":8} |  | 16.3% | 26.8% | 0.61 | 0.92 | 123 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":10} |  | 16.3% | 26.8% | 0.61 | 0.92 | 123 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":15} |  | 16.3% | 26.8% | 0.61 | 0.92 | 123 |
| QQQ->QLD | S3 | {"targetVolPct":15} |  | 9.6% | 20.5% | 0.47 | 0.73 | 3 |
| QQQ->QLD | S3 | {"targetVolPct":20} | yes | 11.6% | 25.9% | 0.45 | 0.71 | 3 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":0} |  | 11.7% | 10.8% | 1.09 | 1.08 | 14 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":1} |  | 11.5% | 10.5% | 1.10 | 1.06 | 6 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":2} |  | 10.3% | 11.4% | 0.91 | 0.95 | 6 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":3} |  | 12.7% | 11.7% | 1.09 | 1.08 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":0} |  | 12.6% | 11.1% | 1.13 | 1.18 | 10 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":1} |  | 13.8% | 11.7% | 1.18 | 1.17 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":2} |  | 12.7% | 11.9% | 1.06 | 1.05 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":3} |  | 11.9% | 11.9% | 1.00 | 0.99 | 3 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":0} |  | 12.2% | 16.4% | 0.74 | 0.98 | 10 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":1} |  | 12.5% | 14.2% | 0.88 | 1.02 | 5 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":2} | yes | 11.6% | 14.8% | 0.79 | 0.97 | 3 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":3} |  | 11.4% | 14.8% | 0.77 | 0.96 | 3 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":0} |  | 10.9% | 22.3% | 0.49 | 0.84 | 13 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":1} |  | 10.0% | 23.4% | 0.43 | 0.79 | 7 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":2} |  | 11.1% | 18.8% | 0.59 | 0.89 | 5 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":3} |  | 12.1% | 12.6% | 0.96 | 1.01 | 3 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":0} |  | 10.7% | 24.2% | 0.44 | 0.81 | 14 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":1} |  | 10.4% | 18.6% | 0.56 | 0.82 | 7 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":2} |  | 10.4% | 19.2% | 0.54 | 0.82 | 7 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":3} |  | 10.4% | 22.4% | 0.47 | 0.78 | 4 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":8} |  | 9.8% | 9.9% | 0.99 | 1.07 | 101 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":10} |  | 9.8% | 9.9% | 0.99 | 1.07 | 101 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":15} |  | 9.8% | 9.9% | 0.99 | 1.07 | 101 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":8} |  | 10.9% | 13.7% | 0.80 | 1.14 | 113 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":10} | yes | 10.9% | 13.7% | 0.80 | 1.14 | 113 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":15} |  | 10.9% | 13.7% | 0.80 | 1.14 | 113 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":8} |  | 9.5% | 15.6% | 0.61 | 0.97 | 123 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":10} |  | 9.5% | 15.6% | 0.61 | 0.97 | 123 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":15} |  | 9.5% | 15.6% | 0.61 | 0.97 | 123 |
| QQQ->QQQ | S3 | {"targetVolPct":15} |  | 10.6% | 13.8% | 0.77 | 0.99 | 3 |
| QQQ->QQQ | S3 | {"targetVolPct":20} | yes | 11.6% | 14.8% | 0.79 | 0.97 | 3 |
| SPY->UPRO | S1 | {"n":150,"bandPct":0} |  | 16.4% | 44.8% | 0.37 | 0.66 | 16 |
| SPY->UPRO | S1 | {"n":150,"bandPct":1} |  | 11.7% | 55.7% | 0.21 | 0.51 | 9 |
| SPY->UPRO | S1 | {"n":150,"bandPct":2} |  | 9.1% | 56.5% | 0.16 | 0.43 | 7 |
| SPY->UPRO | S1 | {"n":150,"bandPct":3} |  | 11.9% | 40.0% | 0.30 | 0.54 | 5 |
| SPY->UPRO | S1 | {"n":175,"bandPct":0} |  | 6.5% | 65.1% | 0.10 | 0.36 | 21 |
| SPY->UPRO | S1 | {"n":175,"bandPct":1} |  | 10.7% | 55.7% | 0.19 | 0.48 | 9 |
| SPY->UPRO | S1 | {"n":175,"bandPct":2} |  | 11.5% | 52.2% | 0.22 | 0.51 | 7 |
| SPY->UPRO | S1 | {"n":175,"bandPct":3} |  | 11.4% | 45.1% | 0.25 | 0.51 | 5 |
| SPY->UPRO | S1 | {"n":200,"bandPct":0} |  | 14.2% | 45.4% | 0.31 | 0.59 | 15 |
| SPY->UPRO | S1 | {"n":200,"bandPct":1} |  | 12.4% | 49.5% | 0.25 | 0.54 | 9 |
| SPY->UPRO | S1 | {"n":200,"bandPct":2} | yes | 13.7% | 44.2% | 0.31 | 0.58 | 5 |
| SPY->UPRO | S1 | {"n":200,"bandPct":3} |  | 10.8% | 54.4% | 0.20 | 0.49 | 4 |
| SPY->UPRO | S1 | {"n":225,"bandPct":0} |  | 15.3% | 42.7% | 0.36 | 0.62 | 14 |
| SPY->UPRO | S1 | {"n":225,"bandPct":1} |  | 15.2% | 39.0% | 0.39 | 0.62 | 7 |
| SPY->UPRO | S1 | {"n":225,"bandPct":2} |  | 13.6% | 50.0% | 0.27 | 0.57 | 4 |
| SPY->UPRO | S1 | {"n":225,"bandPct":3} |  | 11.2% | 57.8% | 0.19 | 0.48 | 3 |
| SPY->UPRO | S1 | {"n":250,"bandPct":0} |  | 15.1% | 40.9% | 0.37 | 0.61 | 17 |
| SPY->UPRO | S1 | {"n":250,"bandPct":1} |  | 13.2% | 52.2% | 0.25 | 0.54 | 6 |
| SPY->UPRO | S1 | {"n":250,"bandPct":2} |  | 10.8% | 56.1% | 0.19 | 0.47 | 4 |
| SPY->UPRO | S1 | {"n":250,"bandPct":3} |  | 12.1% | 51.3% | 0.24 | 0.51 | 4 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":8} |  | 13.9% | 31.1% | 0.45 | 0.70 | 99 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":10} |  | 13.9% | 31.1% | 0.45 | 0.70 | 99 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":15} |  | 13.9% | 31.1% | 0.45 | 0.70 | 99 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":8} |  | 15.1% | 20.4% | 0.74 | 0.80 | 109 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":10} | yes | 15.1% | 20.4% | 0.74 | 0.80 | 109 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":15} |  | 15.1% | 20.4% | 0.74 | 0.80 | 109 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":8} |  | 9.3% | 45.2% | 0.21 | 0.48 | 127 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":10} |  | 9.3% | 45.2% | 0.21 | 0.48 | 127 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":15} |  | 9.3% | 45.2% | 0.21 | 0.48 | 127 |
| SPY->UPRO | S3 | {"targetVolPct":15} |  | 8.4% | 18.1% | 0.46 | 0.69 | 5 |
| SPY->UPRO | S3 | {"targetVolPct":20} | yes | 9.8% | 23.9% | 0.41 | 0.65 | 5 |
| SPY->SSO | S1 | {"n":150,"bandPct":0} |  | 12.9% | 31.1% | 0.42 | 0.72 | 16 |
| SPY->SSO | S1 | {"n":150,"bandPct":1} |  | 10.1% | 40.5% | 0.25 | 0.58 | 9 |
| SPY->SSO | S1 | {"n":150,"bandPct":2} |  | 8.4% | 41.0% | 0.21 | 0.49 | 7 |
| SPY->SSO | S1 | {"n":150,"bandPct":3} |  | 9.7% | 27.4% | 0.35 | 0.60 | 5 |
| SPY->SSO | S1 | {"n":175,"bandPct":0} |  | 6.0% | 49.5% | 0.12 | 0.38 | 21 |
| SPY->SSO | S1 | {"n":175,"bandPct":1} |  | 9.4% | 40.1% | 0.24 | 0.54 | 9 |
| SPY->SSO | S1 | {"n":175,"bandPct":2} |  | 10.0% | 37.0% | 0.27 | 0.57 | 7 |
| SPY->SSO | S1 | {"n":175,"bandPct":3} |  | 9.7% | 31.3% | 0.31 | 0.57 | 5 |
| SPY->SSO | S1 | {"n":200,"bandPct":0} |  | 11.5% | 31.5% | 0.36 | 0.65 | 15 |
| SPY->SSO | S1 | {"n":200,"bandPct":1} |  | 10.7% | 34.5% | 0.31 | 0.61 | 9 |
| SPY->SSO | S1 | {"n":200,"bandPct":2} | yes | 11.2% | 30.4% | 0.37 | 0.64 | 5 |
| SPY->SSO | S1 | {"n":200,"bandPct":3} |  | 9.8% | 39.3% | 0.25 | 0.56 | 4 |
| SPY->SSO | S1 | {"n":225,"bandPct":0} |  | 12.2% | 29.2% | 0.42 | 0.69 | 14 |
| SPY->SSO | S1 | {"n":225,"bandPct":1} |  | 11.8% | 26.5% | 0.44 | 0.68 | 7 |
| SPY->SSO | S1 | {"n":225,"bandPct":2} |  | 11.6% | 35.4% | 0.33 | 0.64 | 4 |
| SPY->SSO | S1 | {"n":225,"bandPct":3} |  | 9.5% | 42.2% | 0.23 | 0.52 | 3 |
| SPY->SSO | S1 | {"n":250,"bandPct":0} |  | 11.7% | 28.6% | 0.41 | 0.65 | 17 |
| SPY->SSO | S1 | {"n":250,"bandPct":1} |  | 10.8% | 37.5% | 0.29 | 0.58 | 6 |
| SPY->SSO | S1 | {"n":250,"bandPct":2} |  | 9.0% | 39.8% | 0.22 | 0.50 | 4 |
| SPY->SSO | S1 | {"n":250,"bandPct":3} |  | 10.0% | 35.7% | 0.28 | 0.54 | 4 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":8} |  | 10.2% | 21.2% | 0.48 | 0.73 | 99 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":10} |  | 10.2% | 21.2% | 0.48 | 0.73 | 99 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":15} |  | 10.2% | 21.2% | 0.48 | 0.73 | 99 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":8} |  | 11.0% | 14.0% | 0.78 | 0.81 | 109 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":10} | yes | 11.0% | 14.0% | 0.78 | 0.81 | 109 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":15} |  | 11.0% | 14.0% | 0.78 | 0.81 | 109 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":8} |  | 7.1% | 31.8% | 0.22 | 0.50 | 127 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":10} |  | 7.1% | 31.8% | 0.22 | 0.50 | 127 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":15} |  | 7.1% | 31.8% | 0.22 | 0.50 | 127 |
| SPY->SSO | S3 | {"targetVolPct":15} |  | 8.6% | 17.8% | 0.48 | 0.76 | 5 |
| SPY->SSO | S3 | {"targetVolPct":20} | yes | 10.1% | 23.4% | 0.43 | 0.71 | 5 |
| SPY->SPY | S1 | {"n":150,"bandPct":0} |  | 9.0% | 14.9% | 0.61 | 1.00 | 16 |
| SPY->SPY | S1 | {"n":150,"bandPct":1} |  | 7.8% | 19.5% | 0.40 | 0.85 | 9 |
| SPY->SPY | S1 | {"n":150,"bandPct":2} |  | 6.9% | 20.3% | 0.34 | 0.75 | 7 |
| SPY->SPY | S1 | {"n":150,"bandPct":3} |  | 7.5% | 13.1% | 0.57 | 0.88 | 5 |
| SPY->SPY | S1 | {"n":175,"bandPct":0} |  | 6.0% | 25.9% | 0.23 | 0.63 | 21 |
| SPY->SPY | S1 | {"n":175,"bandPct":1} |  | 7.4% | 19.9% | 0.37 | 0.80 | 9 |
| SPY->SPY | S1 | {"n":175,"bandPct":2} |  | 7.6% | 18.2% | 0.42 | 0.83 | 7 |
| SPY->SPY | S1 | {"n":175,"bandPct":3} |  | 7.4% | 14.9% | 0.50 | 0.83 | 5 |
| SPY->SPY | S1 | {"n":200,"bandPct":0} |  | 8.4% | 14.9% | 0.56 | 0.93 | 15 |
| SPY->SPY | S1 | {"n":200,"bandPct":1} |  | 7.9% | 16.8% | 0.47 | 0.87 | 9 |
| SPY->SPY | S1 | {"n":200,"bandPct":2} | yes | 8.2% | 14.3% | 0.57 | 0.92 | 5 |
| SPY->SPY | S1 | {"n":200,"bandPct":3} |  | 7.6% | 19.4% | 0.39 | 0.81 | 4 |
| SPY->SPY | S1 | {"n":225,"bandPct":0} |  | 8.6% | 13.8% | 0.62 | 0.95 | 14 |
| SPY->SPY | S1 | {"n":225,"bandPct":1} |  | 8.4% | 12.2% | 0.69 | 0.94 | 7 |
| SPY->SPY | S1 | {"n":225,"bandPct":2} |  | 8.4% | 17.1% | 0.49 | 0.90 | 4 |
| SPY->SPY | S1 | {"n":225,"bandPct":3} |  | 7.4% | 21.3% | 0.35 | 0.75 | 3 |
| SPY->SPY | S1 | {"n":250,"bandPct":0} |  | 8.3% | 13.3% | 0.63 | 0.89 | 17 |
| SPY->SPY | S1 | {"n":250,"bandPct":1} |  | 8.0% | 18.2% | 0.44 | 0.81 | 6 |
| SPY->SPY | S1 | {"n":250,"bandPct":2} |  | 7.3% | 19.5% | 0.37 | 0.73 | 4 |
| SPY->SPY | S1 | {"n":250,"bandPct":3} |  | 7.7% | 17.1% | 0.45 | 0.78 | 4 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":8} |  | 7.0% | 9.4% | 0.75 | 0.96 | 99 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":10} |  | 7.0% | 9.4% | 0.75 | 0.96 | 99 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":15} |  | 7.0% | 9.4% | 0.75 | 0.96 | 99 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":8} |  | 7.5% | 7.0% | 1.06 | 1.05 | 109 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":10} | yes | 7.5% | 7.0% | 1.06 | 1.05 | 109 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":15} |  | 7.5% | 7.0% | 1.06 | 1.05 | 109 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":8} |  | 5.0% | 16.0% | 0.31 | 0.64 | 127 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":10} |  | 5.0% | 16.0% | 0.31 | 0.64 | 127 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":15} |  | 5.0% | 16.0% | 0.31 | 0.64 | 127 |
| SPY->SPY | S3 | {"targetVolPct":15} |  | 8.4% | 13.2% | 0.63 | 0.95 | 5 |
| SPY->SPY | S3 | {"targetVolPct":20} | yes | 8.2% | 14.3% | 0.57 | 0.92 | 5 |

## Not verified

- Alpaca free-tier history start date (recorded at first fetch: 2020-07-27)
- fractionability of traded ETFs (getAsset)
- cash-account good-faith/settlement handling beyond the same-day rule
