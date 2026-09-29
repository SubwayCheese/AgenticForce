# Leveraged-ETF trend backtest: HOLDOUT results (prereg v3, one-shot)

Prereg v3 sha256 (verified): `2c497203d8bdfe1b5eb8c3154dcd653b5409c20eed0921173f23accc35e73817`. Prereg commit (read-only `git log`): `6fdbbb861ca0f3c9843f60288aed1cfa8cff8045`.

Mode: holdout. Fixed configs and the $20/$30 caps were chosen before this window was examined (S1/S2/S3 unchanged from the cycle-3 run and prereg v2); no tuning or selection happens here. Evaluation window: first fill after the 250-bar common warm-up through 2021-08-05 (every series is cut at that date BEFORE any signal or return is computed, so nothing after it can influence any number below). Starting equity $50. Cost model: 5 bps/side base, 15 bps/side stress, no added expense ratio, cash leg BIL.

## Verdict on hypothesis H: DOES NOT HOLD

> H: On QQQ->TQQQ at cap $30 and 5 bps, for BOTH S1 and S2: after-cost CAGR > buy-and-hold QQQ CAGR AND max drawdown <= buy-and-hold QQQ max drawdown + 2 percentage points.

> HOLDS: both S1 and S2 meet both conditions at 5 bps AND at 15 bps. PARTLY HOLDS: it holds at 5 bps only, or for only one of S1/S2. DOES NOT HOLD: otherwise.

> This is never reported as a pass. Even "H HOLDS" means only "consistent with the cycle-3 finding on one more ~4.6-year window"; it is not evidence of a durable edge and does not by itself justify raising C1's cap.

### Primary criteria (QQQ->TQQQ, cap $30, full evaluation window)

| config | cost | after-cost CAGR | vs QQQ buy-and-hold CAGR | CAGR pass | max DD | vs QQQ buy-and-hold maxDD + 2pp | maxDD pass | both pass |
|---|---|---|---|---|---|---|---|---|
| S1 | 5 bps | 34.1% | 28.7% | pass | 31.0% | 30.6% | FAIL | FAIL |
| S1 | 15 bps | 34.0% | 28.7% | pass | 31.1% | 30.6% | FAIL | FAIL |
| S2 | 5 bps | 21.3% | 28.7% | FAIL | 29.7% | 30.6% | pass | FAIL |
| S2 | 15 bps | 19.9% | 28.7% | FAIL | 31.3% | 30.6% | FAIL | FAIL |

## Disclosures (verbatim from the prereg)

- The rules and the $30 cap were chosen before this window was examined; the cap came from a different window.
- The window has no 2008-style bear market; drawdowns are not worst-case for 3x ETFs.
- Round-trip counts are small (S1 ~1-2 trades/yr); confidence intervals would be meaningless and are not computed.
- Raising C1's cap changes bus/city/survive-budget-envelope.js (protected): the owner's decision, not this test's.
- 2020-07-27..2021-08-05 prices (IEX) were used as indicator warm-up by the v2 runs and in the cycle-4 SIP-vs-IEX price comparison -- used, never scored.
- The cycle-4 SIP fetch was a raw price pull with a gap/sanity check only, no signal/return/equity computed on 2016-2021.
- Hindsight: everyone involved knows how 2018 and 2020 played out, and 200-day trend rules are known to have sidestepped parts of both; the configs are canonical, which limits but does not remove this bias.

## Data

Bars dated after 2021-08-05 are dropped before any computation. Cached bars per symbol:

| symbol | cached bars | first cached date | dropped (after window end) | last date used |
|---|---|---|---|---|
| QQQ | 2699 | 2016-01-04 | 2021-08-06, 2021-08-09, 2021-08-10, 2021-08-11, 2021-08-12, 2021-08-13, 2021-08-16, 2021-08-17, 2021-08-18, 2021-08-19, 2021-08-20, 2021-08-23, 2021-08-24, 2021-08-25, 2021-08-26, 2021-08-27, 2021-08-30, 2021-08-31, 2021-09-01, 2021-09-02, ... (1291 total) | 2021-08-05 |
| SPY | 2699 | 2016-01-04 | 2021-08-06, 2021-08-09, 2021-08-10, 2021-08-11, 2021-08-12, 2021-08-13, 2021-08-16, 2021-08-17, 2021-08-18, 2021-08-19, 2021-08-20, 2021-08-23, 2021-08-24, 2021-08-25, 2021-08-26, 2021-08-27, 2021-08-30, 2021-08-31, 2021-09-01, 2021-09-02, ... (1291 total) | 2021-08-05 |
| TQQQ | 2699 | 2016-01-04 | 2021-08-06, 2021-08-09, 2021-08-10, 2021-08-11, 2021-08-12, 2021-08-13, 2021-08-16, 2021-08-17, 2021-08-18, 2021-08-19, 2021-08-20, 2021-08-23, 2021-08-24, 2021-08-25, 2021-08-26, 2021-08-27, 2021-08-30, 2021-08-31, 2021-09-01, 2021-09-02, ... (1291 total) | 2021-08-05 |
| QLD | 2699 | 2016-01-04 | 2021-08-06, 2021-08-09, 2021-08-10, 2021-08-11, 2021-08-12, 2021-08-13, 2021-08-16, 2021-08-17, 2021-08-18, 2021-08-19, 2021-08-20, 2021-08-23, 2021-08-24, 2021-08-25, 2021-08-26, 2021-08-27, 2021-08-30, 2021-08-31, 2021-09-01, 2021-09-02, ... (1291 total) | 2021-08-05 |
| UPRO | 2699 | 2016-01-04 | 2021-08-06, 2021-08-09, 2021-08-10, 2021-08-11, 2021-08-12, 2021-08-13, 2021-08-16, 2021-08-17, 2021-08-18, 2021-08-19, 2021-08-20, 2021-08-23, 2021-08-24, 2021-08-25, 2021-08-26, 2021-08-27, 2021-08-30, 2021-08-31, 2021-09-01, 2021-09-02, ... (1291 total) | 2021-08-05 |
| SSO | 2699 | 2016-01-04 | 2021-08-06, 2021-08-09, 2021-08-10, 2021-08-11, 2021-08-12, 2021-08-13, 2021-08-16, 2021-08-17, 2021-08-18, 2021-08-19, 2021-08-20, 2021-08-23, 2021-08-24, 2021-08-25, 2021-08-26, 2021-08-27, 2021-08-30, 2021-08-31, 2021-09-01, 2021-09-02, ... (1291 total) | 2021-08-05 |
| BIL | 2699 | 2016-01-04 | 2021-08-06, 2021-08-09, 2021-08-10, 2021-08-11, 2021-08-12, 2021-08-13, 2021-08-16, 2021-08-17, 2021-08-18, 2021-08-19, 2021-08-20, 2021-08-23, 2021-08-24, 2021-08-25, 2021-08-26, 2021-08-27, 2021-08-30, 2021-08-31, 2021-09-01, 2021-09-02, ... (1291 total) | 2021-08-05 |
| SHY | 2699 | 2016-01-04 | 2021-08-06, 2021-08-09, 2021-08-10, 2021-08-11, 2021-08-12, 2021-08-13, 2021-08-16, 2021-08-17, 2021-08-18, 2021-08-19, 2021-08-20, 2021-08-23, 2021-08-24, 2021-08-25, 2021-08-26, 2021-08-27, 2021-08-30, 2021-08-31, 2021-09-01, 2021-09-02, ... (1291 total) | 2021-08-05 |

Each pair is aligned by INTERSECTION of underlying, traded ETF and BIL dates:

- QQQ->TQQQ: 1408 aligned days (2016-01-04 to 2021-08-05)
- QQQ->QLD: 1408 aligned days (2016-01-04 to 2021-08-05)
- QQQ->QQQ: 1408 aligned days (2016-01-04 to 2021-08-05)
- SPY->UPRO: 1408 aligned days (2016-01-04 to 2021-08-05)
- SPY->SSO: 1408 aligned days (2016-01-04 to 2021-08-05)
- SPY->SPY: 1408 aligned days (2016-01-04 to 2021-08-05)

Signals use the underlying's close at t and fill at the traded ETF's open at t+1; the full-window equity curve starts at the close before its first possible fill (common warm-up of 250 bars, so every config is scored from the same start; no return is attributed before that). Sharpe is daily, annualised by sqrt(252), rf=0; CAGR uses years = daily returns / 252; ulcer index is in percent units. Fills are SIP first prints.

Multiple testing: N = 36 (2 caps x 3 configs x 6 pairs). Deflated Sharpe uses V[SR] = 1/(T-1).

## By pair, cap and window (all caps, all pairs, both sub-spans)

### QQQ->TQQQ (leverage 3); full evaluation window 2016-12-29 to 2021-08-05

#### cap $20

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 191.9% | 26.3% | 25.4% | 1.03 | 1.04 | -19.1% (2018-10) | 12.59 | 5 | 2.4 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 191.2% | 26.2% | 25.5% | 1.03 | 1.04 | -19.1% (2018-10) | 12.64 | 5 | 2.4 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 97.0% | 15.9% | 23.7% | 0.67 | 0.98 | -11.5% (2020-09) | 8.99 | 101 | 44.2 | 81% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 88.6% | 14.8% | 24.7% | 0.60 | 0.90 | -12.1% (2020-09) | 9.73 | 101 | 44.2 | 81% |
| S3 {"targetVolPct":20} (5 bps) | 117.4% | 18.4% | 23.8% | 0.77 | 0.91 | -19.1% (2018-10) | 12.29 | 5 | 2.4 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 116.7% | 18.3% | 23.9% | 0.77 | 0.90 | -19.1% (2018-10) | 12.35 | 5 | 2.4 | 90% |
| buy-and-hold TQQQ | 1162.5% | 73.6% | 69.9% | 1.05 | 1.17 | -38.1% (2020-03) | 19.07 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 219.2% | 28.7% | 28.6% | 1.01 | 1.22 | -8.7% (2018-12) | 5.74 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -0.5% | -0.5% | 19.2% | -0.03 | 0.10 | -14.0% (2018-10) | 9.24 | 2 | 4.0 | 83% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -0.7% | -0.7% | 19.3% | -0.03 | 0.09 | -14.0% (2018-10) | 9.26 | 2 | 4.0 | 83% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 8.9% | 9.0% | 12.6% | 0.71 | 0.56 | -7.3% (2018-02) | 5.89 | 28 | 56.2 | 73% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 6.6% | 6.7% | 12.6% | 0.53 | 0.44 | -7.6% (2018-02) | 6.31 | 28 | 56.2 | 73% |
| S3 {"targetVolPct":20} (5 bps) | 2.1% | 2.1% | 16.9% | 0.12 | 0.21 | -14.0% (2018-10) | 8.68 | 2 | 4.0 | 83% |
| S3 {"targetVolPct":20} (15 bps stress) | 2.0% | 2.0% | 17.0% | 0.12 | 0.20 | -14.0% (2018-10) | 8.69 | 2 | 4.0 | 83% |
| buy-and-hold TQQQ | -21.0% | -21.1% | 58.1% | -0.36 | -0.01 | -26.8% (2018-12) | 19.50 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -0.6% | -0.6% | 22.8% | -0.03 | 0.09 | -8.7% (2018-12) | 6.55 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 54.4% | 64.1% | 29.7% | 2.16 | 1.26 | -14.2% (2020-09) | 14.98 | 2 | 5.7 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 54.2% | 63.8% | 29.8% | 2.15 | 1.25 | -14.2% (2020-09) | 15.03 | 2 | 5.7 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 22.3% | 25.8% | 31.8% | 0.81 | 0.76 | -16.9% (2020-09) | 19.06 | 19 | 44.5 | 82% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 20.7% | 24.0% | 32.3% | 0.74 | 0.72 | -17.4% (2020-09) | 19.48 | 19 | 44.5 | 82% |
| S3 {"targetVolPct":20} (5 bps) | -0.9% | -1.0% | 20.5% | -0.05 | 0.04 | -13.6% (2020-02) | 12.49 | 2 | 5.7 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | -1.0% | -1.1% | 20.5% | -0.06 | 0.04 | -13.6% (2020-02) | 12.53 | 2 | 5.7 | 90% |
| buy-and-hold TQQQ | 55.5% | 65.4% | 69.9% | 0.94 | 1.03 | -38.1% (2020-03) | 29.93 | 0 | 1.1 | 100% |
| buy-and-hold QQQ | 33.8% | 39.4% | 28.6% | 1.38 | 1.07 | -12.9% (2020-02) | 8.96 | 0 | 1.1 | 100% |

#### cap $30

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 285.4% | 34.1% | 31.0% | 1.10 | 1.08 | -23.2% (2018-10) | 15.42 | 5 | 2.4 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 284.4% | 34.0% | 31.1% | 1.10 | 1.08 | -23.3% (2018-10) | 15.50 | 5 | 2.4 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 143.0% | 21.3% | 29.7% | 0.72 | 1.02 | -13.9% (2020-09) | 11.31 | 101 | 44.2 | 81% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 130.4% | 19.9% | 31.3% | 0.64 | 0.94 | -14.8% (2020-09) | 12.32 | 101 | 44.2 | 81% |
| S3 {"targetVolPct":20} (5 bps) | 145.6% | 21.6% | 28.1% | 0.77 | 0.91 | -22.6% (2018-10) | 14.65 | 5 | 2.4 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 144.6% | 21.5% | 28.2% | 0.76 | 0.91 | -22.6% (2018-10) | 14.75 | 5 | 2.4 | 90% |
| buy-and-hold TQQQ | 1162.5% | 73.6% | 69.9% | 1.05 | 1.17 | -38.1% (2020-03) | 19.07 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 219.2% | 28.7% | 28.6% | 1.01 | 1.22 | -8.7% (2018-12) | 5.74 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -1.6% | -1.6% | 26.7% | -0.06 | 0.13 | -19.4% (2018-10) | 12.94 | 2 | 4.0 | 83% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -1.9% | -1.9% | 26.8% | -0.07 | 0.12 | -19.5% (2018-10) | 12.97 | 2 | 4.0 | 83% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 12.5% | 12.6% | 17.9% | 0.70 | 0.58 | -10.5% (2018-02) | 8.36 | 28 | 56.2 | 73% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 9.1% | 9.1% | 18.0% | 0.51 | 0.46 | -10.9% (2018-02) | 8.97 | 28 | 56.2 | 73% |
| S3 {"targetVolPct":20} (5 bps) | 3.6% | 3.6% | 22.5% | 0.16 | 0.27 | -19.4% (2018-10) | 11.93 | 2 | 4.0 | 83% |
| S3 {"targetVolPct":20} (15 bps stress) | 3.4% | 3.4% | 22.6% | 0.15 | 0.27 | -19.5% (2018-10) | 11.95 | 2 | 4.0 | 83% |
| buy-and-hold TQQQ | -21.0% | -21.1% | 58.1% | -0.36 | -0.01 | -26.8% (2018-12) | 19.50 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -0.6% | -0.6% | 22.8% | -0.03 | 0.09 | -8.7% (2018-12) | 6.55 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 81.5% | 97.3% | 44.6% | 2.18 | 1.30 | -21.3% (2020-03) | 21.30 | 2 | 5.7 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 81.2% | 96.9% | 44.7% | 2.17 | 1.30 | -21.5% (2020-03) | 21.38 | 2 | 5.7 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 28.1% | 32.6% | 47.4% | 0.69 | 0.77 | -24.4% (2020-02) | 26.77 | 19 | 44.5 | 82% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 24.9% | 28.9% | 48.1% | 0.60 | 0.73 | -24.8% (2020-03) | 27.39 | 19 | 44.5 | 82% |
| S3 {"targetVolPct":20} (5 bps) | -1.4% | -1.6% | 20.9% | -0.08 | 0.02 | -14.0% (2020-02) | 12.88 | 2 | 5.7 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | -1.5% | -1.7% | 20.9% | -0.08 | 0.01 | -14.0% (2020-02) | 12.91 | 2 | 5.7 | 90% |
| buy-and-hold TQQQ | 55.5% | 65.4% | 69.9% | 0.94 | 1.03 | -38.1% (2020-03) | 29.93 | 0 | 1.1 | 100% |
| buy-and-hold QQQ | 33.8% | 39.4% | 28.6% | 1.38 | 1.07 | -12.9% (2020-02) | 8.96 | 0 | 1.1 | 100% |

### QQQ->QLD (leverage 2); full evaluation window 2016-12-29 to 2021-08-05

#### cap $20

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 112.2% | 17.8% | 18.0% | 0.99 | 1.10 | -11.4% (2018-10) | 7.52 | 5 | 2.4 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 111.6% | 17.7% | 18.0% | 0.98 | 1.09 | -11.5% (2018-10) | 7.58 | 5 | 2.4 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 61.9% | 11.1% | 17.3% | 0.64 | 0.98 | -7.4% (2020-09) | 5.87 | 101 | 44.2 | 81% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 53.6% | 9.8% | 18.3% | 0.53 | 0.85 | -8.0% (2020-09) | 6.65 | 101 | 44.2 | 81% |
| S3 {"targetVolPct":20} (5 bps) | 81.1% | 13.8% | 16.3% | 0.85 | 1.00 | -11.4% (2018-10) | 7.42 | 5 | 2.4 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 80.4% | 13.7% | 16.3% | 0.84 | 0.99 | -11.5% (2018-10) | 7.48 | 5 | 2.4 | 90% |
| buy-and-hold QLD | 609.4% | 53.2% | 51.7% | 1.03 | 1.18 | -21.1% (2020-03) | 12.11 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 219.2% | 28.7% | 28.6% | 1.01 | 1.22 | -8.7% (2018-12) | 5.74 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 1.6% | 1.6% | 12.5% | 0.13 | 0.18 | -9.0% (2018-10) | 5.91 | 2 | 4.0 | 83% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 1.4% | 1.4% | 12.6% | 0.11 | 0.17 | -9.0% (2018-10) | 5.93 | 2 | 4.0 | 83% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 6.3% | 6.3% | 8.3% | 0.76 | 0.57 | -4.8% (2018-02) | 3.79 | 28 | 56.2 | 73% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 4.0% | 4.0% | 8.3% | 0.48 | 0.39 | -5.1% (2018-02) | 4.22 | 28 | 56.2 | 73% |
| S3 {"targetVolPct":20} (5 bps) | 2.5% | 2.5% | 11.7% | 0.21 | 0.24 | -9.0% (2018-10) | 5.70 | 2 | 4.0 | 83% |
| S3 {"targetVolPct":20} (15 bps stress) | 2.3% | 2.3% | 11.8% | 0.20 | 0.23 | -9.0% (2018-10) | 5.72 | 2 | 4.0 | 83% |
| buy-and-hold QLD | -9.2% | -9.3% | 42.5% | -0.22 | 0.01 | -17.8% (2018-12) | 13.20 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -0.6% | -0.6% | 22.8% | -0.03 | 0.09 | -8.7% (2018-12) | 6.55 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 29.7% | 34.5% | 20.5% | 1.69 | 1.15 | -9.5% (2020-02) | 9.50 | 2 | 5.7 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 29.5% | 34.3% | 20.5% | 1.67 | 1.14 | -9.6% (2020-02) | 9.55 | 2 | 5.7 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 12.1% | 13.9% | 21.6% | 0.65 | 0.64 | -11.1% (2020-02) | 12.25 | 19 | 44.5 | 82% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 10.6% | 12.1% | 22.1% | 0.55 | 0.57 | -11.2% (2020-02) | 12.71 | 19 | 44.5 | 82% |
| S3 {"targetVolPct":20} (5 bps) | 3.0% | 3.4% | 15.5% | 0.22 | 0.30 | -9.5% (2020-02) | 8.24 | 2 | 5.7 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 2.9% | 3.3% | 15.6% | 0.21 | 0.29 | -9.6% (2020-02) | 8.28 | 2 | 5.7 | 90% |
| buy-and-hold QLD | 54.2% | 63.9% | 51.7% | 1.24 | 1.04 | -23.9% (2020-02) | 18.92 | 0 | 1.1 | 100% |
| buy-and-hold QQQ | 33.8% | 39.4% | 28.6% | 1.38 | 1.07 | -12.9% (2020-02) | 8.96 | 0 | 1.1 | 100% |

#### cap $30

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 165.8% | 23.7% | 23.0% | 1.03 | 1.11 | -14.7% (2018-10) | 9.81 | 5 | 2.4 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 165.0% | 23.6% | 23.1% | 1.02 | 1.11 | -14.8% (2018-10) | 9.90 | 5 | 2.4 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 90.4% | 15.0% | 22.7% | 0.66 | 0.99 | -9.5% (2020-09) | 7.83 | 101 | 44.2 | 81% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 77.9% | 13.4% | 24.3% | 0.55 | 0.86 | -10.3% (2020-09) | 8.95 | 101 | 44.2 | 81% |
| S3 {"targetVolPct":20} (5 bps) | 105.8% | 17.0% | 19.5% | 0.87 | 0.98 | -14.7% (2018-10) | 9.52 | 5 | 2.4 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 104.9% | 16.9% | 19.6% | 0.86 | 0.98 | -14.8% (2018-10) | 9.60 | 5 | 2.4 | 90% |
| buy-and-hold QLD | 609.4% | 53.2% | 51.7% | 1.03 | 1.18 | -21.1% (2020-03) | 12.11 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 219.2% | 28.7% | 28.6% | 1.01 | 1.22 | -8.7% (2018-12) | 5.74 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 1.5% | 1.5% | 17.9% | 0.08 | 0.18 | -12.7% (2018-10) | 8.48 | 2 | 4.0 | 83% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 1.3% | 1.3% | 18.0% | 0.07 | 0.17 | -12.8% (2018-10) | 8.52 | 2 | 4.0 | 83% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 8.5% | 8.6% | 12.0% | 0.71 | 0.56 | -7.0% (2018-02) | 5.54 | 28 | 56.2 | 73% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 5.1% | 5.2% | 12.1% | 0.43 | 0.37 | -7.4% (2018-02) | 6.18 | 28 | 56.2 | 73% |
| S3 {"targetVolPct":20} (5 bps) | 4.1% | 4.1% | 15.6% | 0.26 | 0.29 | -12.7% (2018-10) | 7.91 | 2 | 4.0 | 83% |
| S3 {"targetVolPct":20} (15 bps stress) | 3.9% | 4.0% | 15.7% | 0.25 | 0.29 | -12.8% (2018-10) | 7.94 | 2 | 4.0 | 83% |
| buy-and-hold QLD | -9.2% | -9.3% | 42.5% | -0.22 | 0.01 | -17.8% (2018-12) | 13.20 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -0.6% | -0.6% | 22.8% | -0.03 | 0.09 | -8.7% (2018-12) | 6.55 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 44.4% | 52.1% | 30.8% | 1.69 | 1.17 | -14.3% (2020-02) | 13.90 | 2 | 5.7 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 44.1% | 51.7% | 30.9% | 1.68 | 1.16 | -14.4% (2020-02) | 13.98 | 2 | 5.7 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 18.1% | 20.9% | 32.4% | 0.64 | 0.68 | -16.6% (2020-02) | 17.78 | 19 | 44.5 | 82% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 15.7% | 18.1% | 33.2% | 0.55 | 0.62 | -16.8% (2020-02) | 18.44 | 19 | 44.5 | 82% |
| S3 {"targetVolPct":20} (5 bps) | -3.8% | -4.3% | 21.2% | -0.20 | -0.13 | -14.3% (2020-02) | 13.37 | 2 | 5.7 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | -3.9% | -4.5% | 21.3% | -0.21 | -0.14 | -14.4% (2020-02) | 13.45 | 2 | 5.7 | 90% |
| buy-and-hold QLD | 54.2% | 63.9% | 51.7% | 1.24 | 1.04 | -23.9% (2020-02) | 18.92 | 0 | 1.1 | 100% |
| buy-and-hold QQQ | 33.8% | 39.4% | 28.6% | 1.38 | 1.07 | -12.9% (2020-02) | 8.96 | 0 | 1.1 | 100% |

### QQQ->QQQ (leverage 1); full evaluation window 2016-12-29 to 2021-08-05

#### cap $20

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 51.9% | 9.5% | 9.4% | 1.01 | 1.23 | -4.8% (2018-10) | 3.07 | 5 | 2.4 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 51.4% | 9.4% | 9.5% | 0.99 | 1.22 | -4.8% (2018-10) | 3.14 | 5 | 2.4 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 30.8% | 6.0% | 9.5% | 0.63 | 1.01 | -3.6% (2020-09) | 2.87 | 101 | 44.2 | 81% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 22.5% | 4.5% | 10.4% | 0.43 | 0.74 | -4.1% (2020-09) | 3.68 | 101 | 44.2 | 81% |
| S3 {"targetVolPct":20} (5 bps) | 51.9% | 9.5% | 9.4% | 1.01 | 1.23 | -4.8% (2018-10) | 3.07 | 5 | 2.4 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 51.4% | 9.4% | 9.5% | 0.99 | 1.22 | -4.8% (2018-10) | 3.14 | 5 | 2.4 | 90% |
| buy-and-hold QQQ | 219.2% | 28.7% | 28.6% | 1.01 | 1.22 | -8.7% (2018-12) | 5.74 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 219.2% | 28.7% | 28.6% | 1.01 | 1.22 | -8.7% (2018-12) | 5.74 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 2.6% | 2.6% | 6.0% | 0.43 | 0.37 | -4.1% (2018-10) | 2.72 | 2 | 4.0 | 83% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 2.4% | 2.4% | 6.0% | 0.40 | 0.35 | -4.2% (2018-10) | 2.75 | 2 | 4.0 | 83% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 3.7% | 3.7% | 4.1% | 0.92 | 0.65 | -2.3% (2018-02) | 1.80 | 28 | 56.2 | 73% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 1.5% | 1.5% | 4.5% | 0.33 | 0.27 | -2.6% (2018-02) | 2.26 | 28 | 56.2 | 73% |
| S3 {"targetVolPct":20} (5 bps) | 2.6% | 2.6% | 6.0% | 0.43 | 0.37 | -4.1% (2018-10) | 2.72 | 2 | 4.0 | 83% |
| S3 {"targetVolPct":20} (15 bps stress) | 2.4% | 2.4% | 6.0% | 0.40 | 0.35 | -4.2% (2018-10) | 2.75 | 2 | 4.0 | 83% |
| buy-and-hold QQQ | -0.6% | -0.6% | 22.8% | -0.03 | 0.09 | -8.7% (2018-12) | 6.55 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -0.6% | -0.6% | 22.8% | -0.03 | 0.09 | -8.7% (2018-12) | 6.55 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 12.1% | 14.0% | 10.4% | 1.34 | 1.06 | -5.1% (2020-02) | 4.42 | 2 | 5.7 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 11.9% | 13.7% | 10.5% | 1.31 | 1.04 | -5.1% (2020-02) | 4.48 | 2 | 5.7 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 4.7% | 5.4% | 10.9% | 0.49 | 0.51 | -5.6% (2020-02) | 5.87 | 19 | 44.5 | 82% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 3.1% | 3.6% | 11.5% | 0.31 | 0.36 | -5.8% (2020-02) | 6.34 | 19 | 44.5 | 82% |
| S3 {"targetVolPct":20} (5 bps) | 7.6% | 8.7% | 10.1% | 0.86 | 0.81 | -5.1% (2020-02) | 4.35 | 2 | 5.7 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 7.4% | 8.5% | 10.2% | 0.84 | 0.79 | -5.1% (2020-02) | 4.42 | 2 | 5.7 | 90% |
| buy-and-hold QQQ | 33.8% | 39.4% | 28.6% | 1.38 | 1.07 | -12.9% (2020-02) | 8.96 | 0 | 1.1 | 100% |
| buy-and-hold QQQ | 33.8% | 39.4% | 28.6% | 1.38 | 1.07 | -12.9% (2020-02) | 8.96 | 0 | 1.1 | 100% |

#### cap $30

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 75.4% | 13.0% | 13.0% | 1.00 | 1.21 | -6.6% (2018-10) | 4.39 | 5 | 2.4 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 74.7% | 12.9% | 13.1% | 0.99 | 1.20 | -6.7% (2018-10) | 4.49 | 5 | 2.4 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 43.7% | 8.2% | 13.4% | 0.61 | 0.98 | -5.1% (2020-03) | 4.14 | 101 | 44.2 | 81% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 31.3% | 6.1% | 14.9% | 0.41 | 0.71 | -5.9% (2020-03) | 5.39 | 101 | 44.2 | 81% |
| S3 {"targetVolPct":20} (5 bps) | 62.8% | 11.2% | 12.4% | 0.90 | 1.15 | -6.6% (2018-10) | 4.38 | 5 | 2.4 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 61.9% | 11.1% | 12.5% | 0.89 | 1.14 | -6.7% (2018-10) | 4.48 | 5 | 2.4 | 90% |
| buy-and-hold QQQ | 219.2% | 28.7% | 28.6% | 1.01 | 1.22 | -8.7% (2018-12) | 5.74 | 0 | 0.2 | 100% |
| buy-and-hold QQQ | 219.2% | 28.7% | 28.6% | 1.01 | 1.22 | -8.7% (2018-12) | 5.74 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 3.0% | 3.0% | 8.8% | 0.34 | 0.32 | -6.1% (2018-10) | 4.03 | 2 | 4.0 | 83% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 2.7% | 2.7% | 8.9% | 0.31 | 0.30 | -6.1% (2018-10) | 4.08 | 2 | 4.0 | 83% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 4.7% | 4.8% | 6.0% | 0.79 | 0.57 | -3.4% (2018-02) | 2.72 | 28 | 56.2 | 73% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 1.3% | 1.3% | 6.7% | 0.20 | 0.19 | -3.8% (2018-02) | 3.43 | 28 | 56.2 | 73% |
| S3 {"targetVolPct":20} (5 bps) | 3.0% | 3.0% | 8.8% | 0.34 | 0.32 | -6.1% (2018-10) | 4.03 | 2 | 4.0 | 83% |
| S3 {"targetVolPct":20} (15 bps stress) | 2.7% | 2.7% | 8.9% | 0.31 | 0.30 | -6.1% (2018-10) | 4.08 | 2 | 4.0 | 83% |
| buy-and-hold QQQ | -0.6% | -0.6% | 22.8% | -0.03 | 0.09 | -8.7% (2018-12) | 6.55 | 0 | 1.0 | 100% |
| buy-and-hold QQQ | -0.6% | -0.6% | 22.8% | -0.03 | 0.09 | -8.7% (2018-12) | 6.55 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 18.1% | 20.9% | 15.7% | 1.33 | 1.06 | -7.7% (2020-02) | 6.63 | 2 | 5.7 | 90% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 17.8% | 20.5% | 15.8% | 1.30 | 1.04 | -7.7% (2020-02) | 6.72 | 2 | 5.7 | 90% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 6.9% | 7.9% | 16.5% | 0.48 | 0.53 | -8.5% (2020-02) | 8.75 | 19 | 44.5 | 82% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 4.6% | 5.2% | 17.3% | 0.30 | 0.38 | -8.7% (2020-02) | 9.45 | 19 | 44.5 | 82% |
| S3 {"targetVolPct":20} (5 bps) | 4.2% | 4.8% | 13.0% | 0.37 | 0.43 | -7.7% (2020-02) | 6.22 | 2 | 5.7 | 90% |
| S3 {"targetVolPct":20} (15 bps stress) | 3.9% | 4.5% | 13.1% | 0.34 | 0.41 | -7.7% (2020-02) | 6.31 | 2 | 5.7 | 90% |
| buy-and-hold QQQ | 33.8% | 39.4% | 28.6% | 1.38 | 1.07 | -12.9% (2020-02) | 8.96 | 0 | 1.1 | 100% |
| buy-and-hold QQQ | 33.8% | 39.4% | 28.6% | 1.38 | 1.07 | -12.9% (2020-02) | 8.96 | 0 | 1.1 | 100% |

### SPY->UPRO (leverage 3); full evaluation window 2016-12-29 to 2021-08-05

#### cap $20

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 92.2% | 15.3% | 23.7% | 0.64 | 0.90 | -13.4% (2018-10) | 10.87 | 4 | 2.0 | 89% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 91.7% | 15.2% | 23.8% | 0.64 | 0.90 | -13.4% (2018-10) | 10.93 | 4 | 2.0 | 89% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 38.9% | 7.4% | 25.0% | 0.30 | 0.64 | -10.9% (2018-02) | 15.12 | 84 | 36.8 | 77% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 32.0% | 6.2% | 28.6% | 0.22 | 0.53 | -11.3% (2018-02) | 17.59 | 84 | 36.8 | 77% |
| S3 {"targetVolPct":20} (5 bps) | 82.7% | 14.0% | 21.2% | 0.66 | 0.89 | -13.4% (2018-10) | 10.44 | 4 | 2.0 | 89% |
| S3 {"targetVolPct":20} (15 bps stress) | 82.2% | 13.9% | 21.3% | 0.65 | 0.89 | -13.4% (2018-10) | 10.49 | 4 | 2.0 | 89% |
| buy-and-hold UPRO | 355.1% | 39.1% | 76.8% | 0.51 | 0.88 | -48.1% (2020-03) | 20.43 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 112.6% | 17.8% | 33.8% | 0.53 | 0.97 | -12.6% (2020-03) | 5.79 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -7.8% | -7.8% | 16.6% | -0.47 | -0.40 | -10.3% (2018-10) | 8.67 | 2 | 4.0 | 85% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -7.9% | -8.0% | 16.7% | -0.48 | -0.41 | -10.3% (2018-10) | 8.69 | 2 | 4.0 | 85% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -18.5% | -18.6% | 25.2% | -0.74 | -1.27 | -10.1% (2018-02) | 17.00 | 37 | 74.3 | 69% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -21.5% | -21.6% | 27.9% | -0.77 | -1.48 | -10.6% (2018-02) | 18.83 | 37 | 74.3 | 69% |
| S3 {"targetVolPct":20} (5 bps) | -6.0% | -6.0% | 15.0% | -0.40 | -0.29 | -10.3% (2018-10) | 8.31 | 2 | 4.0 | 85% |
| S3 {"targetVolPct":20} (15 bps stress) | -6.1% | -6.2% | 15.0% | -0.41 | -0.30 | -10.3% (2018-10) | 8.32 | 2 | 4.0 | 85% |
| buy-and-hold UPRO | -25.8% | -25.9% | 50.3% | -0.51 | -0.33 | -26.2% (2018-12) | 18.22 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -5.3% | -5.3% | 19.3% | -0.28 | -0.24 | -8.8% (2018-12) | 5.79 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 8.4% | 9.6% | 26.2% | 0.37 | 0.45 | -13.3% (2020-02) | 16.05 | 2 | 5.7 | 75% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 8.2% | 9.4% | 26.2% | 0.36 | 0.45 | -13.3% (2020-02) | 16.12 | 2 | 5.7 | 75% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -1.3% | -1.5% | 17.6% | -0.09 | 0.00 | -9.0% (2020-09) | 12.04 | 14 | 33.1 | 55% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -2.5% | -2.8% | 18.2% | -0.16 | -0.07 | -9.3% (2020-09) | 12.38 | 14 | 33.1 | 55% |
| S3 {"targetVolPct":20} (5 bps) | -0.2% | -0.2% | 19.5% | -0.01 | 0.08 | -13.3% (2020-02) | 13.39 | 2 | 5.7 | 75% |
| S3 {"targetVolPct":20} (15 bps stress) | -0.3% | -0.3% | 19.5% | -0.02 | 0.07 | -13.3% (2020-02) | 13.45 | 2 | 5.7 | 75% |
| buy-and-hold UPRO | -3.4% | -3.8% | 76.8% | -0.05 | 0.49 | -48.1% (2020-03) | 39.27 | 0 | 1.1 | 100% |
| buy-and-hold SPY | 12.8% | 14.7% | 33.8% | 0.44 | 0.57 | -12.6% (2020-03) | 10.82 | 0 | 1.1 | 100% |

#### cap $30

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 135.9% | 20.5% | 31.0% | 0.66 | 0.91 | -17.6% (2018-10) | 14.33 | 4 | 2.0 | 89% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 135.2% | 20.5% | 31.1% | 0.66 | 0.90 | -17.6% (2018-10) | 14.42 | 4 | 2.0 | 89% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 56.0% | 10.2% | 34.3% | 0.30 | 0.64 | -14.7% (2018-02) | 20.81 | 84 | 36.8 | 77% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 45.5% | 8.5% | 39.3% | 0.22 | 0.53 | -15.3% (2018-02) | 24.20 | 84 | 36.8 | 77% |
| S3 {"targetVolPct":20} (5 bps) | 102.7% | 16.6% | 25.2% | 0.66 | 0.87 | -17.6% (2018-10) | 13.17 | 4 | 2.0 | 89% |
| S3 {"targetVolPct":20} (15 bps stress) | 102.0% | 16.5% | 25.3% | 0.65 | 0.86 | -17.6% (2018-10) | 13.24 | 4 | 2.0 | 89% |
| buy-and-hold UPRO | 355.1% | 39.1% | 76.8% | 0.51 | 0.88 | -48.1% (2020-03) | 20.43 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 112.6% | 17.8% | 33.8% | 0.53 | 0.97 | -12.6% (2020-03) | 5.79 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -12.5% | -12.6% | 24.0% | -0.52 | -0.41 | -15.0% (2018-10) | 12.61 | 2 | 4.0 | 85% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -12.8% | -12.8% | 24.2% | -0.53 | -0.42 | -15.0% (2018-10) | 12.64 | 2 | 4.0 | 85% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -28.7% | -28.8% | 37.0% | -0.78 | -1.29 | -14.8% (2018-02) | 24.84 | 37 | 74.3 | 69% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -33.1% | -33.2% | 40.9% | -0.81 | -1.50 | -15.4% (2018-02) | 27.49 | 37 | 74.3 | 69% |
| S3 {"targetVolPct":20} (5 bps) | -7.6% | -7.6% | 19.7% | -0.39 | -0.20 | -15.0% (2018-10) | 11.68 | 2 | 4.0 | 85% |
| S3 {"targetVolPct":20} (15 bps stress) | -7.7% | -7.7% | 19.8% | -0.39 | -0.20 | -15.0% (2018-10) | 11.70 | 2 | 4.0 | 85% |
| buy-and-hold UPRO | -25.8% | -25.9% | 50.3% | -0.51 | -0.33 | -26.2% (2018-12) | 18.22 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -5.3% | -5.3% | 19.3% | -0.28 | -0.24 | -8.8% (2018-12) | 5.79 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 12.5% | 14.4% | 39.3% | 0.37 | 0.53 | -19.9% (2020-02) | 24.13 | 2 | 5.7 | 75% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 12.2% | 14.0% | 39.4% | 0.36 | 0.52 | -20.0% (2020-02) | 24.25 | 2 | 5.7 | 75% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -2.1% | -2.4% | 25.9% | -0.09 | 0.05 | -13.6% (2020-09) | 18.01 | 14 | 33.1 | 55% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -3.8% | -4.4% | 27.0% | -0.16 | -0.02 | -14.1% (2020-09) | 18.53 | 14 | 33.1 | 55% |
| S3 {"targetVolPct":20} (5 bps) | -3.9% | -4.4% | 22.6% | -0.20 | -0.14 | -16.6% (2020-02) | 16.40 | 2 | 5.7 | 75% |
| S3 {"targetVolPct":20} (15 bps stress) | -4.1% | -4.6% | 22.6% | -0.20 | -0.15 | -16.7% (2020-02) | 16.47 | 2 | 5.7 | 75% |
| buy-and-hold UPRO | -3.4% | -3.8% | 76.8% | -0.05 | 0.49 | -48.1% (2020-03) | 39.27 | 0 | 1.1 | 100% |
| buy-and-hold SPY | 12.8% | 14.7% | 33.8% | 0.44 | 0.57 | -12.6% (2020-03) | 10.82 | 0 | 1.1 | 100% |

### SPY->SSO (leverage 2); full evaluation window 2016-12-29 to 2021-08-05

#### cap $20

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 57.5% | 10.4% | 16.5% | 0.63 | 0.93 | -8.3% (2018-10) | 6.82 | 4 | 2.0 | 89% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 57.0% | 10.3% | 16.6% | 0.62 | 0.93 | -8.3% (2018-10) | 6.89 | 4 | 2.0 | 89% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 26.5% | 5.2% | 16.9% | 0.31 | 0.66 | -7.1% (2018-02) | 10.06 | 84 | 36.8 | 77% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 19.5% | 4.0% | 20.9% | 0.19 | 0.49 | -7.6% (2018-02) | 12.76 | 84 | 36.8 | 77% |
| S3 {"targetVolPct":20} (5 bps) | 57.5% | 10.4% | 16.5% | 0.63 | 0.93 | -8.3% (2018-10) | 6.82 | 4 | 2.0 | 89% |
| S3 {"targetVolPct":20} (15 bps stress) | 57.0% | 10.3% | 16.6% | 0.62 | 0.93 | -8.3% (2018-10) | 6.89 | 4 | 2.0 | 89% |
| buy-and-hold SSO | 237.1% | 30.3% | 59.2% | 0.51 | 0.88 | -29.8% (2020-03) | 12.56 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 112.6% | 17.8% | 33.8% | 0.53 | 0.97 | -12.6% (2020-03) | 5.79 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -4.1% | -4.1% | 11.1% | -0.37 | -0.32 | -6.8% (2018-10) | 5.55 | 2 | 4.0 | 85% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -4.2% | -4.2% | 11.2% | -0.38 | -0.33 | -6.9% (2018-10) | 5.58 | 2 | 4.0 | 85% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -12.2% | -12.2% | 17.0% | -0.72 | -1.29 | -6.8% (2018-02) | 11.48 | 37 | 74.3 | 69% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -15.1% | -15.2% | 19.8% | -0.77 | -1.61 | -7.3% (2018-02) | 13.38 | 37 | 74.3 | 69% |
| S3 {"targetVolPct":20} (5 bps) | -4.1% | -4.1% | 11.1% | -0.37 | -0.32 | -6.8% (2018-10) | 5.55 | 2 | 4.0 | 85% |
| S3 {"targetVolPct":20} (15 bps stress) | -4.2% | -4.2% | 11.2% | -0.38 | -0.33 | -6.9% (2018-10) | 5.58 | 2 | 4.0 | 85% |
| buy-and-hold SSO | -15.3% | -15.3% | 36.6% | -0.42 | -0.32 | -17.7% (2018-12) | 12.05 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -5.3% | -5.3% | 19.3% | -0.28 | -0.24 | -8.8% (2018-12) | 5.79 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 4.5% | 5.2% | 17.9% | 0.29 | 0.36 | -9.2% (2020-02) | 10.76 | 2 | 5.7 | 75% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 4.4% | 5.0% | 18.0% | 0.28 | 0.35 | -9.3% (2020-02) | 10.86 | 2 | 5.7 | 75% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -0.9% | -1.0% | 11.1% | -0.09 | -0.03 | -5.5% (2020-02) | 7.83 | 14 | 33.1 | 55% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -2.1% | -2.3% | 11.7% | -0.20 | -0.15 | -5.8% (2020-09) | 8.17 | 14 | 33.1 | 55% |
| S3 {"targetVolPct":20} (5 bps) | 3.7% | 4.3% | 15.9% | 0.27 | 0.33 | -9.2% (2020-02) | 9.78 | 2 | 5.7 | 75% |
| S3 {"targetVolPct":20} (15 bps stress) | 3.6% | 4.1% | 15.9% | 0.26 | 0.32 | -9.3% (2020-02) | 9.87 | 2 | 5.7 | 75% |
| buy-and-hold SSO | 11.1% | 12.8% | 59.2% | 0.22 | 0.53 | -29.8% (2020-03) | 23.59 | 0 | 1.1 | 100% |
| buy-and-hold SPY | 12.8% | 14.7% | 33.8% | 0.44 | 0.57 | -12.6% (2020-03) | 10.82 | 0 | 1.1 | 100% |

#### cap $30

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 83.8% | 14.2% | 22.4% | 0.63 | 0.92 | -11.3% (2018-10) | 9.42 | 4 | 2.0 | 89% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 83.1% | 14.1% | 22.5% | 0.63 | 0.92 | -11.4% (2018-10) | 9.51 | 4 | 2.0 | 89% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 37.3% | 7.1% | 24.5% | 0.29 | 0.63 | -9.9% (2018-02) | 14.66 | 84 | 36.8 | 77% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 26.9% | 5.3% | 30.1% | 0.18 | 0.47 | -10.6% (2018-02) | 18.51 | 84 | 36.8 | 77% |
| S3 {"targetVolPct":20} (5 bps) | 76.5% | 13.2% | 19.9% | 0.66 | 0.93 | -11.3% (2018-10) | 8.98 | 4 | 2.0 | 89% |
| S3 {"targetVolPct":20} (15 bps stress) | 75.7% | 13.1% | 20.0% | 0.65 | 0.92 | -11.4% (2018-10) | 9.07 | 4 | 2.0 | 89% |
| buy-and-hold SSO | 237.1% | 30.3% | 59.2% | 0.51 | 0.88 | -29.8% (2020-03) | 12.56 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 112.6% | 17.8% | 33.8% | 0.53 | 0.97 | -12.6% (2020-03) | 5.79 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -7.0% | -7.0% | 16.3% | -0.43 | -0.35 | -10.0% (2018-10) | 8.22 | 2 | 4.0 | 85% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -7.2% | -7.2% | 16.5% | -0.44 | -0.37 | -10.1% (2018-10) | 8.26 | 2 | 4.0 | 85% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -19.1% | -19.2% | 25.6% | -0.75 | -1.34 | -10.0% (2018-02) | 17.12 | 37 | 74.3 | 69% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -23.6% | -23.7% | 29.6% | -0.80 | -1.66 | -10.7% (2018-02) | 19.89 | 37 | 74.3 | 69% |
| S3 {"targetVolPct":20} (5 bps) | -5.2% | -5.2% | 14.7% | -0.35 | -0.24 | -10.0% (2018-10) | 7.85 | 2 | 4.0 | 85% |
| S3 {"targetVolPct":20} (15 bps stress) | -5.4% | -5.4% | 14.9% | -0.36 | -0.26 | -10.1% (2018-10) | 7.88 | 2 | 4.0 | 85% |
| buy-and-hold SSO | -15.3% | -15.3% | 36.6% | -0.42 | -0.32 | -17.7% (2018-12) | 12.05 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -5.3% | -5.3% | 19.3% | -0.28 | -0.24 | -8.8% (2018-12) | 5.79 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 6.7% | 7.7% | 27.0% | 0.29 | 0.40 | -13.9% (2020-02) | 16.22 | 2 | 5.7 | 75% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 6.4% | 7.4% | 27.1% | 0.27 | 0.39 | -13.9% (2020-02) | 16.37 | 2 | 5.7 | 75% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -1.5% | -1.7% | 16.5% | -0.10 | -0.01 | -8.3% (2020-02) | 11.78 | 14 | 33.1 | 55% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -3.2% | -3.6% | 17.5% | -0.21 | -0.12 | -8.7% (2020-09) | 12.29 | 14 | 33.1 | 55% |
| S3 {"targetVolPct":20} (5 bps) | -1.4% | -1.6% | 20.1% | -0.08 | -0.00 | -13.9% (2020-02) | 13.73 | 2 | 5.7 | 75% |
| S3 {"targetVolPct":20} (15 bps stress) | -1.6% | -1.9% | 20.2% | -0.09 | -0.02 | -13.9% (2020-02) | 13.83 | 2 | 5.7 | 75% |
| buy-and-hold SSO | 11.1% | 12.8% | 59.2% | 0.22 | 0.53 | -29.8% (2020-03) | 23.59 | 0 | 1.1 | 100% |
| buy-and-hold SPY | 12.8% | 14.7% | 33.8% | 0.44 | 0.57 | -12.6% (2020-03) | 10.82 | 0 | 1.1 | 100% |

### SPY->SPY (leverage 1); full evaluation window 2016-12-29 to 2021-08-05

#### cap $20

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 29.7% | 5.8% | 8.4% | 0.69 | 1.08 | -3.6% (2018-10) | 3.05 | 4 | 2.0 | 89% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 29.3% | 5.8% | 8.5% | 0.68 | 1.07 | -3.7% (2018-10) | 3.12 | 4 | 2.0 | 89% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 15.1% | 3.1% | 8.1% | 0.38 | 0.77 | -3.5% (2018-02) | 4.63 | 84 | 36.8 | 77% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 8.2% | 1.7% | 12.2% | 0.14 | 0.42 | -4.0% (2018-02) | 7.53 | 84 | 36.8 | 77% |
| S3 {"targetVolPct":20} (5 bps) | 29.7% | 5.8% | 8.4% | 0.69 | 1.08 | -3.6% (2018-10) | 3.05 | 4 | 2.0 | 89% |
| S3 {"targetVolPct":20} (15 bps stress) | 29.3% | 5.8% | 8.5% | 0.68 | 1.07 | -3.7% (2018-10) | 3.12 | 4 | 2.0 | 89% |
| buy-and-hold SPY | 112.6% | 17.8% | 33.8% | 0.53 | 0.97 | -12.6% (2020-03) | 5.79 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 112.6% | 17.8% | 33.8% | 0.53 | 0.97 | -12.6% (2020-03) | 5.79 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -0.7% | -0.7% | 5.4% | -0.14 | -0.10 | -3.2% (2018-10) | 2.56 | 2 | 4.0 | 85% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -0.9% | -0.9% | 5.5% | -0.16 | -0.13 | -3.3% (2018-10) | 2.59 | 2 | 4.0 | 85% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -5.7% | -5.7% | 8.4% | -0.68 | -1.22 | -3.4% (2018-02) | 5.80 | 37 | 74.3 | 69% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -8.6% | -8.7% | 11.3% | -0.77 | -1.87 | -3.9% (2018-02) | 7.76 | 37 | 74.3 | 69% |
| S3 {"targetVolPct":20} (5 bps) | -0.7% | -0.7% | 5.4% | -0.14 | -0.10 | -3.2% (2018-10) | 2.56 | 2 | 4.0 | 85% |
| S3 {"targetVolPct":20} (15 bps stress) | -0.9% | -0.9% | 5.5% | -0.16 | -0.13 | -3.3% (2018-10) | 2.59 | 2 | 4.0 | 85% |
| buy-and-hold SPY | -5.3% | -5.3% | 19.3% | -0.28 | -0.24 | -8.8% (2018-12) | 5.79 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -5.3% | -5.3% | 19.3% | -0.28 | -0.24 | -8.8% (2018-12) | 5.79 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 1.9% | 2.2% | 8.9% | 0.24 | 0.29 | -4.9% (2020-02) | 5.37 | 2 | 5.7 | 75% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 1.7% | 2.0% | 9.0% | 0.22 | 0.27 | -4.9% (2020-02) | 5.48 | 2 | 5.7 | 75% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -0.5% | -0.5% | 5.3% | -0.10 | -0.08 | -2.8% (2020-02) | 3.81 | 14 | 33.1 | 55% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -1.6% | -1.9% | 6.0% | -0.31 | -0.32 | -2.9% (2020-02) | 4.15 | 14 | 33.1 | 55% |
| S3 {"targetVolPct":20} (5 bps) | 1.9% | 2.2% | 8.9% | 0.24 | 0.29 | -4.9% (2020-02) | 5.37 | 2 | 5.7 | 75% |
| S3 {"targetVolPct":20} (15 bps stress) | 1.7% | 2.0% | 9.0% | 0.22 | 0.27 | -4.9% (2020-02) | 5.48 | 2 | 5.7 | 75% |
| buy-and-hold SPY | 12.8% | 14.7% | 33.8% | 0.44 | 0.57 | -12.6% (2020-03) | 10.82 | 0 | 1.1 | 100% |
| buy-and-hold SPY | 12.8% | 14.7% | 33.8% | 0.44 | 0.57 | -12.6% (2020-03) | 10.82 | 0 | 1.1 | 100% |

#### cap $30

##### full evaluation window (2016-12-29 to 2021-08-05)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 42.2% | 8.0% | 11.9% | 0.67 | 1.03 | -5.2% (2018-10) | 4.48 | 4 | 2.0 | 89% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 41.6% | 7.9% | 12.1% | 0.65 | 1.02 | -5.3% (2018-10) | 4.58 | 4 | 2.0 | 89% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | 20.3% | 4.1% | 12.7% | 0.32 | 0.70 | -5.1% (2018-02) | 7.49 | 84 | 36.8 | 77% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | 9.9% | 2.1% | 19.0% | 0.11 | 0.35 | -5.8% (2018-02) | 11.87 | 84 | 36.8 | 77% |
| S3 {"targetVolPct":20} (5 bps) | 42.2% | 8.0% | 11.9% | 0.67 | 1.03 | -5.2% (2018-10) | 4.48 | 4 | 2.0 | 89% |
| S3 {"targetVolPct":20} (15 bps stress) | 41.6% | 7.9% | 12.1% | 0.65 | 1.02 | -5.3% (2018-10) | 4.58 | 4 | 2.0 | 89% |
| buy-and-hold SPY | 112.6% | 17.8% | 33.8% | 0.53 | 0.97 | -12.6% (2020-03) | 5.79 | 0 | 0.2 | 100% |
| buy-and-hold SPY | 112.6% | 17.8% | 33.8% | 0.53 | 0.97 | -12.6% (2020-03) | 5.79 | 0 | 0.2 | 100% |

##### calendar 2018 (2018-01-01 to 2018-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | -2.0% | -2.0% | 8.1% | -0.24 | -0.20 | -4.9% (2018-10) | 3.89 | 2 | 4.0 | 85% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | -2.2% | -2.2% | 8.3% | -0.27 | -0.23 | -4.9% (2018-10) | 3.93 | 2 | 4.0 | 85% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -9.4% | -9.4% | 13.2% | -0.71 | -1.35 | -5.2% (2018-02) | 8.93 | 37 | 74.3 | 69% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -13.8% | -13.9% | 17.4% | -0.80 | -2.00 | -5.8% (2018-02) | 11.84 | 37 | 74.3 | 69% |
| S3 {"targetVolPct":20} (5 bps) | -2.0% | -2.0% | 8.1% | -0.24 | -0.20 | -4.9% (2018-10) | 3.89 | 2 | 4.0 | 85% |
| S3 {"targetVolPct":20} (15 bps stress) | -2.2% | -2.2% | 8.3% | -0.27 | -0.23 | -4.9% (2018-10) | 3.93 | 2 | 4.0 | 85% |
| buy-and-hold SPY | -5.3% | -5.3% | 19.3% | -0.28 | -0.24 | -8.8% (2018-12) | 5.79 | 0 | 1.0 | 100% |
| buy-and-hold SPY | -5.3% | -5.3% | 19.3% | -0.28 | -0.24 | -8.8% (2018-12) | 5.79 | 0 | 1.0 | 100% |

##### 2020 crash and recovery (2020-02-19 to 2020-12-31)

| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 {"n":200,"bandPct":2} (5 bps) | 2.8% | 3.1% | 13.5% | 0.23 | 0.30 | -7.4% (2020-02) | 8.15 | 2 | 5.7 | 75% |
| S1 {"n":200,"bandPct":2} (15 bps stress) | 2.5% | 2.8% | 13.6% | 0.21 | 0.28 | -7.4% (2020-02) | 8.31 | 2 | 5.7 | 75% |
| S2 {"slow":200,"trailingDDPct":10} (5 bps) | -0.8% | -0.9% | 8.0% | -0.12 | -0.08 | -4.2% (2020-02) | 5.78 | 14 | 33.1 | 55% |
| S2 {"slow":200,"trailingDDPct":10} (15 bps stress) | -2.5% | -2.9% | 9.0% | -0.32 | -0.32 | -4.4% (2020-02) | 6.29 | 14 | 33.1 | 55% |
| S3 {"targetVolPct":20} (5 bps) | 2.8% | 3.1% | 13.5% | 0.23 | 0.30 | -7.4% (2020-02) | 8.15 | 2 | 5.7 | 75% |
| S3 {"targetVolPct":20} (15 bps stress) | 2.5% | 2.8% | 13.6% | 0.21 | 0.28 | -7.4% (2020-02) | 8.31 | 2 | 5.7 | 75% |
| buy-and-hold SPY | 12.8% | 14.7% | 33.8% | 0.44 | 0.57 | -12.6% (2020-03) | 10.82 | 0 | 1.1 | 100% |
| buy-and-hold SPY | 12.8% | 14.7% | 33.8% | 0.44 | 0.57 | -12.6% (2020-03) | 10.82 | 0 | 1.1 | 100% |

## Deflated Sharpe (N=36, full evaluation window, 5 bps, fractional)

| pair | cap | config | round trips | daily SR | SR0 | SR0 (annualised) | DSR |
|---|---|---|---|---|---|---|---|
| QQQ->TQQQ | $20 | S1 | 5 | 0.0658 | 0.0631 | 1.00 | 0.535 |
| QQQ->TQQQ | $20 | S2 | 101 | 0.0617 | 0.0631 | 1.00 | 0.482 |
| QQQ->TQQQ | $20 | S3 | 5 | 0.0571 | 0.0631 | 1.00 | 0.422 |
| QQQ->TQQQ | $30 | S1 | 5 | 0.0683 | 0.0631 | 1.00 | 0.567 |
| QQQ->TQQQ | $30 | S2 | 101 | 0.0639 | 0.0631 | 1.00 | 0.511 |
| QQQ->TQQQ | $30 | S3 | 5 | 0.0576 | 0.0631 | 1.00 | 0.428 |
| QQQ->QLD | $20 | S1 | 5 | 0.0690 | 0.0631 | 1.00 | 0.576 |
| QQQ->QLD | $20 | S2 | 101 | 0.0616 | 0.0631 | 1.00 | 0.480 |
| QQQ->QLD | $20 | S3 | 5 | 0.0630 | 0.0631 | 1.00 | 0.498 |
| QQQ->QLD | $30 | S1 | 5 | 0.0702 | 0.0631 | 1.00 | 0.592 |
| QQQ->QLD | $30 | S2 | 101 | 0.0624 | 0.0631 | 1.00 | 0.491 |
| QQQ->QLD | $30 | S3 | 5 | 0.0619 | 0.0631 | 1.00 | 0.484 |
| QQQ->QQQ | $20 | S1 | 5 | 0.0774 | 0.0631 | 1.00 | 0.679 |
| QQQ->QQQ | $20 | S2 | 101 | 0.0634 | 0.0631 | 1.00 | 0.504 |
| QQQ->QQQ | $20 | S3 | 5 | 0.0774 | 0.0631 | 1.00 | 0.679 |
| QQQ->QQQ | $30 | S1 | 5 | 0.0762 | 0.0631 | 1.00 | 0.665 |
| QQQ->QQQ | $30 | S2 | 101 | 0.0615 | 0.0631 | 1.00 | 0.479 |
| QQQ->QQQ | $30 | S3 | 5 | 0.0725 | 0.0631 | 1.00 | 0.620 |
| SPY->UPRO | $20 | S1 | 4 | 0.0566 | 0.0631 | 1.00 | 0.416 |
| SPY->UPRO | $20 | S2 | 84 | 0.0402 | 0.0631 | 1.00 | 0.225 |
| SPY->UPRO | $20 | S3 | 4 | 0.0561 | 0.0631 | 1.00 | 0.410 |
| SPY->UPRO | $30 | S1 | 4 | 0.0572 | 0.0631 | 1.00 | 0.423 |
| SPY->UPRO | $30 | S2 | 84 | 0.0401 | 0.0631 | 1.00 | 0.223 |
| SPY->UPRO | $30 | S3 | 4 | 0.0546 | 0.0631 | 1.00 | 0.390 |
| SPY->SSO | $20 | S1 | 4 | 0.0587 | 0.0631 | 1.00 | 0.442 |
| SPY->SSO | $20 | S2 | 84 | 0.0413 | 0.0631 | 1.00 | 0.236 |
| SPY->SSO | $20 | S3 | 4 | 0.0587 | 0.0631 | 1.00 | 0.442 |
| SPY->SSO | $30 | S1 | 4 | 0.0581 | 0.0631 | 1.00 | 0.434 |
| SPY->SSO | $30 | S2 | 84 | 0.0398 | 0.0631 | 1.00 | 0.220 |
| SPY->SSO | $30 | S3 | 4 | 0.0584 | 0.0631 | 1.00 | 0.438 |
| SPY->SPY | $20 | S1 | 4 | 0.0681 | 0.0631 | 1.00 | 0.564 |
| SPY->SPY | $20 | S2 | 84 | 0.0485 | 0.0631 | 1.00 | 0.315 |
| SPY->SPY | $20 | S3 | 4 | 0.0681 | 0.0631 | 1.00 | 0.564 |
| SPY->SPY | $30 | S1 | 4 | 0.0650 | 0.0631 | 1.00 | 0.523 |
| SPY->SPY | $30 | S2 | 84 | 0.0438 | 0.0631 | 1.00 | 0.262 |
| SPY->SPY | $30 | S3 | 4 | 0.0650 | 0.0631 | 1.00 | 0.523 |

Round-trip counts this small are too few for confidence intervals to mean anything, so none are computed.

## Not verified

- Alpaca free SIP-tier history depth beyond the cycle-4 spot check
- fractionability of traded ETFs (confirmed live 2026-09-29 for the descriptive prereg's symbol set, not re-verified here)
- cash-account good-faith/settlement handling beyond the same-day rule
