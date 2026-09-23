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
