## fleet_pilot_20260910_universe50_consolidation
from: claude
to: claude
type: response
status: done
source: FMP connector, endpoint company/profile-symbol, one call per symbol, all fetched 2026-09-10 (market open, ~12:50pm ET) within the same run for consistency. Same 50-symbol universe as fleet_pilot_20260908_universe50_consolidation.md (bus/scripts/fleet-universe.json), re-screened fresh against today's live data using the same unified screenScore formula (50% momentum / 30% liquidity / 20% scale, min-max normalized).
recordFact: fleet_pilot_20260910:universe50_consolidation
payload: (orchestrator-sourced -- no dispatch)
timestamp: 2026-09-10T16:55:00Z

## Result (auto)
resolved_at: 2026-09-10T16:55:00Z
output:
```
SOURCE: verified live (FMP API, not training-data recall)
As of: 2026-09-10, ~12:50pm ET (market open, next close 4:00pm ET same day).

Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) + 20 x norm(MarketCap), min-max normalized per field across all 50 symbols.

| Rank | Symbol | Chg% | Avg Volume | Market Cap | screenScore |
|---|---|---|---|---|---|
| 1 | AAPL | 2.62% | 52,766,133 | $4752.7B | 76.0 |
| 2 | NVDA | -2.28% | 144,761,841 | $5294.2B | 66.0 |
| 3 | QCOM | 3.02% | 19,721,727 | $190.8B | 54.2 |
| 4 | MSFT | 0.35% | 35,996,686 | $3663.7B | 53.8 |
| 5 | GOOGL | 0.24% | 30,605,920 | $4011.2B | 53.3 |
| 6 | AMZN | 0.17% | 46,356,837 | $2719.6B | 51.1 |
| 7 | KO | 0.96% | 16,799,316 | $380.3B | 41.1 |
| 8 | TSLA | -0.59% | 44,409,022 | $1444.1B | 41.0 |
| 9 | XOM | 0.79% | 15,876,805 | $686.0B | 41.0 |
| 10 | AVGO | -0.20% | 24,955,854 | $1730.2B | 40.5 |
| 11 | NFLX | 0.14% | 39,190,697 | $317.0B | 40.3 |
| 12 | WMT | 0.16% | 23,854,376 | $843.6B | 39.2 |
| 13 | VZ | 0.48% | 24,631,414 | $208.7B | 39.0 |
| 14 | DIS | 0.87% | 10,022,867 | $182.5B | 38.4 |
| 15 | META | -0.31% | 17,792,667 | $1660.1B | 38.0 |
| 16 | COP | 0.60% | 7,112,183 | $167.3B | 35.9 |
| 17 | LLY | 0.19% | 2,947,548 | $1060.7B | 35.8 |
| 18 | CRM | 0.28% | 15,043,866 | $200.5B | 35.7 |
| 19 | ABBV | 0.37% | 6,205,609 | $445.0B | 35.4 |
| 20 | SCHW | 0.33% | 9,649,862 | $185.9B | 34.8 |
| 21 | PEP | 0.35% | 8,080,415 | $187.4B | 34.6 |
| 22 | BAC | -0.65% | 33,832,080 | $441.9B | 34.6 |
| 23 | V | 0.01% | 7,676,569 | $686.0B | 34.2 |
| 24 | MCD | 0.24% | 4,534,273 | $180.5B | 33.2 |
| 25 | SBUX | 0.11% | 7,203,661 | $114.2B | 32.6 |
| 26 | PG | -0.10% | 8,832,741 | $338.8B | 32.5 |
| 27 | COST | 0.07% | 2,226,812 | $400.6B | 32.4 |
| 28 | CVX | -0.19% | 8,805,563 | $425.0B | 32.2 |
| 29 | JNJ | -0.32% | 7,744,536 | $641.6B | 32.0 |
| 30 | BA | 0.00% | 6,063,005 | $163.2B | 31.9 |
| 31 | PFE | -1.13% | 40,039,060 | $156.5B | 31.7 |
| 32 | JPM | -0.59% | 8,247,542 | $944.8B | 31.5 |
| 33 | CSCO | -0.80% | 23,464,380 | $427.8B | 31.4 |
| 34 | UNH | -0.26% | 5,827,034 | $356.0B | 30.9 |
| 35 | MA | -0.35% | 3,435,220 | $496.0B | 30.3 |
| 36 | GE | -0.45% | 4,440,987 | $336.1B | 29.3 |
| 37 | TMO | -0.36% | 2,177,423 | $224.3B | 29.0 |
| 38 | WFC | -0.83% | 15,207,916 | $268.9B | 28.8 |
| 39 | MS | -0.63% | 5,384,674 | $337.5B | 28.3 |
| 40 | NKE | -1.24% | 24,339,291 | $54.6B | 27.3 |
| 41 | INTC | -4.76% | 121,047,854 | $510.4B | 26.8 |
| 42 | GS | -0.83% | 2,058,516 | $301.0B | 26.2 |
| 43 | ABT | -1.11% | 11,650,853 | $180.1B | 25.9 |
| 44 | HD | -1.27% | 4,544,776 | $305.6B | 23.9 |
| 45 | HON | -1.14% | 4,104,129 | $64.2B | 23.7 |
| 46 | CAT | -1.60% | 3,045,168 | $369.7B | 21.7 |
| 47 | MRK | -1.92% | 10,205,506 | $357.4B | 21.1 |
| 48 | AMD | -2.94% | 29,743,276 | $824.7B | 20.5 |
| 49 | ADBE | -1.90% | 5,821,181 | $99.4B | 19.3 |
| 50 | ORCL | -3.19% | 29,183,783 | $450.7B | 17.3 |

Real shift from the 2026-09-08 run (shortlist was INTC/NVDA/AMD/TSLA/AAPL/MSFT/GOOGL/AMZN/BAC/JPM/META/JNJ/CSCO/KO/VZ): AAPL jumped from a middling rank to #1 (a real +2.62% up day today), while INTC -- #1 two sessions ago -- crashed to #41 (-4.76% today) and AMD dropped out of the top 15 entirely (-2.94%, rank 48). QCOM had a genuine +3.02% day, entering the top 3. This is a real, meaningfully different market snapshot from Tuesday, not a re-run of the same names.

QCOM (rank 3) and AVGO (rank 10) are tier-gated for deeper historical-price/valuation data on this FMP subscription (confirmed live, same ACCESS DENIED pattern as the 2026-09-08 run's AVGO/QCOM/ORCL/LLY/HD/CAT gate) -- substituted with the next-highest-ranked names that have working data access: ABBV (rank 19) and PEP (rank 21). COP (16), LLY (17), CRM (18), and SCHW (20) were also tested and found tier-gated; ABBV and PEP were the first two below the gated names to have working access.

Final 15-symbol shortlist for today's deliberation: AAPL, NVDA, MSFT, GOOGL, AMZN, KO, TSLA, XOM, NFLX, WMT, VZ, DIS, META, ABBV, PEP.
```
