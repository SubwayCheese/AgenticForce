## crypto_pilot_20260912_universe_consolidation
from: claude
to: claude
type: response
status: done
payload: (orchestrator-sourced, unattended -- see generate-pilot-tasks.js)
timestamp: 2026-09-12T02:12:21.127Z

## Result (auto)
resolved_at: 2026-09-12T02:12:21.128Z
output:
```
SOURCE: verified live (Alpaca market-data API, fetched by generate-pilot-tasks.js -- unattended)
As of: 2026-09-12T02:12:21.128Z

Unattended screen, 32-coin real tradable-on-Alpaca universe (bus/scripts/crypto-universe.json), price/volume from Alpaca's free market-data API (batched daily bars, same paper-account key already configured -- no new credential). Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) (market-cap term omitted -- no free crypto market-cap source wired up, see generate-pilot-tasks.js). Top 10 become this cycle's shortlist.

| Rank | Coin | Price | Chg% | Volume (20d avg) | screenScore |
|---|---|---|---|---|---|
| 1 | XTZ | $0.25865 | 3.06% | 1,274 | 50.0 |
| 2 | PEPE | $0.000003315 | 0.30% | 368,245,568 | 40.9 |
| 3 | FIL | $0.7988685 | 1.72% | 736 | 30.9 |
| 4 | BONK | $0.00000277 | 1.09% | 107,452,437 | 30.9 |
| 5 | ARB | $0.1419 | 1.71% | 34,148 | 30.9 |
| 6 | WIF | $0.19488 | 1.59% | 3,487 | 29.1 |
| 7 | SHIB | $0.00000521 | 0.58% | 162,378,990 | 28.0 |
| 8 | DOT | $1.05356 | 1.26% | 7,031 | 24.5 |
| 9 | SKY | $0.062281 | 1.24% | 10,269 | 24.1 |
| 10 | LTC | $53.8675 | 1.12% | 267 | 22.5 |
| 11 | SUSHI | $0.219625 | 1.11% | 8,283 | 22.3 |
| 12 | GRT | $0.0177176 | 0.95% | 204,305 | 20.1 |
| 13 | YFI | $2202.7 | 0.92% | 0 | 19.7 |
| 14 | BCH | $230.2 | 0.89% | 11 | 19.2 |
| 15 | ADA | $0.207895 | 0.80% | 26,092 | 17.9 |
| 16 | LDO | $0.3727 | 0.75% | 656 | 17.2 |
| 17 | UNI | $6.042425 | 0.58% | 2,442 | 14.8 |
| 18 | TRUMP | $1.98951 | 0.44% | 309 | 12.8 |
| 19 | RENDER | $1.397095 | 0.43% | 209 | 12.7 |
| 20 | XRP | $1.360897495 | 0.31% | 27,564 | 11.0 |
| 21 | AAVE | $125.3965 | 0.24% | 55 | 9.9 |
| 22 | DOGE | $0.0844505 | 0.16% | 65,169 | 8.9 |
| 23 | BTC | $77304.19 | 0.12% | 3 | 8.2 |
| 24 | ONDO | $0.350857 | 0.09% | 2,678 | 7.8 |
| 25 | CRV | $0.3357325 | 0.07% | 9,876 | 7.5 |
| 26 | LINK | $11.54485 | -0.02% | 1,375 | 6.2 |
| 27 | ETH | $2514.52 | -0.06% | 25 | 5.7 |
| 28 | AVAX | $7.45595 | -0.07% | 740 | 5.5 |
| 29 | BAT | $0.0715495 | -0.08% | 3,484 | 5.5 |
| 30 | POL | $0.097189 | -0.17% | 3,208 | 4.2 |
| 31 | HYPE | $79.14 | -0.38% | 113 | 1.2 |
| 32 | SOL | $101.96 | -0.46% | 412 | 0.0 |

## Shortlist detail
### XTZ (XTZ/USD)
- Live quote: $0.25865, change 3.06%, 50-day avg $0.22, 200-day avg $0.29.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### PEPE (PEPE/USD)
- Live quote: $0.000003315, change 0.30%, 50-day avg $0.00, 200-day avg $0.00.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### FIL (FIL/USD)
- Live quote: $0.7988685, change 1.72%, 50-day avg $0.73, 200-day avg $0.85.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### BONK (BONK/USD)
- Live quote: $0.00000277, change 1.09%, 50-day avg $0.00, 200-day avg $0.00.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### ARB (ARB/USD)
- Live quote: $0.1419, change 1.71%, 50-day avg $0.10, 200-day avg $0.10.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### WIF (WIF/USD)
- Live quote: $0.19488, change 1.59%, 50-day avg $0.17, 200-day avg $0.18.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### SHIB (SHIB/USD)
- Live quote: $0.00000521, change 0.58%, 50-day avg $0.00, 200-day avg $0.00.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### DOT (DOT/USD)
- Live quote: $1.05356, change 1.26%, 50-day avg $0.86, 200-day avg $1.10.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### SKY (SKY/USD)
- Live quote: $0.062281, change 1.24%, 50-day avg $0.06, 200-day avg $0.07.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### LTC (LTC/USD)
- Live quote: $53.8675, change 1.12%, 50-day avg $48.21, 200-day avg $50.43.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.
```
