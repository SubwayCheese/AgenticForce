const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSandbox } = require('./_sandbox.js');

test('swarm tracking: multi-category unresolved set, staleness recovery, sequencing, no-overwrite, fence round-trip', () => {
  const sbx = makeSandbox();
  const rs = sbx.load('research-swarm-tasks');
  assert.equal(rs.isCycleDue(1).due, true);
  const cats = ['prediction-markets', 'oss-tool-discovery', 'treasury-yield-optimization'];
  rs.appendEvent({ type: 'cycle-started', cycle: 1 });
  for (const c of cats) { rs.writeTaskFile(`survive_research_c1_${c}`, { payload: 'x' }); rs.appendEvent({ type: 'specialist-authored', cycle: 1, category: c }); }
  assert.equal(rs.findUnresolvedSpecialistTasks(1).length, 3);
  assert.equal(rs.isCycleDue(1).due, false);
  rs.appendEvent({ type: 'specialist-resolved', cycle: 1, category: 'oss-tool-discovery' });
  assert.deepEqual(rs.findUnresolvedSpecialistTasks(1).map((u) => u.category).sort(), ['prediction-markets', 'treasury-yield-optimization']);
  for (const c of ['prediction-markets', 'treasury-yield-optimization']) rs.appendEvent({ type: 'specialist-resolved', cycle: 1, category: c });
  assert.equal(rs.findUnresolvedSpecialistTasks(1).length, 0);
  assert.equal(rs.nextCycleNumber(), 2);
  assert.throws(() => rs.writeTaskFile('survive_research_c1_prediction-markets', { payload: 'y' }));
  // Fence collision: output containing a fenced json block must round-trip intact.
  const out = 'SOURCE: x\n```json\n{"mechanismId":"kalshi-event-contracts"}\n```';
  rs.writeTaskResult('survive_research_c1_prediction-markets', { status: 'done', output: out });
  const rt = rs.readTaskFile('survive_research_c1_prediction-markets');
  assert.equal(rt.status, 'done');
  assert.equal(rt.output, out);
  assert.equal(rs.readTaskFile('survive_research_c1_nope'), null);
  sbx.cleanup();
});

test('swarm tracking: an abandoned outstanding cycle goes stale and unblocks a new one', () => {
  const sbx = makeSandbox();
  const rs = sbx.load('research-swarm-tasks');
  const old = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  fs.mkdirSync(path.dirname(rs.EVENTS_PATH), { recursive: true });
  fs.writeFileSync(rs.EVENTS_PATH, JSON.stringify({ ts: old, type: 'cycle-started', cycle: 5 }) + '\n');
  rs.writeTaskFile('survive_research_c5_prediction-markets', { payload: 'x' });
  const due = rs.isCycleDue(1);
  assert.equal(due.due, true);
  assert.equal(due.staleCycle, 5);
  assert.equal(due.staleUnresolved.length, 1);
  sbx.cleanup();
});

test('worker: real dispatch path with a fake codex, bad binary, hang timeout, true concurrency', async () => {
  const sbx = makeSandbox();
  sbx.useFakeCodex('out=""; while [ $# -gt 0 ]; do if [ "$1" = "--output-last-message" ]; then out="$2"; fi; shift; done; cat >/dev/null; sleep 1; printf OK > "$out"');
  const { dispatchCodexAsync, runPool } = sbx.load('research-swarm-worker');
  const one = await dispatchCodexAsync('hello');
  assert.equal(one.exitCode, 0);
  assert.equal(one.output, 'OK');
  // 4 x 1s at concurrency 2 -> ~2s (serial would be ~4s).
  const t0 = Date.now();
  await runPool([1, 2, 3, 4], 2, () => dispatchCodexAsync('x'));
  const el = (Date.now() - t0) / 1000;
  assert.ok(el < 3.5, `expected genuinely parallel, took ${el}s`);
  // Hang -> timeout kills it and resolves.
  sbx.useFakeCodex('cat >/dev/null; sleep 30');
  const t1 = Date.now();
  const hung = await dispatchCodexAsync('x', { timeoutMs: 800 });
  assert.equal(hung.exitCode, 1);
  assert.match(hung.stderr, /timed out/);
  assert.ok(Date.now() - t1 < 3000);
  // Missing binary -> resolves via the 'error' handler, never crashes.
  const cfgPath = path.join(sbx.scripts, 'agents', 'codex.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.binary = '/nonexistent/definitely-not-codex';
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  const bad = await dispatchCodexAsync('x');
  assert.equal(bad.exitCode, 1);
  assert.match(bad.stderr, /spawn error/);
  sbx.cleanup();
});
