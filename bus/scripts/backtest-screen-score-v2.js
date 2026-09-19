#!/usr/bin/env node
// Deeper historical walk-forward test of the LIVE screen score.
//
// This intentionally uses the real computeScreenScore() and real batched
// Alpaca getDailyBars() client, rather than reproducing either implementation.
// In addition to v1's dense daily replay, it measures a non-overlapping sample
// for each holding horizon and charges the scorecard's real cost assumptions.

const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');
const { computeScreenScore } = require('./generate-pilot-tasks.js');
const { ESTIMATED_ROUND_TRIP_COST_PCT } = require('./performance-scorecard.js');

const EQUITY_UNIVERSE_PATH = path.join(__dirname, 'fleet-universe.json');
const CRYPTO_UNIVERSE_PATH = path.join(__dirname, 'crypto-universe.json');
const REPORT_PATH = path.join(__dirname, 'backtest-screen-score-v2-results.md');

const LOOKBACK_DAYS = 20;
const HORIZONS = [5, 10, 20];
const TARGET_SIGNAL_DAYS = 252;

const ASSET_CLASSES = [
  {
    key: 'equity',
    label: 'Equities',
    universePath: EQUITY_UNIVERSE_PATH,
    universeKey: 'symbols',
    expectedUniverseSize: 50,
    shortlistSize: 15,
    benchmark: 'SPY',
    benchmarkLabel: 'SPY',
    calendarLabel: 'trading days',
  },
  {
    key: 'crypto',
    label: 'Crypto',
    universePath: CRYPTO_UNIVERSE_PATH,
    universeKey: 'coins',
    expectedUniverseSize: 32,
    shortlistSize: 10,
    benchmark: 'BTC',
    benchmarkLabel: 'BTC',
    calendarLabel: 'calendar days (24/7)',
  },
];

function mean(values) {
  if (!values.length) return NaN;
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

// Two-sided 95% Student-t critical values for df 1 through 30.  The
// non-overlapping 20-day sample has only about 13 trials, so using 1.96 there
// would overstate precision.  For more than 30 trials, the normal limit is a
// sufficiently close conservative approximation for this report.
const T_95 = [
  null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
  2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093,
  2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045,
  2.042,
];

function summarizePaired(values, { independent }) {
  const average = mean(values);
  const n = values.length;
  const standardError = sampleStdDev(values) / Math.sqrt(n);
  const critical = independent ? (T_95[n - 1] || 1.96) : 1.96;
  return {
    mean: average,
    n,
    winRate: values.filter((value) => value > 0).length / n,
    ciLow: average - (critical * standardError),
    ciHigh: average + (critical * standardError),
  };
}

function observationsForSampling(observations, horizon, sampling) {
  if (sampling === 'daily') return observations;
  // One deterministic phase: the first eligible replay date, then exactly one
  // new signal every holding horizon.  The return intervals touch at endpoints
  // but contain no shared forward day.  We do not choose the best phase.
  return observations.filter((_, index) => index % horizon === 0);
}

function metricForHorizon(observations, horizon, costRate, sampling) {
  const sampled = observationsForSampling(observations, horizon, sampling);
  const costAdjustedShortlist = sampled.map((row) => row.horizons[horizon].shortlistReturn - costRate);
  const shortlist = sampled.map((row) => row.horizons[horizon].shortlistReturn);
  const universe = sampled.map((row) => row.horizons[horizon].universeReturn);
  const benchmark = sampled.map((row) => row.horizons[horizon].benchmarkReturn);
  const grossVsUniverse = shortlist.map((value, index) => value - universe[index]);
  const netVsUniverse = costAdjustedShortlist.map((value, index) => value - universe[index]);
  const grossVsBenchmark = shortlist.map((value, index) => value - benchmark[index]);
  const netVsBenchmark = costAdjustedShortlist.map((value, index) => value - benchmark[index]);
  const independent = sampling === 'non-overlapping';
  return {
    horizon,
    sampling,
    trialCount: sampled.length,
    shortlist: mean(shortlist),
    costAdjustedShortlist: mean(costAdjustedShortlist),
    universe: mean(universe),
    benchmark: mean(benchmark),
    grossVsUniverse: summarizePaired(grossVsUniverse, { independent }),
    netVsUniverse: summarizePaired(netVsUniverse, { independent }),
    grossVsBenchmark: summarizePaired(grossVsBenchmark, { independent }),
    netVsBenchmark: summarizePaired(netVsBenchmark, { independent }),
    beatBothGross: sampled.filter((row) => (
      row.horizons[horizon].shortlistReturn > row.horizons[horizon].universeReturn
      && row.horizons[horizon].shortlistReturn > row.horizons[horizon].benchmarkReturn
    )).length / sampled.length,
    beatBothNet: sampled.filter((row) => (
      (row.horizons[horizon].shortlistReturn - costRate) > row.horizons[horizon].universeReturn
      && (row.horizons[horizon].shortlistReturn - costRate) > row.horizons[horizon].benchmarkReturn
    )).length / sampled.length,
  };
}

function assetClassHasDefensibleEdge(assetResult) {
  // Predeclared strict rule: all three independent, cost-adjusted comparisons
  // must be positive against both baselines at the 95% level.  A win in just
  // one horizon is not enough to call this screen an asset-class edge.
  return assetResult.nonOverlappingMetrics.every((metric) => (
    metric.netVsUniverse.ciLow > 0 && metric.netVsBenchmark.ciLow > 0
  ));
}

function assetClassLooksClearlyNegative(assetResult) {
  return assetResult.nonOverlappingMetrics.every((metric) => (
    metric.netVsUniverse.ciHigh < 0 || metric.netVsBenchmark.ciHigh < 0
  ));
}

function directVerdict(results) {
  const defensible = results.filter(assetClassHasDefensibleEdge);
  if (defensible.length === results.length) {
    return {
      label: 'YES — both equities and crypto show cost-surviving, non-overlapping evidence under this strict test',
      explanation: 'For each asset class and every tested horizon, the non-overlapping, cost-adjusted paired 95% intervals are above zero against both its full-universe and benchmark comparisons. This is still a backtest signal rather than proof of live tradability because of survivorship, close-fill, and capacity limits described below.',
    };
  }
  if (defensible.length) {
    return {
      label: `YES for ${defensible.map((result) => result.config.label.toLowerCase()).join(' and ')}; NO such evidence for the other tested asset class`,
      explanation: 'Only the named asset class clears the predeclared requirement at every horizon: positive non-overlapping, cost-adjusted paired 95% intervals against both baselines. The other asset class does not have demonstrated cost-surviving edge in this sample.',
    };
  }
  if (results.every(assetClassLooksClearlyNegative)) {
    return {
      label: 'NO — neither asset class shows a cost-surviving historical screen edge in this sample',
      explanation: 'All tested horizons have a non-overlapping, cost-adjusted interval that remains below zero against at least one required baseline. The current score should not be treated as an investable selector from these results.',
    };
  }
  return {
    label: 'NO — neither asset class has statistically defensible, cost-surviving edge in this backtest',
    explanation: 'Neither asset class clears the predeclared all-horizons test: every 5-, 10-, and 20-day non-overlapping sample must have a cost-adjusted paired 95% interval above zero against both the full universe and its benchmark. Some gross or daily-correlated figures can be positive without meeting that standard; they are not enough to call the score an edge.',
  };
}

// Split 2026-09-13 for the parameter-search "learning" layer
// (bus/scripts/backtest-parameter-search.js / ARCHITECTURE.md section 13):
// fetchAssetClassData() does everything WEIGHT-INDEPENDENT (one real bar
// fetch + date alignment + per-date candidate features), so a grid search
// over many weight combinations can reuse it once instead of re-fetching
// bars per combination. scoreAssetClassData() does everything
// WEIGHT-DEPENDENT (computeScreenScore() -> shortlist -> horizon returns),
// and accepts an optional `signalDatesSubset` -- the hook a train/test
// split uses. replayAssetClass() below is now a thin wrapper calling both
// with the live default weights and the full date range -- verified
// (2026-09-13) to produce byte-identical output to the pre-split version
// (see the refactor-safety diff in that day's session).
// `extraHistoryDays` (added 2026-09-14 for the fixed-split growing-test-
// set redesign, ARCHITECTURE.md section 17): 0 (default) preserves this
// function's exact original fetch size and return shape -- every existing
// caller (replayAssetClass(), the daily CLI verdict) is completely
// unaffected. > 0 requests a much deeper raw history (used by
// backtest-parameter-search.js) and widens the candidate-feature loop
// below to cover the full uncapped `eligibleDates`, not just the
// TARGET_SIGNAL_DAYS-capped `signalDates` -- both are still returned, so
// a caller that only ever wanted `signalDates` sees no difference.
async function fetchAssetClassData(config, extraHistoryDays = 0) {
  const universeDocument = JSON.parse(fs.readFileSync(config.universePath, 'utf8'));
  const universe = universeDocument[config.universeKey];
  if (!Array.isArray(universe) || universe.length !== config.expectedUniverseSize) {
    throw new Error(`Expected ${config.expectedUniverseSize} ${config.key} symbols in ${config.universePath}; found ${universe && universe.length}.`);
  }
  if (!universe.includes(config.benchmark) && config.key === 'equity') {
    // SPY is intentionally external to the stock universe; this branch documents
    // the benchmark fetch below and protects against an accidental bad config.
  }

  // getDailyBars() calculates an overlong calendar start internally.  The
  // requested span provides 20 inputs before every signal and 20 days after it.
  const fetchLimit = Math.max(TARGET_SIGNAL_DAYS, extraHistoryDays) + LOOKBACK_DAYS + Math.max(...HORIZONS) + 40;
  const [barsBySymbol, benchmarkBarsResult] = await Promise.all([
    alpaca.getDailyBars(universe, { limit: fetchLimit }),
    alpaca.getDailyBars([config.benchmark], { limit: fetchLimit }),
  ]);
  const benchmarkEntry = benchmarkBarsResult[config.benchmark];
  if (!benchmarkEntry || !benchmarkEntry.bars || !benchmarkEntry.bars.length) {
    throw new Error(`Alpaca returned no daily bars for ${config.benchmark}.`);
  }

  const symbolBars = new Map();
  for (const symbol of universe) {
    const entry = barsBySymbol[symbol];
    if (!entry || !entry.bars || !entry.bars.length) {
      throw new Error(`Alpaca returned no daily bars for required ${config.key} symbol ${symbol}.`);
    }
    symbolBars.set(symbol, barsByDate(entry));
  }
  const benchmarkByDate = barsByDate(benchmarkEntry);
  const firstSymbolDates = Array.from(symbolBars.get(universe[0]).keys());
  const commonDates = firstSymbolDates
    .filter((date) => benchmarkByDate.has(date) && universe.every((symbol) => symbolBars.get(symbol).has(date)))
    .sort();
  const indexByDate = new Map(commonDates.map((date, index) => [date, index]));
  const maxHorizon = Math.max(...HORIZONS);
  const firstEligibleIndex = LOOKBACK_DAYS - 1;
  const lastEligibleIndex = commonDates.length - 1 - maxHorizon;
  if (lastEligibleIndex < firstEligibleIndex) {
    throw new Error(`Insufficient common ${config.key} history: need ${LOOKBACK_DAYS} lookback days and ${maxHorizon} forward days, found ${commonDates.length} common dates.`);
  }
  const eligibleDates = commonDates.slice(firstEligibleIndex, lastEligibleIndex + 1);
  const signalDates = eligibleDates.slice(-TARGET_SIGNAL_DAYS);
  if (signalDates.length < 100) {
    throw new Error(`Only ${signalDates.length} eligible ${config.key} signal dates were available; refusing to label that meaningful.`);
  }

  // Weight-independent per-date candidate features (chgPct/avgVolume;
  // marketCap forced to 0 -- see the comment this replaces below) and the
  // weight-independent forward returns (universe average, benchmark) --
  // computed once here so scoreAssetClassData() never re-touches raw bars.
  const candidatesBySignalDate = new Map();
  const universeReturnsByDate = new Map();
  const benchmarkReturnByDate = new Map();
  const dateSetForFeatures = extraHistoryDays > 0 ? eligibleDates : signalDates;
  for (const signalDate of dateSetForFeatures) {
    const signalIndex = indexByDate.get(signalDate);
    const lookbackDates = commonDates.slice(signalIndex - LOOKBACK_DAYS + 1, signalIndex + 1);
    const candidates = universe.map((symbol) => {
      const byDate = symbolBars.get(symbol);
      const today = byDate.get(signalDate);
      const previous = byDate.get(commonDates[signalIndex - 1]);
      return {
        symbol,
        chgPct: ((today.close - previous.close) / previous.close) * 100,
        avgVolume: mean(lookbackDates.map((date) => byDate.get(date).volume)),
        // No point-in-time historical market-cap series is in this system. A
        // constant 0 uses the live function's max === min behavior, so the
        // term contributes exactly zero instead of fabricating a history.
        marketCap: 0,
      };
    });
    candidatesBySignalDate.set(signalDate, candidates);

    const horizonsUniverse = {};
    const horizonsBenchmark = {};
    for (const horizon of HORIZONS) {
      const forwardDate = commonDates[signalIndex + horizon];
      horizonsUniverse[horizon] = mean(universe.map((symbol) => {
        const byDate = symbolBars.get(symbol);
        return (byDate.get(forwardDate).close / byDate.get(signalDate).close) - 1;
      }));
      horizonsBenchmark[horizon] = (benchmarkByDate.get(forwardDate).close / benchmarkByDate.get(signalDate).close) - 1;
    }
    universeReturnsByDate.set(signalDate, horizonsUniverse);
    benchmarkReturnByDate.set(signalDate, horizonsBenchmark);
  }

  const costRate = ESTIMATED_ROUND_TRIP_COST_PCT[config.key] / 100;
  if (!Number.isFinite(costRate)) {
    throw new Error(`No scorecard round-trip cost configured for ${config.key}.`);
  }
  const rawBarCounts = universe.map((symbol) => barsBySymbol[symbol].bars.length);

  return {
    config,
    universe,
    symbolBars,
    commonDates,
    indexByDate,
    signalDates,
    eligibleDates,
    candidatesBySignalDate,
    universeReturnsByDate,
    benchmarkReturnByDate,
    costRate,
    minBars: Math.min(...rawBarCounts),
    maxBars: Math.max(...rawBarCounts),
  };
}

// Weight-dependent replay over `data` (from fetchAssetClassData()).
// `signalDatesSubset`, if given, restricts the replay to those dates only
// (chronological order preserved) -- the train/test split hook.
function scoreAssetClassData(data, weights, signalDatesSubset) {
  const { config, universe, symbolBars, signalDates: allSignalDates, candidatesBySignalDate, universeReturnsByDate, benchmarkReturnByDate, costRate } = data;
  const signalDates = signalDatesSubset || allSignalDates;

  const observations = [];
  for (const signalDate of signalDates) {
    const candidates = candidatesBySignalDate.get(signalDate);
    const ranked = computeScreenScore(candidates, weights);
    if (ranked.length !== universe.length) {
      throw new Error(`Live computeScreenScore returned ${ranked.length} ${config.key} candidates on ${signalDate}; expected ${universe.length}.`);
    }
    const shortlist = ranked.slice(0, config.shortlistSize).map((candidate) => candidate.symbol);
    const signalIndex = data.indexByDate.get(signalDate);
    const horizons = {};
    for (const horizon of HORIZONS) {
      const forwardDate = data.commonDates[signalIndex + horizon];
      const shortlistReturns = shortlist.map((symbol) => {
        const byDate = symbolBars.get(symbol);
        return (byDate.get(forwardDate).close / byDate.get(signalDate).close) - 1;
      });
      horizons[horizon] = {
        shortlistReturn: mean(shortlistReturns),
        universeReturn: universeReturnsByDate.get(signalDate)[horizon],
        benchmarkReturn: benchmarkReturnByDate.get(signalDate)[horizon],
      };
    }
    observations.push({ signalDate, shortlist, horizons });
  }

  const dailyMetrics = HORIZONS.map((horizon) => metricForHorizon(observations, horizon, costRate, 'daily'));
  const nonOverlappingMetrics = HORIZONS.map((horizon) => metricForHorizon(observations, horizon, costRate, 'non-overlapping'));
  return {
    config,
    universe,
    commonDates: data.commonDates,
    signalDates,
    costRate,
    dailyMetrics,
    nonOverlappingMetrics,
    minBars: data.minBars,
    maxBars: data.maxBars,
  };
}

async function replayAssetClass(config) {
  const data = await fetchAssetClassData(config);
  return scoreAssetClassData(data, undefined, undefined);
}

function resultRows(assetResult) {
  const rows = [];
  for (const [label, metrics] of [
    ['Daily (overlapping; descriptive)', assetResult.dailyMetrics],
    ['Every horizon (non-overlapping)', assetResult.nonOverlappingMetrics],
  ]) {
    for (const metric of metrics) {
      rows.push([
        label,
        `${metric.horizon} ${assetResult.config.calendarLabel}`,
        String(metric.trialCount),
        formatPct(metric.shortlist),
        formatPct(metric.costAdjustedShortlist),
        formatPct(metric.universe),
        formatPct(metric.benchmark),
        formatPct(metric.grossVsUniverse.mean),
        formatPct(metric.netVsUniverse.mean),
        formatPct(metric.grossVsBenchmark.mean),
        formatPct(metric.netVsBenchmark.mean),
        formatPctPlain(metric.beatBothNet),
      ].join(' | '));
    }
  }
  return rows.join('\n');
}

function intervalRows(assetResult, metricKey) {
  return assetResult.nonOverlappingMetrics.map((metric) => [
    `${metric.horizon} ${assetResult.config.calendarLabel}`,
    String(metric.trialCount),
    `${formatPct(metric[metricKey].ciLow)} to ${formatPct(metric[metricKey].ciHigh)}`,
    formatPctPlain(metric[metricKey].winRate),
  ].join(' | ')).join('\n');
}

function markdownReport(results, verdict) {
  const generatedAt = new Date().toISOString();
  const sections = results.map((assetResult) => {
    const { config, commonDates, signalDates, universe } = assetResult;
    const costPct = ESTIMATED_ROUND_TRIP_COST_PCT[config.key];
    return [
      `## ${config.label}`,
      '',
      `- Universe: ${universe.length} current symbols from \`bus/scripts/${path.basename(config.universePath)}\`; top ${config.shortlistSize} selected each signal.` ,
      `- Common calendar: ${commonDates.length} dates (${commonDates[0]} through ${commonDates[commonDates.length - 1]}). Raw bars per universe member: ${assetResult.minBars}–${assetResult.maxBars}. The replay uses ${signalDates.length} eligible signals from ${signalDates[0]} through ${signalDates[signalDates.length - 1]}.`,
      `- Benchmark: ${config.benchmarkLabel}. Estimated active-shortlist round-trip cost: ${costPct.toFixed(2)}% (imported from \`performance-scorecard.js\`).`,
      '',
      '| Sampling | Forward horizon | Trials | Top shortlist, gross | Top shortlist, cost-adjusted | Full-universe average | Benchmark | Gross excess vs universe | Cost-adjusted excess vs universe | Gross excess vs benchmark | Cost-adjusted excess vs benchmark | Cost-adjusted beat both |',
      '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
      resultRows(assetResult),
      '',
      'Cost-adjusted shortlist return and excess subtract the full estimated round-trip cost from the active screened portfolio. The full-universe and benchmark columns remain price-only passive comparisons, so this is the deliberately conservative question: does the selected portfolio still earn more after its implementation cost?',
      '',
      '### Non-overlapping statistical read — cost-adjusted excess',
      '',
      `Against the full ${config.key} universe:`,
      '',
      '| Forward horizon | Independent trials | Paired 95% t interval | Trials above zero |',
      '|---|---:|---:|---:|',
      intervalRows(assetResult, 'netVsUniverse'),
      '',
      `Against ${config.benchmarkLabel}:`,
      '',
      '| Forward horizon | Independent trials | Paired 95% t interval | Trials above zero |',
      '|---|---:|---:|---:|',
      intervalRows(assetResult, 'netVsBenchmark'),
      '',
      'The every-horizon rows start at the first replay signal and take every 5th, 10th, or 20th common date, respectively. No phase was selected after seeing returns. These windows do not mechanically share forward days; Student-t intervals are used because the 20-day test has only 13 trials. They are cleaner than daily windows, but still not a guarantee that financial-market observations are IID across regimes. Caveat not yet addressed: unlike backtest-parameter-search.js\'s fixed-split design (ARCHITECTURE.md section 17), this run\'s own signal window is a trailing window that slides forward roughly one trading day per calendar day, so which dates land at each sampled phase also shifts daily -- a change in this "Direct verdict" from one day to the next can partly reflect that phase shift, not only genuinely new evidence.',
      '',
    ].join('\n');
  }).join('\n');

  return [
    '# Screen-score historical backtest v2',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Direct verdict',
    '',
    `**${verdict.label}**`,
    '',
    verdict.explanation,
    '',
    'The formal pass rule was fixed before reading the results: an asset class must have all three non-overlapping, cost-adjusted paired 95% intervals entirely above zero versus both its full-universe equal-weight comparator and its benchmark. Daily rows are retained for density and comparison with v1, but are not used for the verdict because their forward windows overlap.',
    '',
    sections,
    '## Methodology retained from v1 and extended here',
    '',
    `- Formula fidelity: imports and calls the exported \`computeScreenScore()\` from \`generate-pilot-tasks.js\`; no local copy of the formula exists in this script. At each signal close, the candidate has only that date's daily change and the trailing ${LOOKBACK_DAYS}-date average volume. No later bar is passed to the scorer.`,
    `- Data fidelity: each asset class is fetched at run time in Alpaca batches through the existing \`alpaca.getDailyBars()\` client—the same function used by the live equity and crypto data snapshots. Returns are equal-weight close-to-close from the signal close to the close ${HORIZONS.join(', ')} dates later.`,
    '- The current system has no point-in-time historical market-cap series. Every replay candidate therefore receives `marketCap: 0`, deliberately invoking the live scorer’s equal-field behavior that makes the market-cap component zero rather than inventing a history. Both asset classes are thus testing the active 50×normalized daily change + 30×normalized trailing volume behavior.',
    `- Cost source: \`ESTIMATED_ROUND_TRIP_COST_PCT\` is imported from \`performance-scorecard.js\`: ${ESTIMATED_ROUND_TRIP_COST_PCT.equity.toFixed(2)}% for equities and ${ESTIMATED_ROUND_TRIP_COST_PCT.crypto.toFixed(2)}% for crypto. These are stated estimates for spread plus fees, not observed fills.`,
    '',
    '## Survivorship and selection-bias caveat — quantified, not solved',
    '',
    '- Equity: the fixed 50-symbol list is today’s hand-selected, mostly large-cap universe applied backward. At least 44/50 are companies whose current listed identity was public for 20 or more years by the end of this sample. The six shorter-current-identity exceptions are TSLA (2010), META (2012), V (2008), ABBV (2013), COP (2012 spin-off), and AVGO (2009). None is a historical small-cap delisting candidate, so this is less severe than a micro-cap survivor screen—but it remains material selection bias because a 2025 historical process would not necessarily have chosen this exact, current set of winners and incumbents.',
    '- Crypto: the 32-coin file was refreshed from Alpaca’s currently tradable USD universe on 2026-09-11, not reconstructed point-in-time. It includes at least eight clearly recent/current-cycle names (ARB, BONK, HYPE, ONDO, PEPE, SKY, TRUMP, and WIF) alongside established BTC/ETH/LTC/XRP. A historical eligible universe would contain delisted, unavailable, and then-unknown coins; crypto survivorship/listing bias is consequently more acute than the equity caveat.',
    '- No point-in-time universe membership data exists in this system, so v2 does not claim to correct either bias. A positive result would still require that data and an out-of-sample period before deployment.',
    '',
    '## Limits that remain',
    '',
    '- Signals use the day’s close and returns begin at that same close; an after-close screen may not receive that exact fill. The estimated cost does not fully model next-open gaps, bid/ask variation by symbol, slippage, liquidity/capacity, position sizing, rebalancing turnover, taxes, or borrow constraints.',
    '- Crypto trades 24/7, so it does not inherit the equity market-closure calendar gap. Its common calendar still requires a real bar for every current universe coin and BTC on each retained date.',
    '- This report contains only values fetched from Alpaca during this run and deterministic transformations of those values. No historical price, market cap, or return was fabricated.',
    '',
  ].join('\n');
}

async function main() {
  const results = [];
  for (const config of ASSET_CLASSES) {
    results.push(await replayAssetClass(config));
  }
  const verdict = directVerdict(results);
  const report = markdownReport(results, verdict);
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log('Screen-score v2 backtest completed with real Alpaca daily bars.');
  for (const assetResult of results) {
    const { config } = assetResult;
    console.log(`${config.label}: ${assetResult.signalDates.length} daily signals (${assetResult.signalDates[0]} through ${assetResult.signalDates[assetResult.signalDates.length - 1]}), top ${config.shortlistSize} of ${assetResult.universe.length}, ${ESTIMATED_ROUND_TRIP_COST_PCT[config.key].toFixed(2)}% round-trip cost.`);
    for (const metric of assetResult.nonOverlappingMetrics) {
      console.log(
        `  ${metric.horizon}d non-overlap n=${metric.trialCount}: net excess vs universe ${formatPct(metric.netVsUniverse.mean)} `
        + `(${formatPct(metric.netVsUniverse.ciLow)} to ${formatPct(metric.netVsUniverse.ciHigh)}), `
        + `vs ${config.benchmarkLabel} ${formatPct(metric.netVsBenchmark.mean)} `
        + `(${formatPct(metric.netVsBenchmark.ciLow)} to ${formatPct(metric.netVsBenchmark.ciHigh)}).`,
      );
    }
  }
  console.log(`VERDICT: ${verdict.label}`);
  console.log(`Report written: ${REPORT_PATH}`);
}

// Guarded 2026-09-13 when this file first gained a require()-able export
// surface for backtest-parameter-search.js -- previously main() ran
// unconditionally on load, which was harmless while this was only ever
// invoked as a CLI script, but would have silently re-run the entire
// backtest (and rewritten REPORT_PATH) as a side effect of a plain
// require(), the exact class of bug execute-portfolio-setup.js's own
// main() had before its require.main === module fix (see ARCHITECTURE.md).
if (require.main === module) {
  main().catch((error) => {
    const cause = error && error.cause && error.cause.message ? ` (${error.cause.message})` : '';
    console.error(`Screen-score v2 backtest failed: ${error.message}${cause}`);
    process.exitCode = 1;
  });
}

module.exports = { fetchAssetClassData, scoreAssetClassData, replayAssetClass, assetClassHasDefensibleEdge, assetClassLooksClearlyNegative, ASSET_CLASSES, HORIZONS };
