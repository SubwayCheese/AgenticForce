## crypto_pilot_20260908_data_snapshot
from: claude
to: claude
type: response
status: done
source: FMP connector (crypto tool: cryptocurrency-quote, cryptocurrency-historical-price-eod-light), fetched 2026-09-08 for BTCUSD/ETHUSD/XRPUSD. This is the crypto pipeline's equivalent of fleet_pilot_20260908_shortlist15_enrichment.md -- no universe-scan/shortlist stage exists here (only 3 fixed symbols: BTC, ETH, XRP, chosen by the human operator, not screened). IMPORTANT: crypto has NO earnings, valuation multiples, ROE/FCF-yield, or analyst price targets -- this is structural (the asset class doesn't have them), not a today-gap. This snapshot is price/volume/market-cap/trend data ONLY. Any thesis built on this must not invent a fundamentals angle that doesn't exist.
recordFact: crypto_pilot_20260908:data_snapshot
payload: (orchestrator-sourced -- no dispatch)
timestamp: 2026-09-08T21:30:00Z

## Result (auto)
resolved_at: 2026-09-08T21:30:00Z
output:
````
SOURCE: verified live (FMP API crypto tool, not training-data recall)
As of: all figures retrieved together on 2026-09-08. Trend window: 2026-08-10 to 2026-09-08 (30 calendar-day closes, 29 daily returns -- crypto trades every day, unlike equities' 20 trading-day window). Live quote fields (price, 24h change, market cap, 50/200-day averages) are the same-moment snapshot.

### BTC (BTCUSD / BTC-USD spot; Alpaca order symbol: BTC/USD)
- Live quote: $78,863.69, 24h change +0.53% (+$417.51), market cap $1.575T, 50-day avg $69,694.32, 200-day avg $69,814.41, year range $57,747.77-$126,198.07.
- 30-day trend: $63,911.88 -> $78,799.99 (+23.29%), daily stdev 2.53%, max up day +7.28%, max down day -3.03%, max drawdown -3.70% (shallow given the size of the rally -- see cross-symbol note), 16 up / 13 down days.
- No earnings, no valuation multiples, no analyst targets exist for this asset.

### ETH (ETHUSD / ETH-USD spot; Alpaca order symbol: ETH/USD)
- Live quote: $2,498.92, 24h change +0.56% (+$13.99), market cap $301.6B, 50-day avg $2,115.43, 200-day avg $2,041.59, year range $1,506.51-$4,763.36.
- 30-day trend: $1,871.44 -> $2,496.86 (+33.42%), daily stdev 3.93% (highest of the 3), max up day +17.48% (single largest one-day move across all 3 coins -- see cross-symbol note), max down day -3.73%, max drawdown -4.97%, 18 up / 11 down days.
- No earnings, no valuation multiples, no analyst targets exist for this asset.

### XRP (XRPUSD / XRP-USD spot; Alpaca order symbol: XRP/USD)
- Live quote: $1.4224, 24h change +0.43% (+$0.0062), market cap $86.3B, 50-day avg $1.191, 200-day avg $1.274, year range $0.988-$3.183.
- 30-day trend: $1.0114 -> $1.4209 (+40.49%, largest total return of the 3), daily stdev 4.83% (highest volatility of the 3), max up day +14.70%, max down day -4.78%, max drawdown -11.17% (deepest of the 3, despite the largest total gain -- a real round-trip inside the window), 16 up / 13 down days.
- No earnings, no valuation multiples, no analyst targets exist for this asset.

### Cross-symbol note for round-1 writers
All three coins show a concentrated multi-day surge in the SAME calendar window, 2026-08-18 to 2026-08-21: BTC $64,681->$78,325 (+21.1% in 3 sessions), ETH $1,916.72->$2,515.80 (+31.2%), XRP $1.0013->$1.4541 (+45.2%). This is a correlated, market-wide move across all 3 coins simultaneously, not a coin-specific catalyst -- there is no coin-specific news/event data in this snapshot to explain it, and a thesis should not invent one. Treat any claim about WHY this happened as unverified INTERPRETATION with no data source backing it, never FACT. After that surge, all 3 coins have been range-bound-to-mildly-declining through 09-08 (BTC actually round-tripped further, touching $81,263.99 on 09-03 before pulling back to $78,799.99).

### Standing constraint, all rounds
BTC/ETH/XRP are confirmed live as spot, cash-settled, and long-only on this Alpaca paper account (shortable:false, margin_requirement_long:100 for all three) -- no short side exists. A bear case should inform a "stay out" recommendation, never a short thesis.
````
