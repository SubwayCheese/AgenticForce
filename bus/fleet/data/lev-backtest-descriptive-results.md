# Leveraged-ETF trend backtest: DESCRIPTIVE results (prereg v2)

Prereg v2 sha256 (verified): `16fc0c616d0563b4a8b9acc306e468628af90f8c7ed641b60f0de0b291fbdfa1`. Mode: descriptive. Canonical configs fixed in advance; nothing was tuned and no config was picked from any table. Cost model: 5 bps/side base, 15 bps/side stress, no added expense ratio, cash leg BIL. Warm-up 250 aligned bars.

## Verdict on the two primary hypotheses: FAIL

> This mode can only return INCONCLUSIVE or FAIL. Even INCONCLUSIVE means only that the canonical rules beat the benchmarks on one short sample; it is not evidence the strategy will work going forward.

FAIL if either primary hypothesis (S1 or S2 on QQQ->TQQQ, full span, 5 bps) does not beat TQQQ buy-and-hold on max drawdown AND Calmar, or does not beat QQQ buy-and-hold CAGR after costs. INCONCLUSIVE otherwise.

### S1 on QQQ->TQQQ: criteria NOT met

| criterion | result | values |
|---|---|---|
| max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span) | met | maxDD 26.1% vs 81.7%; Calmar 0.53 vs 0.23 |
| after-cost CAGR (5 bps) > underlying buy-and-hold (full span) | NOT met | 13.9% vs 15.5% |

at 15 bps (informational, not gating): maxDD 26.1% vs 81.7%; Calmar 0.53 vs 0.23; CAGR 13.8% vs 15.5%

### S2 on QQQ->TQQQ: criteria NOT met

| criterion | result | values |
|---|---|---|
| max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span) | met | maxDD 20.9% vs 81.7%; Calmar 0.73 vs 0.23 |
| after-cost CAGR (5 bps) > underlying buy-and-hold (full span) | NOT met | 15.2% vs 15.5% |

at 15 bps (informational, not gating): maxDD 21.6% vs 81.7%; Calmar 0.65 vs 0.23; CAGR 14.1% vs 15.5%

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
| S1 {"n":200,"bandPct":2} (5 bps) | 93.9% | 13.9% | 26.1% | 0.53 | 0.67 | -15.8% (2022-01) | 13.66 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 93.5% | 13.8% | 26.1% | 0.53 | 0.67 | -15.8% (2022-01) | 13.69 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 105.8% | 15.2% | 20.9% | 0.73 | 1.01 | -12.8% (2022-01) | 10.60 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 95.8% | 14.1% | 21.6% | 0.65 | 0.93 | -13.3% (2022-01) | 11.08 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 76.0% | 11.7% | 21.4% | 0.55 | 0.67 | -15.8% (2022-01) | 11.78 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 75.6% | 11.7% | 21.5% | 0.54 | 0.66 | -15.8% (2022-01) | 11.80 | 3 | 1.4 | 76% |
| buy-and-hold TQQQ | 144.4% | 19.1% | 81.7% | 0.23 | 0.60 | -37.2% (2022-04) | 41.89 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -13.3% | -13.3% | 15.1% | -0.88 | -1.95 | -14.5% (2022-01) | 14.50 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -13.3% | -13.4% | 15.1% | -0.88 | -1.96 | -14.5% (2022-01) | 14.51 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -16.3% | -16.4% | 18.1% | -0.90 | -2.12 | -13.4% (2022-01) | 17.30 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -16.9% | -17.0% | 18.7% | -0.91 | -2.19 | -13.8% (2022-01) | 17.85 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -8.9% | -9.0% | 10.7% | -0.84 | -1.86 | -10.2% (2022-01) | 10.14 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.0% | -9.0% | 10.7% | -0.84 | -1.87 | -10.2% (2022-01) | 10.15 | 1 | 2.0 | 6% |
| buy-and-hold TQQQ | -79.3% | -79.4% | 81.0% | -0.98 | -1.15 | -37.2% (2022-04) | 61.20 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 102.7% | 21.0% | 25.0% | 0.84 | 0.89 | -13.0% (2025-03) | 11.36 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 102.3% | 20.9% | 25.0% | 0.84 | 0.89 | -13.1% (2025-03) | 11.39 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 119.4% | 23.6% | 10.7% | 2.20 | 1.55 | -4.9% (2026-07) | 3.99 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 110.9% | 22.2% | 11.9% | 1.88 | 1.45 | -5.4% (2026-07) | 4.38 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 88.3% | 18.6% | 20.9% | 0.89 | 0.91 | -10.7% (2025-03) | 8.70 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 87.9% | 18.5% | 20.9% | 0.89 | 0.91 | -10.7% (2025-03) | 8.72 | 2 | 1.3 | 92% |
| buy-and-hold TQQQ | 838.6% | 82.7% | 58.0% | 1.43 | 1.30 | -23.3% (2025-03) | 15.69 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 53.5% | 18.3% | 23.7% | 0.77 | 0.96 | -15.8% (2022-01) | 13.44 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 53.3% | 18.2% | 23.8% | 0.77 | 0.96 | -15.8% (2022-01) | 13.46 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 53.3% | 18.2% | 20.9% | 0.87 | 1.09 | -12.8% (2022-01) | 14.29 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 49.8% | 17.2% | 21.6% | 0.80 | 1.03 | -13.3% (2022-01) | 14.85 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 35.9% | 12.8% | 21.4% | 0.60 | 0.85 | -15.8% (2022-01) | 13.20 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 35.7% | 12.7% | 21.5% | 0.59 | 0.84 | -15.8% (2022-01) | 13.22 | 1 | 1.2 | 60% |
| buy-and-hold TQQQ | -6.9% | -2.7% | 81.7% | -0.03 | 0.33 | -37.2% (2022-04) | 55.66 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 40.4% | 14.2% | 17.6% | 0.81 | 0.69 | -9.3% (2026-07) | 8.53 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 40.2% | 14.1% | 17.6% | 0.80 | 0.68 | -9.3% (2026-07) | 8.54 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 49.5% | 17.1% | 14.7% | 1.16 | 0.93 | -7.3% (2026-07) | 6.66 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 43.2% | 15.1% | 15.0% | 1.01 | 0.83 | -8.0% (2026-07) | 7.25 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 31.9% | 11.5% | 17.6% | 0.65 | 0.64 | -8.9% (2025-03) | 8.21 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 31.7% | 11.4% | 17.6% | 0.65 | 0.63 | -8.9% (2025-03) | 8.23 | 2 | 2.0 | 92% |
| buy-and-hold TQQQ | 167.8% | 47.1% | 58.0% | 0.81 | 0.92 | -23.3% (2025-03) | 17.44 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -5.3% points, max drawdown -55.6% points (negative = less drawdown), Calmar 0.30, time in market 76% (average exposure 36%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -3.9% points, max drawdown -60.8% points (negative = less drawdown), Calmar 0.49, time in market 63% (average exposure 22%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -7.4% points, max drawdown -60.2% points (negative = less drawdown), Calmar 0.31, time in market 76% (average exposure 30%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0422, SR0 0.0765 (annualised 1.21), DSR 0.113, round trips 3
- S2: daily SR 0.0639, SR0 0.0765 (annualised 1.21), DSR 0.328, round trips 113
- S3: daily SR 0.0420, SR0 0.0765 (annualised 1.21), DSR 0.111, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 32.55 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 76.23 | 8.6% | 18.5% | 1 | 449 | 76.18 | 449 |
| full | S2 | 80.05 | 9.7% | 8.1% | 25 | 568 | 79.03 | 568 |
| full | S3 | 76.23 | 8.6% | 18.5% | 1 | 449 | 76.18 | 449 |
| y2022 | S1 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| y2022 | S2 | 50.69 | 1.4% | 0.0% | 0 | 10 | 50.69 | 10 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 75.44 | 11.7% | 18.7% | 1 | 336 | 75.39 | 336 |
| from2023 | S2 | 79.25 | 13.2% | 8.2% | 25 | 467 | 78.23 | 467 |
| from2023 | S3 | 75.44 | 11.7% | 18.7% | 1 | 336 | 75.39 | 336 |
| firstHalf | S1 | 70.89 | 14.7% | 11.1% | 0 | 113 | 70.87 | 113 |
| firstHalf | S2 | 73.86 | 16.5% | 8.1% | 24 | 102 | 72.97 | 102 |
| firstHalf | S3 | 70.89 | 14.7% | 11.1% | 0 | 113 | 70.87 | 113 |
| secondHalf | S1 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |
| secondHalf | S2 | 55.71 | 4.3% | 0.0% | 0 | 488 | 55.71 | 488 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |

### QQQ->QLD (leverage 2)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 71.5% | 11.2% | 16.0% | 0.70 | 0.81 | -11.0% (2022-01) | 7.81 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 71.1% | 11.1% | 16.0% | 0.69 | 0.80 | -11.1% (2022-01) | 7.83 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 77.9% | 11.9% | 13.1% | 0.91 | 1.20 | -8.6% (2022-01) | 6.41 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 67.9% | 10.7% | 13.7% | 0.78 | 1.06 | -9.1% (2022-01) | 6.87 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 71.5% | 11.2% | 16.0% | 0.70 | 0.81 | -11.0% (2022-01) | 7.81 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 71.1% | 11.1% | 16.0% | 0.69 | 0.80 | -11.1% (2022-01) | 7.83 | 3 | 1.4 | 76% |
| buy-and-hold QLD | 152.7% | 19.9% | 63.7% | 0.31 | 0.63 | -26.1% (2022-04) | 28.23 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -9.0% | -9.0% | 10.7% | -0.85 | -1.94 | -10.2% (2022-01) | 10.11 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -9.0% | -9.1% | 10.7% | -0.85 | -1.95 | -10.3% (2022-01) | 10.13 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -10.6% | -10.6% | 12.4% | -0.86 | -2.03 | -9.0% (2022-01) | 11.56 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -11.2% | -11.3% | 12.9% | -0.87 | -2.13 | -9.4% (2022-01) | 12.12 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -9.0% | -9.0% | 10.7% | -0.85 | -1.94 | -10.2% (2022-01) | 10.11 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -9.0% | -9.1% | 10.7% | -0.85 | -1.95 | -10.3% (2022-01) | 10.13 | 1 | 2.0 | 6% |
| buy-and-hold QLD | -61.2% | -61.3% | 63.1% | -0.97 | -1.17 | -26.1% (2022-04) | 45.09 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 76.5% | 16.5% | 15.5% | 1.06 | 1.06 | -7.8% (2025-03) | 5.73 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 76.2% | 16.5% | 15.5% | 1.06 | 1.06 | -7.9% (2025-03) | 5.76 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 83.9% | 17.8% | 6.9% | 2.59 | 1.71 | -3.5% (2026-07) | 2.52 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 75.5% | 16.3% | 8.2% | 1.99 | 1.55 | -4.0% (2026-07) | 2.92 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 76.5% | 16.5% | 15.5% | 1.06 | 1.06 | -7.8% (2025-03) | 5.73 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 76.2% | 16.5% | 15.5% | 1.06 | 1.06 | -7.9% (2025-03) | 5.76 | 2 | 1.3 | 92% |
| buy-and-hold QLD | 446.7% | 58.0% | 42.4% | 1.37 | 1.33 | -15.8% (2025-03) | 10.06 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 35.3% | 12.6% | 15.4% | 0.82 | 1.04 | -11.0% (2022-01) | 8.68 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 35.2% | 12.5% | 15.4% | 0.81 | 1.04 | -11.1% (2022-01) | 8.70 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 36.8% | 13.1% | 13.1% | 1.00 | 1.25 | -8.6% (2022-01) | 8.61 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 33.4% | 12.0% | 13.7% | 0.87 | 1.14 | -9.1% (2022-01) | 9.15 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 35.3% | 12.6% | 15.4% | 0.82 | 1.04 | -11.0% (2022-01) | 8.68 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 35.2% | 12.5% | 15.4% | 0.81 | 1.04 | -11.1% (2022-01) | 8.70 | 1 | 1.2 | 60% |
| buy-and-hold QLD | 13.9% | 5.2% | 63.7% | 0.08 | 0.35 | -26.1% (2022-04) | 38.27 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 33.5% | 12.0% | 11.8% | 1.02 | 0.83 | -5.8% (2025-03) | 4.98 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 33.2% | 11.9% | 11.8% | 1.01 | 0.83 | -5.9% (2025-03) | 5.00 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 38.4% | 13.6% | 9.6% | 1.42 | 1.10 | -4.8% (2026-07) | 3.86 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 32.2% | 11.5% | 9.9% | 1.17 | 0.94 | -5.4% (2026-07) | 4.38 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 33.4% | 12.0% | 11.8% | 1.02 | 0.83 | -5.8% (2025-03) | 4.98 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 33.2% | 11.9% | 11.8% | 1.01 | 0.83 | -5.9% (2025-03) | 4.99 | 2 | 2.0 | 92% |
| buy-and-hold QLD | 125.1% | 37.4% | 42.4% | 0.88 | 0.96 | -15.8% (2025-03) | 11.15 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -8.8% points, max drawdown -47.7% points (negative = less drawdown), Calmar 0.38, time in market 76% (average exposure 34%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -8.0% points, max drawdown -50.6% points (negative = less drawdown), Calmar 0.60, time in market 63% (average exposure 22%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -8.8% points, max drawdown -47.7% points (negative = less drawdown), Calmar 0.38, time in market 76% (average exposure 34%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0508, SR0 0.0765 (annualised 1.21), DSR 0.181, round trips 3
- S2: daily SR 0.0754, SR0 0.0765 (annualised 1.21), DSR 0.485, round trips 113
- S3: daily SR 0.0508, SR0 0.0765 (annualised 1.21), DSR 0.181, round trips 3

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 38.33 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

| span | config | 5 bps end value | 5 bps CAGR | 5 bps max DD | 5 bps round trips | 5 bps cannot buy | 15 bps end value | 15 bps cannot buy |
|---|---|---|---|---|---|---|---|---|
| full | S1 | 84.64 | 10.9% | 16.2% | 1 | 475 | 84.57 | 475 |
| full | S2 | 59.79 | 3.6% | 0.1% | 0 | 810 | 59.79 | 810 |
| full | S3 | 84.64 | 10.9% | 16.2% | 1 | 475 | 84.57 | 475 |
| y2022 | S1 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| y2022 | S2 | 50.69 | 1.4% | 0.0% | 0 | 10 | 50.69 | 10 |
| y2022 | S3 | 50.69 | 1.4% | 0.0% | 0 | 14 | 50.69 | 14 |
| from2023 | S1 | 83.85 | 14.9% | 16.4% | 1 | 362 | 83.77 | 362 |
| from2023 | S2 | 59.00 | 4.6% | 0.0% | 0 | 709 | 59.00 | 709 |
| from2023 | S3 | 83.85 | 14.9% | 16.4% | 1 | 362 | 83.77 | 362 |
| firstHalf | S1 | 76.63 | 18.2% | 11.1% | 0 | 139 | 76.61 | 139 |
| firstHalf | S2 | 53.66 | 2.8% | 0.1% | 0 | 322 | 53.66 | 322 |
| firstHalf | S3 | 76.63 | 18.2% | 11.1% | 0 | 139 | 76.61 | 139 |
| secondHalf | S1 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |
| secondHalf | S2 | 55.71 | 4.3% | 0.0% | 0 | 488 | 55.71 | 488 |
| secondHalf | S3 | 55.71 | 4.3% | 0.0% | 0 | 590 | 55.71 | 590 |

### QQQ->QQQ (leverage 1)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 47.3% | 7.9% | 6.7% | 1.18 | 1.19 | -5.5% (2022-01) | 3.32 | 3 | 1.4 | 76% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 47.0% | 7.8% | 6.7% | 1.17 | 1.18 | -5.5% (2022-01) | 3.34 | 3 | 1.4 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 44.7% | 7.5% | 7.1% | 1.06 | 1.45 | -4.5% (2022-01) | 3.30 | 113 | 44.5 | 63% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 34.8% | 6.0% | 7.8% | 0.78 | 1.14 | -5.0% (2022-01) | 3.75 | 113 | 44.5 | 63% |
| S3 {"targetVolPct":20} (5 bps) | 47.3% | 7.9% | 6.7% | 1.18 | 1.19 | -5.5% (2022-01) | 3.32 | 3 | 1.4 | 76% |
| S3 {"targetVolPct":20} (15 bps stress) | 47.0% | 7.8% | 6.7% | 1.17 | 1.18 | -5.5% (2022-01) | 3.34 | 3 | 1.4 | 76% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 108.7% | 15.5% | 35.0% | 0.44 | 0.75 | -13.4% (2022-04) | 13.38 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -4.1% | -4.1% | 5.7% | -0.73 | -1.67 | -5.4% (2022-01) | 5.22 | 1 | 2.0 | 6% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -4.2% | -4.2% | 5.7% | -0.73 | -1.70 | -5.5% (2022-01) | 5.25 | 1 | 2.0 | 6% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -4.8% | -4.8% | 6.3% | -0.76 | -1.85 | -4.7% (2022-01) | 5.84 | 8 | 16.1 | 4% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -5.4% | -5.4% | 6.9% | -0.79 | -2.05 | -5.2% (2022-01) | 6.40 | 8 | 16.1 | 4% |
| S3 {"targetVolPct":20} (5 bps) | -4.1% | -4.1% | 5.7% | -0.73 | -1.67 | -5.4% (2022-01) | 5.22 | 1 | 2.0 | 6% |
| S3 {"targetVolPct":20} (15 bps stress) | -4.2% | -4.2% | 5.7% | -0.73 | -1.70 | -5.5% (2022-01) | 5.25 | 1 | 2.0 | 6% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -32.7% | -32.8% | 34.7% | -0.94 | -1.07 | -13.4% (2022-04) | 23.83 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 48.7% | 11.3% | 6.6% | 1.70 | 1.53 | -3.3% (2025-03) | 2.12 | 2 | 1.3 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 48.4% | 11.2% | 6.6% | 1.69 | 1.52 | -3.3% (2025-03) | 2.14 | 2 | 1.3 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 48.1% | 11.2% | 3.6% | 3.07 | 2.05 | -1.9% (2026-07) | 1.17 | 97 | 52.5 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 39.7% | 9.4% | 4.5% | 2.11 | 1.71 | -2.5% (2026-07) | 1.57 | 97 | 52.5 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 48.7% | 11.3% | 6.6% | 1.70 | 1.53 | -3.3% (2025-03) | 2.12 | 2 | 1.3 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 48.4% | 11.2% | 6.6% | 1.69 | 1.52 | -3.3% (2025-03) | 2.14 | 2 | 1.3 | 92% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |
| buy-and-hold QQQ | 183.0% | 32.3% | 22.7% | 1.42 | 1.50 | -7.6% (2025-03) | 4.63 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 20.6% | 7.6% | 6.6% | 1.15 | 1.30 | -5.5% (2022-01) | 3.99 | 1 | 1.2 | 60% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 20.5% | 7.6% | 6.7% | 1.13 | 1.30 | -5.5% (2022-01) | 4.02 | 1 | 1.2 | 60% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 19.5% | 7.2% | 7.1% | 1.03 | 1.41 | -4.5% (2022-01) | 4.47 | 40 | 31.7 | 50% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 16.2% | 6.0% | 7.8% | 0.78 | 1.17 | -5.0% (2022-01) | 4.99 | 40 | 31.7 | 50% |
| S3 {"targetVolPct":20} (5 bps) | 20.6% | 7.6% | 6.6% | 1.15 | 1.30 | -5.5% (2022-01) | 3.99 | 1 | 1.2 | 60% |
| S3 {"targetVolPct":20} (15 bps stress) | 20.5% | 7.6% | 6.7% | 1.13 | 1.30 | -5.5% (2022-01) | 4.02 | 1 | 1.2 | 60% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 22.7% | 8.3% | 35.0% | 0.24 | 0.45 | -13.4% (2022-04) | 18.21 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 24.3% | 8.9% | 5.6% | 1.60 | 1.24 | -2.7% (2025-03) | 2.08 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 24.1% | 8.8% | 5.6% | 1.59 | 1.23 | -2.8% (2025-03) | 2.10 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 23.4% | 8.6% | 4.5% | 1.92 | 1.40 | -2.4% (2026-07) | 1.65 | 73 | 57.6 | 76% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 17.2% | 6.4% | 4.8% | 1.35 | 1.04 | -3.0% (2026-07) | 2.16 | 73 | 57.6 | 76% |
| S3 {"targetVolPct":20} (5 bps) | 24.3% | 8.9% | 5.6% | 1.60 | 1.24 | -2.7% (2025-03) | 2.08 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 24.1% | 8.8% | 5.6% | 1.59 | 1.23 | -2.8% (2025-03) | 2.10 | 2 | 2.0 | 92% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |
| buy-and-hold QQQ | 71.3% | 23.5% | 22.7% | 1.03 | 1.11 | -7.6% (2025-03) | 5.14 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -7.6% points, max drawdown -28.3% points (negative = less drawdown), Calmar 0.74, time in market 76% (average exposure 31%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -8.0% points, max drawdown -27.9% points (negative = less drawdown), Calmar 0.62, time in market 63% (average exposure 23%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -7.6% points, max drawdown -28.3% points (negative = less drawdown), Calmar 0.74, time in market 76% (average exposure 31%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0748, SR0 0.0765 (annualised 1.21), DSR 0.477, round trips 3
- S2: daily SR 0.0911, SR0 0.0765 (annualised 1.21), DSR 0.697, round trips 113
- S3: daily SR 0.0748, SR0 0.0765 (annualised 1.21), DSR 0.477, round trips 3

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
| S1 {"n":200,"bandPct":2} (5 bps) | 57.4% | 9.3% | 23.2% | 0.40 | 0.63 | -9.7% (2025-03) | 10.77 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 56.8% | 9.2% | 23.4% | 0.39 | 0.62 | -9.7% (2025-03) | 10.83 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 62.4% | 10.0% | 10.8% | 0.92 | 0.92 | -6.2% (2021-09) | 4.07 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 52.6% | 8.6% | 11.3% | 0.77 | 0.79 | -6.4% (2021-09) | 4.79 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 60.4% | 9.7% | 20.5% | 0.47 | 0.67 | -9.4% (2025-03) | 9.64 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 59.8% | 9.6% | 20.6% | 0.47 | 0.67 | -9.5% (2025-03) | 9.69 | 5 | 2.2 | 79% |
| buy-and-hold UPRO | 154.8% | 20.1% | 63.9% | 0.31 | 0.62 | -27.2% (2022-09) | 29.50 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -17.2% | -17.2% | 18.6% | -0.93 | -1.80 | -8.5% (2022-04) | 16.13 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -17.3% | -17.4% | 18.7% | -0.93 | -1.81 | -8.5% (2022-04) | 16.21 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 0.3% | 0.3% | 6.8% | 0.05 | 0.09 | -1.9% (2022-01) | 1.63 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -0.5% | -0.5% | 7.0% | -0.07 | -0.05 | -2.3% (2022-01) | 2.16 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -14.3% | -14.4% | 15.7% | -0.91 | -1.71 | -6.6% (2022-01) | 13.89 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -14.4% | -14.4% | 15.8% | -0.91 | -1.73 | -6.7% (2022-01) | 13.94 | 2 | 4.0 | 22% |
| buy-and-hold UPRO | -57.3% | -57.5% | 63.9% | -0.90 | -0.83 | -27.2% (2022-09) | 44.07 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 69.3% | 15.2% | 15.6% | 0.98 | 0.97 | -8.9% (2025-03) | 5.60 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 68.9% | 15.2% | 15.6% | 0.97 | 0.96 | -9.0% (2025-03) | 5.62 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 60.9% | 13.7% | 10.1% | 1.35 | 1.16 | -4.6% (2023-09) | 3.52 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 53.1% | 12.1% | 10.5% | 1.15 | 1.02 | -5.2% (2023-09) | 4.05 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 69.3% | 15.2% | 15.6% | 0.98 | 0.97 | -8.9% (2025-03) | 5.58 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 68.9% | 15.2% | 15.6% | 0.97 | 0.96 | -9.0% (2025-03) | 5.60 | 3 | 1.9 | 93% |
| buy-and-hold UPRO | 374.0% | 52.0% | 48.9% | 1.06 | 1.17 | -17.6% (2025-03) | 10.90 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 15.3% | 5.7% | 23.2% | 0.25 | 0.45 | -7.9% (2022-04) | 13.84 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 15.0% | 5.6% | 23.4% | 0.24 | 0.45 | -7.9% (2022-04) | 13.93 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 30.6% | 11.0% | 10.8% | 1.02 | 0.95 | -6.2% (2021-09) | 4.81 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 26.0% | 9.5% | 11.3% | 0.84 | 0.82 | -6.4% (2021-09) | 5.69 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 18.1% | 6.7% | 20.5% | 0.33 | 0.55 | -7.0% (2022-01) | 12.15 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 17.8% | 6.6% | 20.6% | 0.32 | 0.54 | -7.0% (2022-01) | 12.22 | 3 | 2.7 | 66% |
| buy-and-hold UPRO | 8.6% | 3.3% | 63.9% | 0.05 | 0.33 | -27.2% (2022-09) | 40.00 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 38.7% | 13.7% | 12.9% | 1.06 | 0.90 | -8.7% (2026-03) | 4.87 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 38.4% | 13.6% | 12.9% | 1.05 | 0.89 | -8.8% (2026-03) | 4.89 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 30.4% | 11.0% | 12.7% | 0.87 | 0.89 | -3.8% (2026-02) | 4.03 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 25.7% | 9.4% | 12.9% | 0.73 | 0.77 | -4.2% (2026-02) | 4.55 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 37.2% | 13.2% | 12.9% | 1.02 | 0.91 | -7.4% (2026-03) | 4.78 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 37.0% | 13.1% | 12.9% | 1.02 | 0.90 | -7.4% (2026-03) | 4.80 | 2 | 2.0 | 92% |
| buy-and-hold UPRO | 137.8% | 40.4% | 48.9% | 0.83 | 0.96 | -17.6% (2025-03) | 11.27 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -10.8% points, max drawdown -40.7% points (negative = less drawdown), Calmar 0.09, time in market 79% (average exposure 36%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -10.1% points, max drawdown -53.1% points (negative = less drawdown), Calmar 0.61, time in market 66% (average exposure 24%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -10.4% points, max drawdown -43.5% points (negative = less drawdown), Calmar 0.16, time in market 79% (average exposure 35%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0395, SR0 0.0765 (annualised 1.21), DSR 0.095, round trips 5
- S2: daily SR 0.0579, SR0 0.0765 (annualised 1.21), DSR 0.256, round trips 109
- S3: daily SR 0.0423, SR0 0.0765 (annualised 1.21), DSR 0.113, round trips 5

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
| S1 {"n":200,"bandPct":2} (5 bps) | 45.6% | 7.6% | 15.1% | 0.51 | 0.78 | -5.6% (2025-03) | 6.72 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 45.1% | 7.6% | 15.3% | 0.50 | 0.77 | -5.6% (2025-03) | 6.79 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 44.9% | 7.5% | 7.3% | 1.04 | 1.01 | -4.2% (2021-09) | 2.68 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 35.1% | 6.1% | 7.7% | 0.79 | 0.80 | -4.4% (2021-09) | 3.41 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 45.6% | 7.6% | 15.1% | 0.51 | 0.78 | -5.6% (2025-03) | 6.72 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 45.1% | 7.6% | 15.3% | 0.50 | 0.77 | -5.6% (2025-03) | 6.79 | 5 | 2.2 | 79% |
| buy-and-hold SSO | 130.0% | 17.7% | 46.9% | 0.38 | 0.65 | -18.5% (2022-09) | 19.14 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -11.2% | -11.3% | 12.7% | -0.89 | -1.65 | -5.4% (2022-04) | 10.90 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -11.4% | -11.4% | 12.8% | -0.89 | -1.67 | -5.5% (2022-04) | 10.98 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 0.1% | 0.1% | 4.9% | 0.02 | 0.05 | -1.7% (2022-01) | 1.49 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -0.7% | -0.7% | 5.1% | -0.14 | -0.15 | -2.0% (2022-01) | 2.10 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -11.1% | -11.1% | 12.5% | -0.89 | -1.65 | -5.3% (2022-04) | 10.80 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -11.2% | -11.3% | 12.6% | -0.89 | -1.67 | -5.3% (2022-04) | 10.88 | 2 | 4.0 | 22% |
| buy-and-hold SSO | -39.5% | -39.6% | 46.8% | -0.85 | -0.80 | -18.5% (2022-09) | 30.56 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 52.7% | 12.1% | 9.2% | 1.31 | 1.17 | -5.3% (2025-03) | 3.20 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 52.3% | 12.0% | 9.2% | 1.30 | 1.17 | -5.3% (2025-03) | 3.22 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 43.9% | 10.3% | 6.9% | 1.49 | 1.28 | -3.0% (2023-09) | 2.31 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 36.1% | 8.7% | 7.3% | 1.18 | 1.06 | -3.6% (2023-09) | 2.84 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 52.7% | 12.1% | 9.2% | 1.31 | 1.17 | -5.3% (2025-03) | 3.20 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 52.3% | 12.0% | 9.2% | 1.30 | 1.17 | -5.3% (2025-03) | 3.22 | 3 | 1.9 | 93% |
| buy-and-hold SSO | 223.9% | 37.2% | 35.1% | 1.06 | 1.22 | -11.9% (2025-03) | 7.09 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 12.7% | 4.8% | 15.1% | 0.32 | 0.54 | -5.2% (2022-04) | 8.84 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 12.4% | 4.7% | 15.3% | 0.31 | 0.53 | -5.2% (2022-04) | 8.93 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 20.5% | 7.6% | 7.3% | 1.04 | 0.99 | -4.2% (2021-09) | 3.16 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 15.9% | 6.0% | 7.7% | 0.77 | 0.78 | -4.4% (2021-09) | 4.03 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 12.7% | 4.8% | 15.1% | 0.32 | 0.54 | -5.2% (2022-04) | 8.84 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 12.4% | 4.7% | 15.3% | 0.31 | 0.53 | -5.2% (2022-04) | 8.93 | 3 | 2.7 | 66% |
| buy-and-hold SSO | 18.0% | 6.7% | 46.9% | 0.14 | 0.36 | -18.5% (2022-09) | 26.05 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 30.6% | 11.0% | 8.1% | 1.36 | 1.09 | -5.5% (2026-03) | 2.95 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 30.4% | 11.0% | 8.1% | 1.35 | 1.08 | -5.5% (2026-03) | 2.96 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 23.0% | 8.4% | 8.2% | 1.03 | 1.01 | -2.6% (2026-02) | 2.55 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 18.3% | 6.8% | 8.4% | 0.81 | 0.82 | -3.1% (2026-02) | 3.07 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 30.6% | 11.0% | 8.1% | 1.36 | 1.09 | -5.5% (2026-03) | 2.95 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 30.4% | 11.0% | 8.1% | 1.35 | 1.08 | -5.5% (2026-03) | 2.96 | 2 | 2.0 | 92% |
| buy-and-hold SSO | 96.5% | 30.3% | 35.1% | 0.86 | 1.01 | -11.9% (2025-03) | 7.31 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -10.1% points, max drawdown -31.8% points (negative = less drawdown), Calmar 0.13, time in market 79% (average exposure 34%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -10.2% points, max drawdown -39.7% points (negative = less drawdown), Calmar 0.66, time in market 66% (average exposure 24%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -10.1% points, max drawdown -31.8% points (negative = less drawdown), Calmar 0.13, time in market 79% (average exposure 34%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0490, SR0 0.0765 (annualised 1.21), DSR 0.165, round trips 5
- S2: daily SR 0.0639, SR0 0.0765 (annualised 1.21), DSR 0.329, round trips 109
- S3: daily SR 0.0490, SR0 0.0765 (annualised 1.21), DSR 0.165, round trips 5

#### Whole-share $20-cap variant

Traded ETF open at the first full-span fill day: 30.84 vs the $20 cap: one share exceeds the cap, so this variant cannot buy at the start. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.

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

### SPY->SPY (leverage 1)

#### full span (after warm-up): 2021-08-06 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 34.6% | 6.0% | 6.5% | 0.93 | 1.27 | -2.5% (2022-04) | 2.90 | 5 | 2.2 | 79% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 34.0% | 5.9% | 6.6% | 0.90 | 1.25 | -2.6% (2022-04) | 2.95 | 5 | 2.2 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 32.0% | 5.6% | 3.7% | 1.52 | 1.49 | -2.2% (2021-09) | 1.13 | 109 | 42.9 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 22.3% | 4.0% | 4.1% | 0.98 | 1.04 | -2.4% (2021-09) | 1.73 | 109 | 42.9 | 66% |
| S3 {"targetVolPct":20} (5 bps) | 34.6% | 6.0% | 6.5% | 0.93 | 1.27 | -2.5% (2022-04) | 2.90 | 5 | 2.2 | 79% |
| S3 {"targetVolPct":20} (15 bps stress) | 34.0% | 5.9% | 6.6% | 0.90 | 1.25 | -2.6% (2022-04) | 2.95 | 5 | 2.2 | 79% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 87.1% | 13.1% | 24.5% | 0.53 | 0.81 | -9.2% (2022-09) | 8.36 | 0 | 0.2 | 100% |

#### calendar 2022 (2022-01-01 to 2022-12-31): 2022-01-03 to 2022-12-30

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -5.0% | -5.0% | 6.4% | -0.78 | -1.42 | -2.6% (2022-04) | 5.30 | 2 | 4.0 | 22% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -5.1% | -5.1% | 6.5% | -0.79 | -1.47 | -2.6% (2022-04) | 5.40 | 2 | 4.0 | 22% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 0.9% | 0.9% | 2.3% | 0.37 | 0.47 | -0.8% (2022-01) | 0.60 | 10 | 20.1 | 7% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 0.1% | 0.1% | 2.5% | 0.03 | 0.04 | -1.1% (2022-01) | 1.15 | 10 | 20.1 | 7% |
| S3 {"targetVolPct":20} (5 bps) | -5.0% | -5.0% | 6.4% | -0.78 | -1.42 | -2.6% (2022-04) | 5.30 | 2 | 4.0 | 22% |
| S3 {"targetVolPct":20} (15 bps stress) | -5.1% | -5.1% | 6.5% | -0.79 | -1.47 | -2.6% (2022-04) | 5.40 | 2 | 4.0 | 22% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -18.4% | -18.5% | 24.5% | -0.76 | -0.73 | -9.2% (2022-09) | 15.03 | 0 | 1.0 | 100% |

#### 2023-01-01 onward: 2023-01-03 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 36.8% | 8.8% | 4.1% | 2.13 | 1.79 | -2.2% (2026-03) | 1.23 | 3 | 1.9 | 93% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 36.4% | 8.7% | 4.1% | 2.12 | 1.78 | -2.2% (2026-03) | 1.25 | 3 | 1.9 | 93% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 30.6% | 7.5% | 3.7% | 2.00 | 1.83 | -1.5% (2023-09) | 0.96 | 88 | 47.7 | 79% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 22.9% | 5.7% | 4.1% | 1.40 | 1.37 | -2.1% (2023-09) | 1.45 | 88 | 47.7 | 79% |
| S3 {"targetVolPct":20} (5 bps) | 36.8% | 8.8% | 4.1% | 2.13 | 1.79 | -2.2% (2026-03) | 1.23 | 3 | 1.9 | 93% |
| S3 {"targetVolPct":20} (15 bps stress) | 36.4% | 8.7% | 4.1% | 2.12 | 1.78 | -2.2% (2026-03) | 1.25 | 3 | 1.9 | 93% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |
| buy-and-hold SPY | 110.4% | 22.2% | 18.7% | 1.18 | 1.44 | -5.5% (2025-03) | 3.32 | 0 | 0.3 | 100% |

#### first half of the span (to 2024-03-04): 2021-08-06 to 2024-03-04

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 10.6% | 4.0% | 6.5% | 0.63 | 0.89 | -2.5% (2022-04) | 3.89 | 3 | 2.7 | 66% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 10.4% | 3.9% | 6.6% | 0.60 | 0.87 | -2.6% (2022-04) | 3.97 | 3 | 2.7 | 66% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 13.8% | 5.2% | 3.5% | 1.49 | 1.38 | -2.2% (2021-09) | 1.31 | 54 | 42.7 | 53% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 9.2% | 3.5% | 4.1% | 0.85 | 0.92 | -2.4% (2021-09) | 2.02 | 54 | 42.7 | 53% |
| S3 {"targetVolPct":20} (5 bps) | 10.6% | 4.0% | 6.5% | 0.63 | 0.89 | -2.5% (2022-04) | 3.89 | 3 | 2.7 | 66% |
| S3 {"targetVolPct":20} (15 bps stress) | 10.4% | 3.9% | 6.6% | 0.60 | 0.87 | -2.6% (2022-04) | 3.97 | 3 | 2.7 | 66% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 20.3% | 7.5% | 24.5% | 0.31 | 0.49 | -9.2% (2022-09) | 11.30 | 0 | 0.4 | 100% |

#### second half of the span (from 2024-03-05): 2024-03-05 to 2026-09-25

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 22.4% | 8.2% | 3.9% | 2.10 | 1.67 | -2.5% (2026-03) | 1.23 | 2 | 2.0 | 92% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 22.2% | 8.2% | 3.9% | 2.08 | 1.66 | -2.5% (2026-03) | 1.24 | 2 | 2.0 | 92% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 17.0% | 6.3% | 4.2% | 1.51 | 1.51 | -1.3% (2026-02) | 1.07 | 55 | 43.5 | 78% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 12.3% | 4.7% | 4.4% | 1.06 | 1.10 | -1.7% (2026-02) | 1.53 | 55 | 43.5 | 78% |
| S3 {"targetVolPct":20} (5 bps) | 22.4% | 8.2% | 3.9% | 2.10 | 1.67 | -2.5% (2026-03) | 1.23 | 2 | 2.0 | 92% |
| S3 {"targetVolPct":20} (15 bps stress) | 22.2% | 8.2% | 3.9% | 2.08 | 1.66 | -2.5% (2026-03) | 1.24 | 2 | 2.0 | 92% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |
| buy-and-hold SPY | 56.1% | 19.1% | 18.7% | 1.02 | 1.21 | -5.5% (2025-03) | 3.44 | 0 | 0.4 | 100% |

#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)

- S1: CAGR -7.1% points, max drawdown -18.1% points (negative = less drawdown), Calmar 0.40, time in market 79% (average exposure 32%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S2: CAGR -7.5% points, max drawdown -20.8% points (negative = less drawdown), Calmar 0.99, time in market 66% (average exposure 24%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.
- S3: CAGR -7.1% points, max drawdown -18.1% points (negative = less drawdown), Calmar 0.40, time in market 79% (average exposure 32%). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.

#### Deflated Sharpe (full span, 5 bps, N=186)

- S1: daily SR 0.0797, SR0 0.0765 (annualised 1.21), DSR 0.546, round trips 5
- S2: daily SR 0.0936, SR0 0.0765 (annualised 1.21), DSR 0.725, round trips 109
- S3: daily SR 0.0797, SR0 0.0765 (annualised 1.21), DSR 0.546, round trips 5

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
| QQQ->TQQQ | S1 | {"n":150,"bandPct":0} |  | 13.9% | 20.2% | 0.69 | 0.78 | 14 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":1} |  | 13.3% | 21.0% | 0.63 | 0.75 | 6 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":2} |  | 11.5% | 22.1% | 0.52 | 0.66 | 6 |
| QQQ->TQQQ | S1 | {"n":150,"bandPct":3} |  | 15.9% | 26.6% | 0.60 | 0.74 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":0} |  | 15.3% | 22.1% | 0.69 | 0.85 | 10 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":1} |  | 18.0% | 26.7% | 0.67 | 0.82 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":2} |  | 15.9% | 27.2% | 0.59 | 0.73 | 3 |
| QQQ->TQQQ | S1 | {"n":175,"bandPct":3} |  | 14.8% | 27.2% | 0.54 | 0.69 | 3 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":0} |  | 16.2% | 29.0% | 0.56 | 0.71 | 10 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":1} |  | 15.9% | 27.7% | 0.57 | 0.71 | 5 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":2} | yes | 13.9% | 26.1% | 0.53 | 0.67 | 3 |
| QQQ->TQQQ | S1 | {"n":200,"bandPct":3} |  | 13.6% | 26.1% | 0.52 | 0.66 | 3 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":0} |  | 14.2% | 34.5% | 0.41 | 0.62 | 13 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":1} |  | 11.8% | 35.9% | 0.33 | 0.56 | 7 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":2} |  | 13.2% | 30.0% | 0.44 | 0.62 | 5 |
| QQQ->TQQQ | S1 | {"n":225,"bandPct":3} |  | 14.6% | 26.8% | 0.55 | 0.70 | 3 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":0} |  | 14.0% | 37.1% | 0.38 | 0.60 | 14 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":1} |  | 13.0% | 31.5% | 0.41 | 0.59 | 7 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":2} |  | 13.0% | 31.4% | 0.41 | 0.59 | 7 |
| QQQ->TQQQ | S1 | {"n":250,"bandPct":3} |  | 12.3% | 38.9% | 0.32 | 0.55 | 4 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":8} |  | 13.4% | 16.3% | 0.82 | 0.95 | 101 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":10} |  | 13.4% | 16.3% | 0.82 | 0.95 | 101 |
| QQQ->TQQQ | S2 | {"slow":150,"trailingDDPct":15} |  | 13.4% | 16.3% | 0.82 | 0.95 | 101 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":8} |  | 15.2% | 20.9% | 0.73 | 1.01 | 113 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":10} | yes | 15.2% | 20.9% | 0.73 | 1.01 | 113 |
| QQQ->TQQQ | S2 | {"slow":200,"trailingDDPct":15} |  | 15.2% | 20.9% | 0.73 | 1.01 | 113 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":8} |  | 13.1% | 23.3% | 0.56 | 0.86 | 123 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":10} |  | 13.1% | 23.3% | 0.56 | 0.86 | 123 |
| QQQ->TQQQ | S2 | {"slow":250,"trailingDDPct":15} |  | 13.1% | 23.3% | 0.56 | 0.86 | 123 |
| QQQ->TQQQ | S3 | {"targetVolPct":15} |  | 9.4% | 20.2% | 0.46 | 0.64 | 3 |
| QQQ->TQQQ | S3 | {"targetVolPct":20} | yes | 11.7% | 21.4% | 0.55 | 0.67 | 3 |
| QQQ->QLD | S1 | {"n":150,"bandPct":0} |  | 11.2% | 12.8% | 0.87 | 0.93 | 14 |
| QQQ->QLD | S1 | {"n":150,"bandPct":1} |  | 11.0% | 13.0% | 0.85 | 0.92 | 6 |
| QQQ->QLD | S1 | {"n":150,"bandPct":2} |  | 9.8% | 13.7% | 0.71 | 0.83 | 6 |
| QQQ->QLD | S1 | {"n":150,"bandPct":3} |  | 12.5% | 16.3% | 0.77 | 0.89 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":0} |  | 12.2% | 13.9% | 0.88 | 1.02 | 10 |
| QQQ->QLD | S1 | {"n":175,"bandPct":1} |  | 13.8% | 16.3% | 0.84 | 0.97 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":2} |  | 12.5% | 16.7% | 0.75 | 0.87 | 3 |
| QQQ->QLD | S1 | {"n":175,"bandPct":3} |  | 11.7% | 16.6% | 0.70 | 0.82 | 3 |
| QQQ->QLD | S1 | {"n":200,"bandPct":0} |  | 12.2% | 17.9% | 0.68 | 0.82 | 10 |
| QQQ->QLD | S1 | {"n":200,"bandPct":1} |  | 12.4% | 16.9% | 0.73 | 0.84 | 5 |
| QQQ->QLD | S1 | {"n":200,"bandPct":2} | yes | 11.2% | 16.0% | 0.70 | 0.81 | 3 |
| QQQ->QLD | S1 | {"n":200,"bandPct":3} |  | 11.0% | 16.0% | 0.68 | 0.80 | 3 |
| QQQ->QLD | S1 | {"n":225,"bandPct":0} |  | 10.8% | 22.9% | 0.47 | 0.71 | 13 |
| QQQ->QLD | S1 | {"n":225,"bandPct":1} |  | 9.5% | 24.1% | 0.40 | 0.66 | 7 |
| QQQ->QLD | S1 | {"n":225,"bandPct":2} |  | 10.6% | 19.5% | 0.54 | 0.74 | 5 |
| QQQ->QLD | S1 | {"n":225,"bandPct":3} |  | 11.7% | 16.0% | 0.73 | 0.84 | 3 |
| QQQ->QLD | S1 | {"n":250,"bandPct":0} |  | 10.7% | 24.5% | 0.44 | 0.69 | 14 |
| QQQ->QLD | S1 | {"n":250,"bandPct":1} |  | 10.2% | 19.3% | 0.53 | 0.69 | 7 |
| QQQ->QLD | S1 | {"n":250,"bandPct":2} |  | 10.3% | 19.7% | 0.52 | 0.69 | 7 |
| QQQ->QLD | S1 | {"n":250,"bandPct":3} |  | 9.9% | 23.7% | 0.42 | 0.64 | 4 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":8} |  | 10.8% | 8.4% | 1.27 | 1.14 | 101 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":10} |  | 10.8% | 8.4% | 1.27 | 1.14 | 101 |
| QQQ->QLD | S2 | {"slow":150,"trailingDDPct":15} |  | 10.8% | 8.4% | 1.27 | 1.14 | 101 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":8} |  | 11.9% | 13.1% | 0.91 | 1.20 | 113 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":10} | yes | 11.9% | 13.1% | 0.91 | 1.20 | 113 |
| QQQ->QLD | S2 | {"slow":200,"trailingDDPct":15} |  | 11.9% | 13.1% | 0.91 | 1.20 | 113 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":8} |  | 10.7% | 14.3% | 0.74 | 1.05 | 123 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":10} |  | 10.7% | 14.3% | 0.74 | 1.05 | 123 |
| QQQ->QLD | S2 | {"slow":250,"trailingDDPct":15} |  | 10.7% | 14.3% | 0.74 | 1.05 | 123 |
| QQQ->QLD | S3 | {"targetVolPct":15} |  | 10.1% | 14.3% | 0.71 | 0.82 | 3 |
| QQQ->QLD | S3 | {"targetVolPct":20} | yes | 11.2% | 16.0% | 0.70 | 0.81 | 3 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":0} |  | 8.0% | 5.6% | 1.42 | 1.34 | 14 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":1} |  | 7.8% | 5.6% | 1.40 | 1.31 | 6 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":2} |  | 7.2% | 6.1% | 1.17 | 1.20 | 6 |
| QQQ->QQQ | S1 | {"n":150,"bandPct":3} |  | 8.6% | 6.8% | 1.26 | 1.28 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":0} |  | 8.5% | 6.3% | 1.34 | 1.43 | 10 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":1} |  | 9.2% | 6.8% | 1.35 | 1.38 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":2} |  | 8.5% | 6.9% | 1.24 | 1.25 | 3 |
| QQQ->QQQ | S1 | {"n":175,"bandPct":3} |  | 8.1% | 6.9% | 1.18 | 1.19 | 3 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":0} |  | 8.2% | 8.0% | 1.03 | 1.19 | 10 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":1} |  | 8.4% | 7.4% | 1.14 | 1.23 | 5 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":2} | yes | 7.9% | 6.7% | 1.18 | 1.19 | 3 |
| QQQ->QQQ | S1 | {"n":200,"bandPct":3} |  | 7.8% | 6.7% | 1.17 | 1.18 | 3 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":0} |  | 7.5% | 10.5% | 0.71 | 1.06 | 13 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":1} |  | 7.0% | 11.1% | 0.63 | 1.01 | 7 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":2} |  | 7.6% | 8.7% | 0.87 | 1.10 | 5 |
| QQQ->QQQ | S1 | {"n":225,"bandPct":3} |  | 8.2% | 6.7% | 1.21 | 1.22 | 3 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":0} |  | 7.4% | 11.5% | 0.64 | 1.02 | 14 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":1} |  | 7.2% | 9.0% | 0.80 | 1.03 | 7 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":2} |  | 7.2% | 9.1% | 0.79 | 1.03 | 7 |
| QQQ->QQQ | S1 | {"n":250,"bandPct":3} |  | 7.2% | 10.6% | 0.68 | 0.98 | 4 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":8} |  | 6.9% | 4.7% | 1.47 | 1.38 | 101 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":10} |  | 6.9% | 4.7% | 1.47 | 1.38 | 101 |
| QQQ->QQQ | S2 | {"slow":150,"trailingDDPct":15} |  | 6.9% | 4.7% | 1.47 | 1.38 | 101 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":8} |  | 7.5% | 7.1% | 1.06 | 1.45 | 113 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":10} | yes | 7.5% | 7.1% | 1.06 | 1.45 | 113 |
| QQQ->QQQ | S2 | {"slow":200,"trailingDDPct":15} |  | 7.5% | 7.1% | 1.06 | 1.45 | 113 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":8} |  | 6.7% | 8.0% | 0.83 | 1.27 | 123 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":10} |  | 6.7% | 8.0% | 0.83 | 1.27 | 123 |
| QQQ->QQQ | S2 | {"slow":250,"trailingDDPct":15} |  | 6.7% | 8.0% | 0.83 | 1.27 | 123 |
| QQQ->QQQ | S3 | {"targetVolPct":15} |  | 7.9% | 6.7% | 1.18 | 1.19 | 3 |
| QQQ->QQQ | S3 | {"targetVolPct":20} | yes | 7.9% | 6.7% | 1.18 | 1.19 | 3 |
| SPY->UPRO | S1 | {"n":150,"bandPct":0} |  | 11.1% | 23.9% | 0.46 | 0.73 | 16 |
| SPY->UPRO | S1 | {"n":150,"bandPct":1} |  | 8.9% | 31.3% | 0.29 | 0.58 | 9 |
| SPY->UPRO | S1 | {"n":150,"bandPct":2} |  | 7.3% | 31.8% | 0.23 | 0.49 | 7 |
| SPY->UPRO | S1 | {"n":150,"bandPct":3} |  | 8.1% | 20.8% | 0.39 | 0.59 | 5 |
| SPY->UPRO | S1 | {"n":175,"bandPct":0} |  | 6.6% | 39.5% | 0.17 | 0.43 | 21 |
| SPY->UPRO | S1 | {"n":175,"bandPct":1} |  | 8.3% | 31.1% | 0.27 | 0.54 | 9 |
| SPY->UPRO | S1 | {"n":175,"bandPct":2} |  | 8.5% | 28.5% | 0.30 | 0.56 | 7 |
| SPY->UPRO | S1 | {"n":175,"bandPct":3} |  | 8.0% | 23.9% | 0.33 | 0.55 | 5 |
| SPY->UPRO | S1 | {"n":200,"bandPct":0} |  | 9.8% | 24.0% | 0.41 | 0.65 | 15 |
| SPY->UPRO | S1 | {"n":200,"bandPct":1} |  | 9.0% | 26.7% | 0.34 | 0.60 | 9 |
| SPY->UPRO | S1 | {"n":200,"bandPct":2} | yes | 9.3% | 23.2% | 0.40 | 0.63 | 5 |
| SPY->UPRO | S1 | {"n":200,"bandPct":3} |  | 8.4% | 29.8% | 0.28 | 0.55 | 4 |
| SPY->UPRO | S1 | {"n":225,"bandPct":0} |  | 10.4% | 22.5% | 0.46 | 0.67 | 14 |
| SPY->UPRO | S1 | {"n":225,"bandPct":1} |  | 10.0% | 20.3% | 0.49 | 0.66 | 7 |
| SPY->UPRO | S1 | {"n":225,"bandPct":2} |  | 9.7% | 27.0% | 0.36 | 0.62 | 4 |
| SPY->UPRO | S1 | {"n":225,"bandPct":3} |  | 8.1% | 32.1% | 0.25 | 0.51 | 3 |
| SPY->UPRO | S1 | {"n":250,"bandPct":0} |  | 10.2% | 22.7% | 0.45 | 0.65 | 17 |
| SPY->UPRO | S1 | {"n":250,"bandPct":1} |  | 10.0% | 28.7% | 0.35 | 0.60 | 6 |
| SPY->UPRO | S1 | {"n":250,"bandPct":2} |  | 8.3% | 30.1% | 0.28 | 0.50 | 4 |
| SPY->UPRO | S1 | {"n":250,"bandPct":3} |  | 8.7% | 27.6% | 0.32 | 0.53 | 4 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":8} |  | 9.3% | 15.3% | 0.61 | 0.83 | 99 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":10} |  | 9.3% | 15.3% | 0.61 | 0.83 | 99 |
| SPY->UPRO | S2 | {"slow":150,"trailingDDPct":15} |  | 9.3% | 15.3% | 0.61 | 0.83 | 99 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":8} |  | 10.0% | 10.8% | 0.92 | 0.92 | 109 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":10} | yes | 10.0% | 10.8% | 0.92 | 0.92 | 109 |
| SPY->UPRO | S2 | {"slow":200,"trailingDDPct":15} |  | 10.0% | 10.8% | 0.92 | 0.92 | 109 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":8} |  | 7.1% | 23.7% | 0.30 | 0.60 | 127 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":10} |  | 7.1% | 23.7% | 0.30 | 0.60 | 127 |
| SPY->UPRO | S2 | {"slow":250,"trailingDDPct":15} |  | 7.1% | 23.7% | 0.30 | 0.60 | 127 |
| SPY->UPRO | S3 | {"targetVolPct":15} |  | 8.4% | 18.0% | 0.46 | 0.69 | 5 |
| SPY->UPRO | S3 | {"targetVolPct":20} | yes | 9.7% | 20.5% | 0.47 | 0.67 | 5 |
| SPY->SSO | S1 | {"n":150,"bandPct":0} |  | 8.7% | 15.5% | 0.56 | 0.88 | 16 |
| SPY->SSO | S1 | {"n":150,"bandPct":1} |  | 7.2% | 20.8% | 0.35 | 0.72 | 9 |
| SPY->SSO | S1 | {"n":150,"bandPct":2} |  | 6.3% | 21.1% | 0.30 | 0.63 | 7 |
| SPY->SSO | S1 | {"n":150,"bandPct":3} |  | 6.8% | 13.5% | 0.50 | 0.74 | 5 |
| SPY->SSO | S1 | {"n":175,"bandPct":0} |  | 5.5% | 26.7% | 0.20 | 0.53 | 21 |
| SPY->SSO | S1 | {"n":175,"bandPct":1} |  | 6.9% | 20.5% | 0.33 | 0.68 | 9 |
| SPY->SSO | S1 | {"n":175,"bandPct":2} |  | 7.0% | 18.8% | 0.37 | 0.70 | 7 |
| SPY->SSO | S1 | {"n":175,"bandPct":3} |  | 6.8% | 15.6% | 0.44 | 0.70 | 5 |
| SPY->SSO | S1 | {"n":200,"bandPct":0} |  | 7.8% | 15.7% | 0.50 | 0.79 | 15 |
| SPY->SSO | S1 | {"n":200,"bandPct":1} |  | 7.4% | 17.3% | 0.43 | 0.74 | 9 |
| SPY->SSO | S1 | {"n":200,"bandPct":2} | yes | 7.6% | 15.1% | 0.51 | 0.78 | 5 |
| SPY->SSO | S1 | {"n":200,"bandPct":3} |  | 7.0% | 20.0% | 0.35 | 0.68 | 4 |
| SPY->SSO | S1 | {"n":225,"bandPct":0} |  | 8.2% | 14.4% | 0.57 | 0.81 | 14 |
| SPY->SSO | S1 | {"n":225,"bandPct":1} |  | 8.0% | 13.0% | 0.61 | 0.80 | 7 |
| SPY->SSO | S1 | {"n":225,"bandPct":2} |  | 7.9% | 17.8% | 0.44 | 0.76 | 4 |
| SPY->SSO | S1 | {"n":225,"bandPct":3} |  | 6.8% | 21.6% | 0.31 | 0.63 | 3 |
| SPY->SSO | S1 | {"n":250,"bandPct":0} |  | 8.0% | 14.5% | 0.55 | 0.77 | 17 |
| SPY->SSO | S1 | {"n":250,"bandPct":1} |  | 7.8% | 19.0% | 0.41 | 0.70 | 6 |
| SPY->SSO | S1 | {"n":250,"bandPct":2} |  | 6.7% | 20.0% | 0.34 | 0.61 | 4 |
| SPY->SSO | S1 | {"n":250,"bandPct":3} |  | 7.1% | 17.9% | 0.40 | 0.65 | 4 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":8} |  | 7.1% | 9.8% | 0.72 | 0.94 | 99 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":10} |  | 7.1% | 9.8% | 0.72 | 0.94 | 99 |
| SPY->SSO | S2 | {"slow":150,"trailingDDPct":15} |  | 7.1% | 9.8% | 0.72 | 0.94 | 99 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":8} |  | 7.5% | 7.3% | 1.04 | 1.01 | 109 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":10} | yes | 7.5% | 7.3% | 1.04 | 1.01 | 109 |
| SPY->SSO | S2 | {"slow":200,"trailingDDPct":15} |  | 7.5% | 7.3% | 1.04 | 1.01 | 109 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":8} |  | 5.5% | 15.4% | 0.36 | 0.69 | 127 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":10} |  | 5.5% | 15.4% | 0.36 | 0.69 | 127 |
| SPY->SSO | S2 | {"slow":250,"trailingDDPct":15} |  | 5.5% | 15.4% | 0.36 | 0.69 | 127 |
| SPY->SSO | S3 | {"targetVolPct":15} |  | 7.8% | 14.0% | 0.56 | 0.81 | 5 |
| SPY->SSO | S3 | {"targetVolPct":20} | yes | 7.6% | 15.1% | 0.51 | 0.78 | 5 |
| SPY->SPY | S1 | {"n":150,"bandPct":0} |  | 6.4% | 7.0% | 0.92 | 1.37 | 16 |
| SPY->SPY | S1 | {"n":150,"bandPct":1} |  | 5.8% | 9.0% | 0.64 | 1.21 | 9 |
| SPY->SPY | S1 | {"n":150,"bandPct":2} |  | 5.3% | 9.4% | 0.56 | 1.11 | 7 |
| SPY->SPY | S1 | {"n":150,"bandPct":3} |  | 5.6% | 5.7% | 0.98 | 1.25 | 5 |
| SPY->SPY | S1 | {"n":175,"bandPct":0} |  | 4.8% | 12.3% | 0.39 | 0.99 | 21 |
| SPY->SPY | S1 | {"n":175,"bandPct":1} |  | 5.6% | 9.2% | 0.60 | 1.16 | 9 |
| SPY->SPY | S1 | {"n":175,"bandPct":2} |  | 5.7% | 8.4% | 0.68 | 1.19 | 7 |
| SPY->SPY | S1 | {"n":175,"bandPct":3} |  | 5.6% | 7.1% | 0.78 | 1.19 | 5 |
| SPY->SPY | S1 | {"n":200,"bandPct":0} |  | 6.1% | 6.6% | 0.92 | 1.28 | 15 |
| SPY->SPY | S1 | {"n":200,"bandPct":1} |  | 5.8% | 7.6% | 0.77 | 1.23 | 9 |
| SPY->SPY | S1 | {"n":200,"bandPct":2} | yes | 6.0% | 6.5% | 0.93 | 1.27 | 5 |
| SPY->SPY | S1 | {"n":200,"bandPct":3} |  | 5.7% | 9.0% | 0.63 | 1.14 | 4 |
| SPY->SPY | S1 | {"n":225,"bandPct":0} |  | 6.2% | 6.0% | 1.03 | 1.30 | 14 |
| SPY->SPY | S1 | {"n":225,"bandPct":1} |  | 6.1% | 5.2% | 1.18 | 1.28 | 7 |
| SPY->SPY | S1 | {"n":225,"bandPct":2} |  | 6.1% | 7.9% | 0.77 | 1.23 | 4 |
| SPY->SPY | S1 | {"n":225,"bandPct":3} |  | 5.6% | 9.9% | 0.56 | 1.07 | 3 |
| SPY->SPY | S1 | {"n":250,"bandPct":0} |  | 6.0% | 6.5% | 0.94 | 1.22 | 17 |
| SPY->SPY | S1 | {"n":250,"bandPct":1} |  | 5.9% | 8.3% | 0.71 | 1.13 | 6 |
| SPY->SPY | S1 | {"n":250,"bandPct":2} |  | 5.5% | 9.0% | 0.61 | 1.04 | 4 |
| SPY->SPY | S1 | {"n":250,"bandPct":3} |  | 5.7% | 7.8% | 0.73 | 1.09 | 4 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":8} |  | 5.3% | 3.9% | 1.36 | 1.40 | 99 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":10} |  | 5.3% | 3.9% | 1.36 | 1.40 | 99 |
| SPY->SPY | S2 | {"slow":150,"trailingDDPct":15} |  | 5.3% | 3.9% | 1.36 | 1.40 | 99 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":8} |  | 5.6% | 3.7% | 1.52 | 1.49 | 109 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":10} | yes | 5.6% | 3.7% | 1.52 | 1.49 | 109 |
| SPY->SPY | S2 | {"slow":200,"trailingDDPct":15} |  | 5.6% | 3.7% | 1.52 | 1.49 | 109 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":8} |  | 4.3% | 7.0% | 0.62 | 1.06 | 127 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":10} |  | 4.3% | 7.0% | 0.62 | 1.06 | 127 |
| SPY->SPY | S2 | {"slow":250,"trailingDDPct":15} |  | 4.3% | 7.0% | 0.62 | 1.06 | 127 |
| SPY->SPY | S3 | {"targetVolPct":15} |  | 6.0% | 6.5% | 0.93 | 1.27 | 5 |
| SPY->SPY | S3 | {"targetVolPct":20} | yes | 6.0% | 6.5% | 0.93 | 1.27 | 5 |

## Not verified

- Alpaca free-tier history start date (recorded at first fetch: 2020-07-27)
- fractionability of traded ETFs (getAsset)
- cash-account good-faith/settlement handling beyond the same-day rule
