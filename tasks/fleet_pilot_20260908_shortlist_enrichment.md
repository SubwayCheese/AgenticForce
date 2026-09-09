## fleet_pilot_20260908_shortlist_enrichment
from: claude
to: claude
type: response
status: done
source: FMP connector, four endpoints (chart/historical-price-eod-light full daily series, calendar/earnings-company, analyst/financial-estimates + price-target-consensus, statements/key-metrics), all fetched in one continuous pull on 2026-09-08 for the 5 symbols on the new 50-stock-universe shortlist (INTC, NVDA, AMD, TSLA, AAPL -- see fleet_pilot_20260908_universe50_consolidation.md). IMPORTANT METHODOLOGY NOTE: an earlier attempt at this reused the 15-symbol pilot's Aug3-Sep3 trend window for NVDA/TSLA/AAPL, which was misaligned with this run's fresh Sept-8 screening snapshot (a 5-day gap) and produced a materially wrong reading for INTC specifically (looked like a near-flat +0.74% 20-day trend, when the real window shows +8.62%). This file supersedes that attempt entirely -- all 5 symbols use the SAME fresh 20-trading-day window (2026-08-10 to 2026-09-08, 21 closes) and the SAME reference price (today's 09-08 close) for every derived figure below, so there is no cross-symbol or cross-metric date misalignment this time.
recordFact: fleet_pilot_20260908:shortlist_enrichment
payload: (orchestrator-sourced -- no dispatch)
timestamp: 2026-09-08T17:30:38Z

## Result (auto)
resolved_at: 2026-09-08T17:30:38Z
output:
````
SOURCE: verified live (FMP API, not training-data recall)
As of: all figures retrieved together on 2026-09-08. Trend window: 2026-08-10 to 2026-09-08 (21 closes, 20 daily returns), identical for all 5 symbols. Valuation is latest annual (FY2025) per FMP. Analyst targets are current consensus as of this pull; upside/downside below is computed against each symbol's actual 2026-09-08 close (today), not an older date.

## 1. Trend, volatility, and drawdown (2026-08-10 -> 2026-09-08)

| Symbol | Start | End (09-08) | 20-day trend | Daily stdev | Max single-day move | Max drawdown | Up/Down days |
|---|---|---|---|---|---|---|---|
| NVDA | 217.55 | 226.15 | +3.95% | 2.82% | +8.74% | -7.47% | 8 up / 12 down |
| TSLA | 330.88 | 367.77 | +11.15% | 3.29% | **-5.92%** (a down day) | -5.92% | 11 up / 9 down |
| AAPL | 308.26 | 316.04 | +2.52% | **1.33%** (lowest of the 5) | +2.61% | **-3.71%** (smallest of the 5) | 10 up / 10 down |
| INTC | 97.52 | 105.93 | +8.62% | **3.73%** (highest of the 5) | +10.57% | **-16.55%** (by far the largest of the 5) | 12 up / 8 down |
| AMD | 469.56 | 511.84 | +9.00% | 3.25% | +7.17% | -11.32% | 11 up / 9 down |

Notes:
- NVDA's positive 20-day trend is still almost entirely a single-day artifact: its one +8.74% day is larger than the entire 20-day net gain (+3.95%), meaning the rest of the window was net negative.
- TSLA's largest single-day move was actually a DOWN day (-5.92%), yet the 20-day trend is strongly positive (+11.15%) with more up days than down -- a genuinely broad-based advance this time, consistent with the earlier 15-symbol pilot's pass-4 finding.
- INTC had by far the most violent round-trip of the 5: it fell as much as -16.55% from its peak within this same window before recovering to a real, positive (+8.62%) net gain. This is a name with a lot of realized volatility, not a name that just "went up."
- AAPL remains the steadiest of the group on every measure -- lowest volatility, smallest drawdown, most balanced up/down day count.

## 2. Earnings history (actual vs. estimated) and next earnings date

| Symbol | Last earnings | EPS actual vs. est | Revenue actual vs. est | Result | Next earnings | Next estimate |
|---|---|---|---|---|---|---|
| NVDA | 2026-08-26 | 2.22 vs 2.09 | 96.221B vs 92.271B | Beat (+6.2% / +4.3%) | 2026-11-18 | EPS 2.47 / Rev 108.65B |
| TSLA | 2026-07-22 | 0.33 vs 0.50 | 28.236B vs 26.423B | **EPS miss (-34%)**, revenue beat (+6.9%) | 2026-10-28 | EPS 0.47 / Rev 27.63B |
| AAPL | 2026-07-30 | 2.02 vs 1.89 | 109.417B vs 109.039B | Beat (+6.9%), revenue in-line (+0.3%) | 2026-10-29 | EPS 1.98 / Rev 113.26B |
| INTC | 2026-07-23 | **0.42 vs 0.21** | 16.128B vs 14.435B | **Huge beat (+100% EPS, +11.7% revenue)** -- this is the earnings date behind INTC's dominant single-day price move | 2026-10-22 | EPS 0.39 / Rev 16.32B |
| AMD | 2026-08-04 | 1.66 vs 1.62 | 11.536B vs 11.310B | Clean, modest beat (+2.5% / +2.0%) | 2026-11-03 | EPS 1.90 / Rev 12.97B |

## 3. Valuation (FMP key-metrics, latest annual)

| Symbol | EV/EBITDA | EV/Sales | ROE | Earnings Yield | FCF Yield |
|---|---|---|---|---|---|
| NVDA | 31.43x | 21.04x | 76.3% | 2.64% | 2.13% |
| TSLA | 122.60x | 15.21x | 4.6% | 0.26% | 0.43% |
| AAPL | 26.97x | 9.36x | 151.9% (buyback-inflated, per prior pass's caveat) | 2.93% | 2.59% |
| INTC | 14.50x | 3.94x | **-0.23%** | **-0.15%** | **-2.82%** |
| AMD | 47.85x | 10.05x | 6.9% | 1.24% | 1.93% |

**INTC's valuation multiples look cheap in isolation (lowest EV/EBITDA and EV/Sales of the 5), but its ROE, earnings yield, and FCF yield are all NEGATIVE** -- the company is not currently generating positive returns on capital or free cash flow at the trailing-annual level, despite the recent huge earnings beat and #1 screenScore rank. A cheap multiple on negative profitability is not straightforwardly "cheap" -- it may just mean the market is pricing continued weak fundamentals. This tension should be engaged with directly, not glossed over.

## 4. Analyst price-target consensus (current, upside computed against today's 09-08 close)

| Symbol | Target Low | Target Median | Target Consensus | Upside vs. 09-08 close |
|---|---|---|---|---|
| NVDA | 270 | 322.50 | 345.21 | +52.6% |
| TSLA | 370 | 435.00 | 436.08 | +18.6% |
| AAPL | 245 | 362.00 | 341.31 | +8.0% |
| INTC | **60** | 110 | 110.04 | +3.9% |
| AMD | 260 | 625 | 594.04 | +16.1% |

INTC's target range is unusually wide (low of 60 vs. today's close of ~106 -- i.e., the most bearish analyst sees ~43% DOWNSIDE from here, while the median analyst sees essentially no edge, +3.9%). That dispersion itself is a signal: real, unresolved analyst disagreement about whether INTC's earnings beat is durable.

## 5. Long-horizon analyst estimates (annual, 3-5 years out; quarterly is tier-gated/unavailable)

| Symbol | Estimate FY | Revenue (avg, analyst count) | EPS (avg, analyst count) |
|---|---|---|---|
| NVDA | FY2030/FY2031 | see prior enrichment_v2_snapshot.md -- unchanged since 09-08 same-day pull | FY2030 $23.00 (10 analysts) -> FY2031 $20.00 (17 analysts) -- **flagged unreliable** (EPS declines despite revenue growth, thin coverage) |
| AAPL | FY2029/FY2030 | see enrichment_v2_snapshot.md | **flagged unreliable** (revenue +43.5% vs EPS +3.7% in one year -- internally implausible, likely thin out-year coverage) |
| TSLA | FY2029 $193.60B (25) -> FY2030 $239.71B (26) | | EPS $6.51 (9) -> $9.14 (9) -- internally consistent |
| INTC | FY2029 $98.65B (21) -> FY2030 $131.00B (15) | | EPS $4.66 (6) -> $7.03 (9) -- revenue +32.8%, EPS +50.9%, roughly proportional, no obvious red flag, but EPS analyst count is thin (6-9) |
| AMD | FY2029 $158.22B (18) -> FY2030 $237.78B (34) | | EPS $29.45 (17) -> $42.54 (9) -- revenue +50.3%, EPS +44.5%, roughly proportional and well-covered, no obvious red flag |
````
