// CLI for the leveraged-ETF trend backtest: prereg check, tune-window selection, frozen test-window verdict and report.
//
// Usage:  node bus/fleet/backtest-lev-trend.js [--prereg <path>] --verify-prereg | --tune | --test | --descriptive
//   --prereg <path>  use another prereg file (default: v1, data/lev-backtest-prereg.json).  Its hash file is derived by replacing
//                    the trailing ".json" with ".sha256": lev-backtest-prereg.json -> lev-backtest-prereg.sha256 (v1) and
//                    lev-backtest-prereg.v2.json -> lev-backtest-prereg.v2.sha256 (v2).  Every mode refuses on a hash mismatch.
//   --descriptive    requires a prereg with mode "descriptive" (v2) and a matching hash.  Loads bars from data/lev-bars, drops bars
//                    before data.startDate, evaluates the FIXED canonical configs (no tuning, no selection) on the prereg spans at
//                    5 and 15 bps, idealized and whole-share, adds a sensitivity table (descriptive only) and writes
//                    data/lev-backtest-descriptive-results.md.  Its verdict is INCONCLUSIVE or FAIL and can never be a pass.
//                    --tune/--test refuse a descriptive prereg; --descriptive refuses a prereg whose mode is not "descriptive".
//   --verify-prereg  sha256(lev-backtest-prereg.json) must equal lev-backtest-prereg.sha256, else EVERY mode refuses.
//   --tune           tune window only (date <= windows.tuneEnd): per strategy family and pair, evaluate the whole prereg grid,
//                    keep the ONE config with the highest Calmar (ties: larger n/slow/targetVol, then larger band/DD), and
//                    write data/lev-backtest-frozen-configs.json.  Bars after tuneEnd are cut off before anything is computed.
//   --test           refuses unless the prereg hash matches AND the frozen-configs file exists (and was frozen against the same
//                    hash).  Evaluates ONLY the frozen configs on the test window (date >= windows.testStart), then their
//                    one-step grid neighbours for STABILITY only, applies the prereg passRule to the two primary hypotheses
//                    and writes data/lev-backtest-results.md.  No selection or tuning ever happens on test-window data.
// Bars come from ./lev-bars-cache.js (loaded lazily, only here); the engine itself never touches files or the network.
// This script places no orders and imports no order-submission path.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const avPaths = require('../lib/paths.js');
const engine = require('./lev-backtest-engine.js');

const PATHS = {
  prereg: avPaths.fleetData('lev-backtest-prereg.json'),
  sha: avPaths.fleetData('lev-backtest-prereg.sha256'),
  frozen: avPaths.fleetData('lev-backtest-frozen-configs.json'),
  results: avPaths.fleetData('lev-backtest-results.md'),
  descResults: avPaths.fleetData('lev-backtest-descriptive-results.md'),
};
const STABILITY_TOLERANCE = 0.15;
const MIN_TEST_ROUND_TRIPS = 5;
const PRIMARY = [{ label: 'S1 on QQQ->TQQQ', family: 'S1', pair: 'QQQ->TQQQ' }, { label: 'S2 on QQQ->TQQQ', family: 'S2', pair: 'QQQ->TQQQ' }];

// ---------------------------------------------------------------- prereg
function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

function verifyPrereg(preregPath = PATHS.prereg, shaPath = PATHS.sha) {
  let actual, expected;
  try { actual = sha256File(preregPath); } catch (e) { return { ok: false, reason: `cannot read prereg: ${e.message}` }; }
  try { expected = fs.readFileSync(shaPath, 'utf8').trim().split(/\s+/)[0].toLowerCase(); } catch (e) { return { ok: false, actual, reason: `cannot read sha file: ${e.message}` }; }
  return actual === expected ? { ok: true, actual, expected } : { ok: false, actual, expected, reason: 'sha256 mismatch: the prereg file was modified after freezing' };
}

function loadPrereg(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function cartesian(dims) {
  return Object.entries(dims).reduce((acc, [k, vals]) => acc.flatMap((o) => vals.map((v) => ({ ...o, [k]: v }))), [{}]);
}

function gridFor(prereg, family) {
  if (family === 'S1') return cartesian(prereg.strategies.S1_trend_band.grid);
  if (family === 'S2') return cartesian(prereg.strategies.S2_dual_fast_exit.grid);
  if (family === 'S3') return cartesian(prereg.strategies.S3_vol_target.grid);
  throw new Error(`unknown family ${family}`);
}
const FAMILIES = ['S1', 'S2', 'S3'];

function pairsOf(prereg) {
  const out = [];
  for (const p of prereg.pairs) p.traded.forEach((t, i) => out.push({ key: `${p.underlying}->${t}`, underlying: p.underlying, traded: t, leverage: p.leverage[i] }));
  return out;
}

// One grid step in either direction, one dimension at a time, within the prereg grid (never selects anything).
function neighbours(prereg, family, params) {
  const def = { S1: prereg.strategies.S1_trend_band, S2: prereg.strategies.S2_dual_fast_exit, S3: prereg.strategies.S3_vol_target }[family];
  const out = [];
  for (const [dim, vals] of Object.entries(def.grid)) {
    const i = vals.indexOf(params[dim]);
    for (const j of [i - 1, i + 1]) if (i >= 0 && j >= 0 && j < vals.length) out.push({ ...params, [dim]: vals[j] });
  }
  return out;
}

// Prereg N: (sum of grid sizes) x (number of pairs); must equal the number written in the prereg text.
function trialCount(prereg) {
  const n = FAMILIES.reduce((s, f) => s + gridFor(prereg, f).length, 0) * pairsOf(prereg).length;
  const m = /=\s*(\d+)\s*$/.exec(prereg.multipleTesting.N);
  if (m && Number(m[1]) !== n) throw new Error(`prereg N mismatch: text says ${m[1]}, grids give ${n}`);
  return n;
}

// Common warm-up = the longest window in any grid, so every config is scored over the identical sample (decision, see report).
function commonWarmup(prereg) {
  const s1 = Math.max(...prereg.strategies.S1_trend_band.grid.n);
  const s2 = Math.max(...prereg.strategies.S2_dual_fast_exit.grid.slow, 50);
  return Math.max(s1, s2, 200);
}

const specOf = (family, params, leverage) => ({ family, params, leverage });
const paramKey = (p) => JSON.stringify(p);

// ---------------------------------------------------------------- data
async function loadData(prereg, deps, endDate) {
  let loadBars = deps.loadBars;
  if (!loadBars) loadBars = require('./lev-bars-cache.js').loadBars; // lazy: engine/selftest never need it
  const bars = {}, firstDates = {}, lastDates = {};
  for (const sym of prereg.data.symbols) {
    let b = await loadBars(sym);
    if (!Array.isArray(b) || !b.length) throw new Error(`no bars for ${sym}`);
    firstDates[sym] = b[0].date;
    if (endDate) b = b.filter((x) => x.date <= endDate); // cut BEFORE any computation (tune must never see test data)
    if (!b.length) throw new Error(`no bars for ${sym} on or before ${endDate}`);
    bars[sym] = b;
    lastDates[sym] = b[b.length - 1].date;
  }
  const cash = prereg.cashLeg.split(' ')[0];
  const aligned = {};
  const flags = [];
  for (const p of pairsOf(prereg)) {
    aligned[p.key] = engine.alignBars(bars[p.underlying], bars[p.traded], bars[cash]);
    for (const f of engine.sanityCheckPair(bars[p.underlying], bars[p.traded], p.leverage)) flags.push({ pair: p.key, ...f });
  }
  return { bars, firstDates, lastDates, aligned, flags, cash };
}

// ---------------------------------------------------------------- tune
async function runTune(ctx) {
  const { prereg, deps, hash, log } = ctx;
  const tuneEnd = prereg.windows.tuneEnd;
  const data = await loadData(prereg, deps, tuneEnd);
  if (data.flags.length) return { code: 2, message: `sanity flags in tune data, stopping for manual review: ${JSON.stringify(data.flags.slice(0, 10))}` };
  const warmupBars = commonWarmup(prereg);
  const selections = [];
  for (const pair of pairsOf(prereg)) {
    for (const family of FAMILIES) {
      const grid = gridFor(prereg, family);
      let best = null;
      for (const params of grid) {
        const r = engine.evaluateConfig(data.aligned[pair.key], specOf(family, params, pair.leverage), { window: { end: tuneEnd }, slippageBps: prereg.costs.slippagePerSideBps.base, variant: 'fractional', warmupBars });
        if (best === null || betterOnTune(r.metrics.calmar, params, best.metrics.calmar, best.params)) best = { params, metrics: r.metrics, window: r.window };
      }
      selections.push({
        pair: pair.key, underlying: pair.underlying, traded: pair.traded, leverage: pair.leverage, family, params: best.params, gridSize: grid.length,
        tuneWindow: { start: best.window.startDate, end: best.window.endDate },
        tuneMetrics: pick(best.metrics, ['calmar', 'cagr', 'maxDD', 'sharpe', 'roundTrips', 'nDays']),
      });
    }
  }
  const doc = { version: 1, preregSha256: hash, tuneEnd, warmupBars, slippageBps: prereg.costs.slippagePerSideBps.base, selection: 'highest Calmar on the tune window; ties: larger n/slow/targetVol, then larger band/trailingDD', selections };
  fs.writeFileSync(ctx.paths.frozen, JSON.stringify(doc, null, 2) + '\n');
  log(`tune: froze ${selections.length} configs -> ${ctx.paths.frozen}`);
  for (const s of selections) log(`  ${s.pair.padEnd(11)} ${s.family} ${paramKey(s.params).padEnd(34)} tune Calmar ${fmt(s.tuneMetrics.calmar, 2)}  CAGR ${pct(s.tuneMetrics.cagr)}  maxDD ${pct(s.tuneMetrics.maxDD)}  trips ${s.tuneMetrics.roundTrips}`);
  return { code: 0 };
}

const TIE_KEYS = ['n', 'slow', 'targetVolPct', 'bandPct', 'trailingDDPct'];
function betterOnTune(calmar, params, bestCalmar, bestParams) {
  const a = Number.isNaN(calmar) ? -Infinity : calmar;
  const b = Number.isNaN(bestCalmar) ? -Infinity : bestCalmar;
  const tied = a === b || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-12);
  if (!tied) return a > b;
  for (const k of TIE_KEYS) if (params[k] !== undefined && params[k] !== bestParams[k]) return params[k] > bestParams[k]; // larger wins
  return false;
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

// ---------------------------------------------------------------- pass rule
// inputs: {base:{strat:{maxDD,calmar,cagr}, tradedBH:{maxDD,calmar}, underBH:{cagr}}, stress:{same}, roundTrips, sharpe, neighbourSharpes:[]}
function judgePrimary(inp, tolerance = STABILITY_TOLERANCE, minTrips = MIN_TEST_ROUND_TRIPS) {
  const ddCalmar = (s) => s.strat.maxDD < s.tradedBH.maxDD && s.strat.calmar > s.tradedBH.calmar;
  const cagr = (s) => s.strat.cagr > s.underBH.cagr;
  const diffs = inp.neighbourSharpes.map((x) => Math.abs(x - inp.sharpe));
  const criteria = [
    { name: 'max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps)', pass: ddCalmar(inp.base), value: `maxDD ${pct(inp.base.strat.maxDD)} vs ${pct(inp.base.tradedBH.maxDD)}; Calmar ${fmt(inp.base.strat.calmar, 2)} vs ${fmt(inp.base.tradedBH.calmar, 2)}` },
    { name: 'after-cost CAGR > underlying buy-and-hold (5 bps)', pass: cagr(inp.base), value: `${pct(inp.base.strat.cagr)} vs ${pct(inp.base.underBH.cagr)}` },
    { name: 'both of the above still true at 15 bps/side', pass: ddCalmar(inp.stress) && cagr(inp.stress), value: `maxDD ${pct(inp.stress.strat.maxDD)} vs ${pct(inp.stress.tradedBH.maxDD)}; Calmar ${fmt(inp.stress.strat.calmar, 2)} vs ${fmt(inp.stress.tradedBH.calmar, 2)}; CAGR ${pct(inp.stress.strat.cagr)} vs ${pct(inp.stress.underBH.cagr)}` },
    { name: `at least ${minTrips} completed round trips in the TEST window`, pass: inp.roundTrips >= minTrips, value: `${inp.roundTrips}` },
    { name: `neighbour stability: every one-step neighbour's test Sharpe within ${tolerance} of the frozen config's`, pass: diffs.length > 0 && diffs.every((d) => d < tolerance), value: diffs.length ? `max |dSharpe| ${fmt(Math.max(...diffs), 3)} over ${diffs.length} neighbours (frozen ${fmt(inp.sharpe, 3)})` : 'no neighbours evaluated' },
  ];
  const substantive = [0, 1, 2, 4].every((i) => criteria[i].pass);
  // Decision: a failed substantive criterion is a FAIL even with few trips; INCONCLUSIVE only when the ONLY failure is the trip count.
  const verdict = !substantive ? 'FAIL' : criteria[3].pass ? 'PASS' : 'INCONCLUSIVE';
  return { verdict, criteria };
}

// ---------------------------------------------------------------- test
function scenario(aligned, spec, prereg, warmupBars, slippageBps, variant) {
  return engine.evaluateConfig(aligned, spec, { window: { start: prereg.windows.testStart }, slippageBps, variant, warmupBars });
}

async function runTest(ctx) {
  const { prereg, deps, hash, log } = ctx;
  if (!fs.existsSync(ctx.paths.frozen)) return { code: 3, message: `REFUSED: ${ctx.paths.frozen} does not exist; run --tune first.` };
  const frozen = JSON.parse(fs.readFileSync(ctx.paths.frozen, 'utf8'));
  if (frozen.preregSha256 !== hash) return { code: 3, message: 'REFUSED: the frozen configs were made against a different prereg hash.' };
  const data = await loadData(prereg, deps, null);
  if (data.flags.length) return { code: 2, message: `sanity flags in data, stopping for manual review: ${JSON.stringify(data.flags.slice(0, 10))}` };
  const N = trialCount(prereg);
  const base = prereg.costs.slippagePerSideBps.base, stress = prereg.costs.slippagePerSideBps.stress;
  const wu = frozen.warmupBars;
  const rows = [];
  for (const sel of frozen.selections) {
    const al = data.aligned[`${sel.underlying}->${sel.traded}`];
    const spec = specOf(sel.family, sel.params, sel.leverage);
    const fb = scenario(al, spec, prereg, wu, base, 'fractional');
    const fs15 = scenario(al, spec, prereg, wu, stress, 'fractional');
    const wb = scenario(al, spec, prereg, wu, base, 'wholeShare');
    const ws = scenario(al, spec, prereg, wu, stress, 'wholeShare');
    const nb = neighbours(prereg, sel.family, sel.params).map((p) => {
      const r = scenario(al, specOf(sel.family, p, sel.leverage), prereg, wu, base, 'fractional');
      return { params: p, sharpe: r.metrics.sharpe, cagr: r.metrics.cagr, maxDD: r.metrics.maxDD, roundTrips: r.metrics.roundTrips };
    });
    const dsr = engine.deflatedSharpeFromReturns(fb.returns, N);
    const bootUnder = engine.movingBlockBootstrapCI(fb.returns, fb.benchmarks.underlying.returns);
    const bootTraded = engine.movingBlockBootstrapCI(fb.returns, fb.benchmarks.traded.returns);
    const tradedPriceAtStart = al.t[fb.window.base + 1].open;
    rows.push({ sel, fb, fs15, wb, ws, nb, dsr, bootUnder, bootTraded, tradedPriceAtStart });
  }
  for (const r of rows) {
    const primary = PRIMARY.find((p) => p.family === r.sel.family && p.pair === r.sel.pair);
    if (!primary) continue;
    const grab = (x) => ({ strat: x.metrics, tradedBH: x.benchmarks.traded.metrics, underBH: x.benchmarks.underlying.metrics });
    r.primary = primary;
    r.judgement = judgePrimary({ base: grab(r.fb), stress: grab(r.fs15), roundTrips: r.fb.metrics.roundTrips, sharpe: r.fb.metrics.sharpe, neighbourSharpes: r.nb.map((x) => x.sharpe) });
  }
  const judged = rows.filter((r) => r.judgement);
  const overall = judged.some((r) => r.judgement.verdict === 'FAIL') ? 'FAIL' : judged.every((r) => r.judgement.verdict === 'PASS') ? 'PASS' : 'INCONCLUSIVE';
  fs.writeFileSync(ctx.paths.results, renderReport({ prereg, frozen, data, rows, overall, N, base, stress, hash }));
  log('');
  for (const r of judged) {
    log(`${r.primary.label} [frozen ${paramKey(r.sel.params)}]: ${r.judgement.verdict}`);
    for (const c of r.judgement.criteria) log(`   ${c.pass ? 'pass' : 'FAIL'}  ${c.name}: ${c.value}`);
  }
  log(`OVERALL (both primary hypotheses): ${overall}`);
  log(prereg.passRule.meaning);
  log(`report written to ${ctx.paths.results}`);
  return { code: 0, overall };
}

// ---------------------------------------------------------------- report
function fmt(v, d = 2) { return Number.isFinite(v) ? v.toFixed(d) : v === Infinity ? 'inf' : 'n/a'; }
function pct(v, d = 1) { return Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : 'n/a'; }
const mrow = (label, m) => `| ${label} | ${pct(m.totalReturn)} | ${pct(m.cagr)} | ${pct(m.maxDD)} | ${fmt(m.calmar)} | ${fmt(m.sharpe)} | ${pct(m.worstMonth.ret)} (${m.worstMonth.month}) | ${fmt(m.ulcer)} | ${m.roundTrips === undefined ? '-' : m.roundTrips} | ${m.tradesPerYear === undefined ? '-' : fmt(m.tradesPerYear, 1)} | ${m.timeInMarket === undefined ? '-' : pct(m.timeInMarket, 0)} |`;
const HEADER = '| series | total return | CAGR | max DD | Calmar | Sharpe (daily, x sqrt252, rf=0) | worst month | ulcer idx (%) | round trips | fills/yr | time in market |\n|---|---|---|---|---|---|---|---|---|---|---|';

function renderReport({ prereg, frozen, data, rows, overall, N, base, stress, hash }) {
  const L = [];
  L.push('# Leveraged-ETF trend backtest: results', '');
  L.push(`Prereg sha256 (verified): \`${hash}\`. Windows: tune up to ${prereg.windows.tuneEnd} (selection only), test from ${prereg.windows.testStart}. Cost model: ${base} bps/side base, ${stress} bps/side stress, no added expense ratio, cash leg BIL.`, '');
  L.push(`## Verdict on the two primary hypotheses: ${overall}`, '');
  L.push(`> ${prereg.passRule.meaning}`, '');
  L.push('A FAIL, PASS or INCONCLUSIVE below is reported as it came out. PASS is never proof: it concerns a handful of trades in one regime, and the two primary claims are not corrected for each other.', '');
  for (const r of rows.filter((x) => x.judgement)) {
    L.push(`### ${r.primary.label}: ${r.judgement.verdict}`, '', `Frozen config (chosen on the tune window only): \`${paramKey(r.sel.params)}\`.`, '');
    L.push('| criterion | result | values |', '|---|---|---|');
    for (const c of r.judgement.criteria) L.push(`| ${c.name} | ${c.pass ? 'pass' : 'FAIL'} | ${c.value} |`);
    L.push('');
  }
  L.push('## Disclosures (verbatim from the prereg)', '');
  for (const d of prereg.disclosures) L.push(`- ${d}`);
  L.push('', '## Data', '');
  L.push('| symbol | first available date | last date used |', '|---|---|---|');
  for (const s of prereg.data.symbols) L.push(`| ${s} | ${data.firstDates[s]} | ${data.lastDates[s]} |`);
  L.push('', 'Dates are aligned by INTERSECTION of underlying, traded ETF and BIL; rows missing in any series are dropped:', '');
  for (const [k, a] of Object.entries(data.aligned)) L.push(`- ${k}: ${a.dates.length} aligned days (${a.dates[0]} to ${a.dates[a.dates.length - 1]})`);
  L.push('', `Signals use the underlying's close at t and fill at the traded ETF's open at t+1; the equity curve of each window starts at the close before its first possible fill. Warm-up: every config is scored from the same start (common warm-up of ${frozen.warmupBars} bars = the longest grid window); signals themselves are causal and computed on all earlier history. Sharpe is daily, annualised by sqrt(252), rf=0; CAGR uses years = daily returns / 252; ulcer index is in percent units. Fills are IEX first prints.`, '');
  L.push(`Multiple testing: N = ${N} configs (prereg). Deflated Sharpe uses V[SR] = 1/(T-1) (the prereg does not specify V[SR]).`, '');
  L.push('## All frozen configs on the test window (base 5 bps, idealized fractional)', '');
  for (const r of rows) {
    const s = r.sel;
    const bhT = r.fb.benchmarks.traded.metrics, bhU = r.fb.benchmarks.underlying.metrics, m = r.fb.metrics;
    L.push(`### ${s.pair} ${s.family} ${paramKey(s.params)}${r.primary ? ' (PRIMARY)' : ' (secondary: no pass claim)'}`, '');
    L.push(`Test window ${r.fb.window.startDate} to ${r.fb.window.endDate}. Tune-window numbers for this pick: Calmar ${fmt(s.tuneMetrics.calmar)}, CAGR ${pct(s.tuneMetrics.cagr)}, max DD ${pct(s.tuneMetrics.maxDD)}, ${s.tuneMetrics.roundTrips} round trips.`, '');
    L.push(HEADER);
    L.push(mrow(`strategy (${base} bps)`, m));
    L.push(mrow(`strategy (${stress} bps stress)`, r.fs15.metrics));
    L.push(mrow(`buy-and-hold ${s.traded}`, bhT));
    L.push(mrow(`buy-and-hold ${s.underlying}`, bhU));
    L.push('');
    L.push(`Decomposition vs ${s.traded} buy-and-hold: CAGR ${pct(m.cagr - bhT.cagr)} points, max drawdown ${pct(m.maxDD - bhT.maxDD)} points (negative = less drawdown), Calmar ${fmt(m.calmar - bhT.calmar)}, time in market ${pct(m.timeInMarket, 0)} (average exposure ${pct(m.avgExposure, 0)}). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.`, '');
    L.push(`Deflated Sharpe (N=${N}): daily SR ${fmt(r.dsr.sr, 4)}, SR0 ${fmt(r.dsr.sr0, 4)} (annualised ${fmt(r.dsr.sr0Annualised, 2)}), DSR ${fmt(r.dsr.dsr, 3)}. Bootstrap CI of annualised excess return (illustrative, 20-day blocks, 2000 reps, seed 12345): vs ${s.underlying} ${pct(r.bootUnder.low)} to ${pct(r.bootUnder.high)}; vs ${s.traded} ${pct(r.bootTraded.low)} to ${pct(r.bootTraded.high)}. Too few trades for these to mean much.`, '');
    L.push(`Stability (one-step neighbours, test Sharpe, frozen ${fmt(m.sharpe, 2)}): ${r.nb.map((x) => `${paramKey(x.params)} ${fmt(x.sharpe, 2)}`).join('; ') || 'none'}.`, '');
    const wc = (w, label) => `${label}: end value ${fmt(w.sim.equity[w.sim.equity.length - 1], 2)} from $50, CAGR ${pct(w.metrics.cagr)}, max DD ${pct(w.metrics.maxDD)}, round trips ${w.metrics.roundTrips}, cannot-buy events ${w.sim.cannotBuy.length}`;
    L.push(`Whole-share $20-cap variant (traded ETF open at first fill day ${fmt(r.tradedPriceAtStart, 2)} vs $20 cap${r.tradedPriceAtStart > 20 ? ': one share exceeds the cap, so this variant cannot buy at the start' : ''}): ${wc(r.wb, `${base} bps`)}; ${wc(r.ws, `${stress} bps`)}.`, '');
    if (r.fb.sim.trades.length) L.push(`Fills (base, fractional): ${r.fb.sim.trades.slice(0, 40).map((t) => `${t.date} ${t.side} @${fmt(t.fillPrice, 2)}`).join('; ')}${r.fb.sim.trades.length > 40 ? '; ...' : ''}`, '');
  }
  L.push('## Not verified', '', ...prereg.unverified.map((u) => `- ${u}`), '');
  return L.join('\n');
}

// ---------------------------------------------------------------- descriptive mode (prereg v2)
// <prereg>.json -> <prereg>.sha256 (so v2 uses lev-backtest-prereg.v2.sha256).
function shaPathFor(preregPath) { return /\.json$/.test(preregPath) ? preregPath.replace(/\.json$/, '.sha256') : `${preregPath}.sha256`; }

// Load the cache, drop every bar before data.startDate BEFORE any computation, then align each pair on common dates.
async function loadDescriptiveData(prereg, deps) {
  let loadBars = deps.loadBars;
  if (!loadBars) loadBars = require('./lev-bars-cache.js').loadBars; // lazy: engine/selftest never need it
  const minDate = prereg.data.startDate;
  const bars = {}, firstDates = {}, lastDates = {}, rawCounts = {}, droppedPre = {};
  for (const sym of prereg.data.symbols) {
    const raw = await loadBars(sym);
    if (!Array.isArray(raw) || !raw.length) throw new Error(`no bars for ${sym}`);
    firstDates[sym] = raw[0].date;
    rawCounts[sym] = raw.length;
    droppedPre[sym] = raw.filter((b) => b.date < minDate).map((b) => b.date);
    const kept = raw.filter((b) => b.date >= minDate);
    if (!kept.length) throw new Error(`no bars for ${sym} on or after ${minDate}`);
    bars[sym] = kept;
    lastDates[sym] = kept[kept.length - 1].date;
  }
  const cash = prereg.cashLeg.split(' ')[0];
  const aligned = {}, alignLost = {}, flags = [];
  for (const p of pairsOf(prereg)) {
    const al = engine.alignBars(bars[p.underlying], bars[p.traded], bars[cash]);
    aligned[p.key] = al;
    const keep = new Set(al.dates);
    alignLost[p.key] = {};
    for (const [role, sym] of [['underlying', p.underlying], ['traded', p.traded], ['cash', cash]]) alignLost[p.key][role] = { symbol: sym, dates: bars[sym].map((b) => b.date).filter((d) => !keep.has(d)) };
    for (const f of engine.sanityCheckPair(bars[p.underlying], bars[p.traded], p.leverage)) flags.push({ pair: p.key, ...f });
  }
  return { bars, firstDates, lastDates, rawCounts, droppedPre, aligned, alignLost, flags, cash, minDate };
}

// Verdict for the two primary hypotheses.  The ONLY outcomes are FAIL and INCONCLUSIVE: no path returns a pass.
// inp = {S1:{base:{strat:{maxDD,calmar,cagr}, tradedBH:{maxDD,calmar}, underBH:{cagr}}, stress:{same}, roundTrips}, S2:{...}}
function judgeDescriptive(inp) {
  const hypotheses = ['S1', 'S2'].map((family) => {
    const h = inp[family];
    const b = h.base;
    const ddCalmar = b.strat.maxDD < b.tradedBH.maxDD && b.strat.calmar > b.tradedBH.calmar;
    const cagr = b.strat.cagr > b.underBH.cagr;
    const criteria = [
      { name: 'max drawdown < traded-ETF buy-and-hold AND Calmar > traded-ETF buy-and-hold (5 bps, full span)', met: ddCalmar, value: `maxDD ${pct(b.strat.maxDD)} vs ${pct(b.tradedBH.maxDD)}; Calmar ${fmt(b.strat.calmar, 2)} vs ${fmt(b.tradedBH.calmar, 2)}` },
      { name: 'after-cost CAGR (5 bps) > underlying buy-and-hold (full span)', met: cagr, value: `${pct(b.strat.cagr)} vs ${pct(b.underBH.cagr)}` },
    ];
    let stressNote = null;
    if (h.stress) {
      const s = h.stress;
      stressNote = `at 15 bps (informational, not gating): maxDD ${pct(s.strat.maxDD)} vs ${pct(s.tradedBH.maxDD)}; Calmar ${fmt(s.strat.calmar, 2)} vs ${fmt(s.tradedBH.calmar, 2)}; CAGR ${pct(s.strat.cagr)} vs ${pct(s.underBH.cagr)}`;
    }
    return { family, label: `${family} on QQQ->TQQQ`, criteria, met: criteria.every((c) => c.met), roundTrips: h.roundTrips, stressNote };
  });
  const verdict = hypotheses.every((h) => h.met) ? 'INCONCLUSIVE' : 'FAIL';
  return { verdict, hypotheses };
}

const DESC_FAMILIES = [
  { family: 'S1', def: 'S1_trend_band' },
  { family: 'S2', def: 'S2_dual_fast_exit' },
  { family: 'S3', def: 'S3_vol_target' },
];

// Spans from prereg.evaluation.spans (calendar windows as declared; halves split the full span by number of daily returns).
function spansFor(prereg, al, warmupBars) {
  const ev = prereg.evaluation.spans;
  const full = engine.windowIndices(al.dates, {}, warmupBars - 1);
  const midIdx = full.base + 1 + Math.floor((full.end - full.base) / 2);
  return [
    { key: 'full', label: 'full span (after warm-up)', window: {} },
    { key: 'y2022', label: `calendar 2022 (${ev.y2022.start} to ${ev.y2022.end})`, window: { start: ev.y2022.start, end: ev.y2022.end } },
    { key: 'from2023', label: `${ev.from2023.start} onward`, window: { start: ev.from2023.start } },
    { key: 'firstHalf', label: `first half of the span (to ${al.dates[midIdx - 1]})`, window: { end: al.dates[midIdx - 1] } },
    { key: 'secondHalf', label: `second half of the span (from ${al.dates[midIdx]})`, window: { start: al.dates[midIdx] } },
  ];
}

function safeEval(al, spec, span, bps, variant, warmupBars) {
  try { return engine.evaluateConfig(al, spec, { window: span.window, slippageBps: bps, variant, warmupBars }); } catch (e) { return { error: e.message }; }
}

async function runDescriptive(ctx) {
  const { prereg, deps, hash, log } = ctx;
  const data = await loadDescriptiveData(prereg, deps);
  if (data.flags.length) return { code: 2, message: `sanity flags in data, stopping for manual review: ${JSON.stringify(data.flags.slice(0, 10))}` };
  const N = trialCount(prereg);
  const base = prereg.costs.slippagePerSideBps.base, stress = prereg.costs.slippagePerSideBps.stress;
  const warmupBars = prereg.evaluation.warmupBars;
  const pairs = pairsOf(prereg);
  const out = { pairs: {}, sensitivity: [], N };

  for (const pair of pairs) {
    const al = data.aligned[pair.key];
    const spans = spansFor(prereg, al, warmupBars);
    const pr = { pair, spans: {}, spanList: spans, tradedPriceAtStart: al.t[warmupBars].open };
    for (const span of spans) {
      const cell = { span, configs: {} };
      for (const { family, def } of DESC_FAMILIES) {
        const spec = specOf(family, prereg.strategies[def].canonical, pair.leverage);
        const r = { spec, b5: safeEval(al, spec, span, base, 'fractional', warmupBars), b15: safeEval(al, spec, span, stress, 'fractional', warmupBars), w5: safeEval(al, spec, span, base, 'wholeShare', warmupBars), w15: safeEval(al, spec, span, stress, 'wholeShare', warmupBars) };
        if (family === 'S1' && !r.b5.error) cell.bh = { traded: r.b5.benchmarks.traded, underlying: r.b5.benchmarks.underlying, window: r.b5.window };
        if (!r.b5.error) r.dsr = engine.deflatedSharpeFromReturns(r.b5.returns, N);
        cell.configs[family] = r;
      }
      pr.spans[span.key] = cell;
    }
    // sensitivity: full span, base cost, idealized fractional; DESCRIPTIVE only, feeds nothing
    for (const { family, def } of DESC_FAMILIES) {
      for (const params of gridFor(prereg, family)) {
        const r = safeEval(al, specOf(family, params, pair.leverage), spans[0], base, 'fractional', warmupBars);
        const canonical = paramKey(params) === paramKey(prereg.strategies[def].canonical);
        out.sensitivity.push({ pair: pair.key, family, params, canonical, error: r.error, metrics: r.error ? null : pick(r.metrics, ['cagr', 'maxDD', 'calmar', 'sharpe', 'roundTrips']) });
      }
    }
    out.pairs[pair.key] = pr;
  }

  const q = out.pairs['QQQ->TQQQ'];
  const full = q && q.spans.full;
  if (!full || !full.bh || ['S1', 'S2'].some((f) => full.configs[f].b5.error || full.configs[f].b15.error)) return { code: 2, message: 'cannot evaluate the primary hypotheses on QQQ->TQQQ (see the data)' };
  const grab = (x) => ({ strat: x.metrics, tradedBH: x.benchmarks.traded.metrics, underBH: x.benchmarks.underlying.metrics });
  const inp = {};
  for (const f of ['S1', 'S2']) inp[f] = { base: grab(full.configs[f].b5), stress: grab(full.configs[f].b15), roundTrips: full.configs[f].b5.metrics.roundTrips };
  out.judgement = judgeDescriptive(inp);
  if (!['INCONCLUSIVE', 'FAIL'].includes(out.judgement.verdict)) throw new Error('internal error: descriptive verdict must be INCONCLUSIVE or FAIL');
  const md = renderDescriptive({ prereg, data, out, hash, base, stress, warmupBars });
  if (/\bPASS\b/.test(md)) throw new Error('internal error: the descriptive report must never contain a pass verdict');
  fs.writeFileSync(ctx.paths.descResults, md);
  log('');
  for (const h of out.judgement.hypotheses) {
    log(`${h.label} [canonical ${paramKey(prereg.strategies[h.family === 'S1' ? 'S1_trend_band' : 'S2_dual_fast_exit'].canonical)}]: ${h.met ? 'both criteria met' : 'criteria NOT met'} (round trips ${h.roundTrips})`);
    for (const c of h.criteria) log(`   ${c.met ? 'met' : 'NOT met'}  ${c.name}: ${c.value}`);
  }
  log(`DESCRIPTIVE VERDICT (INCONCLUSIVE or FAIL only; nothing here can establish a durable edge): ${out.judgement.verdict}`);
  log(`report written to ${ctx.paths.descResults}`);
  return { code: 0, verdict: out.judgement.verdict, out };
}

function renderDescriptive({ prereg, data, out, hash, base, stress, warmupBars }) {
  const L = [];
  const { N } = out;
  const listDates = (d) => (d.length <= 20 ? d.join(', ') : `${d.slice(0, 20).join(', ')}, ... (${d.length} total)`);
  L.push('# Leveraged-ETF trend backtest: DESCRIPTIVE results (prereg v2)', '');
  L.push(`Prereg v2 sha256 (verified): \`${hash}\`. Mode: descriptive. Canonical configs fixed in advance; nothing was tuned and no config was picked from any table. Cost model: ${base} bps/side base, ${stress} bps/side stress, no added expense ratio, cash leg BIL. Warm-up ${warmupBars} aligned bars.`, '');
  L.push(`## Verdict on the two primary hypotheses: ${out.judgement.verdict}`, '');
  L.push('> This mode can only return INCONCLUSIVE or FAIL. Even INCONCLUSIVE means only that the canonical rules beat the benchmarks on one short sample; it is not evidence the strategy will work going forward.', '');
  L.push('FAIL if either primary hypothesis (S1 or S2 on QQQ->TQQQ, full span, 5 bps) does not beat TQQQ buy-and-hold on max drawdown AND Calmar, or does not beat QQQ buy-and-hold CAGR after costs. INCONCLUSIVE otherwise.', '');
  for (const h of out.judgement.hypotheses) {
    L.push(`### ${h.label}: ${h.met ? 'both criteria met' : 'criteria NOT met'}`, '', '| criterion | result | values |', '|---|---|---|');
    for (const c of h.criteria) L.push(`| ${c.name} | ${c.met ? 'met' : 'NOT met'} | ${c.value} |`);
    L.push('', `${h.stressNote || ''}`, '');
  }
  const rt = out.judgement.hypotheses.map((h) => `${h.family} ${h.roundTrips}`).join(', ');
  L.push(`Completed round trips on QQQ->TQQQ, full span, 5 bps: ${rt}. Counts this small are too few for confidence intervals to mean anything, so none are computed.`, '');
  L.push('## Disclosures (verbatim from the prereg)', '');
  for (const d of prereg.disclosures) L.push(`- ${d}`);

  L.push('', '## Data', '');
  L.push(`Bars dated before ${data.minDate} are dropped before any computation. Cached bars per symbol:`, '');
  L.push('| symbol | cached bars | first cached date | dropped (before start) | last date used |', '|---|---|---|---|---|');
  for (const s of prereg.data.symbols) L.push(`| ${s} | ${data.rawCounts[s]} | ${data.firstDates[s]} | ${data.droppedPre[s].length ? listDates(data.droppedPre[s]) : 'none'} | ${data.lastDates[s]} |`);
  L.push('', 'Each pair is aligned by INTERSECTION of underlying, traded ETF and BIL dates; dates lost to alignment:', '');
  for (const [k, a] of Object.entries(data.aligned)) {
    const lost = Object.values(data.alignLost[k]).filter((x) => x.dates.length).map((x) => `${x.symbol} ${listDates(x.dates)}`);
    L.push(`- ${k}: ${a.dates.length} aligned days (${a.dates[0]} to ${a.dates[a.dates.length - 1]}); lost to alignment: ${lost.length ? lost.join('; ') : 'none'}`);
  }
  L.push('', `Signals use the underlying's close at t and fill at the traded ETF's open at t+1; each span's equity curve starts at the close before its first possible fill. Signals are causal and computed on all earlier history. Sharpe is daily, annualised by sqrt(252), rf=0; CAGR uses years = daily returns / 252; ulcer index is in percent units. Fills are IEX first prints.`, '');
  L.push(`Multiple testing: N = ${N} configs (the sensitivity grid: ${prereg.multipleTesting.configsPerPair.total} configs x ${pairsOf(prereg).length} pairs, listed in the prereg). Deflated Sharpe uses V[SR] = 1/(T-1).`, '');

  L.push('## Canonical configs by pair and span', '');
  for (const pr of Object.values(out.pairs)) {
    const p = pr.pair;
    L.push(`### ${p.key} (leverage ${p.leverage})`, '');
    for (const span of pr.spanList) {
      const cell = pr.spans[span.key];
      const errs = Object.entries(cell.configs).flatMap(([f, r]) => ['b5', 'b15'].filter((k) => r[k].error).map((k) => `${f} ${k}: ${r[k].error}`));
      L.push(`#### ${span.label}${cell.bh ? `: ${cell.bh.window.startDate} to ${cell.bh.window.endDate}` : ''}`, '');
      if (!cell.bh) { L.push(`Not evaluable: ${errs.join('; ') || 'no data'}.`, ''); continue; }
      L.push(HEADER);
      for (const { family, def } of DESC_FAMILIES) {
        const r = cell.configs[family];
        const tag = `${family} ${paramKey(prereg.strategies[def].canonical)}`;
        if (!r.b5.error) L.push(mrow(`${tag} (${base} bps)`, r.b5.metrics));
        if (!r.b15.error) L.push(mrow(`${tag} (${stress} bps stress)`, r.b15.metrics));
      }
      L.push(mrow(`buy-and-hold ${p.traded}`, cell.bh.traded.metrics));
      L.push(mrow(`buy-and-hold ${p.underlying}`, cell.bh.underlying.metrics), '');
    }
    const full = pr.spans.full;
    if (full.bh) {
      L.push('#### Decomposition vs traded-ETF buy-and-hold (full span, 5 bps)', '');
      for (const { family } of DESC_FAMILIES) {
        const r = full.configs[family].b5;
        if (r.error) continue;
        const m = r.metrics, bh = full.bh.traded.metrics;
        L.push(`- ${family}: CAGR ${pct(m.cagr - bh.cagr)} points, max drawdown ${pct(m.maxDD - bh.maxDD)} points (negative = less drawdown), Calmar ${fmt(m.calmar - bh.calmar)}, time in market ${pct(m.timeInMarket, 0)} (average exposure ${pct(m.avgExposure, 0)}). Drawdown avoidance = the drawdown difference; timing = the CAGR difference at that exposure.`);
      }
      L.push('');
      L.push('#### Deflated Sharpe (full span, 5 bps, N=' + N + ')', '');
      for (const { family } of DESC_FAMILIES) {
        const r = full.configs[family];
        if (r.dsr) L.push(`- ${family}: daily SR ${fmt(r.dsr.sr, 4)}, SR0 ${fmt(r.dsr.sr0, 4)} (annualised ${fmt(r.dsr.sr0Annualised, 2)}), DSR ${fmt(r.dsr.dsr, 3)}, round trips ${r.b5.metrics.roundTrips}`);
      }
      L.push('');
    }
    L.push('#### Whole-share $20-cap variant', '');
    L.push(`Traded ETF open at the first full-span fill day: ${fmt(pr.tradedPriceAtStart, 2)} vs the $20 cap${pr.tradedPriceAtStart > 20 ? ': one share exceeds the cap, so this variant cannot buy at the start' : ''}. This is the FULL-SPAN starting price only -- sub-span rows (2022, 2023-onward, first/second half) can show a very different price by the time they begin, so a low "cannot buy" count here does not mean sub-span rows can always buy. End value from $50; "cannot buy" counts entry signals where one share did not fit.`, '');
    L.push(`| span | config | ${base} bps end value | ${base} bps CAGR | ${base} bps max DD | ${base} bps round trips | ${base} bps cannot buy | ${stress} bps end value | ${stress} bps cannot buy |`, '|---|---|---|---|---|---|---|---|---|');
    for (const span of pr.spanList) {
      for (const { family } of DESC_FAMILIES) {
        const r = pr.spans[span.key].configs[family];
        if (r.w5.error || r.w15.error) { L.push(`| ${span.key} | ${family} | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`); continue; }
        const end = (w) => fmt(w.sim.equity[w.sim.equity.length - 1], 2);
        L.push(`| ${span.key} | ${family} | ${end(r.w5)} | ${pct(r.w5.metrics.cagr)} | ${pct(r.w5.metrics.maxDD)} | ${r.w5.metrics.roundTrips} | ${r.w5.sim.cannotBuy.length} | ${end(r.w15)} | ${r.w15.sim.cannotBuy.length} |`);
      }
    }
    L.push('');
  }

  L.push('## Sensitivity grid (DESCRIPTIVE ONLY: nothing is chosen from this table)', '');
  L.push(`Same grids as v1, full span, ${base} bps, idealized fractional. It feeds no verdict; no config is promoted or preferred. Rows marked canonical are the fixed configs above.`, '');
  L.push('| pair | strategy | params | canonical | CAGR | max DD | Calmar | Sharpe | round trips |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of out.sensitivity) {
    if (r.error) { L.push(`| ${r.pair} | ${r.family} | ${paramKey(r.params)} | ${r.canonical ? 'yes' : ''} | n/a (${r.error}) | | | | |`); continue; }
    const m = r.metrics;
    L.push(`| ${r.pair} | ${r.family} | ${paramKey(r.params)} | ${r.canonical ? 'yes' : ''} | ${pct(m.cagr)} | ${pct(m.maxDD)} | ${fmt(m.calmar)} | ${fmt(m.sharpe)} | ${m.roundTrips} |`);
  }
  L.push('', '## Not verified', '', ...prereg.unverified.map((u) => `- ${u}`), '');
  return L.join('\n');
}

// ---------------------------------------------------------------- main
async function main(argv, deps = {}) {
  const log = deps.log || ((s) => console.log(s));
  const usage = () => { log('usage: backtest-lev-trend.js [--prereg <path>] --verify-prereg | --tune | --test | --descriptive'); return 1; };
  const paths = { ...PATHS, ...(deps.paths || {}) };
  const modes = ['--verify-prereg', '--tune', '--test', '--descriptive'].filter((m) => argv.includes(m));
  if (modes.length !== 1) return usage();
  const pi = argv.indexOf('--prereg');
  if (pi >= 0) {
    const p = argv[pi + 1];
    if (!p || p.startsWith('--')) return usage();
    paths.prereg = path.resolve(p);
    if (!(deps.paths && deps.paths.sha)) paths.sha = shaPathFor(paths.prereg);
  }
  const v = verifyPrereg(paths.prereg, paths.sha);
  if (!v.ok) { log(`REFUSED: ${v.reason} (actual ${v.actual}, expected ${v.expected})`); return 1; }
  if (modes[0] === '--verify-prereg') { log(`prereg OK sha256 ${v.actual}`); return 0; }
  const prereg = loadPrereg(paths.prereg);
  if (modes[0] === '--descriptive' && prereg.mode !== 'descriptive') { log(`REFUSED: --descriptive needs a prereg with mode "descriptive" (this one has ${prereg.mode === undefined ? 'no mode' : `mode "${prereg.mode}"`}); pass --prereg <the v2 file>.`); return 1; }
  if (modes[0] !== '--descriptive' && prereg.mode === 'descriptive') { log(`REFUSED: ${modes[0]} needs a tune/test prereg; this prereg is descriptive (use --descriptive).`); return 1; }
  const ctx = { prereg, deps, hash: v.actual, log, paths };
  const res = modes[0] === '--tune' ? await runTune(ctx) : modes[0] === '--test' ? await runTest(ctx) : await runDescriptive(ctx);
  if (res.message) log(res.message);
  return res.code;
}

module.exports = { verifyPrereg, loadPrereg, gridFor, neighbours, pairsOf, trialCount, commonWarmup, betterOnTune, judgePrimary, judgeDescriptive, shaPathFor, loadDescriptiveData, main, PATHS };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`backtest-lev-trend: ${e && e.message ? e.message : e}`); process.exit(1); });
}
