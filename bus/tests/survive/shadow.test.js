const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { makeSandbox, seedCitizen } = require('./_sandbox.js');

const bars = (start, closes) => closes.map((c, i) => {
  const d = new Date(Date.parse(start) + i * 86400e3); // consecutive "sessions" (weekend handling is irrelevant to the arithmetic)
  return { date: d.toISOString().slice(0, 10), close: c };
});

test('ET parts and the no-lookahead reference rule', () => {
  const sbx = makeSandbox();
  const sh = sbx.load('survive-shadow');
  // 2026-09-18 14:30Z = 10:30 ET (EDT) -> before the close.
  assert.deepEqual(sh.etParts(Date.parse('2026-09-18T14:30:00Z')), { date: '2026-09-18', minutes: 10 * 60 + 30 });
  const b = bars('2026-09-15', [100, 101, 102, 103, 104, 105, 106, 107]);
  const intraday = { etDate: '2026-09-18', etMinutes: 10 * 60 + 30 };
  const after = { etDate: '2026-09-18', etMinutes: 17 * 60 };
  // Intraday: reference is the PREVIOUS close (09-17 = 102), never today's.
  assert.equal(sh.forwardReturns(b, intraday).refDate, '2026-09-17');
  // After 16:00 ET: today's close is known and may be the reference.
  assert.equal(sh.forwardReturns(b, after).refDate, '2026-09-18');
  assert.equal(sh.forwardReturns(b, intraday).r5, 107 / 102 - 1);
  assert.equal(sh.forwardReturns(b, intraday).r20, null, 'unelapsed horizon is not scored');
  sbx.cleanup();
});

test('scoreSnapshot: baselines vs actual, friction only when the market was open', () => {
  const sbx = makeSandbox();
  const sh = sbx.load('survive-shadow');
  const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
  const b = bars('2026-09-01', closes);
  const snap = (marketOpen) => ({ etDate: '2026-09-10', etMinutes: 10 * 60, marketOpen, candidates: [{ symbol: 'SGOV', spreadPct: 0.02 }, { symbol: 'VOO', spreadPct: 0.1 }] });
  const barsBySymbol = { SGOV: b, VOO: b };
  const refIdx = b.findIndex((x) => x.date === '2026-09-09');
  const raw5 = b[refIdx + 5].close / b[refIdx].close - 1;
  const open = sh.scoreSnapshot(snap(true), barsBySymbol, { decision: 'enter', symbol: 'VOO' });
  assert.equal(open.policies.cash[5], 0);
  assert.ok(Math.abs(open.policies['always-VOO'][5] - (raw5 - 0.001)) < 1e-12);
  assert.ok(Math.abs(open.policies['always-SGOV'][5] - (raw5 - 0.0002)) < 1e-12);
  assert.ok(Math.abs(open.policies.actual[5] - (raw5 - 0.001)) < 1e-12, 'enter VOO scores as VOO');
  const closed = sh.scoreSnapshot(snap(false), barsBySymbol, { decision: 'no-action', symbol: 'SGOV' });
  assert.ok(Math.abs(closed.policies['always-VOO'][5] - raw5) < 1e-12, 'no friction when the snapshot was taken with the market closed');
  assert.equal(closed.policies.actual[5], 0, 'no-action = stayed in cash');
  assert.equal(sh.scoreSnapshot(snap(true), barsBySymbol, null).policies.actual[5], null, 'unknown decision is not silently scored');
  sbx.cleanup();
});

test('scoreboard: honest about degeneracy and sample size', () => {
  const sbx = makeSandbox();
  const sh = sbx.load('survive-shadow');
  const mk = (d) => ({ type: 'score', decisionKind: d, policies: { cash: { 5: 0 }, actual: { 5: 0 }, 'always-VOO': { 5: 0.01 } } });
  let board = sh.buildScoreboard([]);
  assert.match(board.notes.join(' '), /No scored snapshots/);
  board = sh.buildScoreboard([mk('no-action'), mk('no-action')]);
  assert.match(board.notes.join(' '), /equals cash/);
  assert.match(board.notes.join(' '), /Insufficient data/);
  assert.equal(board.table.find((r) => r.policy === 'always-VOO' && r.horizon === 5).meanReturnPct, 1);
  board = sh.buildScoreboard([mk('enter'), mk('no-action')]);
  assert.doesNotMatch(board.notes.join(' '), /equals cash/);
  sbx.cleanup();
});

test('snapshot is written by authorNewMission; the score job scores it once horizons elapse', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  const sh = sbx.load('survive-shadow');
  const scorer = sbx.load('survive-shadow-score');
  seedCitizen(sbx, 'S1');
  executor.loadClient = () => ({
    getLatestQuote: async () => ({ bid: 100, ask: 100.02, mid: 100.01 }),
    getAsset: async () => ({ tradable: true, fractionable: true, status: 'active' }),
    getClock: async () => ({ is_open: true }),
  });
  const missionId = await sup.authorNewMission('S1', { rehearsal: true });
  const snaps = sh.readShadowEvents().filter((e) => e.type === 'snapshot');
  assert.equal(snaps.length, 1);
  assert.equal(snaps[0].missionId, missionId);
  assert.equal(snaps[0].candidates.length, sup.SURVIVE_CANDIDATE_UNIVERSE.length);
  // Score against mocked bars that start 5+ sessions after the snapshot date's previous close.
  const etDate = snaps[0].etDate;
  const start = new Date(Date.parse(etDate) - 3 * 86400e3).toISOString().slice(0, 10);
  const closes = Array.from({ length: 30 }, (_, i) => 100 * (1 + 0.001 * i));
  const barsFn = async () => bars(start, closes);
  const decisionFn = () => ({ decision: 'no-action', symbol: 'SGOV' });
  const r1 = await scorer.runScoring({ barsFn, decisionFn, symbols: ['SGOV', 'VOO'] });
  // With consecutive daily mock bars from 3 days before the snapshot, the +5 horizon has elapsed only if data exists that far ahead.
  const scores = sh.readShadowEvents().filter((e) => e.type === 'score');
  assert.equal(r1.scoredNow, 1, 'both horizons elapsed in the mock bars');
  assert.equal(scores.length, 1);
  assert.equal(scores[0].decisionKind, 'no-action');
  assert.deepEqual(scores[0].resolved, [5, 20]);
  // Idempotence: once both horizons are resolved a snapshot is not re-scored; otherwise its newest score wins.
  const r2 = await scorer.runScoring({ barsFn, decisionFn, symbols: ['SGOV', 'VOO'] });
  assert.equal(r2.scoredNow, 0, 'fully resolved snapshots are not re-scored');
  assert.equal(r2.board.scored, 1);
  sbx.cleanup();
});

// Round 27 fix: symbolsNeededFor() derives what to fetch from pending snapshots' own candidates, not a
// static universe import -- proves a scanned symbol outside any fixed list still gets scored correctly.
test('symbolsNeededFor: derives from pending snapshots\' own candidates plus the fixed baseline-policy symbols', () => {
  const sbx = makeSandbox();
  const score = sbx.load('survive-shadow-score');
  const shadow = sbx.load('survive-shadow');
  const snaps = [
    { candidates: [{ symbol: 'SGOV' }, { symbol: 'NVDA' }] }, // NVDA: a scanned symbol, not in any fixed universe
    { candidates: [{ symbol: 'VOO' }] },
  ];
  const needed = score.symbolsNeededFor(snaps).sort();
  assert.deepEqual(needed, ['NVDA', 'SGOV', 'VOO'].sort());
  assert.ok(Object.values(shadow.BASELINE_SYMBOLS).every((s) => needed.includes(s)), 'baseline-policy symbols are always included even if no snapshot happens to mention them');
  sbx.cleanup();
});

test('runScoring: a scanned symbol (outside the fixed universe) that a citizen actually entered is scored correctly, not silently null', async () => {
  const sbx = makeSandbox();
  const shadow = sbx.load('survive-shadow');
  const score = sbx.load('survive-shadow-score');
  const closes = Array.from({ length: 40 }, (_, i) => 50 + i * 0.5); // a steady climb so "entered NVDA" clearly beats cash
  const start = '2026-01-01';
  const barsFor = closes.map((c, i) => ({ date: new Date(Date.parse(start) + i * 86400e3).toISOString().slice(0, 10), close: c }));
  const snap = shadow.recordSnapshot({
    citizenId: 'C1', missionId: 'mission900',
    candidateData: [{ symbol: 'NVDA', ok: true, bid: 100, ask: 100.1, mid: 100.05, spreadPct: 0.1 }, { symbol: 'SGOV', ok: true, bid: 100, ask: 100.01, mid: 100.005, spreadPct: 0.01 }],
    marketOpen: true, nowMs: Date.parse('2026-01-05T20:00:00Z'), // after-hours-ish; exact time doesn't matter for this test
  });
  const barsFn = async (sym) => (sym === 'NVDA' || sym === 'SGOV' || sym === 'VOO' ? barsFor : []);
  const decisionFn = () => ({ decision: 'enter', symbol: 'NVDA' });
  const r = await score.runScoring({ barsFn, decisionFn });
  assert.equal(r.scoredNow, 1);
  const scores = shadow.readShadowEvents().filter((e) => e.type === 'score');
  assert.equal(scores.length, 1);
  assert.ok(typeof scores[0].policies.actual[5] === 'number' && scores[0].policies.actual[5] !== null, 'the entered scanned symbol has a real, non-null scored outcome, not the old silent-null bug');
  sbx.cleanup();
});
