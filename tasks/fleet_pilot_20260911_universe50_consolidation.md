## fleet_pilot_20260911_universe50_consolidation
from: claude
to: claude
type: response
status: done
payload: (orchestrator-sourced, unattended -- see generate-pilot-tasks.js)
timestamp: 2026-09-11T17:30:25.269Z

## Result (auto)
resolved_at: 2026-09-11T17:30:25.270Z
output:
```
SOURCE: verified live (Alpaca market-data API + Finnhub free tier, fetched by generate-pilot-tasks.js -- unattended)
As of: 2026-09-11T17:30:25.270Z

Unattended screen, 50-symbol fixed universe (bus/scripts/fleet-universe.json), price/volume from Alpaca's free market-data API (batched daily bars, same paper-account key already configured -- no new credential), market cap from Finnhub's free tier. Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) + 20 x norm(MarketCap), min-max normalized. Top 15 become this cycle's shortlist.

FINNHUB_API_KEY not configured -- market cap is n/a for every symbol this cycle, and screenScore is effectively 50 x norm(Chg%) + 30 x norm(AvgVolume) only (the 20% cap weight contributes nothing when every value is equal). Add FINNHUB_API_KEY to bus/secrets.local.json (free tier, finnhub.io) to restore it.

| Rank | Symbol | Chg% | Avg Volume (20d) | Market Cap | screenScore |
|---|---|---|---|---|---|
| 1 | INTC | 3.08% | 2,917,430 | n/a | 64.5 |
| 2 | QCOM | 4.61% | 307,408 | n/a | 52.3 |
| 3 | NVDA | 0.40% | 3,449,580 | n/a | 50.2 |
| 4 | CSCO | 3.81% | 567,646 | n/a | 48.8 |
| 5 | AAPL | 2.25% | 1,247,223 | n/a | 43.8 |
| 6 | BA | 3.07% | 208,081 | n/a | 40.5 |
| 7 | AMZN | 1.88% | 1,158,521 | n/a | 40.4 |
| 8 | GOOGL | 2.43% | 678,354 | n/a | 40.1 |
| 9 | CRM | 2.38% | 623,279 | n/a | 39.2 |
| 10 | NFLX | 1.34% | 1,383,311 | n/a | 38.6 |
| 11 | AMD | 2.41% | 452,052 | n/a | 37.9 |
| 12 | BAC | 0.61% | 1,812,007 | n/a | 37.2 |
| 13 | NKE | 1.11% | 1,242,739 | n/a | 35.7 |
| 14 | VZ | 1.26% | 933,806 | n/a | 34.0 |
| 15 | CAT | 2.18% | 91,767 | n/a | 33.2 |
| 16 | AVGO | 1.22% | 825,103 | n/a | 32.8 |
| 17 | ADBE | 2.00% | 172,985 | n/a | 32.6 |
| 18 | PG | 1.54% | 422,407 | n/a | 31.5 |
| 19 | PFE | -0.22% | 1,811,376 | n/a | 31.3 |
| 20 | WFC | 1.25% | 570,316 | n/a | 30.7 |
| 21 | WMT | 0.65% | 1,007,929 | n/a | 30.4 |
| 22 | META | 0.94% | 616,881 | n/a | 29.0 |
| 23 | TSLA | 0.64% | 765,209 | n/a | 28.2 |
| 24 | HD | 1.31% | 136,062 | n/a | 27.3 |
| 25 | TMO | 1.35% | 90,020 | n/a | 27.2 |
| 26 | KO | 0.51% | 750,550 | n/a | 27.1 |
| 27 | V | 1.05% | 211,847 | n/a | 26.2 |
| 28 | MSFT | 0.57% | 543,571 | n/a | 25.7 |
| 29 | DIS | 0.84% | 322,410 | n/a | 25.7 |
| 30 | GS | 1.17% | 57,092 | n/a | 25.6 |
| 31 | JPM | 0.95% | 165,679 | n/a | 25.1 |
| 32 | ABBV | 0.91% | 161,807 | n/a | 24.7 |
| 33 | MS | 0.78% | 149,904 | n/a | 23.7 |
| 34 | MA | 0.79% | 109,647 | n/a | 23.4 |
| 35 | MRK | 0.37% | 401,751 | n/a | 23.0 |
| 36 | CVX | 0.47% | 260,569 | n/a | 22.5 |
| 37 | GE | 0.55% | 148,862 | n/a | 22.1 |
| 38 | ORCL | -0.20% | 748,853 | n/a | 22.1 |
| 39 | HON | 0.60% | 86,488 | n/a | 21.9 |
| 40 | XOM | 0.15% | 394,711 | n/a | 21.5 |
| 41 | PEP | 0.37% | 198,707 | n/a | 21.3 |
| 42 | MCD | 0.25% | 149,555 | n/a | 20.0 |
| 43 | COST | 0.17% | 52,621 | n/a | 18.5 |
| 44 | SBUX | -0.11% | 207,575 | n/a | 18.0 |
| 45 | LLY | -0.05% | 97,693 | n/a | 17.4 |
| 46 | COP | -0.34% | 305,606 | n/a | 17.1 |
| 47 | JNJ | -0.37% | 218,945 | n/a | 16.2 |
| 48 | SCHW | -0.64% | 402,167 | n/a | 15.9 |
| 49 | ABT | -1.14% | 364,244 | n/a | 12.0 |
| 50 | UNH | -2.45% | 169,447 | n/a | 1.0 |
```
