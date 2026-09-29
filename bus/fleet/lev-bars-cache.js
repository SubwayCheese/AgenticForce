// lev-bars-cache.js -- Fetch and cache split+dividend-adjusted Alpaca IEX daily bars for the leveraged-ETF trend backtest (read-only market data).
//
// Fleet-local copy of the adjusted-bars logic in bus/city/survive-market-data.js (fleet may not import from city; small
// duplication is the repo precedent). Data endpoint only: no account, order or position access of any kind.
//
// CLI:
//   node bus/fleet/lev-bars-cache.js refresh [--symbols QQQ,SPY,...]   fetch + write bus/fleet/data/lev-bars/<SYM>.json, run sanity check
//   node bus/fleet/lev-bars-cache.js report                            per symbol: first/last date, bar count, gaps
// Default symbols = data.symbols in bus/fleet/data/lev-backtest-prereg.json.

const fs = require('fs');
const path = require('path');
const avPaths = require('../lib/paths.js');
const secretsBroker = require('../platform/secrets-broker.js');

const DATA_BASE = 'https://data.alpaca.markets/v2/stocks';
const DEFAULT_START = '2015-01-01'; // ask for as much history as exists; the actual first date is recorded per symbol
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PAGES = 200; // safety valve against a token loop
const PREREG_PATH = avPaths.fleetData('lev-backtest-prereg.json');
const SANITY = { trackingTol: 0.10, logRetMax: 0.70 }; // from prereg data.sanity; deliberately NO fixed 0.35 cap

function defaultDir() { return avPaths.fleetData('lev-bars'); }

// ---- secret hygiene -------------------------------------------------------------------------------------------------
// Replace every literal occurrence (not regex) of any key value, in any text that may reach an error message or stdout.
function redactWith(text, keys) {
  let out = String(text == null ? '' : text);
  for (const v of [keys && keys.key, keys && keys.secret]) {
    if (typeof v === 'string' && v.length >= 4) out = out.split(v).join('[REDACTED]');
  }
  return out;
}

function resolveKeys(keys) {
  if (keys && keys.key && keys.secret) return keys;
  const key = secretsBroker.loadSecret('ALPACA_API_KEY');
  const secret = secretsBroker.loadSecret('ALPACA_API_SECRET');
  if (!key || !secret) throw new Error('ALPACA_API_KEY / ALPACA_API_SECRET not configured (secrets-broker)');
  return { key, secret };
}

// ---- fetching -------------------------------------------------------------------------------------------------------
// Daily-bar timestamps `t` are the trading day's midnight in America/New_York expressed in UTC (04:00Z during EDT, 05:00Z
// during EST), so the UTC date part of the ISO string IS the New York trading date. No timezone conversion is applied on
// purpose; converting the instant to a UTC-based Date and back would be a no-op, and shifting to ET would move it to the
// previous calendar day.
function toBar(b) {
  return { date: String(b.t).slice(0, 10), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v };
}

async function fetchAdjustedBars(symbol, { start = DEFAULT_START, end, fetchFn = globalThis.fetch, keys, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const k = resolveKeys(keys);
  const byDate = new Map();
  let pageToken = null;
  let pages = 0;
  try {
    do {
      if (++pages > MAX_PAGES) throw new Error(`pagination exceeded ${MAX_PAGES} pages`);
      const params = new URLSearchParams({ timeframe: '1Day', adjustment: 'all', feed: 'iex', limit: '10000', sort: 'asc' });
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      if (pageToken) params.set('page_token', pageToken);
      const url = `${DATA_BASE}/${encodeURIComponent(symbol)}/bars?${params}`;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      let res, text;
      try {
        res = await fetchFn(url, { headers: { 'APCA-API-KEY-ID': k.key, 'APCA-API-SECRET-KEY': k.secret }, signal: ac.signal });
        text = await res.text();
      } catch (e) {
        if (ac.signal.aborted) throw new Error(`bars ${symbol}: timeout after ${timeoutMs} ms`);
        throw e;
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`bars ${symbol}: HTTP ${res.status} ${String(text).slice(0, 200)}`);
      let body;
      try { body = JSON.parse(text); } catch (_) { throw new Error(`bars ${symbol}: response was not JSON`); }
      for (const b of body.bars || []) {
        const bar = toBar(b);
        byDate.set(bar.date, bar); // dedupe by date; a later page wins
      }
      pageToken = body.next_page_token || null;
    } while (pageToken);
  } catch (e) {
    // Rethrow a fresh error whose message (and no stack of the original) has both key values scrubbed.
    throw new Error(redactWith(e && e.message ? e.message : e, k));
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ---- cache ----------------------------------------------------------------------------------------------------------
function cachePath(symbol, dir) { return path.join(dir || defaultDir(), `${symbol}.json`); }

function writeCache(symbol, bars, dir, extra = {}) {
  const d = dir || defaultDir();
  fs.mkdirSync(d, { recursive: true });
  const doc = {
    symbol,
    fetchedAt: new Date().toISOString(),
    source: 'alpaca-iex',
    adjustment: 'all',
    firstDate: bars.length ? bars[0].date : null,
    lastDate: bars.length ? bars[bars.length - 1].date : null,
    barCount: bars.length,
    ...extra,
    bars,
  };
  const final = cachePath(symbol, d);
  const tmp = `${final}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(doc) + '\n');
  fs.renameSync(tmp, final);
  return doc;
}

function loadDoc(symbol, opts = {}) {
  const p = cachePath(symbol, opts.dataDir);
  if (!fs.existsSync(p)) throw new Error(`lev-bars-cache: no cached bars for ${symbol} at ${p}; run: node bus/fleet/lev-bars-cache.js refresh`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadBars(symbol, opts = {}) { return loadDoc(symbol, opts).bars; }

// ---- sanity ---------------------------------------------------------------------------------------------------------
// Close-to-close simple returns of the adjusted bars; a return is only comparable across two series when both cover the
// same previous->current date interval.
function returnsByDate(bars) {
  const m = new Map();
  for (let i = 1; i < bars.length; i++) {
    const p = bars[i - 1].close, c = bars[i].close;
    if (p > 0 && c > 0) m.set(bars[i].date, { prev: bars[i - 1].date, ret: c / p - 1 });
  }
  return m;
}

// pairs: [{underlying, traded:[...], leverage:[...]}] (prereg format). Flags:
//   kind 'tracking': |ret_etf - L*ret_underlying| > 0.10   (only where both series span the same interval)
//   kind 'logret'  : |ln(1+ret)| > 0.70 for any symbol present in barsBySymbol
function sanityCheck(barsBySymbol, pairs = []) {
  const flags = [];
  const rets = {};
  for (const s of Object.keys(barsBySymbol)) rets[s] = returnsByDate(barsBySymbol[s]);
  for (const s of Object.keys(rets)) {
    for (const [date, r] of rets[s]) {
      const lr = Math.log1p(r.ret);
      if (Math.abs(lr) > SANITY.logRetMax) flags.push({ symbol: s, date, kind: 'logret', value: lr });
    }
  }
  for (const pair of pairs) {
    const u = rets[pair.underlying];
    if (!u) continue;
    pair.traded.forEach((sym, i) => {
      const L = pair.leverage[i];
      const e = rets[sym];
      if (!e || sym === pair.underlying) return;
      for (const [date, r] of e) {
        const ur = u.get(date);
        if (!ur || ur.prev !== r.prev) continue;
        const diff = r.ret - L * ur.ret;
        if (Math.abs(diff) > SANITY.trackingTol) flags.push({ symbol: sym, date, kind: 'tracking', value: diff });
      }
    });
  }
  flags.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.symbol < b.symbol ? -1 : 1));
  return flags;
}

// ---- gaps (NYSE calendar) -------------------------------------------------------------------------------------------
function ymd(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function dow(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function nthWeekday(y, m, wd, n) { // n-th (1-based) weekday wd of month
  const first = dow(y, m, 1);
  return 1 + ((wd - first + 7) % 7) + 7 * (n - 1);
}
function lastWeekday(y, m, wd) {
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = dow(y, m, dim);
  return dim - ((last - wd + 7) % 7);
}
function easter(y) { // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}
function observed(y, m, d, skipSaturdayBack) {
  const w = dow(y, m, d);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (w === 6) { if (skipSaturdayBack) return null; dt.setUTCDate(dt.getUTCDate() - 1); }
  if (w === 0) dt.setUTCDate(dt.getUTCDate() + 1);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
const holidayCache = new Map();
function nyseHolidays(y) {
  if (holidayCache.has(y)) return holidayCache.get(y);
  const set = new Set();
  const add = (s) => { if (s) set.add(s); };
  add(observed(y, 1, 1, true));
  add(ymd(y, 1, nthWeekday(y, 1, 1, 3)));  // MLK
  add(ymd(y, 2, nthWeekday(y, 2, 1, 3)));  // Presidents
  const [em, ed] = easter(y);
  const gf = new Date(Date.UTC(y, em - 1, ed - 2));
  add(ymd(gf.getUTCFullYear(), gf.getUTCMonth() + 1, gf.getUTCDate())); // Good Friday
  add(ymd(y, 5, lastWeekday(y, 5, 1)));    // Memorial
  if (y >= 2022) add(observed(y, 6, 19, false)); // Juneteenth
  add(observed(y, 7, 4, false));
  add(ymd(y, 9, nthWeekday(y, 9, 1, 1)));  // Labor
  add(ymd(y, 11, nthWeekday(y, 11, 4, 4))); // Thanksgiving
  add(observed(y, 12, 25, false));
  // one-off closures
  if (y === 2018) add('2018-12-05'); // Bush national day of mourning
  if (y === 2025) add('2025-01-09'); // Carter national day of mourning
  holidayCache.set(y, set);
  return set;
}
function isTradingDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const w = dow(y, m, d);
  return w !== 0 && w !== 6 && !nyseHolidays(y).has(dateStr);
}
function nextDay(dateStr) {
  const dt = new Date(dateStr + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

// Returns {gaps:[{from,to,missingTradingDays}], missingTotal}; a gap is listed only if MORE than `minMissing` trading days
// (default 5) are absent between two consecutive bars. missingTotal counts all missing trading days (informational).
function findGaps(bars, minMissing = 5) {
  const gaps = [];
  let missingTotal = 0;
  for (let i = 1; i < bars.length; i++) {
    let missing = 0;
    for (let d = nextDay(bars[i - 1].date); d < bars[i].date; d = nextDay(d)) if (isTradingDay(d)) missing++;
    missingTotal += missing;
    if (missing > minMissing) gaps.push({ from: bars[i - 1].date, to: bars[i].date, missingTradingDays: missing });
  }
  return { gaps, missingTotal };
}

// ---- refresh / report -----------------------------------------------------------------------------------------------
function loadPrereg() { return JSON.parse(fs.readFileSync(PREREG_PATH, 'utf8')); }

async function refresh(symbols, opts = {}) {
  const prereg = opts.prereg || loadPrereg();
  const syms = symbols && symbols.length ? symbols : prereg.data.symbols;
  const log = opts.log || (() => {});
  const barsBySymbol = {};
  const summary = {};
  for (const s of syms) {
    const bars = await fetchAdjustedBars(s, opts);
    if (!bars.length) throw new Error(`bars ${s}: API returned no bars`);
    const doc = writeCache(s, bars, opts.dataDir);
    barsBySymbol[s] = bars;
    summary[s] = { firstDate: doc.firstDate, lastDate: doc.lastDate, barCount: doc.barCount };
    log(`${s}: ${doc.firstDate} .. ${doc.lastDate}  ${doc.barCount} bars`);
  }
  const flags = sanityCheck(barsBySymbol, prereg.pairs);
  return { summary, flags };
}

function report(symbols, opts = {}) {
  const prereg = opts.prereg || loadPrereg();
  const syms = symbols && symbols.length ? symbols : prereg.data.symbols;
  const lines = [];
  const barsBySymbol = {};
  for (const s of syms) {
    let doc;
    try { doc = loadDoc(s, opts); } catch (e) { lines.push(`${s}: MISSING (${e.message})`); continue; }
    barsBySymbol[s] = doc.bars;
    const g = findGaps(doc.bars);
    lines.push(`${s}: first ${doc.firstDate}  last ${doc.lastDate}  bars ${doc.barCount}  fetched ${doc.fetchedAt}  ` +
      `missing trading days ${g.missingTotal}  gaps>5: ${g.gaps.length ? g.gaps.map((x) => `${x.from}->${x.to} (${x.missingTradingDays})`).join('; ') : 'none'}`);
  }
  const flags = sanityCheck(barsBySymbol, prereg.pairs);
  lines.push(flags.length ? `sanity flags (${flags.length}):` : 'sanity flags: none');
  for (const f of flags) lines.push(`  ${f.symbol} ${f.date} ${f.kind} ${f.value.toFixed(4)}`);
  return lines.join('\n');
}

async function main(argv) {
  const cmd = argv[0];
  const si = argv.indexOf('--symbols');
  const symbols = si >= 0 && argv[si + 1] ? argv[si + 1].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : null;
  if (cmd === 'refresh') {
    const { summary, flags } = await refresh(symbols, { log: console.log });
    console.log(flags.length ? `sanity flags (${flags.length}) -- files were still written:` : 'sanity flags: none');
    for (const f of flags) console.log(`  ${f.symbol} ${f.date} ${f.kind} ${f.value.toFixed(4)}`);
    void summary;
  } else if (cmd === 'report') {
    console.log(report(symbols));
  } else {
    console.log('usage: node bus/fleet/lev-bars-cache.js refresh [--symbols A,B] | report [--symbols A,B]');
    process.exitCode = 2;
  }
}

module.exports = { fetchAdjustedBars, refresh, loadBars, loadDoc, writeCache, sanityCheck, findGaps, isTradingDay, redactWith, report, toBar };

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    // fetchAdjustedBars already scrubs key values; scrub again defensively via the broker before printing.
    let msg = e && e.message ? e.message : String(e);
    try { msg = secretsBroker.redactSecrets(msg); } catch (_) { /* ignore */ }
    console.error(`lev-bars-cache: ${msg}`);
    process.exit(1);
  });
}
