const test = require('node:test');
const assert = require('node:assert/strict');
const { makeSandbox } = require('./_sandbox.js');

const ids = { r: 'survive/x_research', b: 'survive/x_bull', e: 'survive/x_bear', d: 'survive/x_decision' };
const started = { type: 'mission-started', ts: '2026-01-01T00:00:00Z', missionId: 'mission001', researchTaskId: ids.r, bullTaskId: ids.b, bearTaskId: ids.e, decisionTaskId: ids.d };
const noPos = { hasOpenPosition: false, openLots: [] };
const done = (json) => ({ status: 'done', output: 'SOURCE: x\nAS OF: y\n```json\n' + JSON.stringify(json) + '\n```' });

test('deriveWorkStatusText walks the real pipeline stages and decision outcomes', () => {
  const sbx = makeSandbox();
  const { deriveWorkStatusText: d } = sbx.load('city-status');
  const fx = (map) => (id) => map[id] || null;
  const bullish = done({ stance: 'bullish', symbol: 'SGOV', keyPoints: [] });
  const bearish = done({ stance: 'bearish', concerns: [] });
  const noCase = done({ stance: 'no-real-case', symbol: null, keyPoints: [] });
  assert.equal(d('in-position', [], { hasOpenPosition: true, openLots: [{ symbol: 'SPY' }] }), 'Holding SPY');
  assert.equal(d('idle', [started], noPos), null);
  assert.equal(d('researching', [], noPos), 'Researching...');
  assert.equal(d('researching', [started], noPos, fx({})), 'Researching options...');
  assert.equal(d('researching', [started], noPos, fx({ [ids.r]: { status: 'done' } })), 'Weighing the case...');
  const both = { [ids.r]: { status: 'done' }, [ids.b]: bullish, [ids.e]: bearish };
  assert.equal(d('researching', [started], noPos, fx(both)), 'Deciding on SGOV...');
  assert.equal(d('researching', [started], noPos, fx({ ...both, [ids.b]: noCase })), 'Deciding...');
  const dec = (x) => fx({ ...both, [ids.d]: done(x) });
  assert.equal(d('researching', [started], noPos, dec({ decision: 'no-action', symbol: 'SGOV' })), 'Wrapping up -- staying put for now');
  assert.equal(d('researching', [started], noPos, dec({ decision: 'enter', symbol: 'VOO' })), 'Ready to enter VOO...');
  assert.equal(d('researching', [started], noPos, dec({ decision: 'exit', symbol: 'VOO' })), 'Ready to exit VOO...');
  assert.equal(d('researching', [started], noPos, dec({ decision: 'hold', symbol: 'VOO' })), 'Wrapping up -- staying put for now');
  assert.equal(d('researching', [{ ...started, bullTaskId: undefined, bearTaskId: undefined }], noPos, fx({ [ids.r]: { status: 'done' } })), 'Weighing the case...');
  sbx.cleanup();
});

test('getVaultStats counts only reflected lessons and real postmortems', () => {
  const sbx = makeSandbox();
  const status = sbx.load('city-status');
  const registry = sbx.load('city-registry');
  const journal = sbx.load('survive-journal');
  const memory = sbx.load('memory-store');
  assert.deepEqual(status.getVaultStats(), { lessonCount: 0, postmortemCount: 0, latestLessonAt: null, latestPostmortemAt: null });
  registry.registerCitizen({ citizenId: 'V1', role: 'citizen', genesisAllocationUsd: 50, mechanism: 'alpaca-live-equity' });
  registry.updateCitizenStatus('V1', 'kia');
  memory.recordFact('survive_citizen_V1_postmortem', { diagnosis: 'd', keyMistakes: [], recommendationForFutureCitizens: 'r' }, { sourceTaskId: 'x', taskTo: 'codex' });
  const closed = (m, exit) => journal.appendJournalEntry({ type: 'mission-closed', citizenId: 'V1', missionId: m, symbol: 'X', lotId: 'l' + m, entryTs: exit, exitTs: exit, notionalUsd: 10, pnlUsd: 1, outcome: 'win', entryThesis: null, lesson: null, reflectionTaskId: null });
  closed('m1', '2026-09-17T11:00:00.000Z');
  journal.appendJournalEntry({ type: 'lesson-added', citizenId: 'V1', missionId: 'm1', reflectionTaskId: 't1', lesson: 'a' });
  closed('m2', '2026-09-17T13:00:00.000Z');
  journal.appendJournalEntry({ type: 'lesson-added', citizenId: 'V1', missionId: 'm2', reflectionTaskId: 't2', lesson: 'b' });
  closed('m3', '2026-09-17T15:00:00.000Z'); // never reflected -> excluded
  const s = status.getVaultStats();
  assert.equal(s.lessonCount, 2);
  assert.equal(s.postmortemCount, 1);
  assert.equal(s.latestLessonAt, '2026-09-17T13:00:00.000Z');
  assert.ok(s.latestPostmortemAt);
  sbx.cleanup();
});
