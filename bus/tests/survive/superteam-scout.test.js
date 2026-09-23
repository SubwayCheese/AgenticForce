const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeSandbox } = require('./_sandbox.js');

const card = (listing, count) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { listing, dehydratedState: { queries: [{ queryKey: ['submissionCount', listing.id], state: { data: count } }] } } } })}</script></html>`;
const future = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const base = { id: 'id1', slug: 'write-a-guide', title: 'Write a beginner guide to Solana staking', description: 'Write a clear 800 word guide with sources.', requirements: '', status: 'OPEN', isPublished: true, isWinnersAnnounced: false, type: 'bounty', token: 'USDC', rewardAmount: 300, agentAccess: 'AGENT_ALLOWED', deadline: future(120), eligibility: [{ question: 'Link to your guide' }] };

test('parseCard reads the listing and the submission count from dehydratedState (not the listing)', () => {
  const sbx = makeSandbox(); const s = sbx.load('superteam-scout');
  const r = s.parseCard(card(base, 36));
  assert.equal(r.listing.slug, 'write-a-guide'); assert.equal(r.submissionCount, 36);
  assert.equal(s.parseCard(card(base, undefined)).submissionCount, null);
  assert.throws(() => s.parseCard('<html>nothing</html>'), /__NEXT_DATA__/);
  sbx.cleanup();
});

test('verifyListing: status stays OPEN after winners are announced, so it gates on the flag and on time left', () => {
  const sbx = makeSandbox(); const s = sbx.load('superteam-scout');
  assert.deepEqual(s.verifyListing(base), { ok: true, reasons: [] });
  assert.match(s.verifyListing({ ...base, isWinnersAnnounced: true }).reasons.join(), /winners already announced/);
  assert.match(s.verifyListing({ ...base, deadline: future(10) }).reasons.join(), /deadline within 48h/);
  assert.match(s.verifyListing({ ...base, deadline: future(-5) }).reasons.join(), /deadline/);
  assert.match(s.verifyListing({ ...base, status: 'COMPLETED' }).reasons.join(), /status/);
  sbx.cleanup();
});

test('fitReport rejects everything an agent must not do under the owner identity, and accepts a plain writing bounty', () => {
  const sbx = makeSandbox(); const s = sbx.load('superteam-scout');
  assert.deepEqual(s.fitReport(base), { fit: true, reasons: [] });
  const bad = (patch) => s.fitReport({ ...base, ...patch }).reasons;
  assert.ok(bad({ description: 'Post a thread on X and tag us' }).includes('x-twitter'));
  assert.ok(bad({ description: 'Record a 2 minute video' }).includes('video'));
  assert.ok(bad({ description: 'Connect your wallet and swap on mainnet' }).includes('wallet-or-onchain'));
  assert.ok(bad({ eligibility: [{ question: 'Your Discord handle' }] }).includes('community-membership'));
  assert.ok(bad({ description: 'Attend the Luma session' }).includes('attendance'));
  assert.ok(bad({ description: 'Open a pull request on our GitHub repo' }).includes('github-required'));
  assert.ok(bad({ type: 'project' }).some((r) => /type project/.test(r)));
  assert.ok(bad({ agentAccess: 'HUMAN_ONLY' }).some((r) => /agentAccess/.test(r)));
  assert.ok(bad({ token: 'SOL' }).some((r) => /token/.test(r)));
  sbx.cleanup();
});

test('scout(): verifies each candidate against its card, ignores human-only, alerts once per fit listing, never posts', async () => {
  const sbx = makeSandbox(); const s = sbx.load('superteam-scout');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-')); s._setLedgerPathForTesting(path.join(dir, 'l.jsonl'));
  const fit = { ...base }, xpost = { ...base, id: 'id2', slug: 'x-thread', title: 'Write an X thread', description: 'Post a thread on X' }, stale = { ...base, id: 'id3', slug: 'stale', isWinnersAnnounced: true };
  const feed = [fit, xpost, stale, { ...base, id: 'id4', slug: 'human', agentAccess: 'HUMAN_ONLY' }].map((l) => ({ slug: l.slug, agentAccess: l.agentAccess }));
  const cards = { 'write-a-guide': card(fit, 12), 'x-thread': card(xpost, 40), stale: card(stale, 5) };
  const calls = [];
  const fetchFn = async (url, opts = {}) => { calls.push({ url, method: opts.method || 'GET' }); const slug = url.split('/earn/listing/')[1];
    if (url.includes('/api/listings/')) return { ok: true, json: async () => feed };
    return { ok: true, text: async () => cards[slug] }; };
  const alerts = [];
  const r = await s.scout({ fetchFn, sendNtfy: async (m) => alerts.push(m.title) });
  assert.equal(r.scanned, 4); assert.equal(r.agentEligible, 3);
  assert.deepEqual(r.fit.map((f) => f.slug), ['write-a-guide']);
  assert.equal(r.fit[0].submissions, 12);
  assert.deepEqual(r.skipped.map((x) => x.slug).sort(), ['stale', 'x-thread']);
  assert.equal(alerts.length, 1);
  await s.scout({ fetchFn, sendNtfy: async (m) => alerts.push(m.title) });
  assert.equal(alerts.length, 1, 'the same fit listing is not alerted twice');
  assert.ok(calls.every((c) => c.method === 'GET'), 'scout is read-only');
  assert.ok(!calls.some((c) => /\/api\/agents/.test(c.url)), 'scout never touches the authenticated agent API');
  sbx.cleanup();
});
