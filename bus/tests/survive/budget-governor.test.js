const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { makeSandbox } = require('./_sandbox.js');

const iso = (ms) => new Date(ms).toISOString();

function fabricateLog(sbx, now) {
  const lines = [
    `[${iso(now - 40 * 3600e3)}] Queue daemon started.`,
    `[${iso(now - 3 * 3600e3)}] QUEUED: survive/survive_cC1_mission007_research (to: codex)`,
    `[${iso(now - 3 * 3600e3)}] survive/survive_cC1_mission007_research: DONE: SOURCE: x`,
    `[${iso(now - 2 * 3600e3)}] QUEUED: fleet_pilot_20260919_thesis_aapl (to: codex)`,
    `[${iso(now - 2 * 3600e3)}] fleet_pilot_20260919_thesis_aapl: DONE: SOURCE: x`,
    `[${iso(now - 2 * 3600e3)}] QUEUED: strategy_backtest_x (to: claude-agent)`,
    `[${iso(now - 2 * 3600e3)}] strategy_backtest_x: DONE: claude side, not counted`,
    `[${iso(now - 1 * 3600e3)}] QUEUED: crypto_pilot_20260919_thesis_r1_ada (to: codex)`,
    `[${iso(now - 1 * 3600e3)}] crypto_pilot_20260919_thesis_r1_ada: BLOCKED: dependency not ready`,
    `[${iso(now - 1 * 3600e3)}] fleet_pilot_20260919_thesis_msft: ERROR (exit 1)`,
  ];
  fs.mkdirSync(sbx.file('bus'), { recursive: true });
  fs.writeFileSync(sbx.file('bus', 'queue-daemon.log'), lines.join('\n') + '\n');
}

test('classify handles survive/ prefixed ids and counts only completed codex tasks', () => {
  const sbx = makeSandbox();
  const b = sbx.load('dispatch-budget');
  assert.equal(b.classify('survive/survive_cC1_mission005_bull'), 'city');
  assert.equal(b.classify('survive_cC1_mission005_bull'), 'city');
  assert.equal(b.classify('fleet_pilot_20260919_x'), 'fleet');
  assert.equal(b.classify('crypto_pilot_20260919_x'), 'fleet');
  assert.equal(b.classify('continuous_backtest_1'), 'fleet');
  assert.equal(b.classify('something_else'), 'other');
  const now = Date.now();
  fabricateLog(sbx, now);
  const s = b.summarize({ now });
  assert.equal(s.logReadable, true);
  assert.ok(s.coverageHours >= 39.9);
  assert.deepEqual([s.windows['24h'].city, s.windows['24h'].fleet, s.windows['24h'].total], [1, 1, 2], 'BLOCKED/ERROR/claude-agent are not counted');
  sbx.cleanup();
});

test('allow(): city always; fails closed on missing/short log, unhealthy codex, caps and ceiling', async () => {
  const sbx = makeSandbox();
  const b = sbx.load('dispatch-budget');
  const health = sbx.load('codex-health');
  const now = Date.now();
  assert.equal((await b.allow('city')).allow, true);
  const okProbe = async () => ({ status: 'ok', detail: null });
  const recordFn = (p) => health.recordProbe(p, { notify: async () => {} });
  // Log missing -> fail closed.
  let r = await b.allow('swarm', { probeFn: okProbe, recordFn, now });
  assert.equal(r.allow, false);
  assert.match(r.reason, /unreadable/);
  // Log too short -> fail closed.
  fs.mkdirSync(sbx.file('bus'), { recursive: true });
  fs.writeFileSync(sbx.file('bus', 'queue-daemon.log'), `[${iso(now - 2 * 3600e3)}] Queue daemon started.\n`);
  r = await b.allow('swarm', { probeFn: okProbe, recordFn, now });
  assert.match(r.reason, /covers only/);
  fabricateLog(sbx, now);
  // Healthy + within budget -> allowed.
  r = await b.allow('swarm', { probeFn: okProbe, recordFn, now });
  assert.equal(r.allow, true);
  // Codex out of credits -> denied (probe result outranks any stale state).
  const down = async () => ({ status: 'out-of-credits', detail: 'x' });
  fs.rmSync(sbx.file('bus', 'codex-health.json'), { force: true });
  r = await b.allow('swarm', { probeFn: down, recordFn, now });
  assert.equal(r.allow, false);
  assert.match(r.reason, /codex unavailable/);
  // Stale ok is re-verified (probe is invoked), and a non-probing check refuses on stale state.
  fs.writeFileSync(sbx.file('bus', 'codex-health.json'), JSON.stringify({ status: 'ok', since: iso(now - 30 * 3600e3), lastChecked: iso(now - 30 * 3600e3) }));
  r = await b.allow('swarm', { probe: false, now });
  assert.equal(r.allow, false);
  let probed = 0;
  r = await b.allow('swarm', { probeFn: async () => { probed++; return { status: 'ok', detail: null }; }, recordFn, now });
  assert.equal(probed, 1);
  assert.equal(r.allow, true);
  // Caps and ceiling.
  const s = b.summarize({ now });
  r = await b.allow('swarm', { probeFn: okProbe, recordFn, now, summary: s, config: { ...b.readConfig(), caps: { swarm: { daily: 0 } } } });
  assert.match(r.reason, /daily cap/);
  r = await b.allow('swarm', { probeFn: okProbe, recordFn, now, summary: s, config: { ...b.readConfig(), discretionaryCeiling24h: 2 } });
  assert.match(r.reason, /ceiling/);
  sbx.cleanup();
});

test('exhaustion calibration records per-window volume and suggests ceilings', () => {
  const sbx = makeSandbox();
  const b = sbx.load('dispatch-budget');
  const now = Date.now();
  fabricateLog(sbx, now);
  const cal = sbx.file('bus', 'dispatch-calibration.jsonl');
  assert.deepEqual(b.suggestCeilings(cal), { observations: 0 });
  b.recordExhaustion({ now, detail: 'test', calibrationPath: cal });
  const s = b.suggestCeilings(cal);
  assert.equal(s.observations, 1);
  assert.equal(s.suggested5h, Math.floor(2 * 0.8));
  sbx.cleanup();
});

test('swarm cycle: a denied budget authors no cycle; a mid-cycle denial resolves tasks as skipped, never wedges', async () => {
  const sbx = makeSandbox();
  const cycle = sbx.load('research-swarm-cycle');
  const rs = sbx.load('research-swarm-tasks');
  sbx.useFakeCodex('cat >/dev/null; exit 1');
  const log = console.log; console.log = () => {};
  try {
    await cycle.runCycle({ allowFn: async () => ({ allow: false, reason: 'test-denied' }) });
    assert.equal(rs.readEvents().length, 0, 'no cycle-started event when denied up front');
    let calls = 0;
    await cycle.runCycle({ allowFn: async (_c, opts) => (opts && opts.probe === false ? { allow: false, reason: 'mid-cycle' } : { allow: true, reason: 'ok' }) });
  } finally { console.log = log; }
  const ev = rs.readEvents();
  assert.equal(ev.filter((e) => e.type === 'cycle-started').length, 1);
  const resolved = ev.filter((e) => e.type === 'specialist-resolved');
  assert.ok(resolved.length > 0 && resolved.every((e) => e.skipped === true));
  assert.equal(rs.findUnresolvedSpecialistTasks(1).length, 0, 'skipped specialists are resolved, so the cycle cannot wedge');
  sbx.cleanup();
});
