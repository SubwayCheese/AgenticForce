// resolveTopic: logical topic names in code map to unguessable real topics from the (gitignored) secrets file.
// The sandbox replaces ntfy.js with a recording stub, so the REAL module is required directly, with an injected lookup
// (never the live secrets file).
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTopic } = require('../../platform/ntfy.js');

test('a configured mapping wins; the key is NTFY_TOPIC_<LOGICALNAME uppercased, alphanumerics only>', () => {
  const seen = [];
  const lookup = (k) => { seen.push(k); return k === 'NTFY_TOPIC_AGENTVAULTSURVIVE' ? 'abcdEFGH12345678wxyz' : null; };
  assert.equal(resolveTopic('AgentVaultSurvive', lookup), 'abcdEFGH12345678wxyz');
  assert.deepEqual(seen, ['NTFY_TOPIC_AGENTVAULTSURVIVE']);
});

test('no mapping, an unusable mapping, or a throwing lookup all fall back to the logical name', () => {
  assert.equal(resolveTopic('ClaudeTeam', () => null), 'ClaudeTeam');
  assert.equal(resolveTopic('ClaudeTeam', () => 'short'), 'ClaudeTeam', 'too short to be unguessable');
  assert.equal(resolveTopic('ClaudeTeam', () => 'has spaces and/slashes-in-it-xxxxxxxx'), 'ClaudeTeam', 'must be url-safe');
  assert.equal(resolveTopic('ClaudeTeam', () => { throw new Error('secrets unreadable'); }), 'ClaudeTeam');
});

// Codex round-4 (2026-09-29): a send that never completes used to hang forever -- and the supervisor now awaits alerts
// while holding the C1 execution lock, so a hung send would lock the stop guard out. Every send has an absolute deadline.
const { EventEmitter } = require('events');
const { sendNtfy } = require('../../platform/ntfy.js');

function hangingRequest() {
  const state = { destroyed: null };
  const request = () => {
    const req = new EventEmitter();
    req.write = () => {};
    req.end = () => {};
    req.destroy = (err) => { state.destroyed = err || true; setImmediate(() => req.emit('error', err || new Error('destroyed'))); };
    return req; // never calls the response callback
  };
  return { request, state };
}

test('a send that never gets a response rejects at the deadline and destroys the request', async () => {
  const { request, state } = hangingRequest();
  const t0 = Date.now();
  await assert.rejects(sendNtfy({ topic: 'ClaudeTeam', message: 'x', timeoutMs: 200, request, resolveTopicFn: (t) => t }), /timed out/i);
  assert.ok(Date.now() - t0 < 2000, 'rejected promptly');
  assert.ok(state.destroyed, 'the request was destroyed, not left dangling');
});

test('a response body that never ends also hits the deadline', async () => {
  const request = (opts, onRes) => {
    const req = new EventEmitter();
    req.write = () => {};
    req.end = () => { const res = new EventEmitter(); res.statusCode = 200; onRes(res); res.emit('data', 'partial'); };
    req.destroy = (err) => setImmediate(() => req.emit('error', err));
    return req;
  };
  await assert.rejects(sendNtfy({ topic: 'ClaudeTeam', message: 'x', timeoutMs: 200, request, resolveTopicFn: (t) => t }), /timed out/i);
});

test('a normal send resolves with the status and clears its deadline', async () => {
  const request = (opts, onRes) => {
    const req = new EventEmitter();
    req.write = () => {};
    req.end = () => { const res = new EventEmitter(); res.statusCode = 200; onRes(res); res.emit('data', 'ok'); res.emit('end'); };
    req.destroy = () => { throw new Error('must not destroy a finished request'); };
    return req;
  };
  const r = await sendNtfy({ topic: 'ClaudeTeam', message: 'x', timeoutMs: 200, request, resolveTopicFn: (t) => t });
  assert.equal(r.statusCode, 200);
  await new Promise((res) => setTimeout(res, 300)); // past the deadline: nothing fires
});
