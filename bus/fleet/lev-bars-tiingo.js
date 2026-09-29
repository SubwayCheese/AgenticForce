// lev-bars-tiingo.js -- Fetch and cache split+dividend-adjusted Tiingo daily bars (1999+) for the leveraged-ETF trend backtest, and
// cross-check them against the Alpaca IEX cache (read-only market data).
//
// Why: Alpaca's free IEX feed only returns history from 2020-07-27, too short. Tiingo's free tier has consolidated daily history.
// Data endpoint only: no account, order or position access. Token is sent in the Authorization header, NEVER in the URL, and is
// redacted from every error, report and log line.
//
// CLI:
//   node bus/fleet/lev-bars-tiingo.js refresh [--symbols QQQ,SPY,...]   fetch + write bus/fleet/data/lev-bars-tiingo/<SYM>.json
//   node bus/fleet/lev-bars-tiingo.js report [--symbols ...]             per symbol: first/last date, bar count, gaps, sanity flags
//   node bus/fleet/lev-bars-tiingo.js crosscheck [--symbols ...]         Tiingo vs Alpaca (bus/fleet/data/lev-bars/) on overlapping dates
// If TIINGO_API_KEY is not configured (secrets-broker), refresh prints 'TIINGO_API_KEY not configured' and exits non-zero, no network.
//
// Free-tier limits (Tiingo docs; NOT verified with a key here): roughly 50 requests/hour and 1000/day. One request per symbol
// (the whole history comes back in a single response), and a 429 is never retried: refresh stops and reports it.

const fs = require('fs');
const path = require('path');
const avPaths = require('../lib/paths.js');
const secretsBroker = require('../platform/secrets-broker.js');
const alpacaCache = require('./lev-bars-cache.js');

const DATA_BASE = 'https://api.tiingo.com/tiingo/daily';
const DEFAULT_START = '1999-01-01';
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_SYMBOLS = ['QQQ', 'SPY', 'TQQQ', 'QLD', 'UPRO', 'SSO', 'BIL', 'SHY'];
const KEY_NAME = 'TIINGO_API_KEY';
const CROSS = { maxDiff: 0.02, maxDays: 3, flagDiff: 0.005 }; // fail if |ret diff| > maxDiff on MORE than maxDays days
const PREREG_PATH = avPaths.fleetData('lev-backtest-prereg.json');

function defaultDir() { return avPaths.fleetData('lev-bars-tiingo'); }

// ---- secret hygiene -------------------------------------------------------------------------------------------------
// Literal (not regex) replacement of the token in any text that may reach an error message or stdout.
function redactWith(text, key) {
  let out = String(text == null ? '' : text);
  if (typeof key === 'string' && key.length >= 4) out = out.split(key).join('[REDACTED]');
  return out;
}

function resolveKey(key) {
  const k = key || secretsBroker.loadSecret(KEY_NAME);
  if (!k || typeof k !== 'string') throw new Error(`${KEY_NAME} not configured`);
  return k;
}

function hasKey() {
  try { return !!secretsBroker.loadSecret(KEY_NAME); } catch (_) { return false; }
}

// Error carrying a machine-readable code so refresh() can decide to stop (never a retry storm).
function httpError(code, message, extra) {
  const e = new Error(message);
  e.code = code;
  return Object.assign(e, extra || {});
}

// ---- fetching -------------------------------------------------------------------------------------------------------
// Tiingo's daily `date` is an ISO timestamp at midnight UTC ("2020-03-16T00:00:00.000Z") labelling the trading date itself, so
// the date part of the string IS the trading date. No timezone conversion (shifting to New York would move it to the previous day).
// Adjusted fields (adjOpen/adjHigh/adjLow/adjClose/adjVolume) carry both split and dividend adjustment. divCash/splitFactor are
// deliberately dropped: the adjusted prices already include them. Unlike Alpaca IEX prints, Tiingo is a consolidated feed.
function toBar(r) {
  const bar = { date: String(r.date).slice(0, 10), open: r.adjOpen, high: r.adjHigh, low: r.adjLow, close: r.adjClose, volume: r.adjVolume };
  return bar;
}

function validBar(b) {
  return /^\d{4}-\d{2}-\d{2}$/.test(b.date) && [b.open, b.high, b.low, b.close].every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)
    && typeof b.volume === 'number' && Number.isFinite(b.volume);
}

async function fetchTiingoBars(symbol, { start = DEFAULT_START, end, fetchFn = globalThis.fetch, key, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const k = resolveKey(key); // throws before any network call when unconfigured
  const params = new URLSearchParams({ startDate: start, format: 'json', resampleFreq: 'daily' });
  if (end) params.set('endDate', end);
  const url = `${DATA_BASE}/${encodeURIComponent(symbol)}/prices?${params}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let res, text;
    try {
      res = await fetchFn(url, { headers: { 'Content-Type': 'application/json', Authorization: `Token ${k}` }, signal: ac.signal });
      text = await res.text();
    } catch (e) {
      if (ac.signal.aborted) throw httpError('TIMEOUT', `tiingo ${symbol}: timeout after ${timeoutMs} ms`);
      throw e;
    }
    if (!res.ok) {
      const snippet = String(text).slice(0, 200);
      if (res.status === 429) {
        const ra = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
        throw httpError('RATE_LIMITED', `tiingo ${symbol}: HTTP 429 rate limited (free tier ~50 requests/hour, ~1000/day); not retrying` +
          `${ra ? `, retry-after ${ra}s` : ''}; wait and re-run. ${snippet}`);
      }
      if (res.status === 401 || res.status === 403) throw httpError('AUTH', `tiingo ${symbol}: HTTP ${res.status} ${KEY_NAME} rejected (invalid, expired or unauthorized); check the token in bus/secrets.local.json`);
      if (res.status === 404) throw httpError('NOT_FOUND', `tiingo ${symbol}: HTTP 404 unknown ticker or no data for this range`);
      throw httpError('HTTP', `tiingo ${symbol}: HTTP ${res.status} ${snippet}`);
    }
    let body;
    try { body = JSON.parse(text); } catch (_) { throw httpError('BAD_BODY', `tiingo ${symbol}: response was not JSON`); }
    if (!Array.isArray(body)) throw httpError('BAD_BODY', `tiingo ${symbol}: unexpected response shape ${String(text).slice(0, 200)}`);
    const byDate = new Map();
    for (const r of body) {
      const bar = toBar(r);
      if (validBar(bar)) byDate.set(bar.date, bar); // dedupe by date; a later row wins
    }
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  } catch (e) {
    // Rethrow a fresh error whose message (no original stack) has the token scrubbed; keep the code.
    throw httpError(e && e.code, redactWith(e && e.message ? e.message : e, k));
  } finally {
    clearTimeout(timer);
  }
}

// ---- cache (same schema as bus/fleet/data/lev-bars/<SYM>.json) --------------------------------------------------------
function cachePath(symbol, dir) { return path.join(dir || defaultDir(), `${symbol}.json`); }

function writeCache(symbol, bars, dir, extra = {}) {
  const d = dir || defaultDir();
  fs.mkdirSync(d, { recursive: true });
  const doc = {
    symbol,
    fetchedAt: new Date().toISOString(),
    source: 'tiingo',
    adjustment: 'adj-fields',
    firstDate: bars.length ? bars[0].date : null,
    lastDate: bars.length ? bars[bars.length - 1].date : null,
    barCount: bars.length,
    ...extra,
    bars,
  };
  const final = cachePath(symbol, d);
  const tmp = `${final}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(doc) + '\n');
  fs.renameSync(tmp, final); // atomic replace: a reader never sees a half-written file
  return doc;
}

function loadDoc(symbol, opts = {}) {
  const p = cachePath(symbol, opts.dataDir);
  if (!fs.existsSync(p)) throw new Error(`lev-bars-tiingo: no cached bars for ${symbol} at ${p}; run: node bus/fleet/lev-bars-tiingo.js refresh`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadBars(symbol, opts = {}) { return loadDoc(symbol, opts).bars; }

// ---- cross-check vs Alpaca ------------------------------------------------------------------------------------------
// Alpaca bars are IEX-only prints (open/high/low/volume can differ materially from the consolidated tape) while Tiingo is
// consolidated, so compare CLOSE-to-CLOSE returns only, never opens. A return is compared only when BOTH series' previous bar is
// the same date (otherwise the two returns span different intervals). Both series are adjusted as of "now", so the ratio of
// adjusted closes should be roughly constant across the overlap; drift means a dividend/split adjustment disagreement.
function crossCheck(tiingoBars, alpacaBars, opts = {}) {
  const maxDiff = opts.maxDiff != null ? opts.maxDiff : CROSS.maxDiff;
  const maxDays = opts.maxDays != null ? opts.maxDays : CROSS.maxDays;
  const flagDiff = opts.flagDiff != null ? opts.flagDiff : CROSS.flagDiff;
  const tIdx = new Map(tiingoBars.map((b, i) => [b.date, i]));
  const aIdx = new Map(alpacaBars.map((b, i) => [b.date, i]));
  const overlap = [];
  for (const b of alpacaBars) if (tIdx.has(b.date)) overlap.push(b.date);
  overlap.sort();
  const out = {
    overlapCount: overlap.length, firstOverlap: overlap[0] || null, lastOverlap: overlap[overlap.length - 1] || null,
    comparedReturns: 0, skippedReturns: 0, meanAbsDiff: null, maxAbsDiff: null, maxAbsDiffDate: null,
    daysOver05pct: 0, daysOverMax: 0, ratioFirst: null, ratioLast: null, ratioDrift: null,
    tolerance: { maxDiff, maxDays }, pass: false, reason: null,
  };
  if (!overlap.length) { out.reason = 'no overlapping dates'; return out; }
  let sum = 0;
  for (const d of overlap) {
    const ti = tIdx.get(d), ai = aIdx.get(d);
    if (ti < 1 || ai < 1) continue;
    const tp = tiingoBars[ti - 1], ap = alpacaBars[ai - 1];
    if (tp.date !== ap.date) { out.skippedReturns++; continue; }
    const tr = tiingoBars[ti].close / tp.close - 1;
    const ar = alpacaBars[ai].close / ap.close - 1;
    const diff = Math.abs(tr - ar);
    out.comparedReturns++;
    sum += diff;
    if (out.maxAbsDiff === null || diff > out.maxAbsDiff) { out.maxAbsDiff = diff; out.maxAbsDiffDate = d; }
    if (diff > flagDiff) out.daysOver05pct++;
    if (diff > maxDiff) out.daysOverMax++;
  }
  if (out.comparedReturns) out.meanAbsDiff = sum / out.comparedReturns;
  const f = overlap[0], l = overlap[overlap.length - 1];
  out.ratioFirst = tiingoBars[tIdx.get(f)].close / alpacaBars[aIdx.get(f)].close;
  out.ratioLast = tiingoBars[tIdx.get(l)].close / alpacaBars[aIdx.get(l)].close;
  out.ratioDrift = out.ratioLast / out.ratioFirst - 1;
  out.pass = out.comparedReturns > 0 && out.daysOverMax <= maxDays;
  if (!out.comparedReturns) out.reason = 'no comparable consecutive returns';
  else if (!out.pass) out.reason = `${out.daysOverMax} days with |return diff| > ${(maxDiff * 100).toFixed(1)}% (allowed ${maxDays})`;
  return out;
}

function formatCross(symbol, r) {
  if (!r.overlapCount) return `${symbol}: NO OVERLAP (${r.reason})`;
  const pct = (x) => (x == null ? 'n/a' : `${(x * 100).toFixed(3)}%`);
  return `${symbol}: ${r.pass ? 'PASS' : 'FAIL'}  overlap ${r.overlapCount} (${r.firstOverlap}..${r.lastOverlap}), compared ${r.comparedReturns} returns` +
    ` (skipped ${r.skippedReturns})  mean|d| ${pct(r.meanAbsDiff)}  max|d| ${pct(r.maxAbsDiff)} on ${r.maxAbsDiffDate}` +
    `  days>0.5% ${r.daysOver05pct}  days>${(r.tolerance.maxDiff * 100).toFixed(1)}% ${r.daysOverMax}` +
    `  ratio ${r.ratioFirst.toFixed(5)} -> ${r.ratioLast.toFixed(5)} (drift ${pct(r.ratioDrift)})${r.reason ? `  [${r.reason}]` : ''}`;
}

// ---- refresh / report -----------------------------------------------------------------------------------------------
function loadPrereg() { try { return JSON.parse(fs.readFileSync(PREREG_PATH, 'utf8')); } catch (_) { return { pairs: [] }; } }

// Sequential, one request per symbol. Stops at once on rate limit / auth failure (files already written are kept); an unknown
// ticker or other per-symbol failure is recorded in `errors` and the loop continues.
async function refresh(symbols, opts = {}) {
  const syms = symbols && symbols.length ? symbols : DEFAULT_SYMBOLS;
  const log = opts.log || (() => {});
  const key = resolveKey(opts.key); // fail before any network call
  const summary = {}, errors = {}, barsBySymbol = {};
  let stopped = null;
  for (const s of syms) {
    try {
      const bars = await fetchTiingoBars(s, { ...opts, key });
      if (!bars.length) throw httpError('EMPTY', `tiingo ${s}: API returned no bars`);
      const doc = writeCache(s, bars, opts.dataDir);
      barsBySymbol[s] = bars;
      summary[s] = { firstDate: doc.firstDate, lastDate: doc.lastDate, barCount: doc.barCount };
      log(`${s}: ${doc.firstDate} .. ${doc.lastDate}  ${doc.barCount} bars`);
    } catch (e) {
      const msg = redactWith(e && e.message ? e.message : e, key);
      errors[s] = msg;
      log(`${s}: ERROR ${msg}`);
      if (e && (e.code === 'RATE_LIMITED' || e.code === 'AUTH')) { stopped = `stopped after ${s}: ${e.code}`; break; }
    }
  }
  const flags = alpacaCache.sanityCheck(barsBySymbol, (opts.prereg || loadPrereg()).pairs || []);
  return { summary, errors, flags, stopped };
}

function report(symbols, opts = {}) {
  const syms = symbols && symbols.length ? symbols : DEFAULT_SYMBOLS;
  const lines = [], barsBySymbol = {};
  for (const s of syms) {
    let doc;
    try { doc = loadDoc(s, opts); } catch (e) { lines.push(`${s}: MISSING (${e.message})`); continue; }
    barsBySymbol[s] = doc.bars;
    const g = alpacaCache.findGaps(doc.bars);
    lines.push(`${s}: first ${doc.firstDate}  last ${doc.lastDate}  bars ${doc.barCount}  fetched ${doc.fetchedAt}  ` +
      `missing trading days ${g.missingTotal}  gaps>5: ${g.gaps.length ? g.gaps.map((x) => `${x.from}->${x.to} (${x.missingTradingDays})`).join('; ') : 'none'}`);
  }
  const flags = alpacaCache.sanityCheck(barsBySymbol, (opts.prereg || loadPrereg()).pairs || []);
  lines.push(flags.length ? `sanity flags (${flags.length}):` : 'sanity flags: none');
  for (const f of flags) lines.push(`  ${f.symbol} ${f.date} ${f.kind} ${f.value.toFixed(4)}`);
  return lines.join('\n');
}

// Per symbol: Tiingo cache vs Alpaca cache. Returns {lines, results, anyFail}.
function crossCheckAll(symbols, opts = {}) {
  const syms = symbols && symbols.length ? symbols : DEFAULT_SYMBOLS;
  const lines = [], results = {};
  let anyFail = false;
  for (const s of syms) {
    let t, a;
    try { t = loadBars(s, { dataDir: opts.dataDir }); } catch (e) { lines.push(`${s}: MISSING tiingo cache (${e.message})`); anyFail = true; continue; }
    try { a = alpacaCache.loadBars(s, { dataDir: opts.alpacaDir }); } catch (e) { lines.push(`${s}: MISSING alpaca cache (${e.message})`); anyFail = true; continue; }
    const r = crossCheck(t, a, opts);
    results[s] = r;
    if (!r.pass) anyFail = true;
    lines.push(formatCross(s, r));
  }
  return { lines, results, anyFail };
}

async function main(argv) {
  const cmd = argv[0];
  const si = argv.indexOf('--symbols');
  const symbols = si >= 0 && argv[si + 1] ? argv[si + 1].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : null;
  if (cmd === 'refresh') {
    if (!hasKey()) { console.error('TIINGO_API_KEY not configured'); process.exit(1); }
    const { errors, flags, stopped } = await refresh(symbols, { log: console.log });
    console.log(flags.length ? `sanity flags (${flags.length}) -- files were still written:` : 'sanity flags: none');
    for (const f of flags) console.log(`  ${f.symbol} ${f.date} ${f.kind} ${f.value.toFixed(4)}`);
    if (stopped) console.error(`lev-bars-tiingo: ${stopped}`);
    if (Object.keys(errors).length) process.exitCode = 1;
  } else if (cmd === 'report') {
    console.log(report(symbols));
  } else if (cmd === 'crosscheck') {
    const { lines, anyFail } = crossCheckAll(symbols);
    for (const l of lines) console.log(l);
    if (anyFail) process.exitCode = 1;
  } else {
    console.log('usage: node bus/fleet/lev-bars-tiingo.js refresh [--symbols A,B] | report [--symbols A,B] | crosscheck [--symbols A,B]');
    process.exitCode = 2;
  }
}

module.exports = { fetchTiingoBars, refresh, loadBars, loadDoc, writeCache, crossCheck, crossCheckAll, formatCross, report, redactWith, toBar, hasKey, DEFAULT_SYMBOLS };

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    let msg = e && e.message ? e.message : String(e);
    try { msg = secretsBroker.redactSecrets(msg); } catch (_) { /* ignore */ }
    console.error(`lev-bars-tiingo: ${msg}`);
    process.exit(1);
  });
}
