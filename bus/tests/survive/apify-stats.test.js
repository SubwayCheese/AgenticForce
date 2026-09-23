const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeSandbox } = require('./_sandbox.js');

test('apify-stats: collects per-actor stats read-only and diffs against the previous snapshot', async () => {
  const sbx = makeSandbox(); const st = sbx.load('apify-stats');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-')); st._setLogPathForTesting(path.join(dir, 's.jsonl'));
  const calls = [];
  const mk = (runs) => async (url, opts = {}) => { calls.push(opts.method || 'GET'); const p = url.replace('https://api.apify.com/v2', '');
    const data = p.startsWith('/acts?') ? { items: [{ id: 'a1' }] }
      : { name: 'sec-form4-insiders', isPublic: true, pricingInfos: [{ pricingModel: 'PAY_PER_EVENT' }], stats: { totalRuns: runs, totalUsers: 2, lastRunStartedAt: '2026-09-19T00:00:00Z' } };
    return { ok: true, json: async () => ({ data }) }; };
  const first = await st.collect({ token: 't', fetchFn: mk(5) });
  assert.deepEqual(first.actors[0], { name: 'sec-form4-insiders', public: true, priced: true, runs: 5, users: 2, lastRunStartedAt: '2026-09-19T00:00:00Z' });
  const second = await st.collect({ token: 't', fetchFn: mk(9) });
  const d = st.diff(first, second)[0];
  assert.equal(d.runsDelta, 4); assert.equal(d.usersDelta, 0);
  assert.equal(st.diff(null, second)[0].runsDelta, null);
  assert.ok(calls.every((c) => c === 'GET'), 'read-only');
  sbx.cleanup();
});
