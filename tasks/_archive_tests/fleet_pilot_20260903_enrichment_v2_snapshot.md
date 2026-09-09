## fleet_pilot_20260903_enrichment_v2_snapshot
from: claude
to: claude
type: response
status: done
source: FMP connector, four endpoints (chart/historical-price-eod-light full daily series, calendar/earnings-company, analyst/financial-estimates annual, technicalIndicators attempted but tier-gated/unavailable), all fetched in one continuous pull on 2026-09-08 for the 5 shortlisted symbols (NVDA, TSLA, MSFT, AAPL, GOOGL). This supersedes and CORRECTS a material error in the first enrichment_snapshot: that file asserted NVDA's 20-day rise was a "steady climb, no single dominant spike day" -- this was never actually verified against daily data at the time, and it was wrong. Real daily-path computation below shows the opposite. Do not carry forward the original enrichment_snapshot's "steady climb" characterization of NVDA -- treat this file as authoritative on trend shape/volatility for all 5 names.
recordFact: fleet_pilot_20260903:enrichment_v2_snapshot
payload: (orchestrator-sourced -- no dispatch)
timestamp: 2026-09-08T15:15:35Z

## Result (auto)
resolved_at: 2026-09-08T15:15:35Z
output:
````
SOURCE: verified live (FMP API, not training-data recall)
As of: all figures below retrieved together in one continuous pull on 2026-09-08. Daily price window 2026-08-03 to 2026-09-03 (24 trading-day closes, 23 daily returns computed). Earnings history/next-date and long-horizon analyst estimates are FMP's current data as of this pull. technicalIndicators (a built-in volatility/RSI tool) is tier-gated and unavailable -- volatility below is computed directly from the raw daily closes instead, not sourced from that blocked tool.

## 1. CORRECTED trend-shape and volatility (computed from real daily closes, not endpoints alone)

| Symbol | 20-day total return | Daily stdev | Max single-day move | Max single day as % of total move | Max intra-window drawdown | Up days / Down days |
|---|---|---|---|---|---|---|
| NVDA | +10.55% | **2.82%** (highest of the 5) | **+8.74%** (08-26, earnings day) | **83%** — almost the ENTIRE 20-day gain came from one day | -7.47% | 10 up / 13 down |
| TSLA | +16.86% | 2.74% | +5.51% | 33% | -4.70% | 13 up / 10 down |
| MSFT | +4.61% | 1.43% | -3.04% (a down day) | 66% (in magnitude; net direction still positive) | -5.08% | 14 up / 9 down |
| AAPL | +8.17% | **1.18%** (lowest of the 5) | +2.61% | **32%** (most broadly-based of the 5) | -3.54% (smallest of the 5) | 14 up / 9 down |
| GOOGL | -8.31% | 1.53% | -4.03% | 49% | **-11.29%** (worse than the endpoint-to-endpoint decline -- it fell further intra-window before partially recovering) | 10 up / 13 down |

**Correction, stated plainly**: NVDA is NOT a steady, broad-based advance. 83% of its entire 20-day gain came from a single day (2026-08-26, which is also its most recent earnings date -- see section 2). Excluding that one day, NVDA's price action was choppy and net-negative more often than not (13 of 20 days were down days) with the highest day-to-day volatility of the 5 shortlisted names. AAPL, by contrast, is the genuinely steady, broadly-based riser of the group -- lowest volatility, smallest single-day concentration, smallest drawdown -- a materially different picture than AAPL's "modest, unremarkable" characterization in prior passes.

## 2. Earnings history (actual vs. estimated) and next earnings date

| Symbol | Last earnings date | EPS actual vs. estimated | Revenue actual vs. estimated | Result | Next earnings date | Next EPS/revenue estimate |
|---|---|---|---|---|---|---|
| NVDA | 2026-08-26 | 2.22 vs 2.09 est | 96.221B vs 92.271B est | **Beat** (+6.2% EPS, +4.3% rev) — this is the exact day of NVDA's dominant single-day price spike above | 2026-11-18 | EPS 2.47 / Rev 108.65B |
| TSLA | 2026-07-22 | **0.33 vs 0.50 est** | 28.236B vs 26.423B est | **EPS MISS (-34%)** despite a revenue beat (+6.9%) — a real, material margin-compression signal not previously visible anywhere in this pipeline | 2026-10-28 | EPS 0.47 / Rev 27.63B |
| MSFT | 2026-07-29 | 4.74 vs 4.24 est | 90.007B vs 87.620B est | **Clean beat** (+11.8% EPS, +2.7% rev) | 2026-10-28 | EPS 4.67 / Rev 90.59B |
| AAPL | 2026-07-30 | 2.02 vs 1.89 est | 109.417B vs 109.039B est | **Beat** (+6.9% EPS), revenue roughly in-line (+0.3%) | 2026-10-29 | EPS 1.98 / Rev 113.26B |
| GOOGL | 2026-07-22 | **9.11 vs 2.87 est** | 119.796B vs 116.532B est | Revenue beat (+2.8%) is clean; the reported EPS figure is **+217% vs. estimate** -- a beat this large is not a normal operating result. **Flag, not fact**: this is very likely driven by a large non-recurring item (e.g. an unrealized mark-to-market gain on Alphabet's equity investment portfolio, a known recurring source of GAAP EPS noise for this company) rather than core operating outperformance. Treat the raw 9.11 EPS figure as unreliable for valuation/quality purposes without further breakdown -- do not cite it as a clean beat. | 2026-10-28 | EPS 3.02 / Rev 126.66B |

## 3. Long-horizon analyst estimates (annual; quarterly estimates are tier-gated/unavailable)

| Symbol | Estimate FY | Revenue (avg, analyst count) | EPS (avg, analyst count) |
|---|---|---|---|
| NVDA | FY2030 (Jan) | $1,036.95B (18 analysts) | $23.00 (10 analysts) |
| NVDA | FY2031 (Jan) | $1,119.72B (17 analysts) | $20.00 (17 analysts) |
| TSLA | FY2029 | $193.60B (25 analysts) | $6.51 (9 analysts) |
| TSLA | FY2030 | $239.71B (26 analysts) | $9.14 (9 analysts) |
| MSFT | FY2030 (Jun) | $655.80B (13 analysts) | $35.15 (12 analysts) |
| MSFT | FY2031 (Jun) | $869.91B (11 analysts) | $44.85 (7 analysts) |
| AAPL | FY2029 (Sep) | $483.09B (12 analysts) | $12.34 (8 analysts) |
| AAPL | FY2030 (Sep) | $693.15B (16 analysts) | $12.80 (14 analysts) |
| GOOGL | FY2029 | $825.02B (17 analysts) | $21.17 (24 analysts) |
| GOOGL | FY2030 | $930.92B (17 analysts) | $25.05 (25 analysts) |

Note: these are far-horizon (3-5 year out) annual estimates -- FMP's quarterly/near-term estimates endpoint is tier-gated and unavailable in this account. Use these for a rough long-run growth-trajectory sanity check (e.g. against the current EV/Sales multiple already in enrichment_snapshot), not as near-term guidance. NVDA's FY2030 EPS estimate ($23.00) is oddly LOWER than its FY2031 estimate is high relative to FY2030 in an unusual pattern worth noting as-is rather than smoothing over -- analyst count also drops from 18 (FY2030 revenue) to 10 (FY2030 EPS), suggesting thinner EPS coverage that far out.
````
