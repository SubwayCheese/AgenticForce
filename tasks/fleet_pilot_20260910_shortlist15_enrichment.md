## fleet_pilot_20260910_shortlist15_enrichment
from: claude
to: claude
type: response
status: done
source: FMP connector -- historical-price-eod-light (20 trading days, 2026-08-13 to 2026-09-10), metrics-ratios (annual period, most recent fiscal year), price-target-consensus. All fetched live 2026-09-10, same run, for the 15 symbols in fleet_pilot_20260910_universe50_consolidation.md. Same deep-enrichment methodology proven highest-value in the 2026-09-08 pass-4 run (real trend/volatility/valuation/analyst data, not just a single-day screen snapshot).
recordFact: fleet_pilot_20260910:shortlist15_enrichment
payload: (orchestrator-sourced -- no dispatch)
dependsOnTaskId: fleet_pilot_20260910_universe50_consolidation
timestamp: 2026-09-10T17:10:00Z

## Result (auto)
resolved_at: 2026-09-10T17:10:00Z
output:
```
SOURCE: verified live (FMP API, not training-data recall)
As of: 2026-09-10. Trend window: 20 trading-day closes, 2026-08-13 to 2026-09-10 (19 daily returns). Valuation ratios are most-recent-fiscal-year annual figures (quarterly-period access is tier-gated on this subscription, confirmed live). Analyst targets are current consensus snapshots.

### AAPL (screenScore 76.0, rank 1)
- 20-day trend: $305.26 -> $324.03 (+6.15%), daily stdev 1.39%, max up day +2.76%, max down day -2.51%, max drawdown -3.92%, 10 up / 9 down days.
- Valuation: P/E 34.1, EV/EBITDA-equivalent (enterpriseValueMultiple) 27.0, FCF yield 2.04%, dividend yield 0.40%.
- Analyst targets: high $400, low $245, consensus $339.35, median $360 (consensus implies +4.7% from $324.03).

### NVDA (screenScore 66.0, rank 2)
- 20-day trend: $225.30 -> $218.59 (-2.98%), daily stdev 2.80%, max up day +8.74%, max down day -4.57%, max drawdown -7.47%, 6 up / 13 down days.
- Valuation: P/E 37.8, EV/EBITDA-equivalent 31.4, FCF yield 1.82%, dividend yield 0.02%.
- Analyst targets: high $515, low $270, consensus $343.66, median $320 (consensus implies +57.2% from $218.59 -- the largest gap of the 15, same pattern flagged in the 2026-09-08 run).

### MSFT (screenScore 53.8, rank 4)
- 20-day trend: $496.88 -> $493.18 (-0.74%), daily stdev 1.36%, max up day +2.68%, max down day -3.04%, max drawdown -4.26%, 10 up / 9 down days.
- Valuation: P/E 20.7, EV/EBITDA-equivalent 13.9, FCF yield 1.83%, dividend yield 0.95%.
- Analyst targets: high $690, low $490, consensus $553.39, median $535 (consensus implies +12.2% from $493.18).

### GOOGL (screenScore 53.3, rank 5)
- 20-day trend: $346.36 -> $331.65 (-4.25%), daily stdev 1.13%, max up day +1.74%, max down day -2.28%, max drawdown -5.00%, 8 up / 11 down days.
- Valuation: P/E 28.8, EV/EBITDA-equivalent 21.2, FCF yield 1.82%, dividend yield 0.26%.
- Analyst targets: high $475, low $350, consensus $428.14, median $425 (consensus implies +29.1% from $331.65).

### AMZN (screenScore 51.1, rank 6)
- 20-day trend: $265.13 -> $252.74 (-4.67%), daily stdev 1.58%, max up day +3.97%, max down day -2.50%, max drawdown -5.27%, 6 up / 13 down days.
- Valuation: P/E 31.7, EV/EBITDA-equivalent 15.3, FCF yield 0.29% (lowest of the 15 -- heavy capex, consistent with the segment's known cash-conversion profile), no dividend.
- Analyst targets: high $390, low $300, consensus $330.27, median $325 (consensus implies +30.7% from $252.74).

### KO (screenScore 41.1, rank 7)
- 20-day trend: $87.42 -> $88.51 (+1.25%), daily stdev 1.01% (lowest volatility of the 15 alongside VZ), max up day +2.12%, max down day -1.70%, max drawdown -4.83%, 11 up / 8 down days.
- Valuation: P/E 22.9, EV/EBITDA-equivalent 18.1, FCF yield 1.39%, dividend yield 2.92%.
- Analyst targets: high $104, low $86, consensus $95.75, median $95 (consensus implies +8.2% from $88.51).

### TSLA (screenScore 41.0, rank 8)
- 20-day trend: $339.96 -> $366.39 (+7.77%), daily stdev 3.18% (highest of the 15), max up day +5.51%, max down day -5.92%, max drawdown -5.92%, 9 up / 10 down days.
- Valuation: P/E 381.1 (by far the highest of the 15 -- note priceToEarningsGrowthRatio is negative, meaning the PEG relationship is not a clean growth-adjusted read), EV/EBITDA-equivalent 122.6, FCF yield 0.53%, no dividend.
- Analyst targets: high $491, low $370, consensus $436.08, median $435 (consensus implies +19.0% from $366.39).

### XOM (screenScore 41.0, rank 9)
- 20-day trend: $158.61 -> $165.49 (+4.34%), daily stdev 1.44%, max up day +2.71%, max down day -2.08%, max drawdown -5.84%, 10 up / 9 down days.
- Valuation: P/E 18.0 (cheapest of the 15 alongside VZ), EV/EBITDA-equivalent 8.1 (lowest of the 15), FCF yield 3.31%, dividend yield 3.33%.
- Analyst targets: high $185, low $153, consensus $173.42, median $177 (consensus implies +4.8% from $165.49 -- one of the smallest gaps of the 15).

### NFLX (screenScore 40.3, rank 11)
- 20-day trend: $78.24 -> $76.16 (-2.66%), daily stdev 2.06%, max up day +3.15%, max down day -5.35%, max drawdown -8.10%, 7 up / 12 down days.
- Valuation: P/E 36.3, EV/EBITDA-equivalent 13.3, FCF yield 2.94%, no dividend.
- Analyst targets: high $119, low $75, consensus $91.82, median $90 (consensus implies +20.6% from $76.16).

### WMT (screenScore 39.2, rank 12)
- 20-day trend: $115.72 -> $106.04 (-8.37%, the worst trend of the 15), daily stdev 2.36%, max up day +2.69%, max down day **-9.15%** (a single-session crash, Aug 19->20: $114.30 -> $103.84), max drawdown -11.31% (deepest of the 15), 8 up / 11 down days.
- Valuation: P/E 43.5 (second-highest of the 15 after TSLA, despite the price decline), EV/EBITDA-equivalent 21.7, FCF yield 1.76%, dividend yield 0.79%.
- Analyst targets: high $155, low $110, consensus $128.84, median $130 (consensus implies +21.5% from $106.04).
- **Flag for round 1**: the single-day -9.15% move on Aug 19->20 is a real, concentrated event worth investigating -- likely earnings-related given the timing, but this dataset does not include an earnings-calendar confirmation. Treat the cause as unconfirmed unless independently verifiable; do not assume "earnings miss" without evidence.

### VZ (screenScore 39.0, rank 13)
- 20-day trend: $48.22 -> $50.015 (+3.72%), daily stdev 0.88% (lowest of the 15), max up day +1.69%, max down day -1.51%, max drawdown -1.68% (shallowest of the 15 by far), 11 up / 8 down days.
- Valuation: P/E 10.0 (cheapest of the 15), EV/EBITDA-equivalent 7.4 (second-lowest), FCF yield 9.52% (highest of the 15 by a wide margin), dividend yield 6.67% (highest of the 15).
- Analyst targets: high $56, low $46, consensus $49.64, median $47 (consensus implies **-0.75%** from $50.015 -- the ONLY one of the 15 where the stock already trades above its analyst consensus target).

### DIS (screenScore 38.4, rank 14)
- 20-day trend: $104.80 -> $105.15 (+0.33%, flattest of the 15), daily stdev 1.61%, max up day +2.87%, max down day -3.14%, max drawdown -6.36%, 10 up / 9 down days.
- Valuation: P/E 16.5, EV/EBITDA-equivalent 12.8, FCF yield 5.31%, dividend yield 0.88%.
- Analyst targets: high $164, low $111, consensus $126.30, median $124 (consensus implies +20.1% from $105.15).

### META (screenScore 38.0, rank 15)
- 20-day trend: $594.97 -> $651.4605 (+9.49%, best trend of the 15), daily stdev 2.30%, max up day +6.55% (a large single-day move, 2026-09-08->09), max down day -4.45%, max drawdown -8.62%, 11 up / 8 down days.
- Valuation: P/E 27.5, EV/EBITDA-equivalent 16.4, FCF yield 2.81%, dividend yield 0.32%.
- Analyst targets: high $886, low $595, consensus $729.93, median $735 (consensus implies +12.1% from $651.46).
- **Flag for round 1**: nearly half the 20-day gain landed in one session (Sep 8->9, +6.55%) after a slower climb before that -- decompose the trend by timing rather than treating it as evenly-earned momentum.

### ABBV (screenScore 35.4, rank 19 -- substituted for tier-gated QCOM)
- 20-day trend: $250.82 -> $252.36 (+0.61%), daily stdev 1.52%, max up day +3.43%, max down day -2.99%, max drawdown -6.46%, 10 up / 9 down days.
- Valuation: P/E 96.4 (second-highest of the 15), but note priceToBookRatio is negative (-124.0) and shareholdersEquityPerShare is negative (-$1.84) -- a real, unusual balance-sheet structure (likely buyback-driven negative equity, common for mature dividend payers with large repurchase programs) that materially limits how book-value-based metrics can be used here. EV/EBITDA-equivalent 26.6, FCF yield 3.98%, dividend yield 2.88%.
- Analyst targets: high $315, low $235, consensus $287.08, median $296 (consensus implies +13.8% from $252.36).
- **Flag for round 1**: the negative book value / negative debtToEquity figures are a real data characteristic, not a data error -- do not treat priceToBookRatio or debtToEquityRatio as meaningful for this name without accounting for the negative-equity structure.

### PEP (screenScore 34.6, rank 21 -- substituted for tier-gated AVGO)
- 20-day trend: $140.62 -> $137.30 (-2.36%), daily stdev 1.08%, max up day +1.75%, max down day -1.81%, max drawdown -5.52%, 9 up / 10 down days.
- Valuation: P/E 23.8, EV/EBITDA-equivalent 15.3, FCF yield 4.09%, dividend yield 3.89%.
- Analyst targets: high $183, low $134, consensus $155.64, median $155 (consensus implies +13.4% from $137.30).

### Cross-symbol notes for round-1 writers
- WMT's single-day -9.15% crash (Aug 19->20) is the most concentrated, unexplained move in this dataset -- flag it as a real risk factor but do not assume a cause not evidenced here.
- VZ is the only one of the 15 already trading above its analyst consensus target -- a real, checkable fact that should inform any bull case built on analyst-target upside for VZ specifically.
- NVDA's +57.2% analyst-target gap is the largest of the 15, same "consensus lagging price" pattern noted for NVDA in the 2026-09-08 run -- treat a large gap as a data point to investigate (dispersion, staleness), not as free upside.
- TSLA's P/E (381.1) and EV/EBITDA-equivalent (122.6) are extreme outliers versus the rest of the group -- any bull case must engage with this directly rather than leaning on trend/analyst-target framing alone.
- QCOM and AVGO (both originally top-10 by screenScore) are absent from this shortlist purely due to a data-access limitation (tier-gated on this FMP subscription for historical price/valuation), not a screening decision -- do not read their absence as a negative signal about either name.
```
