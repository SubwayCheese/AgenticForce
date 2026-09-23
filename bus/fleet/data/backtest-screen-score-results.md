# Screen-score historical backtest

Generated: 2026-09-12T00:04:20.522Z

## Verdict

**INCONCLUSIVE — no demonstrated consistent historical edge**

The required pattern was not present across all 5-, 10-, and 20-day horizons: a positive excess return versus both the full universe and SPY, with majority-of-date consistency. Treat this as no validated edge, not as evidence that the hand-tuned screen is a trading force.

## Results

| Forward horizon | Signal dates | Top-15 average return | Full 50-stock universe average | Top-15 minus universe | SPY return | Top-15 minus SPY | Dates top-15 beat universe | Dates top-15 beat SPY | Dates top-15 beat both |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
5 trading days | 252 | +0.58% | +0.39% | +0.20% | +0.37% | +0.21% | 54.76% | 53.57% | 44.84%
10 trading days | 252 | +1.29% | +0.77% | +0.52% | +0.74% | +0.55% | 59.92% | 57.94% | 54.37%
20 trading days | 252 | +2.45% | +1.55% | +0.90% | +1.44% | +1.01% | 61.11% | 61.11% | 55.56%

The full-universe equal-weight average is the expected return of a random equal-weight 15-stock draw from this fixed universe on a given date, so the top-15-minus-universe column is the relevant selection-edge comparison.

### Descriptive paired 95% intervals for excess return

| Forward horizon | Top-15 minus universe | Top-15 minus SPY |
|---|---:|---:|
5 trading days | +0.01% to +0.39% | +0.02% to +0.40%
10 trading days | +0.24% to +0.79% | +0.28% to +0.82%
20 trading days | +0.46% to +1.34% | +0.57% to +1.45%

These intervals are deliberately labeled descriptive: adjacent daily observations overlap (especially at 10 and 20 days), so they are not a clean independent-trials significance test.

## Methodology actually used

- Universe: the 50-symbol equity list in `bus/scripts/fleet-universe.json`; no symbols were added or removed.
- Data: real daily OHLCV bars fetched at run time from Alpaca's free IEX equity feed through the existing `alpaca.getDailyBars()` client. The fetched common calendar contained 365 dates (2025-03-31 through 2026-09-11); per-symbol raw bar counts ranged from 365 to 365. SPY was fetched separately through the same client as the benchmark.
- Replay: every trading day in the last 252 eligible common dates (2025-08-13 through 2026-08-13), not a weekly sample. Each date forms exactly 15 candidates from all 50 symbols.
- Signal inputs available at each signal close only: `chgPct = (close[t] - close[t-1]) / close[t-1]` and `avgVolume = mean(volume[t-19]...volume[t])`. No bar after the signal date is supplied to `computeScreenScore()`.
- Formula: the script imports and calls the exported `computeScreenScore` from `generate-pilot-tasks.js`; it does not reproduce the formula locally.
- Returns: equal-weight close-to-close return from the signal-date close to the close 5, 10, 20 trading days later. The same start/end dates are used for the shortlist, full universe, and SPY.

## Market-cap applicability

Finnhub configured at run time: **no**. This backtest uses `marketCap: 0` for every historical candidate because no point-in-time historical market-cap series is available through the configured data path. This matches the current live fallback exactly: when every value in a field is equal, the live function uses `max === min ? 0`, so the market-cap term contributes 0 points.

With a flat market-cap field, the implemented score remains `50 * norm(chgPct) + 30 * norm(avgVolume) + 20 * 0`: its maximum is 80, and its active relative weights are 62.5% daily change and 37.5% 20-day average volume. It is not a validated 50/30/20 fundamental-momentum screen today.

## Important limits

- This is a historical screen-signal test, not a fully executable portfolio simulation: it does not model next-open fills, bid/ask spreads, slippage, commissions, capacity, position sizing, exits, or turnover. Because the signal uses the day’s close, same-close returns can be modestly optimistic for an after-close screen.
- The 50-symbol universe is today’s fixed list applied backward, which creates survivorship/selection bias. A positive result would therefore need a stricter out-of-sample and point-in-time-universe test before use; a weak or negative result remains a real warning.
- Results use Alpaca bars as returned by the existing client. No price history, fundamentals, or returns were fabricated.
