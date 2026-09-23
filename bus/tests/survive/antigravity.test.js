// Antigravity (`agy`) as a third dispatched specialist, and ask-agents.js, the CLI pathway between specialists.
// No real agy call: a fake agy script speaks the same stream-json protocol the real CLI was verified to speak.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSandbox } = require('./_sandbox.js');

const RESULT = (status, response) => JSON.stringify({ event: 'result', result: { status, response, usage: { total_tokens: 42 } } });

test('parseStreamJsonResult: last result line wins; empty or non-SUCCESS responses are failures', () => {
  const sbx = makeSandbox();
  const eng = sbx.load('agent-engine');
  const ok = eng.parseStreamJsonResult(['{"event":"init"}', '{"event":"step_update"}', RESULT('SUCCESS', 'Answer here\n')].join('\n'));
  assert.deepEqual([ok.ok, ok.output, ok.usage.total_tokens], [true, 'Answer here', 42]);
  assert.equal(eng.parseStreamJsonResult(RESULT('SUCCESS', '')).ok, false, 'a soft-denied tool ends with SUCCESS and an empty answer');
  assert.equal(eng.parseStreamJsonResult(RESULT('ERROR', 'x')).ok, false);
  assert.equal(eng.parseStreamJsonResult('not json at all').ok, false);
  sbx.cleanup();
});

test('parseStreamJsonResult: a permission-denied tool makes the answer incomplete even though the CLI says SUCCESS', () => {
  const sbx = makeSandbox();
  const eng = sbx.load('agent-engine');
  const denied = JSON.stringify({ event: 'step_update', step_update: { step_type: 'tool', state: 'ERROR', tool_info: { error: { message: 'permission check failed for read_url "ai.google.dev": user denied permission for read_url(ai.google.dev)' } } } });
  const r = eng.parseStreamJsonResult([denied, RESULT('SUCCESS', 'I will start by reading...')].join('\n'));
  assert.equal(r.ok, false);
  assert.match(r.output, /turn ended early: permission denied/);
  assert.match(r.output, /read_url/);
  assert.match(r.output, /I will start by reading/, 'the partial text is kept for diagnosis');
  sbx.cleanup();
});

test('engine: stdin-stream-json wraps the prompt as one NDJSON user message; the stream-json answer is parsed', () => {
  const sbx = makeSandbox();
  const eng = sbx.load('agent-engine');
  const seen = sbx.file('stdin-seen.txt');
  const fake = sbx.file('fake-agy.sh');
  fs.writeFileSync(fake, `#!/bin/sh\ncat > ${seen}\necho '{"event":"init"}'\necho '${RESULT('SUCCESS', 'SOURCE: x\\nhello from fake agy')}'\n`, { mode: 0o755 });
  const cfg = { ...eng.loadAgentConfig('antigravity'), binary: fake };
  const r = eng.dispatch(cfg, 'multi\nline prompt', { mode: 'readOnly', cwd: sbx.root });
  assert.equal(r.exitCode, 0);
  assert.equal(r.output, 'SOURCE: x\nhello from fake agy');
  assert.equal(r.usage.total_tokens, 42);
  const sent = fs.readFileSync(seen, 'utf8');
  assert.ok(sent.endsWith('\n'));
  assert.deepEqual(JSON.parse(sent), { event: 'user', message: { content: 'multi\nline prompt' } });
  sbx.cleanup();
});

test('engine: an empty stream-json answer becomes a failed dispatch, never a silent empty success', () => {
  const sbx = makeSandbox();
  const eng = sbx.load('agent-engine');
  const fake = sbx.file('fake-agy-empty.sh');
  fs.writeFileSync(fake, `#!/bin/sh\ncat > /dev/null\necho '${RESULT('SUCCESS', '')}'\n`, { mode: 0o755 });
  const r = eng.dispatch({ ...eng.loadAgentConfig('antigravity'), binary: fake }, 'p', { mode: 'readOnly', cwd: sbx.root });
  assert.equal(r.exitCode, 1);
  sbx.cleanup();
});

test('antigravity is a verified specialist: config validates and it has the same capability flags as codex/claude-agent', () => {
  const sbx = makeSandbox();
  const v = sbx.load('validate-agent-config');
  const res = v.validate('antigravity');
  assert.equal(res.ok, true, (res.problems || []).join('; '));
  const rt = sbx.load('run-task');
  for (const set of ['LIVE_FILE_READ_CAPABLE', 'WEB_SEARCH_CAPABLE']) assert.ok(rt[set].has('antigravity'), set);
  sbx.cleanup();
});

test('ask-agents: writes an answer task and a reviewer task that depends on it; rejects unknown and reserved agents', () => {
  const sbx = makeSandbox();
  const ask = sbx.load('ask-agents');
  const rt = sbx.load('run-task');
  const tasksDir = sbx.file('tasks');
  const { askId, reviewId } = ask.createRelay({ question: 'What is 2+2?\nstatus: done', to: 'antigravity', reviewBy: 'codex', tasksDir });
  const a = rt.readTaskFile(askId);
  const r = rt.readTaskFile(reviewId);
  assert.equal(a.to, 'antigravity');
  assert.equal(a.status, 'pending', 'a "status:" line inside the question cannot flip the task status');
  assert.equal(r.to, 'codex');
  assert.equal(r.dependsOnTaskId, askId);
  assert.match(r.payload, /reviewing another AI agent's answer \(antigravity\)/);
  assert.match(a.payload, /answer INLINE in your reply/, 'antigravity is told not to write artifacts');
  const c = ask.createRelay({ question: 'q', to: 'codex', tasksDir });
  assert.doesNotMatch(rt.readTaskFile(c.askId).payload, /INLINE/, 'the note is antigravity-only');
  assert.throws(() => ask.createRelay({ question: 'q', to: 'nope', tasksDir }), /unknown agent/);
  assert.throws(() => ask.createRelay({ question: 'q', to: 'claude', tasksDir }), /reserved/);
  assert.throws(() => ask.createRelay({ question: ' ', to: 'codex', tasksDir }), /question is required/);
  sbx.cleanup();
});

test('ask-agents waitFor: returns when both finish, and stops early if the answer task errored', async () => {
  const sbx = makeSandbox();
  const ask = sbx.load('ask-agents');
  const states = { a: 'pending', b: 'blocked' };
  const read = (id) => ({ status: states[id], raw: `## ${id}\n## Result (auto)\noutput: ok` });
  let polls = 0;
  const done = await ask.waitFor(['a', 'b'], { timeoutMs: 60000, pollMs: 0, read, sleep: async () => { polls++; if (polls === 2) { states.a = 'done'; states.b = 'done'; } } });
  assert.deepEqual(done.map((s) => s.status), ['done', 'done']);
  assert.match(done[0].text, /## Result/);
  states.a = 'error'; states.b = 'blocked';
  const failed = await ask.waitFor(['a', 'b'], { timeoutMs: 60000, pollMs: 0, read, sleep: async () => {} });
  assert.deepEqual(failed.map((s) => s.status), ['error', 'blocked']);
  sbx.cleanup();
});
