#!/usr/bin/env node
// Historical walk-forward backtest of the LIVE equity screen score.
//
// This intentionally imports computeScreenScore() from generate-pilot-tasks.js
// rather than recreating it.  If the live scoring function changes, a future
// backtest run exercises that exact implementation too.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');
const finnhub = require('./finnhub-client.js');
const { computeScreenScore } = require('./generate-pilot-tasks.js');

const UNIVERSE_PATH = avPaths.fleetData('fleet-universe.json');
const REPORT_PATH = avPaths.fleetData('backtest-screen-score-results.md');
const SHORTLIST_SIZE = 15;
const LOOKBACK_DAYS = 20;
const HORIZONS = [5, 10, 20];
const TARGET_SIGNAL_DAYS = 252;

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdDev(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1));
}

function formatPct(value, digits = 2) {
  if (!Number.isFinite(value)) return 'n/a';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}%`;
}

function formatPctPlain(value, digits = 2) {
  if (!Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
}

function dateForBar(bar) {
  return String(bar.t).slice(0, 10);
}

function closeByDate(entry) {
  const result = new Map();
  for (const bar of entry.bars || []) {
    const close = Number(bar.c);
    if (Number.isFinite(close) && close > 0) result.set(dateForBar(bar), close);
  }
  return result;
}

function barsByDate(entry) {
  const result = new Map();
  for (const bar of entry.bars || []) {
    const close = Number(bar.c);
    const volume = Number(bar.v);
    if (Number.isFinite(close) && close > 0 && Number.isFinite(volume) && volume >= 0) {
      result.set(dateForBar(bar), { close, volume });
    }
  }
  return result;
}

function summarizePaired(values) {
  const average = mean(values);
  const standardError = sampleStdDev(values) / Math.sqrt(values.length);
  return {
    mean: average,
    winRate: values.filter((value) => value > 0).length / values.length,
    // This interval treats overlapping daily forward returns as independent.
    // It is reported as a descriptive check, not a formal significance claim.
    naiveCiLow: average - (1.96 * standardError),
    naiveCiHigh: average + (1.96 * standardError),
  };
}

function metricForHorizon(observations, horizon) {
  const shortlistReturns = observations.map((row) => row.horizons[horizon].shortlistReturn);
  const universeReturns = observations.map((row) => row.horizons[horizon].universeReturn);
  const spyReturns = observations.map((row) => row.horizons[horizon].spyReturn);
  const vsUniverse = observations.map((row) => row.horizons[horizon].shortlistReturn - row.horizons[horizon].universeReturn);
  const vsSpy = observations.map((row) => row.horizons[horizon].shortlistReturn - row.horizons[horizon].spyReturn);
  const beatBoth = observations.filter((row) => (
    row.horizons[horizon].shortlistReturn > row.horizons[horizon].universeReturn
    && row.horizons[horizon].shortlistReturn > row.horizons[horizon].spyReturn
  )).length / observations.length;
  return {
    horizon,
    shortlist: mean(shortlistReturns),
    universe: mean(universeReturns),
    spy: mean(spyReturns),
    vsUniverse: summarizePaired(vsUniverse),
    vsSpy: summarizePaired(vsSpy),
    beatBoth,
  };
}

function makeVerdict(metrics) {
  const clearPositive = metrics.every((metric) => (
    metric.vsUniverse.mean > 0
    && metric.vsSpy.mean > 0
    && metric.vsUniverse.winRate > 0.5
    && metric.vsSpy.winRate > 0.5
    && metric.beatBoth > 0.5
    && metric.vsUniverse.naiveCiLow > 0
    && metric.vsSpy.naiveCiLow > 0
  ));
  if (clearPositive) {
    return {
      label: 'YES — demonstrated positive historical screen edge in this sample',
      explanation: 'The shortlist beat both the random-universe baseline and SPY at every tested horizon, did so on a majority of signal dates, and its descriptive paired intervals stayed positive. This is evidence for a screen edge, not proof of an executable trading strategy because fills, costs, and survivorship are not modeled.',
    };
  }

  const consistentlyNegative = metrics.every((metric) => (
    metric.vsUniverse.mean < 0 && metric.vsUniverse.winRate < 0.5
  ));
  if (consistentlyNegative) {
    return {
      label: 'NO — negative historical screen edge in this sample',
      explanation: 'The shortlist lagged the full-universe (random-selection expectation) average at every tested horizon and lost on a majority of signal dates. The current screen did not show an investable historical selection edge here.',
    };
  }

  return {
    label: 'INCONCLUSIVE — no demonstrated consistent historical edge',
    explanation: 'The required pattern was not present across all 5-, 10-, and 20-day horizons: a positive excess return versus both the full universe and SPY, with majority-of-date consistency. Treat this as no validated edge, not as evidence that the hand-tuned screen is a trading force.',
  };
}

function markdownReport({ universe, commonDates, signalDates, metrics, verdict, minBars, maxBars, finnhubConfigured }) {
  const rows = metrics.map((metric) => [
    `${metric.horizon} trading days`,
    String(signalDates.length),
    formatPct(metric.shortlist),
    formatPct(metric.universe),
    formatPct(metric.vsUniverse.mean),
    formatPct(metric.spy),
    formatPct(metric.vsSpy.mean),
    formatPctPlain(metric.vsUniverse.winRate),
    formatPctPlain(metric.vsSpy.winRate),
    formatPctPlain(metric.beatBoth),
  ].join(' | ')).join('\n');
  const intervalRows = metrics.map((metric) => [
    `${metric.horizon} trading days`,
    `${formatPct(metric.vsUniverse.naiveCiLow)} to ${formatPct(metric.vsUniverse.naiveCiHigh)}`,
    `${formatPct(metric.vsSpy.naiveCiLow)} to ${formatPct(metric.vsSpy.naiveCiHigh)}`,
  ].join(' | ')).join('\n');
  const generatedAt = new Date().toISOString();

  return [
    '# Screen-score historical backtest',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Verdict',
    '',
    `**${verdict.label}**`,
    '',
    verdict.explanation,
    '',
    '## Results',
    '',
    '| Forward horizon | Signal dates | Top-15 average return | Full 50-stock universe average | Top-15 minus universe | SPY return | Top-15 minus SPY | Dates top-15 beat universe | Dates top-15 beat SPY | Dates top-15 beat both |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    rows,
    '',
    'The full-universe equal-weight average is the expected return of a random equal-weight 15-stock draw from this fixed universe on a given date, so the top-15-minus-universe column is the relevant selection-edge comparison.',
    '',
    '### Descriptive paired 95% intervals for excess return',
    '',
    '| Forward horizon | Top-15 minus universe | Top-15 minus SPY |',
    '|---|---:|---:|',
    intervalRows,
    '',
    'These intervals are deliberately labeled descriptive: adjacent daily observations overlap (especially at 10 and 20 days), so they are not a clean independent-trials significance test.',
    '',
    '## Methodology actually used',
    '',
    `- Universe: the ${universe.length}-symbol equity list in \`bus/fleet/data/fleet-universe.json\`; no symbols were added or removed.`,
    `- Data: real daily OHLCV bars fetched at run time from Alpaca's free IEX equity feed through the existing \`alpaca.getDailyBars()\` client. The fetched common calendar contained ${commonDates.length} dates (${commonDates[0]} through ${commonDates[commonDates.length - 1]}); per-symbol raw bar counts ranged from ${minBars} to ${maxBars}. SPY was fetched separately through the same client as the benchmark.`,
    `- Replay: every trading day in the last ${signalDates.length} eligible common dates (${signalDates[0]} through ${signalDates[signalDates.length - 1]}), not a weekly sample. Each date forms exactly ${SHORTLIST_SIZE} candidates from all ${universe.length} symbols.`,
    `- Signal inputs available at each signal close only: \`chgPct = (close[t] - close[t-1]) / close[t-1]\` and \`avgVolume = mean(volume[t-19]...volume[t])\`. No bar after the signal date is supplied to \`computeScreenScore()\`.`,
    '- Formula: the script imports and calls the exported `computeScreenScore` from `generate-pilot-tasks.js`; it does not reproduce the formula locally.',
    `- Returns: equal-weight close-to-close return from the signal-date close to the close ${HORIZONS.join(', ')} trading days later. The same start/end dates are used for the shortlist, full universe, and SPY.`,
    '',
    '## Market-cap applicability',
    '',
    `Finnhub configured at run time: **${finnhubConfigured ? 'yes' : 'no'}**. This backtest uses \`marketCap: 0\` for every historical candidate because no point-in-time historical market-cap series is available through the configured data path. ${finnhubConfigured ? 'Because Finnhub is now configured, this flat-cap replay no longer fully represents the live equity screen; do not interpret it as a backtest of a market-cap-enabled live configuration.' : 'This matches the current live fallback exactly: when every value in a field is equal, the live function uses `max === min ? 0`, so the market-cap term contributes 0 points.'}`,
    '',
    'With a flat market-cap field, the implemented score remains `50 * norm(chgPct) + 30 * norm(avgVolume) + 20 * 0`: its maximum is 80, and its active relative weights are 62.5% daily change and 37.5% 20-day average volume. It is not a validated 50/30/20 fundamental-momentum screen today.',
    '',
    '## Important limits',
    '',
    '- This is a historical screen-signal test, not a fully executable portfolio simulation: it does not model next-open fills, bid/ask spreads, slippage, commissions, capacity, position sizing, exits, or turnover. Because the signal uses the day’s close, same-close returns can be modestly optimistic for an after-close screen.',
    '- The 50-symbol universe is today’s fixed list applied backward, which creates survivorship/selection bias. A positive result would therefore need a stricter out-of-sample and point-in-time-universe test before use; a weak or negative result remains a real warning.',
    '- Results use Alpaca bars as returned by the existing client. No price history, fundamentals, or returns were fabricated.',
    '',
  ].join('\n');
}

async function main() {
  const universe = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8')).symbols;
  if (!Array.isArray(universe) || universe.length !== 50) {
    throw new Error(`Expected exactly 50 equity symbols in ${UNIVERSE_PATH}; found ${universe && universe.length}.`);
  }

  // getDailyBars calculates its own safely overlong calendar start. This
  // request leaves enough pre-signal history and 20 subsequent trading days
  // while the selected replay itself is constrained to 252 signal sessions.
  const fetchLimit = TARGET_SIGNAL_DAYS + LOOKBACK_DAYS + Math.max(...HORIZONS) + 40;
  const [barsBySymbol, spyBarsResult] = await Promise.all([
    alpaca.getDailyBars(universe, { limit: fetchLimit }),
    alpaca.getDailyBars(['SPY'], { limit: fetchLimit }),
  ]);
  const spyEntry = spyBarsResult.SPY;
  if (!spyEntry) throw new Error('Alpaca returned no daily bars for SPY.');

  const symbolBars = new Map();
  for (const symbol of universe) {
    const entry = barsBySymbol[symbol];
    if (!entry || !entry.bars || !entry.bars.length) {
      throw new Error(`Alpaca returned no daily bars for required universe symbol ${symbol}.`);
    }
    symbolBars.set(symbol, barsByDate(entry));
  }
  const spyCloses = closeByDate(spyEntry);
  const firstSymbolDates = Array.from(symbolBars.get(universe[0]).keys());
  const commonDates = firstSymbolDates
    .filter((date) => spyCloses.has(date) && universe.every((symbol) => symbolBars.get(symbol).has(date)))
    .sort();
  const maxHorizon = Math.max(...HORIZONS);
  const firstEligibleIndex = LOOKBACK_DAYS - 1;
  const lastEligibleIndex = commonDates.length - 1 - maxHorizon;
  if (lastEligibleIndex < firstEligibleIndex) {
    throw new Error(`Insufficient common history: need ${LOOKBACK_DAYS} lookback days and ${maxHorizon} forward days, found ${commonDates.length} common dates.`);
  }
  const eligibleDates = commonDates.slice(firstEligibleIndex, lastEligibleIndex + 1);
  const signalDates = eligibleDates.slice(-TARGET_SIGNAL_DAYS);
  if (signalDates.length < 100) {
    throw new Error(`Only ${signalDates.length} eligible signal dates were available; refusing to label that a meaningful historical backtest.`);
  }

  // The live system currently has no FINNHUB_API_KEY.  Setting each field to
  // zero is therefore its actual deployed behavior, and the imported live
  // norm() intentionally makes that term contribute zero rather than inventing
  // market caps. If credentials are added, the report flags that this remains
  // a flat-cap historical replay until point-in-time cap data is available.
  const finnhubConfigured = finnhub.hasCredentials();
  const observations = [];
  for (const signalDate of signalDates) {
    const signalIndex = commonDates.indexOf(signalDate);
    const lookbackDates = commonDates.slice(signalIndex - LOOKBACK_DAYS + 1, signalIndex + 1);
    const candidates = universe.map((symbol) => {
      const byDate = symbolBars.get(symbol);
      const today = byDate.get(signalDate);
      const previous = byDate.get(commonDates[signalIndex - 1]);
      const avgVolume = mean(lookbackDates.map((date) => byDate.get(date).volume));
      return {
        symbol,
        chgPct: ((today.close - previous.close) / previous.close) * 100,
        avgVolume,
        marketCap: 0,
      };
    });
    const ranked = computeScreenScore(candidates);
    if (ranked.length !== universe.length) {
      throw new Error(`Live computeScreenScore returned ${ranked.length} candidates on ${signalDate}; expected ${universe.length}.`);
    }
    const shortlist = ranked.slice(0, SHORTLIST_SIZE).map((candidate) => candidate.symbol);
    const horizons = {};
    for (const horizon of HORIZONS) {
      const forwardDate = commonDates[signalIndex + horizon];
      const universeReturns = universe.map((symbol) => {
        const byDate = symbolBars.get(symbol);
        return (byDate.get(forwardDate).close / byDate.get(signalDate).close) - 1;
      });
      const shortlistReturns = shortlist.map((symbol) => {
        const byDate = symbolBars.get(symbol);
        return (byDate.get(forwardDate).close / byDate.get(signalDate).close) - 1;
      });
      horizons[horizon] = {
        shortlistReturn: mean(shortlistReturns),
        universeReturn: mean(universeReturns),
        spyReturn: (spyCloses.get(forwardDate) / spyCloses.get(signalDate)) - 1,
      };
    }
    observations.push({ signalDate, shortlist, horizons });
  }

  const metrics = HORIZONS.map((horizon) => metricForHorizon(observations, horizon));
  const verdict = makeVerdict(metrics);
  const barCounts = universe.map((symbol) => barsBySymbol[symbol].bars.length);
  const report = markdownReport({
    universe,
    commonDates,
    signalDates,
    metrics,
    verdict,
    minBars: Math.min(...barCounts),
    maxBars: Math.max(...barCounts),
    finnhubConfigured,
  });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log('Screen-score backtest completed with real Alpaca daily bars.');
  console.log(`Common calendar: ${commonDates[0]} through ${commonDates[commonDates.length - 1]} (${commonDates.length} dates).`);
  console.log(`Replay: ${signalDates.length} daily signals from ${signalDates[0]} through ${signalDates[signalDates.length - 1]}; top ${SHORTLIST_SIZE} of ${universe.length}.`);
  for (const metric of metrics) {
    console.log(
      `${metric.horizon}d: shortlist ${formatPct(metric.shortlist)}, universe ${formatPct(metric.universe)}, `
      + `SPY ${formatPct(metric.spy)}, vs universe ${formatPct(metric.vsUniverse.mean)}, vs SPY ${formatPct(metric.vsSpy.mean)}, `
      + `beat both ${formatPctPlain(metric.beatBoth)}.`,
    );
  }
  console.log(`VERDICT: ${verdict.label}`);
  console.log(`Report written: ${REPORT_PATH}`);
}

main().catch((error) => {
  const cause = error && error.cause && error.cause.message ? ` (${error.cause.message})` : '';
  console.error(`Screen-score backtest failed: ${error.message}${cause}`);
  process.exitCode = 1;
});
