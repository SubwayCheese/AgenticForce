// lev-bars-cache-selftest.js -- Offline self-checks for lev-bars-cache.js (injected fetch, temp dir, no network, no real keys).
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cache = require('./lev-bars-cache.js');

const KEYS = { key: 'KEYID-SELFTEST-123', secret: 'SECRET-SELFTEST-456' };
let failed = 0;
const tests = [];
function check(name, fn) { tests.push([name, fn]); }

const apiBar = (t, c) => ({ t, o: c - 1, h: c + 1, l: c - 2, c, v: 1000, n: 5, vw: c });
const okRes = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

check('pagination across 3 pages, adjustment=all/feed=iex/limit in URL, headers set', async () => {
  const urls = [];
  const pages = [
    { bars: [apiBar('2020-03-16T04:00:00Z', 10), apiBar('2020-03-17T04:00:00Z', 11)], next_page_token: 'TOK1' },
    { bars: [apiBar('2020-03-18T04:00:00Z', 12)], next_page_token: 'TOK2' },
    { bars: [apiBar('2020-03-19T04:00:00Z', 13)], next_page_token: null },
  ];
  let i = 0;
  const fetchFn = async (url, init) => {
    urls.push(url);
    assert.equal(init.headers['APCA-API-KEY-ID'], KEYS.key);
    return okRes(pages[i++]);
  };
  const bars = await cache.fetchAdjustedBars('TQQQ', { fetchFn, keys: KEYS });
  assert.equal(bars.length, 4);
  assert.equal(urls.length, 3);
  for (const u of urls) {
    assert.ok(u.includes('/v2/stocks/TQQQ/bars'), u);
    assert.ok(u.includes('adjustment=all'), u);
    assert.ok(u.includes('feed=iex'), u);
    assert.ok(u.includes('timeframe=1Day'), u);
    assert.ok(u.includes('limit=10000'), u);
    assert.ok(u.includes('start=2015-01-01'), u);
  }
  assert.ok(!urls[0].includes('page_token'));
  assert.ok(urls[1].includes('page_token=TOK1'));
  assert.ok(urls[2].includes('page_token=TOK2'));
  assert.deepEqual(Object.keys(bars[0]).sort(), ['close', 'date', 'high', 'low', 'open', 'volume']);
});

check('ascending order and dedup by date; ET date taken from the timestamp date part (EST and EDT)', async () => {
  const fetchFn = async () => okRes({ bars: [
    apiBar('2021-07-01T04:00:00Z', 3), // EDT midnight
    apiBar('2021-01-04T05:00:00Z', 1), // EST midnight
    apiBar('2021-07-01T04:00:00Z', 3.5), // duplicate date
    apiBar('2021-03-01T05:00:00Z', 2),
  ] });
  const bars = await cache.fetchAdjustedBars('QQQ', { fetchFn, keys: KEYS });
  assert.deepEqual(bars.map((b) => b.date), ['2021-01-04', '2021-03-01', '2021-07-01']);
  assert.equal(bars[2].close, 3.5);
});

check('timeout aborts a hung fetch', async () => {
  let sawSignal = false;
  const fetchFn = (url, init) => new Promise((_, reject) => {
    sawSignal = !!init.signal;
    init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const t0 = Date.now();
  await assert.rejects(cache.fetchAdjustedBars('QQQ', { fetchFn, keys: KEYS, timeoutMs: 50 }), /timeout after 50 ms/);
  assert.ok(sawSignal);
  assert.ok(Date.now() - t0 < 2000);
});

check('HTTP error message never contains key values (status, body, url echo)', async () => {
  const fetchFn = async (url) => ({
    ok: false, status: 403,
    text: async () => `forbidden for ${KEYS.key} / ${KEYS.secret} at ${url} header APCA-API-KEY-ID=${KEYS.key}`,
  });
  let msg = '';
  try { await cache.fetchAdjustedBars('QQQ', { fetchFn, keys: KEYS }); } catch (e) { msg = e.message + '\n' + (e.stack || ''); }
  assert.ok(msg.includes('HTTP 403'), msg);
  assert.ok(!msg.includes('KEYID-SELFTEST-123'), 'key id leaked');
  assert.ok(!msg.includes('SECRET-SELFTEST-456'), 'secret leaked');
  assert.ok(!msg.includes('SELFTEST'), 'partial key leaked');
});

check('thrown network error carrying key text is redacted', async () => {
  const fetchFn = async () => { throw new Error(`socket hang up using ${KEYS.secret} and ${KEYS.key}`); };
  let msg = '';
  try { await cache.fetchAdjustedBars('QQQ', { fetchFn, keys: KEYS }); } catch (e) { msg = e.message + (e.stack || ''); }
  assert.ok(msg.includes('socket hang up'));
  assert.ok(!msg.includes('SELFTEST'));
});

check('atomic write / load round trip in a temp dir; missing symbol throws clearly', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lev-bars-'));
  try {
    const fetchFn = async () => okRes({ bars: [apiBar('2020-01-02T05:00:00Z', 5), apiBar('2020-01-03T05:00:00Z', 6)] });
    const { summary } = await cache.refresh(['TQQQ'], { fetchFn, keys: KEYS, dataDir: dir, prereg: { data: { symbols: [] }, pairs: [] } });
    assert.deepEqual(summary.TQQQ, { firstDate: '2020-01-02', lastDate: '2020-01-03', barCount: 2 });
    const doc = cache.loadDoc('TQQQ', { dataDir: dir });
    assert.equal(doc.source, 'alpaca-iex');
    assert.equal(doc.adjustment, 'all');
    assert.equal(doc.symbol, 'TQQQ');
    assert.ok(!Number.isNaN(Date.parse(doc.fetchedAt)));
    assert.equal(cache.loadBars('TQQQ', { dataDir: dir }).length, 2);
    assert.deepEqual(fs.readdirSync(dir), ['TQQQ.json'], 'no temp file left behind');
    assert.throws(() => cache.loadBars('NOPE', { dataDir: dir }), /no cached bars for NOPE/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

check('refresh still writes files when sanity flags exist, and returns the flags', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lev-bars-'));
  try {
    const data = {
      QQQ: [100, 101, 102], TQQQ: [10, 10.3, 20], // TQQQ +94% vs 3x QQQ ~ +3%
    };
    const fetchFn = async (url) => {
      const sym = url.split('/stocks/')[1].split('/')[0];
      return okRes({ bars: data[sym].map((c, i) => apiBar(`2020-02-0${3 + i}T05:00:00Z`, c)) });
    };
    const prereg = { data: { symbols: [] }, pairs: [{ underlying: 'QQQ', traded: ['TQQQ'], leverage: [3] }] };
    const { flags } = await cache.refresh(['QQQ', 'TQQQ'], { fetchFn, keys: KEYS, dataDir: dir, prereg });
    assert.ok(flags.some((f) => f.symbol === 'TQQQ' && f.kind === 'tracking'));
    assert.equal(cache.loadBars('TQQQ', { dataDir: dir }).length, 3);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function series(dates, closes) { return dates.map((date, i) => ({ date, open: closes[i], high: closes[i], low: closes[i], close: closes[i], volume: 1 })); }
const PAIRS = [{ underlying: 'QQQ', traded: ['TQQQ', 'QLD', 'QQQ'], leverage: [3, 2, 1] }];

check('sanityCheck does NOT flag a realistic -35% TQQQ day paired with -12% QQQ', () => {
  const d = ['2020-03-13', '2020-03-16', '2020-03-17'];
  const qqq = series(d, [100, 88, 90]);         // -12% on 03-16
  const tqqq = series(d, [100, 65, 68]);        // -35% on 03-16 (3x = -36%)
  const flags = cache.sanityCheck({ QQQ: qqq, TQQQ: tqqq }, PAIRS);
  assert.deepEqual(flags, []);
});

check('sanityCheck flags a synthetic bad bar (tracking) and an absurd log return', () => {
  const d = ['2021-05-03', '2021-05-04', '2021-05-05', '2021-05-06'];
  const qqq = series(d, [100, 101, 102, 101]);
  const tqqq = series(d, [50, 51.5, 70, 71]);          // +37% on 05-05 vs QQQ +1%
  const flags = cache.sanityCheck({ QQQ: qqq, TQQQ: tqqq }, PAIRS);
  const f = flags.find((x) => x.symbol === 'TQQQ' && x.date === '2021-05-05');
  assert.ok(f && f.kind === 'tracking', JSON.stringify(flags));
  const bad = series(['2021-05-03', '2021-05-04'], [100, 400]);   // ln(4) = 1.39
  const flags2 = cache.sanityCheck({ QQQ: bad }, PAIRS);
  assert.ok(flags2.some((x) => x.kind === 'logret' && x.date === '2021-05-04'));
});

check('sanityCheck skips comparison when the two series span different intervals (missing bar)', () => {
  const qqq = series(['2021-05-03', '2021-05-04', '2021-05-05'], [100, 100, 100]);
  const tqqq = series(['2021-05-03', '2021-05-05'], [100, 120]); // spans two days, not comparable
  assert.deepEqual(cache.sanityCheck({ QQQ: qqq, TQQQ: tqqq }, PAIRS), []);
});

check('findGaps ignores weekends/holidays, flags only > 5 missing trading days', () => {
  // Thanksgiving 2020-11-26 and Christmas 2020-12-25 are holidays; Good Friday 2021-04-02.
  assert.equal(cache.isTradingDay('2020-11-26'), false);
  assert.equal(cache.isTradingDay('2020-12-25'), false);
  assert.equal(cache.isTradingDay('2021-04-02'), false);
  assert.equal(cache.isTradingDay('2022-06-20'), false); // Juneteenth observed
  assert.equal(cache.isTradingDay('2021-04-05'), true);
  // Wed 11-25 -> Fri 11-27 skips Thanksgiving (holiday): 0 missing. Thu 12-24 -> Mon 12-28 skips Christmas + weekend: 0 missing.
  const ok = cache.findGaps(series(['2020-11-25', '2020-11-27'], [1, 1]).concat(series(['2020-12-24', '2020-12-28'], [1, 1])), 0);
  assert.equal(ok.gaps.filter((x) => x.from !== '2020-11-27').length, 0);
  assert.equal(ok.missingTotal, 18); // only the deliberate 11-27 -> 12-24 hole (18 trading days)
  const g = cache.findGaps(series(['2021-03-01', '2021-03-10'], [1, 1])); // 03-02..03-09 = 6 trading days
  assert.equal(g.gaps.length, 1);
  assert.equal(g.gaps[0].missingTradingDays, 6);
  const small = cache.findGaps(series(['2021-03-01', '2021-03-08'], [1, 1])); // 5 missing: not flagged
  assert.equal(small.gaps.length, 0);
});

check('feed option: sip sends feed=sip with an explicit past end date; iex stays the default; bad feed refused before any fetch', async () => {
  const urls = [];
  const fetchFn = async (url) => { urls.push(url); return okRes({ bars: [apiBar('2016-01-04T05:00:00Z', 100)], next_page_token: null }); };
  await cache.fetchAdjustedBars('QQQ', { fetchFn, keys: KEYS });
  assert.ok(urls[0].includes('feed=iex'), 'default feed must stay iex (existing cache and reports unchanged)');
  await cache.fetchAdjustedBars('QQQ', { fetchFn, keys: KEYS, feed: 'sip' });
  assert.ok(urls[1].includes('feed=sip'), urls[1]);
  const m = /[?&]end=(\d{4}-\d{2}-\d{2})/.exec(urls[1]);
  assert.ok(m, 'sip without an explicit end must send one (free plans may not query the most recent SIP data)');
  assert.ok(m[1] < new Date().toISOString().slice(0, 10), `sip end ${m[1]} must be before today`);
  await cache.fetchAdjustedBars('QQQ', { fetchFn, keys: KEYS, feed: 'sip', end: '2016-12-31' });
  assert.ok(urls[2].includes('end=2016-12-31'), 'an explicit end is kept');
  let called = false;
  await assert.rejects(cache.fetchAdjustedBars('QQQ', { fetchFn: async () => { called = true; return okRes({ bars: [] }); }, keys: KEYS, feed: 'otc' }), /feed/);
  assert.equal(called, false, 'an unknown feed must be refused before any network call');
});

check('feed=sip caches to its own directory with source alpaca-sip; iex cache untouched; loadBars reads per feed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'levbars-feed-'));
  try {
    const fetchFn = async () => okRes({ bars: [apiBar('2016-01-04T05:00:00Z', 100), apiBar('2016-01-05T05:00:00Z', 101)], next_page_token: null });
    const prereg = { data: { symbols: ['QQQ'] }, pairs: [] };
    const dirs = { sip: path.join(root, 'lev-bars-sip'), iex: path.join(root, 'lev-bars') };
    assert.equal(path.basename(cache.defaultDirFor('sip')), 'lev-bars-sip');
    assert.equal(path.basename(cache.defaultDirFor('iex')), 'lev-bars');
    await cache.refresh(['QQQ'], { fetchFn, keys: KEYS, prereg, feed: 'sip', dataDir: dirs.sip });
    const doc = cache.loadDoc('QQQ', { dataDir: dirs.sip });
    assert.equal(doc.source, 'alpaca-sip');
    assert.equal(doc.firstDate, '2016-01-04');
    assert.equal(fs.existsSync(path.join(dirs.iex, 'QQQ.json')), false, 'a sip refresh must not write the iex cache');
    await cache.refresh(['QQQ'], { fetchFn, keys: KEYS, prereg, dataDir: dirs.iex });
    assert.equal(cache.loadDoc('QQQ', { dataDir: dirs.iex }).source, 'alpaca-iex');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`PASS  ${name}`); } catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e && e.message}`); }
  }
  console.log(`\n${tests.length - failed}/${tests.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
