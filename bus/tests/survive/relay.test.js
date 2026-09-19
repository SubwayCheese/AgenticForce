const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { makeSandbox } = require('./_sandbox.js');

// The real bug behind Round 15: run-task.js relays a parent's OUTPUT (not
// payload) to a child, so bull/bear's `verifiedFacts` must survive the
// decision-task fan-in byte for byte. Runs inside the sandbox tasks/ tree,
// never the real one the queue daemon watches.
test('verifiedFacts from bull and bear reach the decision context', () => {
  const sbx = makeSandbox();
  const runTask = sbx.load('run-task');
  const fp = (id) => sbx.file('tasks', `${id}.md`);
  const ids = { bull: 'survive/survive_cR_mission001_bull', bear: 'survive/survive_cR_mission001_bear', dec: 'survive/survive_cR_mission001_decision' };
  const facts = '{"bid":100.11,"ask":100.13,"spreadPct":0.02,"fractionable":true,"tradable":true,"availableCashUsd":50}';
  const writeDone = (id, json) => fs.writeFileSync(fp(id), [`## ${id}`, 'from: t', 'to: codex', 'type: request', 'status: done', 'payload: x', 'timestamp: 2026-01-01T00:00:00Z', '', 'output:', '````', '```json', json, '```', '````', ''].join('\n'));
  writeDone(ids.bull, `{"stance":"bullish","symbol":"SGOV","keyPoints":["k"],"verifiedFacts":${facts},"confidence":"medium"}`);
  writeDone(ids.bear, `{"stance":"bearish","concerns":["c"],"verifiedFacts":${facts},"confidence":"low"}`);
  fs.writeFileSync(fp(ids.dec), [`## ${ids.dec}`, 'from: t', 'to: codex', 'type: request', 'status: pending', 'payload: decide', 'timestamp: 2026-01-01T00:00:00Z', `dependsOnTaskIds: ${ids.bull},${ids.bear}`, ''].join('\n'));
  const dep = runTask.resolveTaskDependencies(ids.dec, runTask.readTaskFile(ids.dec));
  assert.equal(dep.ok, true, dep.reason);
  assert.equal((dep.injectedContext.match(/"verifiedFacts":\{"bid":100\.11/g) || []).length, 2);
  assert.ok(dep.injectedContext.includes('"availableCashUsd":50'));
  sbx.cleanup();
});
