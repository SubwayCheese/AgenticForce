## crypto_pilot_20260913_universe_consolidation
from: claude
to: claude
type: response
status: done
payload: (orchestrator-sourced, unattended -- see generate-pilot-tasks.js)
timestamp: 2026-09-13T03:21:33.700Z

## Result (auto)
resolved_at: 2026-09-13T03:21:33.701Z
output:
```
SOURCE: verified live (Alpaca market-data API, fetched by generate-pilot-tasks.js -- unattended)
As of: 2026-09-13T03:21:33.701Z

Unattended screen, 32-coin real tradable-on-Alpaca universe (bus/scripts/crypto-universe.json), price/volume from Alpaca's free market-data API (batched daily bars, same paper-account key already configured -- no new credential). Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) (market-cap term omitted -- no free crypto market-cap source wired up, see generate-pilot-tasks.js). Top 10 become this cycle's shortlist.

| Rank | Coin | Price | Chg% | Volume (20d avg) | screenScore |
|---|---|---|---|---|---|
| 1 | BAT | $0.07870775 | 7.64% | 3,138 | 50.0 |
| 2 | PEPE | $0.000003455 | 1.02% | 323,122,269 | 40.8 |
| 3 | GRT | $0.01881165 | 3.36% | 204,232 | 24.6 |
| 4 | BONK | $0.00000279 | 0.36% | 106,819,663 | 16.7 |
| 5 | SHIB | $0.00000528 | -0.19% | 138,548,191 | 16.4 |
| 6 | AAVE | $127.37 | 1.42% | 49 | 13.1 |
| 7 | CRV | $0.33733 | 1.21% | 9,610 | 11.9 |
| 8 | XTZ | $0.2685885 | 0.98% | 1,132 | 10.5 |
| 9 | FIL | $0.80791 | 0.83% | 736 | 9.6 |
| 10 | YFI | $2211.62 | 0.58% | 0 | 8.1 |
| 11 | AVAX | $7.41881 | 0.29% | 713 | 6.4 |
| 12 | ARB | $0.140917 | 0.27% | 29,978 | 6.3 |
| 13 | DOGE | $0.0849456 | 0.13% | 58,276 | 5.5 |
| 14 | SOL | $101.881 | 0.11% | 389 | 5.4 |
| 15 | ADA | $0.2074235 | 0.06% | 25,181 | 5.0 |
| 16 | XRP | $1.36655 | 0.02% | 24,387 | 4.8 |
| 17 | SKY | $0.0630119 | 0.00% | 9,558 | 4.7 |
| 18 | BTC | $77260.09 | -0.01% | 2 | 4.6 |
| 19 | LTC | $53.6413 | -0.02% | 265 | 4.6 |
| 20 | UNI | $6.368895 | -0.03% | 2,239 | 4.5 |
| 21 | LINK | $11.5034 | -0.09% | 1,330 | 4.2 |
| 22 | POL | $0.09646465 | -0.09% | 3,137 | 4.2 |
| 23 | ETH | $2519.5425 | -0.22% | 24 | 3.4 |
| 24 | TRUMP | $1.9841 | -0.24% | 297 | 3.3 |
| 25 | RENDER | $1.37832 | -0.27% | 201 | 3.1 |
| 26 | ONDO | $0.34745 | -0.35% | 2,289 | 2.6 |
| 27 | HYPE | $79.3257 | -0.45% | 107 | 2.0 |
| 28 | SUSHI | $0.22379 | -0.48% | 8,178 | 1.8 |
| 29 | LDO | $0.369332 | -0.52% | 643 | 1.6 |
| 30 | WIF | $0.189795 | -0.53% | 3,458 | 1.6 |
| 31 | BCH | $224.958 | -0.65% | 10 | 0.8 |
| 32 | DOT | $1.011055 | -0.79% | 6,909 | 0.0 |

## Shortlist detail
### BAT (BAT/USD)
- Live quote: $0.07870775, change 7.64%, 50-day avg $0.07, 200-day avg $0.09.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### PEPE (PEPE/USD)
- Live quote: $0.000003455, change 1.02%, 50-day avg $0.00, 200-day avg $0.00.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### GRT (GRT/USD)
- Live quote: $0.01881165, change 3.36%, 50-day avg $0.02, 200-day avg $0.02.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### BONK (BONK/USD)
- Live quote: $0.00000279, change 0.36%, 50-day avg $0.00, 200-day avg $0.00.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### SHIB (SHIB/USD)
- Live quote: $0.00000528, change -0.19%, 50-day avg $0.00, 200-day avg $0.00.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### AAVE (AAVE/USD)
- Live quote: $127.37, change 1.42%, 50-day avg $109.26, 200-day avg $97.14.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### CRV (CRV/USD)
- Live quote: $0.33733, change 1.21%, 50-day avg $0.28, 200-day avg $0.24.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### XTZ (XTZ/USD)
- Live quote: $0.2685885, change 0.98%, 50-day avg $0.22, 200-day avg $0.29.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### FIL (FIL/USD)
- Live quote: $0.80791, change 0.83%, 50-day avg $0.73, 200-day avg $0.84.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.

### YFI (YFI/USD)
- Live quote: $2211.62, change 0.58%, 50-day avg $2139.75, 200-day avg $2306.03.
- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.
```
