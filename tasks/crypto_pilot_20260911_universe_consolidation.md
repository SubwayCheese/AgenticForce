## crypto_pilot_20260911_universe_consolidation
from: claude
to: claude
type: response
status: done
payload: (orchestrator-sourced, unattended -- see generate-pilot-tasks.js)
timestamp: 2026-09-11T09:12:21.041Z

## Result (auto)
resolved_at: 2026-09-11T09:12:21.042Z
output:
```
SOURCE: verified live (Alpaca market-data API, fetched by generate-pilot-tasks.js -- unattended)
As of: 2026-09-11T09:12:21.042Z

Unattended screen, 32-coin real tradable-on-Alpaca universe (bus/scripts/crypto-universe.json), price/volume from Alpaca's free market-data API (batched daily bars, same paper-account key already configured -- no new credential). Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) (market-cap term omitted -- no free crypto market-cap source wired up, see generate-pilot-tasks.js). Top 10 become this cycle's shortlist.

| Rank | Coin | Price | Chg% | Volume (20d avg) | screenScore |
|---|---|---|---|---|---|
| 1 | PEPE | $0.000003305 | 2.16% | 369,184,404 | 68.0 |
| 2 | POL | $0.09461675 | 2.75% | 3,206 | 50.0 |
| 3 | ARB | $0.1432 | 2.45% | 33,862 | 44.0 |
| 4 | CRV | $0.34393 | 2.39% | 9,312 | 42.7 |
| 5 | ONDO | $0.350625 | 2.38% | 2,750 | 42.3 |
| 6 | DOT | $1.12004 | 2.16% | 8,547 | 38.0 |
| 7 | UNI | $6.076 | 2.10% | 3,003 | 36.7 |
| 8 | SKY | $0.0608861 | 2.01% | 10,434 | 34.8 |
| 9 | HYPE | $80.085 | 1.90% | 116 | 32.4 |
| 10 | YFI | $2162.17 | 1.89% | 0 | 32.3 |
| 11 | AAVE | $122.65 | 1.74% | 70 | 29.3 |
| 12 | XTZ | $0.2574 | 1.67% | 1,272 | 27.8 |
| 13 | LTC | $52.971 | 1.65% | 267 | 27.4 |
| 14 | SHIB | $0.00000508 | 0.99% | 163,382,240 | 27.1 |
| 15 | BONK | $0.00000267 | 1.14% | 110,622,692 | 25.8 |
| 16 | ETH | $2472.8525 | 1.48% | 25 | 23.8 |
| 17 | TRUMP | $1.96629 | 1.38% | 320 | 21.7 |
| 18 | WIF | $0.192626 | 1.33% | 4,221 | 20.7 |
| 19 | BCH | $226.805 | 1.31% | 12 | 20.4 |
| 20 | BAT | $0.07136 | 1.28% | 3,569 | 19.8 |
| 21 | DOGE | $0.083925 | 1.27% | 62,047 | 19.6 |
| 22 | XRP | $1.3505 | 1.22% | 29,489 | 18.6 |
| 23 | ADA | $0.20697 | 1.18% | 26,045 | 17.7 |
| 24 | SOL | $99.7455 | 1.16% | 432 | 17.2 |
| 25 | SUSHI | $0.214785 | 1.05% | 8,094 | 14.9 |
| 26 | BTC | $77249.98 | 0.93% | 3 | 12.6 |
| 27 | LDO | $0.370838 | 0.83% | 684 | 10.5 |
| 28 | AVAX | $7.48235 | 0.83% | 991 | 10.4 |
| 29 | FIL | $0.785818 | 0.79% | 691 | 9.6 |
| 30 | RENDER | $1.40183 | 0.64% | 204 | 6.5 |
| 31 | GRT | $0.0177925 | 0.45% | 199,378 | 2.6 |
| 32 | LINK | $11.47905 | 0.32% | 1,422 | 0.0 |

## Shortlist detail
### PEPE (PEPE/USD)
- Live quote: $0.000003305, change 2.16%, 50-day avg $0.00, 200-day avg $0.00.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### POL (POL/USD)
- Live quote: $0.09461675, change 2.75%, 50-day avg $0.09, 200-day avg $0.09.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### ARB (ARB/USD)
- Live quote: $0.1432, change 2.45%, 50-day avg $0.10, 200-day avg $0.10.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### CRV (CRV/USD)
- Live quote: $0.34393, change 2.39%, 50-day avg $0.28, 200-day avg $0.24.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### ONDO (ONDO/USD)
- Live quote: $0.350625, change 2.38%, 50-day avg $0.36, 200-day avg $0.33.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### DOT (DOT/USD)
- Live quote: $1.12004, change 2.16%, 50-day avg $0.86, 200-day avg $1.10.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### UNI (UNI/USD)
- Live quote: $6.076, change 2.10%, 50-day avg $4.53, 200-day avg $3.64.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### SKY (SKY/USD)
- Live quote: $0.0608861, change 2.01%, 50-day avg $0.06, 200-day avg $0.07.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### HYPE (HYPE/USD)
- Live quote: $80.085, change 1.90%, 50-day avg $68.14, 200-day avg $54.39.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### YFI (YFI/USD)
- Live quote: $2162.17, change 1.89%, 50-day avg $2133.91, 200-day avg $2311.14.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.
```
