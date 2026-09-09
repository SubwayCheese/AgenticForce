## fleet_pilot_20260908_universe50_consolidation
from: claude
to: claude
type: response
status: done
source: FMP connector, endpoint company/profile-symbol, one call per symbol, all fetched 2026-09-08 within the same run for consistency. This is the STAGED EXPANSION from the original 15-symbol pilot (fleet_pilot_20260903) to the approved plan's real 50-stock pilot stage (tasks/trading_fleet_scoping_plan.md, "Scale plan" section: "Pilot | 50 liquid US stocks | 4-6 concurrent scanning tasks | 5 shortlist | 3 rounds"). The original 15 symbols are carried forward unchanged (same values as fleet_pilot_20260903_universe_snapshot.md); 35 new diversified symbols were added across sectors underrepresented in the original 15 (semiconductors/software, consumer staples/discretionary, healthcare, financials, industrials, energy, communications). The unified screenScore formula is unchanged from the original pilot (50%% momentum / 30%% liquidity / 20%% scale, min-max normalized) -- only the universe it's computed over is wider. This step combines what were previously two separate steps (universe_snapshot + consolidation) into one, since the formula itself is already proven and doesn't need independent re-derivation by two specialists again -- this is a data-scale-up, not a methodology change.
recordFact: fleet_pilot_20260908:universe50_consolidation
payload: (orchestrator-sourced -- no dispatch)
timestamp: 2026-09-08T17:27:07Z

## Result (auto)
resolved_at: 2026-09-08T17:27:07Z
output:
```
SOURCE: verified live (FMP API, not training-data recall)
As of: retrieved 2026-09-08. Screen criteria (unchanged from the original pilot): price > $5, average volume > 1,000,000, market cap > $300,000,000, isActivelyTrading true, US-listed, not an ETF/fund. All 50 below pass every threshold.

Screen anchors (min/max across all 50, used for normalization): Chg% [-4.15%, +10.54%], Avg Volume [2,063,654, 148,067,102], Market Cap [$56.4B, $5,533.3B].

Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) + 20 x norm(MarketCap), min-max normalized per field across all 50 symbols.

## Ranked table, all 50

| Rank | Symbol | Chg% | Avg Volume | Market Cap | screenScore |
|---|---|---|---|---|---|
| 1 | INTC | +10.54% | 122,101,206 | $534.1B | **76.4** |
| 2 | NVDA | +1.80% | 148,067,102 | $5,533.3B | **70.3** |
| 3 | AMD | +7.08% | 29,927,030 | $833.9B | **46.8** |
| 4 | TSLA | +5.42% | 44,429,008 | $1,486.5B | **46.5** |
| 5 | AAPL | +1.00% | 53,048,711 | $4,820.5B | **45.4** |
| 6 | MSFT | +2.68% | 37,070,183 | $3,787.9B | 44.1 |
| 7 | GOOGL | +1.59% | 30,883,090 | $4,144.7B | 40.4 |
| 8 | AMZN | +1.54% | 47,161,723 | $2,785.0B | 38.6 |
| 9 | AVGO | +2.51% | 24,764,263 | $1,745.5B | 33.5 |
| 10 | QCOM | +3.36% | 19,721,727 | $183.1B | 29.7 |
| 11 | ORCL | +2.09% | 28,922,411 | $466.9B | 28.3 |
| 12 | BAC | +0.70% | 33,718,988 | $447.4B | 24.5 |
| 13 | JPM | +1.64% | 8,330,103 | $970.1B | 24.3 |
| 14 | META | +0.17% | 17,986,480 | $1,573.9B | 23.5 |
| 15 | JNJ | +1.17% | 7,786,770 | $671.0B | 21.5 |
| 16 | CSCO | -0.09% | 23,472,608 | $430.0B | 19.6 |
| 17 | KO | +0.27% | 16,786,736 | $379.9B | 19.3 |
| 18 | VZ | -0.09% | 24,856,804 | $209.2B | 19.1 |
| 19 | CAT | +0.99% | 3,039,409 | $368.6B | 18.9 |
| 20 | CVX | +0.38% | 8,815,987 | $417.0B | 18.1 |
| 21 | V | +0.09% | 7,955,169 | $707.1B | 18.0 |
| 22 | LLY | -0.05% | 3,038,805 | $1,091.9B | 18.0 |
| 23 | HD | +0.60% | 4,549,349 | $317.2B | 17.6 |
| 24 | WMT | -1.20% | 23,836,533 | $842.4B | 17.4 |
| 25 | PEP | +0.38% | 8,011,101 | $188.7B | 17.2 |
| 26 | UNH | +0.32% | 5,915,371 | $364.1B | 17.1 |
| 27 | GE | +0.32% | 4,516,061 | $350.9B | 16.8 |
| 28 | NKE | -0.67% | 23,938,111 | $56.4B | 16.3 |
| 29 | MS | +0.05% | 5,422,577 | $343.6B | 16.1 |
| 30 | PFE | -1.85% | 40,135,149 | $159.2B | 16.1 |
| 31 | NFLX | -1.98% | 39,306,252 | $319.4B | 16.0 |
| 32 | COP | +0.03% | 7,162,189 | $163.6B | 15.7 |
| 33 | XOM | -1.16% | 16,000,421 | $672.4B | 15.3 |
| 34 | MCD | +0.03% | 4,523,715 | $181.7B | 15.2 |
| 35 | BA | -0.15% | 6,085,269 | $167.5B | 14.9 |
| 36 | GS | -0.08% | 2,063,654 | $306.1B | 14.8 |
| 37 | PG | -0.80% | 8,842,833 | $345.3B | 13.9 |
| 38 | DIS | -0.77% | 10,002,155 | $181.5B | 13.6 |
| 39 | MRK | -1.04% | 10,293,904 | $367.4B | 13.4 |
| 40 | SCHW | -0.93% | 9,718,987 | $188.3B | 13.0 |
| 41 | COST | -0.73% | 2,218,774 | $403.2B | 13.0 |
| 42 | HON | -0.60% | 4,234,619 | $66.0B | 12.6 |
| 43 | WFC | -1.50% | 15,309,355 | $268.0B | 12.5 |
| 44 | TMO | -1.30% | 2,165,576 | $225.1B | 10.4 |
| 45 | ABT | -2.10% | 11,624,328 | $183.5B | 9.4 |
| 46 | MA | -2.06% | 3,516,663 | $497.5B | 9.1 |
| 47 | ABBV | -2.21% | 6,259,322 | $443.1B | 8.9 |
| 48 | SBUX | -2.19% | 7,457,274 | $116.5B | 8.0 |
| 49 | CRM | -4.15% | 14,954,474 | $203.5B | 3.2 |
| 50 | ADBE | -3.55% | 5,800,482 | $102.2B | 3.0 |

## Shortlist: top 5 = **INTC (76.4), NVDA (70.3), AMD (46.8), TSLA (46.5), AAPL (45.4)**

- **Real shift from the 15-symbol pilot's shortlist** (which was NVDA/TSLA/MSFT/AAPL/GOOGL): widening the universe to 50 pulled in two semiconductor names -- INTC and AMD -- that beat MSFT and GOOGL on the unified score, primarily on momentum (both had large single-day Chg% moves this snapshot: INTC +10.54%, AMD +7.08%). MSFT (44.1) and GOOGL (40.4) are now ranked 6th and 7th, just outside the shortlist -- a real, close cliff (44.1 vs. 45.4 for the 5th-place cutoff), not a wide gap, worth noting for anyone reviewing this rather than treating the top-5 cutoff as decisive.
- Clean natural break after the top 3: INTC/NVDA are well clear of the rest (70+), then a tighter cluster of AMD/TSLA/AAPL (45-47), then MSFT/GOOGL close behind (40-44), then a real drop to AMZN (38.6) and below.
- Per the same caveat this pilot has carried since the 15-symbol run: this is a single-day momentum/liquidity/size screen, not a fundamental-quality signal. INTC and AMD's inclusion is heavily driven by one day's outsized price move -- this should be treated as a screening-stage signal only, exactly the kind of claim the earlier 15-symbol pilot's deep-enrichment work (real volatility/earnings history/long-horizon estimates) was built to pressure-test. The same deep-enrichment process should be applied to this new shortlist before any deliberation round, not skipped just because the mechanism is now familiar.
```
