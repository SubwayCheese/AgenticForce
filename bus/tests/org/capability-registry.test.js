// Plan 1 sec 11: "build or acquire" -- search the registry before proposing a build.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fresh() {
  const store = require('../../org/store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-capreg-'));
  store._setStoreDirForTesting(dir);
  return require('../../org/capability-registry.js');
}

test('register() requires the full schema (input/output schema, cost, permission, verification method)', () => {
  const reg = fresh();
  assert.throws(() => reg.register('x', { costEstimate: 1 }), /missing required field/);
});

test('findOrPropose(): an existing matching capability is reused, not rebuilt', () => {
  const reg = fresh();
  reg.register('fetch-sec-filing', { inputSchema: {}, outputSchema: {}, costEstimate: 0.01, permissionTier: 'A0_OBSERVE', verificationMethod: 'read-back', tags: ['sec', 'filings'], description: 'fetches an SEC filing by accession number' });
  const r = reg.findOrPropose({ query: 'sec filing', tags: ['sec'] });
  assert.equal(r.decision, 'acquire');
  assert.deepEqual(r.matches, ['fetch-sec-filing']);
});

test('findOrPropose(): nothing matches -> proposes a build, never fabricates a match', () => {
  const reg = fresh();
  const r = reg.findOrPropose({ query: 'scrape competitor pricing pages', tags: ['pricing'] });
  assert.equal(r.decision, 'propose-build');
  assert.equal(r.need.query, 'scrape competitor pricing pages');
});
