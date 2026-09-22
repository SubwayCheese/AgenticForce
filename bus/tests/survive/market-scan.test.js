// Round 27: survive-market-scan.js -- widening C1's candidate universe. Every test here confirms the
// decoupling actually holds: runMarketScan() is only ever exercised with an injected fake dispatchFn (never
// a real codex call), and readScanCache()/authorNewMission's use of it never dispatches anything at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeSandbox, seedCitizen } = require('./_sandbox.js');

function fresh() {
  const sbx = makeSandbox();
  return { sbx, ms: sbx.load('survive-market-scan') };
}

test('validateCandidates: dedups against baseline, rejects malformed tickers, honors the cap', () => {
  const { sbx, ms } = fresh();
  const parsed = { candidates: [
    { symbol: 'aapl', reason: 'lowercase should be normalized' },
    { symbol: 'SGOV', reason: 'already in baseline -- must be dropped' },
    { symbol: 'aapl', reason: 'duplicate of the first -- must be dropped' },
    { symbol: 'TOOLONGTICKER', reason: 'invalid shape -- must be dropped' },
    { symbol: '123', reason: 'not letters -- must be dropped' },
    { symbol: 'MSFT', reason: '' }, // empty reason -- must be dropped
    { symbol: 'GOOG', reason: 'ok' },
    { symbol: 'AMZN', reason: 'ok' },
    { symbol: 'NVDA', reason: 'ok' },
    { symbol: 'TSLA', reason: 'ok -- this one should be cut by the cap' },
  ] };
  const out = ms.validateCandidates(parsed, ['SGOV', 'VOO'], 4);
  assert.deepEqual(out.map((c) => c.symbol), ['AAPL', 'GOOG', 'AMZN', 'NVDA']);
  sbx.cleanup();
});

test('validateCandidates: a missing/malformed response is a safe empty list, never a throw', () => {
  const { sbx, ms } = fresh();
  assert.deepEqual(ms.validateCandidates(null, ['SGOV'], 5), []);
  assert.deepEqual(ms.validateCandidates({}, ['SGOV'], 5), []);
  assert.deepEqual(ms.validateCandidates({ candidates: 'not-an-array' }, ['SGOV'], 5), []);
  sbx.cleanup();
});

test('runMarketScan: real dispatch path with an injected fake, parses a real fenced json block', async () => {
  const { sbx, ms } = fresh();
  const fakeDispatch = async () => ({ exitCode: 0, output: 'found some ideas\n```json\n{"candidates":[{"symbol":"NVDA","reason":"real current earnings beat"}]}\n```' });
  const r = await ms.runMarketScan({ dispatchFn: fakeDispatch, existingUniverse: ['SGOV', 'BIL', 'SHY', 'VOO', 'SCHD'] });
  assert.deepEqual(r.symbols, ['NVDA']);
  assert.equal(r.candidates[0].reason, 'real current earnings beat');
  assert.ok(r.generatedAt);
  sbx.cleanup();
});

test('runMarketScan: a dispatch failure (exit code, thrown error, unparseable output) is a safe empty result, never a throw', async () => {
  const { sbx, ms } = fresh();
  const failing = async () => ({ exitCode: 1, stderr: 'codex died', output: '' });
  const r1 = await ms.runMarketScan({ dispatchFn: failing, existingUniverse: ['SGOV'] });
  assert.deepEqual(r1.symbols, []);
  assert.match(r1.error, /codex died/);

  const throwing = async () => { throw new Error('spawn ENOENT'); };
  const r2 = await ms.runMarketScan({ dispatchFn: throwing, existingUniverse: ['SGOV'] });
  assert.deepEqual(r2.symbols, []);
  assert.match(r2.error, /ENOENT/);

  const garbage = async () => ({ exitCode: 0, output: 'no json here at all' });
  const r3 = await ms.runMarketScan({ dispatchFn: garbage, existingUniverse: ['SGOV'] });
  assert.deepEqual(r3.symbols, []);
  sbx.cleanup();
});

test('runMarketScan requires existingUniverse -- refuses to guess what "beyond the baseline" means', async () => {
  const { sbx, ms } = fresh();
  await assert.rejects(() => ms.runMarketScan({ dispatchFn: async () => ({}) }), /existingUniverse is required/);
  sbx.cleanup();
});

test('writeScanCache/readScanCache round-trip, and a stale cache is treated as absent', () => {
  const { sbx, ms } = fresh();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-cache-'));
  ms._setCachePathForTesting(path.join(dir, 'cache.json'));
  assert.equal(ms.readScanCache(), null, 'no cache yet');
  const now = Date.now();
  ms.writeScanCache({ symbols: ['NVDA'], candidates: [{ symbol: 'NVDA', reason: 'x' }], generatedAt: new Date(now).toISOString() });
  const fresh1 = ms.readScanCache({ now });
  assert.deepEqual(fresh1.symbols, ['NVDA']);
  const staleCheck = ms.readScanCache({ now: now + 48 * 3600 * 1000 }); // past MAX_CACHE_AGE_MS (36h)
  assert.equal(staleCheck, null, 'a stale cache must not silently feed an old scan into a live mission');
  sbx.cleanup();
});

test('readScanCache never throws on a corrupt file -- always a safe null', () => {
  const { sbx, ms } = fresh();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-cache-bad-'));
  const p = path.join(dir, 'cache.json');
  fs.writeFileSync(p, 'not valid json {{{');
  ms._setCachePathForTesting(p);
  assert.equal(ms.readScanCache(), null);
  sbx.cleanup();
});

// --- End-to-end: authorNewMission actually widens the universe when a fresh cache exists, and NEVER
// dispatches anything itself (proves the decoupling: no dispatchFn is injected anywhere in this test, and
// the sandbox's network/subprocess blocks from _sandbox.js would catch a real attempt).
test('authorNewMission: widens the candidate table with a fresh scan cache, tags Source, and applies the liquidity floor to scanned-only candidates', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  const ms = sbx.load('survive-market-scan');
  seedCitizen(sbx, 'T4');
  const quotes = {
    NVDA: { bid: 900, ask: 900.9, mid: 900.45 }, // ~0.1% spread -- passes the liquidity floor
    THIN: { bid: 10, ask: 10.5, mid: 10.25 }, // ~4.9% spread -- fails MAX_SCAN_SPREAD_PCT (2%)
  };
  executor.loadClient = () => ({
    getLatestQuote: async (sym) => quotes[sym] || { bid: 100, ask: 100.02, mid: 100.01 },
    getAsset: async () => ({ tradable: true, fractionable: true, status: 'active' }),
    getClock: async () => ({ is_open: true }),
  });
  ms.writeScanCache({ symbols: ['NVDA', 'THIN'], candidates: [{ symbol: 'NVDA', reason: 'real earnings beat' }, { symbol: 'THIN', reason: 'thin -- should be filtered' }], generatedAt: new Date().toISOString() });

  const missionId = await sup.authorNewMission('T4', { rehearsal: true });
  const research = fs.readFileSync(sbx.file('tasks', 'survive', `survive_cT4_${missionId}_research.md`), 'utf8');
  assert.match(research, /\| NVDA \| scan \|/, 'a liquid scanned candidate is included and tagged scan');
  assert.match(research, /\| SGOV \| baseline \|/, 'baseline candidates keep their tag');
  assert.doesNotMatch(research, /THIN/, 'an illiquid scanned candidate is filtered out before it ever reaches the research prompt');
  assert.match(research, /weaker \(E0\/E1\) evidence than "baseline"/, 'the table explains the evidentiary difference to the LLM');
  sbx.cleanup();
});

test('authorNewMission: no scan cache present falls back to exactly the baseline-only table, unchanged behavior', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  seedCitizen(sbx, 'T5');
  executor.loadClient = () => ({
    getLatestQuote: async () => ({ bid: 100, ask: 100.02, mid: 100.01 }),
    getAsset: async () => ({ tradable: true, fractionable: true, status: 'active' }),
    getClock: async () => ({ is_open: true }),
  });
  const missionId = await sup.authorNewMission('T5', { rehearsal: true });
  const research = fs.readFileSync(sbx.file('tasks', 'survive', `survive_cT5_${missionId}_research.md`), 'utf8');
  assert.match(research, /\| SGOV \| baseline \|/);
  assert.doesNotMatch(research, /\| scan \|/, 'no scan-sourced rows when no cache exists');
  sbx.cleanup();
});

test('authorNewMission: a stale cache is ignored just like a missing one', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  const ms = sbx.load('survive-market-scan');
  seedCitizen(sbx, 'T6');
  executor.loadClient = () => ({
    getLatestQuote: async () => ({ bid: 100, ask: 100.02, mid: 100.01 }),
    getAsset: async () => ({ tradable: true, fractionable: true, status: 'active' }),
    getClock: async () => ({ is_open: true }),
  });
  ms.writeScanCache({ symbols: ['NVDA'], candidates: [{ symbol: 'NVDA', reason: 'x' }], generatedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString() });
  const missionId = await sup.authorNewMission('T6', { rehearsal: true });
  const research = fs.readFileSync(sbx.file('tasks', 'survive', `survive_cT6_${missionId}_research.md`), 'utf8');
  assert.doesNotMatch(research, /NVDA/);
  sbx.cleanup();
});

test('authorNewMission: a scanned candidate with a nonsensical (negative/zero) spread is filtered, not shown as real data -- regression for a bug caught live in a paper-Alpaca rehearsal', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  const ms = sbx.load('survive-market-scan');
  seedCitizen(sbx, 'T7');
  executor.loadClient = () => ({
    getLatestQuote: async (sym) => (sym === 'BADQ' ? { bid: 338.91, ask: 0, mid: 169.45 } : { bid: 100, ask: 100.02, mid: 100.01 }),
    getAsset: async () => ({ tradable: true, fractionable: true, status: 'active' }),
    getClock: async () => ({ is_open: true }),
  });
  ms.writeScanCache({ symbols: ['BADQ'], candidates: [{ symbol: 'BADQ', reason: 'degenerate after-hours quote' }], generatedAt: new Date().toISOString() });
  const missionId = await sup.authorNewMission('T7', { rehearsal: true });
  const research = fs.readFileSync(sbx.file('tasks', 'survive', `survive_cT7_${missionId}_research.md`), 'utf8');
  assert.doesNotMatch(research, /BADQ/, 'a negative-spread (ask < bid) scanned quote is never shown as real, verified data');
  sbx.cleanup();
});
