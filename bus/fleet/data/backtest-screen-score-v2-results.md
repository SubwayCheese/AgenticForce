# Screen-score historical backtest v2

Generated: 2026-09-18T15:00:11.993Z

## Direct verdict

**NO — neither asset class has statistically defensible, cost-surviving edge in this backtest**

Neither asset class clears the predeclared all-horizons test: every 5-, 10-, and 20-day non-overlapping sample must have a cost-adjusted paired 95% interval above zero against both the full universe and its benchmark. Some gross or daily-correlated figures can be positive without meeting that standard; they are not enough to call the score an edge.

The formal pass rule was fixed before reading the results: an asset class must have all three non-overlapping, cost-adjusted paired 95% intervals entirely above zero versus both its full-universe equal-weight comparator and its benchmark. Daily rows are retained for density and comparison with v1, but are not used for the verdict because their forward windows overlap.

## Equities

- Universe: 50 current symbols from `bus/scripts/fleet-universe.json`; top 15 selected each signal.
- Common calendar: 366 dates (2025-04-04 through 2026-09-18). Raw bars per universe member: 366–366. The replay uses 252 eligible signals from 2025-08-20 through 2026-08-20.
- Benchmark: SPY. Estimated active-shortlist round-trip cost: 0.20% (imported from `performance-scorecard.js`).

| Sampling | Forward horizon | Trials | Top shortlist, gross | Top shortlist, cost-adjusted | Full-universe average | Benchmark | Gross excess vs universe | Cost-adjusted excess vs universe | Gross excess vs benchmark | Cost-adjusted excess vs benchmark | Cost-adjusted beat both |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
Daily (overlapping; descriptive) | 5 trading days | 252 | +0.58% | +0.38% | +0.39% | +0.37% | +0.19% | -0.01% | +0.21% | +0.01% | 40.08%
Daily (overlapping; descriptive) | 10 trading days | 252 | +1.28% | +1.08% | +0.76% | +0.73% | +0.52% | +0.32% | +0.55% | +0.35% | 51.59%
Daily (overlapping; descriptive) | 20 trading days | 252 | +2.40% | +2.20% | +1.48% | +1.36% | +0.92% | +0.72% | +1.04% | +0.84% | 54.76%
Every horizon (non-overlapping) | 5 trading days | 51 | +0.42% | +0.22% | +0.39% | +0.38% | +0.02% | -0.18% | +0.04% | -0.16% | 37.25%
Every horizon (non-overlapping) | 10 trading days | 26 | +1.64% | +1.44% | +0.76% | +0.72% | +0.87% | +0.67% | +0.91% | +0.71% | 53.85%
Every horizon (non-overlapping) | 20 trading days | 13 | +2.92% | +2.72% | +1.60% | +1.45% | +1.31% | +1.11% | +1.47% | +1.27% | 38.46%

Cost-adjusted shortlist return and excess subtract the full estimated round-trip cost from the active screened portfolio. The full-universe and benchmark columns remain price-only passive comparisons, so this is the deliberately conservative question: does the selected portfolio still earn more after its implementation cost?

### Non-overlapping statistical read — cost-adjusted excess

Against the full equity universe:

| Forward horizon | Independent trials | Paired 95% t interval | Trials above zero |
|---|---:|---:|---:|
5 trading days | 51 | -0.59% to +0.24% | 47.06%
10 trading days | 26 | -0.35% to +1.70% | 61.54%
20 trading days | 13 | -2.16% to +4.39% | 46.15%

Against SPY:

| Forward horizon | Independent trials | Paired 95% t interval | Trials above zero |
|---|---:|---:|---:|
5 trading days | 51 | -0.59% to +0.27% | 47.06%
10 trading days | 26 | -0.39% to +1.81% | 61.54%
20 trading days | 13 | -2.04% to +4.58% | 46.15%

The every-horizon rows start at the first replay signal and take every 5th, 10th, or 20th common date, respectively. No phase was selected after seeing returns. These windows do not mechanically share forward days; Student-t intervals are used because the 20-day test has only 13 trials. They are cleaner than daily windows, but still not a guarantee that financial-market observations are IID across regimes. Caveat not yet addressed: unlike backtest-parameter-search.js's fixed-split design (ARCHITECTURE.md section 17), this run's own signal window is a trailing window that slides forward roughly one trading day per calendar day, so which dates land at each sampled phase also shifts daily -- a change in this "Direct verdict" from one day to the next can partly reflect that phase shift, not only genuinely new evidence.

## Crypto

- Universe: 32 current symbols from `bus/scripts/crypto-universe.json`; top 10 selected each signal.
- Common calendar: 212 dates (2026-02-19 through 2026-09-18). Raw bars per universe member: 212–533. The replay uses 173 eligible signals from 2026-03-10 through 2026-08-29.
- Benchmark: BTC. Estimated active-shortlist round-trip cost: 0.05% (imported from `performance-scorecard.js`).

| Sampling | Forward horizon | Trials | Top shortlist, gross | Top shortlist, cost-adjusted | Full-universe average | Benchmark | Gross excess vs universe | Cost-adjusted excess vs universe | Gross excess vs benchmark | Cost-adjusted excess vs benchmark | Cost-adjusted beat both |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
Daily (overlapping; descriptive) | 5 calendar days (24/7) | 173 | +0.30% | +0.25% | +0.20% | +0.44% | +0.10% | +0.05% | -0.14% | -0.19% | 34.10%
Daily (overlapping; descriptive) | 10 calendar days (24/7) | 173 | +0.42% | +0.37% | +0.47% | +0.87% | -0.04% | -0.09% | -0.44% | -0.49% | 28.32%
Daily (overlapping; descriptive) | 20 calendar days (24/7) | 173 | +0.72% | +0.67% | +1.03% | +1.84% | -0.30% | -0.35% | -1.12% | -1.17% | 25.43%
Every horizon (non-overlapping) | 5 calendar days (24/7) | 35 | +0.38% | +0.33% | +0.24% | +0.41% | +0.13% | +0.08% | -0.04% | -0.09% | 37.14%
Every horizon (non-overlapping) | 10 calendar days (24/7) | 18 | +2.09% | +2.04% | +1.14% | +1.04% | +0.95% | +0.90% | +1.05% | +1.00% | 33.33%
Every horizon (non-overlapping) | 20 calendar days (24/7) | 9 | +3.54% | +3.49% | +2.44% | +2.12% | +1.10% | +1.05% | +1.42% | +1.37% | 44.44%

Cost-adjusted shortlist return and excess subtract the full estimated round-trip cost from the active screened portfolio. The full-universe and benchmark columns remain price-only passive comparisons, so this is the deliberately conservative question: does the selected portfolio still earn more after its implementation cost?

### Non-overlapping statistical read — cost-adjusted excess

Against the full crypto universe:

| Forward horizon | Independent trials | Paired 95% t interval | Trials above zero |
|---|---:|---:|---:|
5 calendar days (24/7) | 35 | -0.45% to +0.62% | 54.29%
10 calendar days (24/7) | 18 | -0.41% to +2.22% | 61.11%
20 calendar days (24/7) | 9 | -0.98% to +3.09% | 55.56%

Against BTC:

| Forward horizon | Independent trials | Paired 95% t interval | Trials above zero |
|---|---:|---:|---:|
5 calendar days (24/7) | 35 | -1.57% to +1.40% | 48.57%
10 calendar days (24/7) | 18 | -1.29% to +3.28% | 50.00%
20 calendar days (24/7) | 9 | -4.83% to +7.57% | 55.56%

The every-horizon rows start at the first replay signal and take every 5th, 10th, or 20th common date, respectively. No phase was selected after seeing returns. These windows do not mechanically share forward days; Student-t intervals are used because the 20-day test has only 13 trials. They are cleaner than daily windows, but still not a guarantee that financial-market observations are IID across regimes. Caveat not yet addressed: unlike backtest-parameter-search.js's fixed-split design (ARCHITECTURE.md section 17), this run's own signal window is a trailing window that slides forward roughly one trading day per calendar day, so which dates land at each sampled phase also shifts daily -- a change in this "Direct verdict" from one day to the next can partly reflect that phase shift, not only genuinely new evidence.

## Methodology retained from v1 and extended here

- Formula fidelity: imports and calls the exported `computeScreenScore()` from `generate-pilot-tasks.js`; no local copy of the formula exists in this script. At each signal close, the candidate has only that date's daily change and the trailing 20-date average volume. No later bar is passed to the scorer.
- Data fidelity: each asset class is fetched at run time in Alpaca batches through the existing `alpaca.getDailyBars()` client—the same function used by the live equity and crypto data snapshots. Returns are equal-weight close-to-close from the signal close to the close 5, 10, 20 dates later.
- The current system has no point-in-time historical market-cap series. Every replay candidate therefore receives `marketCap: 0`, deliberately invoking the live scorer’s equal-field behavior that makes the market-cap component zero rather than inventing a history. Both asset classes are thus testing the active 50×normalized daily change + 30×normalized trailing volume behavior.
- Cost source: `ESTIMATED_ROUND_TRIP_COST_PCT` is imported from `performance-scorecard.js`: 0.20% for equities and 0.05% for crypto. These are stated estimates for spread plus fees, not observed fills.

## Survivorship and selection-bias caveat — quantified, not solved

- Equity: the fixed 50-symbol list is today’s hand-selected, mostly large-cap universe applied backward. At least 44/50 are companies whose current listed identity was public for 20 or more years by the end of this sample. The six shorter-current-identity exceptions are TSLA (2010), META (2012), V (2008), ABBV (2013), COP (2012 spin-off), and AVGO (2009). None is a historical small-cap delisting candidate, so this is less severe than a micro-cap survivor screen—but it remains material selection bias because a 2025 historical process would not necessarily have chosen this exact, current set of winners and incumbents.
- Crypto: the 32-coin file was refreshed from Alpaca’s currently tradable USD universe on 2026-09-11, not reconstructed point-in-time. It includes at least eight clearly recent/current-cycle names (ARB, BONK, HYPE, ONDO, PEPE, SKY, TRUMP, and WIF) alongside established BTC/ETH/LTC/XRP. A historical eligible universe would contain delisted, unavailable, and then-unknown coins; crypto survivorship/listing bias is consequently more acute than the equity caveat.
- No point-in-time universe membership data exists in this system, so v2 does not claim to correct either bias. A positive result would still require that data and an out-of-sample period before deployment.

## Limits that remain

- Signals use the day’s close and returns begin at that same close; an after-close screen may not receive that exact fill. The estimated cost does not fully model next-open gaps, bid/ask variation by symbol, slippage, liquidity/capacity, position sizing, rebalancing turnover, taxes, or borrow constraints.
- Crypto trades 24/7, so it does not inherit the equity market-closure calendar gap. Its common calendar still requires a real bar for every current universe coin and BTC on each retained date.
- This report contains only values fetched from Alpaca during this run and deterministic transformations of those values. No historical price, market cap, or return was fabricated.
