const test = require('node:test');
const assert = require('node:assert/strict');
const { makeSandbox, seedCitizen } = require('./_sandbox.js');

test('isMissionDue: fresh citizen due; in-flight blocks; recent resolve waits out cooldown', () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  seedCitizen(sbx, 'T1');
  assert.equal(sup.isMissionDue('T1'), true);
  executor.appendMissionEvent({ type: 'mission-started', citizenId: 'T1', missionId: 'mission001' });
  assert.equal(sup.isMissionDue('T1'), false, 'in-flight mission must not be due (duplicate-mission bug)');
  executor.appendMissionEvent({ type: 'mission-resolved', citizenId: 'T1', missionId: 'mission001', outcome: 'no-action' });
  assert.equal(sup.isMissionDue('T1'), false, 'within 4h cooldown');
  sbx.cleanup();
});

test('dead-mission recovery: outage alerts once, recovery resolves as dispatchFailure, cap of 3', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  const health = sbx.load('codex-health');
  seedCitizen(sbx, 'T2');
  const ids = { r: 'x/r', b: 'x/b', e: 'x/e', d: 'x/d' };
  executor.appendMissionEvent({ type: 'mission-started', citizenId: 'T2', missionId: 'mission001', researchTaskId: ids.r, bullTaskId: ids.b, bearTaskId: ids.e, decisionTaskId: ids.d });
  const tasks = { [ids.r]: { status: 'error' }, [ids.b]: { status: 'blocked' }, [ids.e]: { status: 'blocked' }, [ids.d]: { status: 'blocked' } };
  const rt = (id) => tasks[id] || null;
  assert.equal(sup.findDeadInFlightMission('T2', rt).taskId, ids.r);
  assert.equal(sup.isMissionDue('T2'), false);
  const alerts = [];
  const notify = async (m) => { alerts.push(m.title); };
  const wake = (probe) => sup.recoverDeadMissions([{ citizenId: 'T2' }], { probeFn: async () => probe, recordFn: (p) => health.recordProbe(p, { notify }), readTaskFileFn: rt });
  const resolved = () => executor.readMissionEvents('T2').filter((e) => e.type === 'mission-resolved');
  const down = { status: 'out-of-credits', detail: 'x' };
  await wake(down); await wake(down);
  assert.equal(resolved().length, 0);
  assert.equal(alerts.length, 1, 'one alert per outage');
  await wake({ status: 'ok', detail: null });
  assert.equal(resolved().length, 1);
  assert.equal(resolved()[0].dispatchFailure, true);
  assert.equal(alerts.length, 2);
  assert.equal(sup.isMissionDue('T2'), true, 'dispatch failure skips cooldown');
  for (const n of ['002', '003']) {
    executor.appendMissionEvent({ type: 'mission-started', citizenId: 'T2', missionId: `mission${n}` });
    executor.appendMissionEvent({ type: 'mission-resolved', citizenId: 'T2', missionId: `mission${n}`, outcome: 'error', dispatchFailure: true });
  }
  assert.equal(sup.isMissionDue('T2'), false, '3 consecutive dispatch failures fall back to cooldown');
  sbx.cleanup();
});

test('codex-health classify', () => {
  const sbx = makeSandbox();
  const health = sbx.load('codex-health');
  assert.equal(health.classify({ exitCode: 1, stderr: 'ERROR: Your workspace is out of credits.' }).status, 'out-of-credits');
  assert.equal(health.classify({ exitCode: 0, output: 'OK' }).status, 'ok');
  assert.equal(health.classify({ exitCode: 1, stderr: 'dispatch timed out' }).status, 'error');
  sbx.cleanup();
});

test('candidate universe: per-symbol failure isolation, null spread guard, caveats', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const mock = {
    getLatestQuote: async (s) => (s === 'NOMID' ? { bid: 1, ask: 1.1, mid: 0 } : s === 'BAD' ? Promise.reject(new Error('quote 404')) : { bid: 100, ask: 100.02, mid: 100.01 }),
    getAsset: async () => ({ tradable: true, fractionable: true, status: 'active' }),
  };
  sup.SURVIVE_CANDIDATE_UNIVERSE.splice(0, sup.SURVIVE_CANDIDATE_UNIVERSE.length, 'GOOD', 'BAD', 'NOMID');
  const rows = await sup.fetchCandidateUniverseData(mock);
  assert.equal(rows[0].ok, true);
  assert.equal(rows[1].ok, false);
  assert.match(rows[1].error, /quote 404/);
  assert.equal(rows[2].spreadPct, null);
  const closed = sup.formatCandidateUniverseTable(rows, 'x', false);
  assert.match(closed, /DATA FETCH FAILED: quote 404/);
  assert.match(closed, /\| NOMID \| baseline \| \$1\.00 \| \$1\.10 \| n\/a \|/); // Round 27: added Source column
  assert.match(closed, /Market is CLOSED/);
  assert.doesNotMatch(sup.formatCandidateUniverseTable(rows, 'x', null), /Market is/);
  assert.equal(sbx.ntfyCalls().length, 0, 'partial failure does not alert');
  sbx.cleanup();
});

test('candidate universe: total failure alerts exactly once and a hang times out', { timeout: 30000 }, async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  sup.SURVIVE_CANDIDATE_UNIVERSE.splice(0, sup.SURVIVE_CANDIDATE_UNIVERSE.length, 'H1', 'H2');
  const hang = { getLatestQuote: () => new Promise(() => {}), getAsset: () => new Promise(() => {}) };
  const t0 = Date.now();
  const rows = await sup.fetchCandidateUniverseData(hang);
  assert.ok(rows.every((r) => !r.ok && /timed out/.test(r.error)));
  assert.ok(Date.now() - t0 < 20000);
  assert.equal(sbx.ntfyCalls().length, 1);
  sbx.cleanup();
});

test('missionAgentFor: alternates by mission number, odd -> codex, even -> claude-agent', () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  assert.equal(sup.missionAgentFor('mission001'), 'codex');
  assert.equal(sup.missionAgentFor('mission002'), 'claude-agent');
  assert.equal(sup.missionAgentFor('mission003'), 'codex');
  assert.equal(sup.missionAgentFor('mission010'), 'claude-agent');
  sbx.cleanup();
});

test('authorNewMission: consecutive missions for the same citizen alternate codex/claude-agent, never split within one mission', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  const fs = require('fs');
  seedCitizen(sbx, 'T8');
  const fake = {
    getLatestQuote: async () => ({ bid: 100, ask: 100.02, mid: 100.01 }),
    getAsset: async () => ({ tradable: true, fractionable: true, status: 'active' }),
    getClock: async () => ({ is_open: true }),
  };
  executor.loadClient = () => fake;
  const m1 = await sup.authorNewMission('T8', { rehearsal: true });
  executor.appendMissionEvent({ type: 'mission-resolved', citizenId: 'T8', missionId: m1, outcome: 'no-action' });
  const m2 = await sup.authorNewMission('T8', { rehearsal: true });
  for (const k of ['research', 'bull', 'bear', 'decision']) {
    const t1 = fs.readFileSync(sbx.file('tasks', 'survive', `survive_cT8_${m1}_${k}.md`), 'utf8');
    const t2 = fs.readFileSync(sbx.file('tasks', 'survive', `survive_cT8_${m2}_${k}.md`), 'utf8');
    assert.match(t1, /^to: codex$/m, `${m1}/${k} should go to codex (odd mission)`);
    assert.match(t2, /^to: claude-agent$/m, `${m2}/${k} should go to claude-agent (even mission)`);
  }
  sbx.cleanup();
});

test('recoverDeadMissions: a dead claude-agent task recovers immediately, no codex probe made', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  seedCitizen(sbx, 'T9');
  const ids = { r: 'x/r2', b: 'x/b2', e: 'x/e2', d: 'x/d2' };
  executor.appendMissionEvent({ type: 'mission-started', citizenId: 'T9', missionId: 'mission002', researchTaskId: ids.r, bullTaskId: ids.b, bearTaskId: ids.e, decisionTaskId: ids.d });
  const tasks = { [ids.r]: { status: 'error', to: 'claude-agent' }, [ids.b]: { status: 'blocked' }, [ids.e]: { status: 'blocked' }, [ids.d]: { status: 'blocked' } };
  const rt = (id) => tasks[id] || null;
  let probed = false;
  await sup.recoverDeadMissions([{ citizenId: 'T9' }], { probeFn: async () => { probed = true; return { status: 'ok', detail: null }; }, recordFn: async () => {}, readTaskFileFn: rt });
  assert.equal(probed, false, 'a dead claude-agent task must never wait on a codex health probe');
  const resolved = executor.readMissionEvents('T9').filter((e) => e.type === 'mission-resolved');
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].dispatchFailure, true);
  sbx.cleanup();
});

test('authorNewMission writes the four-task chain with real-data grounding', async () => {
  const sbx = makeSandbox();
  const sup = sbx.load('survive-supervisor');
  const executor = sbx.load('survive-executor');
  seedCitizen(sbx, 'T3');
  const fake = {
    getLatestQuote: async () => ({ bid: 100, ask: 100.02, mid: 100.01 }),
    getAsset: async () => ({ tradable: true, fractionable: true, status: 'active' }),
    getClock: async () => ({ is_open: true }),
  };
  executor.loadClient = () => fake;
  const missionId = await sup.authorNewMission('T3', { rehearsal: true });
  const fs = require('fs');
  const read = (k) => fs.readFileSync(sbx.file('tasks', 'survive', `survive_cT3_${missionId}_${k}.md`), 'utf8');
  assert.match(read('research'), /Real, verified candidate data/);
  assert.match(read('research'), /\| SGOV \|/);
  assert.match(read('research'), /close to zero yield|earns close to zero/);
  assert.match(read('bull'), /"verifiedFacts"/);
  assert.match(read('bear'), /"verifiedFacts"/);
  assert.match(read('decision'), /verifiedFacts/);
  assert.equal(executor.readMissionEvents('T3').filter((e) => e.type === 'mission-started').length, 1);
  sbx.cleanup();
});
