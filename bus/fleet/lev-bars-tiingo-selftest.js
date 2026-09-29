// lev-bars-tiingo-selftest.js -- Offline self-checks for lev-bars-tiingo.js (injected fetch, temp dir, no network, dummy token).
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tg = require('./lev-bars-tiingo.js');

const TOKEN = 'TIINGO-SELFTEST-TOKEN';
let failed = 0;
const tests = [];
function check(name, fn) { tests.push([name, fn]); }

const row = (date, c, extra = {}) => ({
  date, open: c * 2, high: c * 2 + 2, low: c * 2 - 2, close: c * 2, volume: 999,
  adjOpen: c - 1, adjHigh: c + 1, adjLow: c - 2, adjClose: c, adjVolume: 1000, divCash: 0, splitFactor: 1, ...extra,
});
const okRes = (body) => ({ ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(body) });
const errRes = (status, body, headers) => ({ ok: false, status, headers: new Map(Object.entries(headers || {})), text: async () => body });
const ts = (d) => `${d}T00:00:00.000Z`;

check('header auth: token in Authorization header, absent from URL; endpoint and query params correct', async () => {
  let seenUrl, seenInit;
  const fetchFn = async (url, init) => { seenUrl = url; seenInit = init; return okRes([row(ts('2020-03-16'), 10)]); };
  await tg.fetchTiingoBars('TQQQ', { fetchFn, key: TOKEN, end: '2021-01-01' });
  assert.ok(seenUrl.startsWith('https://api.tiingo.com/tiingo/daily/TQQQ/prices?'), seenUrl);
  assert.ok(seenUrl.includes('startDate=1999-01-01'), seenUrl);
  assert.ok(seenUrl.includes('endDate=2021-01-01'), seenUrl);
  assert.ok(seenUrl.includes('format=json'), seenUrl);
  assert.ok(seenUrl.includes('resampleFreq=daily'), seenUrl);
  assert.ok(!seenUrl.includes(TOKEN) && !/token=/i.test(seenUrl), 'token leaked into URL');
  assert.equal(seenInit.headers.Authorization, `Token ${TOKEN}`);
  assert.ok(seenInit.signal);
});

check('adjusted fields used (not raw); volume = adjVolume; divCash/splitFactor dropped; keys exact', async () => {
  const fetchFn = async () => okRes([row(ts('2020-03-16'), 10, { divCash: 0.5, splitFactor: 2 })]);
  const bars = await tg.fetchTiingoBars('QQQ', { fetchFn, key: TOKEN });
  assert.deepEqual(bars, [{ date: '2020-03-16', open: 9, high: 11, low: 8, close: 10, volume: 1000 }]);
  assert.deepEqual(Object.keys(bars[0]).sort(), ['close', 'date', 'high', 'low', 'open', 'volume']);
});

check('ascending order, dedup by date (later wins), date part of midnight-UTC timestamp, bad rows skipped', async () => {
  const fetchFn = async () => okRes([
    row(ts('2021-07-01'), 30),
    row(ts('2021-01-04'), 10),
    row(ts('2021-07-01'), 35),
    row(ts('2021-03-01'), 20),
    row(ts('2021-04-01'), 20, { adjClose: null }),
  ]);
  const bars = await tg.fetchTiingoBars('QQQ', { fetchFn, key: TOKEN });
  assert.deepEqual(bars.map((b) => b.date), ['2021-01-04', '2021-03-01', '2021-07-01']);
  assert.equal(bars[2].close, 35);
});

check('429: one request only, clear message with code, retry-after shown, no retry storm', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return errRes(429, `Error: hourly limit exceeded for ${TOKEN}`, { 'retry-after': '3600' }); };
  let err;
  try { await tg.fetchTiingoBars('QQQ', { fetchFn, key: TOKEN }); } catch (e) { err = e; }
  assert.ok(err && err.code === 'RATE_LIMITED');
  assert.match(err.message, /HTTP 429 rate limited/);
  assert.match(err.message, /not retrying/);
  assert.match(err.message, /retry-after 3600s/);
  assert.equal(calls, 1);
});

check('refresh stops at the first 429 (remaining symbols never requested); earlier files kept', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lev-tiingo-'));
  try {
    const seen = [];
    const fetchFn = async (url) => {
      const sym = url.split('/daily/')[1].split('/')[0];
      seen.push(sym);
      return sym === 'SPY' ? errRes(429, 'slow down') : okRes([row(ts('2020-01-02'), 5), row(ts('2020-01-03'), 6)]);
    };
    const r = await tg.refresh(['QQQ', 'SPY', 'TQQQ'], { fetchFn, key: TOKEN, dataDir: dir, prereg: { pairs: [] } });
    assert.deepEqual(seen, ['QQQ', 'SPY']);
    assert.match(r.stopped, /RATE_LIMITED/);
    assert.deepEqual(Object.keys(r.summary), ['QQQ']);
    assert.match(r.errors.SPY, /429/);
    assert.deepEqual(fs.readdirSync(dir), ['QQQ.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

check('401/403 message says token rejected without the token; 404 says unknown ticker; 500 has status', async () => {
  for (const status of [401, 403]) {
    let err;
    try { await tg.fetchTiingoBars('QQQ', { fetchFn: async () => errRes(status, `bad token ${TOKEN}`), key: TOKEN }); } catch (e) { err = e; }
    assert.equal(err.code, 'AUTH');
    assert.match(err.message, new RegExp(`HTTP ${status}`));
    assert.match(err.message, /TIINGO_API_KEY rejected/);
    assert.ok(!err.message.includes(TOKEN));
  }
  let e404;
  try { await tg.fetchTiingoBars('ZZZZ', { fetchFn: async () => errRes(404, '{"detail":"Not found."}'), key: TOKEN }); } catch (e) { e404 = e; }
  assert.equal(e404.code, 'NOT_FOUND');
  assert.match(e404.message, /unknown ticker/);
  await assert.rejects(tg.fetchTiingoBars('QQQ', { fetchFn: async () => errRes(500, 'boom'), key: TOKEN }), /HTTP 500 boom/);
});

check('timeout aborts a hung fetch', async () => {
  let sawSignal = false;
  const fetchFn = (url, init) => new Promise((_, reject) => {
    sawSignal = !!init.signal;
    init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const t0 = Date.now();
  await assert.rejects(tg.fetchTiingoBars('QQQ', { fetchFn, key: TOKEN, timeoutMs: 50 }), /timeout after 50 ms/);
  assert.ok(sawSignal);
  assert.ok(Date.now() - t0 < 2000);
});

check('no token substring in any thrown error (status, body, url echo, network error, non-JSON, wrong shape) incl. stack', async () => {
  const cases = [
    async (url) => errRes(500, `oops ${TOKEN} at ${url} Authorization: Token ${TOKEN}`),
    async () => { throw new Error(`socket hang up using Token ${TOKEN}`); },
    async () => ({ ok: true, status: 200, text: async () => `not json ${TOKEN}` }),
    async () => okRes({ detail: `Invalid token ${TOKEN}` }),
    async () => errRes(429, `limit ${TOKEN}`),
    async () => errRes(404, `nf ${TOKEN}`),
  ];
  for (const fetchFn of cases) {
    let blob = '';
    try { await tg.fetchTiingoBars('QQQ', { fetchFn, key: TOKEN }); blob = 'DID NOT THROW'; } catch (e) { blob = e.message + '\n' + (e.stack || ''); }
    assert.ok(blob !== 'DID NOT THROW');
    assert.ok(!blob.includes(TOKEN), `token leaked: ${blob}`);
    assert.ok(!blob.includes('SELFTEST'), 'partial token leaked');
  }
  // refresh's recorded errors as well
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lev-tiingo-'));
  try {
    const r = await tg.refresh(['QQQ'], { fetchFn: async () => errRes(500, `x ${TOKEN}`), key: TOKEN, dataDir: dir, prereg: { pairs: [] } });
    assert.ok(!JSON.stringify(r).includes(TOKEN));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

check('missing key: throws "TIINGO_API_KEY not configured" and makes no fetch call (fetch and refresh)', async () => {
  // The default key path reads the real secrets broker; if a real key is configured, emulate "missing" with an empty explicit key
  // is not the same path, so only run the broker path when nothing is configured.
  let calls = 0;
  const fetchFn = async () => { calls++; return okRes([]); };
  if (!tg.hasKey()) {
    await assert.rejects(tg.fetchTiingoBars('QQQ', { fetchFn }), /TIINGO_API_KEY not configured/);
    await assert.rejects(tg.refresh(['QQQ'], { fetchFn }), /TIINGO_API_KEY not configured/);
    assert.equal(calls, 0);
  }
  // Empty explicit key with a stubbed broker: cover the resolve path deterministically.
  const broker = require('../platform/secrets-broker.js');
  const orig = broker.loadSecret;
  broker.loadSecret = () => null;
  try {
    await assert.rejects(tg.fetchTiingoBars('QQQ', { fetchFn }), /TIINGO_API_KEY not configured/);
    await assert.rejects(tg.refresh(['QQQ'], { fetchFn }), /TIINGO_API_KEY not configured/);
    assert.equal(tg.hasKey(), false);
  } finally { broker.loadSecret = orig; }
  assert.equal(calls, 0);
});

check('atomic write / load round trip in a temp dir (schema: source tiingo, adj-fields); missing symbol throws', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lev-tiingo-'));
  try {
    const fetchFn = async () => okRes([row(ts('2020-01-03'), 6), row(ts('2020-01-02'), 5)]);
    const { summary, errors } = await tg.refresh(['TQQQ'], { fetchFn, key: TOKEN, dataDir: dir, prereg: { pairs: [] } });
    assert.deepEqual(errors, {});
    assert.deepEqual(summary.TQQQ, { firstDate: '2020-01-02', lastDate: '2020-01-03', barCount: 2 });
    const doc = tg.loadDoc('TQQQ', { dataDir: dir });
    assert.equal(doc.source, 'tiingo');
    assert.equal(doc.adjustment, 'adj-fields');
    assert.equal(doc.symbol, 'TQQQ');
    assert.equal(doc.barCount, 2);
    assert.ok(!Number.isNaN(Date.parse(doc.fetchedAt)));
    assert.equal(tg.loadBars('TQQQ', { dataDir: dir })[0].close, 5);
    assert.deepEqual(fs.readdirSync(dir), ['TQQQ.json'], 'no temp file left behind');
    assert.throws(() => tg.loadBars('NOPE', { dataDir: dir }), /no cached bars for NOPE/);
    assert.match(tg.report(['TQQQ', 'NOPE'], { dataDir: dir, prereg: { pairs: [] } }), /TQQQ: first 2020-01-02.*\n.*NOPE: MISSING/s);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function series(dates, closes) { return dates.map((date, i) => ({ date, open: closes[i], high: closes[i], low: closes[i], close: closes[i], volume: 1 })); }
const D = ['2021-05-03', '2021-05-04', '2021-05-05', '2021-05-06', '2021-05-07', '2021-05-10'];

check('crossCheck passes a matching series (constant ratio, zero return diff)', () => {
  const a = series(D, [100, 101, 102, 101, 103, 104]);
  const t = series(D, [100, 101, 102, 101, 103, 104].map((x) => x * 1.02)); // constant ratio: same returns
  const r = tg.crossCheck(t, a);
  assert.equal(r.pass, true);
  assert.equal(r.overlapCount, 6);
  assert.equal(r.comparedReturns, 5);
  assert.ok(r.maxAbsDiff < 1e-12);
  assert.equal(r.daysOver05pct, 0);
  assert.ok(Math.abs(r.ratioDrift) < 1e-12);
  assert.ok(Math.abs(r.ratioFirst - 1.02) < 1e-12);
});

check('crossCheck flags a bad day (max diff and date reported) and fails only above the tolerance count', () => {
  const a = series(D, [100, 101, 102, 101, 103, 104]);
  const base = [100, 101, 102, 101, 103, 104];
  const bad = base.slice();
  bad[2] = 110; // +8.9% on 05-05 vs +1%; later days replay Alpaca's own returns so only this day differs
  for (let i = 3; i < bad.length; i++) bad[i] = bad[i - 1] * (base[i] / base[i - 1]);
  const t = series(D, bad);
  const one = tg.crossCheck(t, a);
  assert.equal(one.maxAbsDiffDate, '2021-05-05');
  assert.ok(one.maxAbsDiff > 0.07);
  assert.equal(one.daysOverMax, 1);
  assert.equal(one.pass, true, 'only a few bad days: still within maxDays=3');
  const strict = tg.crossCheck(t, a, { maxDays: 0 });
  assert.equal(strict.pass, false);
  assert.match(strict.reason, /days with \|return diff\| > 2\.0%/);
  // 4 bad days -> fail with defaults
  const wild = series(D, [100, 120, 90, 130, 80, 140]);
  const f = tg.crossCheck(wild, a);
  assert.equal(f.pass, false);
  assert.ok(f.daysOverMax > 3);
});

check('crossCheck: ratio drift, partial overlap, skipped non-consecutive returns, and no-overlap', () => {
  const a = series(D, [100, 100, 100, 100, 100, 100]);
  const t = series(D, [100, 101, 102, 103, 104, 110]);
  const r = tg.crossCheck(t, a, { maxDiff: 1, maxDays: 100 });
  assert.ok(Math.abs(r.ratioDrift - 0.10) < 1e-9);
  // Alpaca missing 05-05: returns for 05-05 (no alpaca bar) and 05-06 (prev mismatch) are not compared.
  const aGap = series(['2021-05-03', '2021-05-04', '2021-05-06', '2021-05-07'], [100, 101, 101, 103]);
  const t2 = series(D, [100, 101, 102, 101, 103, 104]);
  const g = tg.crossCheck(t2, aGap);
  assert.equal(g.overlapCount, 4);
  assert.equal(g.skippedReturns, 1);
  assert.equal(g.comparedReturns, 2); // 05-04 and 05-07
  const none = tg.crossCheck(series(['2019-01-02'], [1]), series(['2021-01-04'], [1]));
  assert.equal(none.overlapCount, 0);
  assert.equal(none.pass, false);
  assert.match(none.reason, /no overlapping/);
});

check('crossCheckAll reads both caches from injected dirs and reports per symbol', async () => {
  const tDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lev-tiingo-'));
  const aDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lev-alpaca-'));
  try {
    const closes = [100, 101, 102, 101, 103, 104];
    tg.writeCache('QQQ', series(D, closes), tDir);
    require('./lev-bars-cache.js').writeCache('QQQ', series(D, closes.map((x) => x / 1.01)), aDir);
    const r = tg.crossCheckAll(['QQQ', 'SPY'], { dataDir: tDir, alpacaDir: aDir });
    assert.equal(r.results.QQQ.pass, true);
    assert.match(r.lines[0], /^QQQ: PASS/);
    assert.match(r.lines[1], /^SPY: MISSING/);
    assert.equal(r.anyFail, true);
  } finally { fs.rmSync(tDir, { recursive: true, force: true }); fs.rmSync(aDir, { recursive: true, force: true }); }
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`PASS  ${name}`); } catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e && e.message}`); }
  }
  console.log(`\n${tests.length - failed}/${tests.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
