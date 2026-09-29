// Proposed addition for bus/tests/survive/entry-submit-errors.test.js (owner-reviewed; NOT applied).
// Regression for: executeEntry() (survive-executor.js) had no try/catch around client.submitOrder()/client.getOrder(), so a
// rejected submit or a failed status read escaped runForCitizen() with no mission-resolved event. The supervisor then re-ran
// the same decision every wake (same deterministic client order id) and the citizen wedged for good; a poll failure could also
// leave a real fill unrecorded in the ledger.
//
// Runs inside the sandbox (temp copy of the code dirs, network blocked, ntfy stubbed). The live Alpaca client inside the
// sandbox is replaced by a stub that forwards to an injected fake, so nothing real can be called.
//
// Run against the applied tree:        node --test bus/tests/survive/entry-submit-errors.test.js
// Run against a candidate executor:    EXECUTOR_UNDER_TEST=/path/to/survive-executor.js node --test <this file>
// Optional client under test (case (k) only; default = the tree's client):  CLIENT_UNDER_TEST=/path/to/survive-alpaca-live-client.js
// (the docs/ copy resolves the sandbox helper from bus/tests/survive; see SANDBOX below)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SANDBOX = process.env.SANDBOX_HELPER
  || [path.join(__dirname, '_sandbox.js'), path.join(__dirname, '..', '..', '..', 'bus', 'tests', 'survive', '_sandbox.js')].find((p) => fs.existsSync(p));
const { makeSandbox, seedCitizen } = require(SANDBOX);

const CID = 'T1';
const MISSION = 'mission001';

// Sandbox copy of survive-alpaca-live-client.js that forwards every call to globalThis.__fakeClient.
const CLIENT_STUB = `
const f = () => globalThis.__fakeClient;
module.exports = new Proxy({}, { get: (_, k) => (f() && typeof f()[k] === 'function' ? (...a) => f()[k](...a) : undefined) });
`;

// The 1s waits in the executor's poll loop are sped up (only exactly 1000ms; the 5s quote timeout is left alone).
const realSetTimeout = global.setTimeout;
function fastTimers() { global.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms === 1000 ? 0 : ms, ...a); }
function slowTimers() { global.setTimeout = realSetTimeout; }

function setup() {
  const sbx = makeSandbox();
  seedCitizen(sbx, CID, { genesis: 50 });
  if (process.env.EXECUTOR_UNDER_TEST) fs.copyFileSync(process.env.EXECUTOR_UNDER_TEST, sbx.dir('city', 'survive-executor.js'));
  // keep the untouched client beside the stub for case (k)
  fs.copyFileSync(process.env.CLIENT_UNDER_TEST || sbx.dir('city', 'survive-alpaca-live-client.js'), sbx.dir('city', 'survive-alpaca-live-client.real.js'));
  fs.writeFileSync(sbx.dir('city', 'survive-alpaca-live-client.js'), CLIENT_STUB);
  // A candidate snapshot for this mission, so the entry-symbol-allowlist proposal (when stacked on top of this patch)
  // sees SGOV as an allowed symbol -- without this, validateDecision fails closed ("no candidate snapshot recorded")
  // and every case below fails for a reason unrelated to what this file tests. Real missions always record one
  // (authorNewMission, before the task chain is created); this mirrors that.
  sbx.load('survive-shadow').recordSnapshot({ citizenId: CID, missionId: MISSION, marketOpen: true, candidateData: [{ ok: true, symbol: 'SGOV', bid: 100, ask: 100.02, mid: 100.01, spreadPct: 0.0002 }] });
  const decision = { decision: 'enter', symbol: 'SGOV', notionalUsd: 20, invalidationCondition: 'Exit if it falls 5% below entry.', rationale: 'test' };
  fs.writeFileSync(sbx.file('tasks', 'survive', `survive_c${CID}_${MISSION}_decision.md`), [
    `## survive_c${CID}_${MISSION}_decision`, 'from: t', 'to: codex', 'type: request', 'status: done', 'payload: decide', 'timestamp: 2026-01-01T00:00:00Z', '',
    'output:', '````', '```json', JSON.stringify(decision), '```', '````', '',
  ].join('\n'));
  return { sbx, ex: sbx.load('survive-executor'), envelope: sbx.load('survive-budget-envelope'), registry: sbx.load('city-registry') };
}

// A fake client. `getOrder` is a function (call#, id) => order | throws.
function fakeClient(o = {}) {
  const c = {
    submits: [], cancels: [], getOrderCalls: 0,
    getLatestQuote: async () => ({ bid: 100, ask: 100.02 }),
    getOrders: o.getOrders || (async () => []),
    cancelOrder: async (id) => { c.cancels.push(id); },
    submitOrder: async (req) => {
      c.submits.push(req);
      if (req.orderType === 'stop') return { id: 'stop-1' };
      if (o.submitOrder) return o.submitOrder(req);
      return { id: 'entry-1', status: 'accepted' };
    },
    getOrder: async (id) => { c.getOrderCalls++; return o.getOrder(c.getOrderCalls, id); },
  };
  return c;
}
const FILLED = { id: 'entry-1', status: 'filled', filled_avg_price: '100', filled_qty: '0.2' };

const events = (ex) => ex.readMissionEvents(CID);
const resolved = (ex) => events(ex).filter((e) => e.type === 'mission-resolved');
async function run(t, client, fn) {
  const { sbx, ex, envelope, registry } = setup();
  globalThis.__fakeClient = client;
  fastTimers();
  try { await fn({ ex, envelope, registry, sbx }); } finally { slowTimers(); sbx.cleanup(); delete globalThis.__fakeClient; }
}

test('(a) submitOrder rejected (422): mission resolved as error, nothing escapes, not wedged, not re-submitted', async (t) => {
  const c = fakeClient({ submitOrder: async () => { throw new Error('Live Alpaca API POST /orders -> 422: asset SGOV is not fractionable'); } });
  await run(t, c, async ({ ex, registry }) => {
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'error');
    const r = resolved(ex);
    assert.equal(r.length, 1);
    assert.equal(r[0].outcome, 'error');
    assert.match(r[0].reason, /not placed/);
    assert.match(r[0].reason, /not fractionable/);
    assert.equal(ex.findLatestUnresolvedDecision(CID), null, 'mission must not stay unresolved (wedge)');
    const again = await ex.runForCitizen(CID);
    assert.equal(again.ranAnything, false);
    assert.equal(c.submits.length, 1, 'no blind second submission');
    assert.ok(!registry.getCitizen(CID).quarantined, 'a plain rejection needs no freeze');
    assert.ok(!events(ex).some((e) => e.type === 'mission-entered'));
  });
});

test('(b) getOrder throws twice then succeeds: fill is recorded', async (t) => {
  const c = fakeClient({ getOrder: async (n) => { if (n <= 2) throw new Error('fetch failed'); return FILLED; } });
  await run(t, c, async ({ ex, envelope }) => {
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'entered');
    assert.equal(events(ex).filter((e) => e.type === 'mission-entered').length, 1);
    assert.equal(envelope.computeLifetimeLedger(CID).hasOpenPosition, true);
    assert.equal(resolved(ex)[0].outcome, 'entered');
  });
});

test('(c) getOrder always throws: resolved as error with the order id, citizen frozen, no second buy', async (t) => {
  const c = fakeClient({ getOrder: async () => { throw new Error('fetch failed'); } });
  await run(t, c, async ({ ex, registry, sbx }) => {
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'error');
    assert.equal(res.orderId, 'entry-1');
    const r = resolved(ex);
    assert.equal(r.length, 1);
    assert.equal(r[0].outcome, 'error');
    assert.match(r[0].reason, /entry-1/);
    assert.match(r[0].reason, /reconciled/);
    assert.equal(ex.findLatestUnresolvedDecision(CID), null);
    assert.ok(c.cancels.includes('entry-1'), 'best-effort cancel of the possibly-pending order');
    assert.equal(registry.getCitizen(CID).quarantined, true, 'frozen until a human reconciles');
    assert.ok(sbx.ntfyCalls().some((m) => /UNKNOWN/.test(m.title) && m.priority === 5));
    // Next wake: nothing runs, and even a fresh entry decision would be blocked by the quarantine.
    assert.equal((await ex.runForCitizen(CID)).ranAnything, false);
    assert.equal(c.submits.length, 1);
  });
});

test('(d) happy path unchanged: market fill on first poll, stop placed, mission entered', async (t) => {
  const c = fakeClient({ getOrder: async () => FILLED });
  await run(t, c, async ({ ex, envelope, registry }) => {
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'entered');
    assert.equal(res.stopResult.stopPlaced, true);
    assert.equal(res.fillPrice, 100);
    assert.equal(res.filledQty, 0.2);
    assert.deepEqual(events(ex).map((e) => e.type), ['mission-entered', 'stop-placed', 'mission-resolved']);
    assert.equal(c.submits[0].clientOrderId, `survive-${CID}-${MISSION}-entry`);
    assert.equal(c.submits.length, 2); // entry + stop
    assert.equal(envelope.computeLifetimeLedger(CID).hasOpenPosition, true);
    assert.ok(!registry.getCitizen(CID).quarantined);
  });
});

test('(d2) terminal status path unchanged: canceled order -> error naming Alpaca, no freeze', async (t) => {
  const c = fakeClient({ getOrder: async () => ({ id: 'entry-1', status: 'canceled' }) });
  await run(t, c, async ({ ex, registry }) => {
    const res = await ex.runForCitizen(CID);
    assert.deepEqual([res.outcome, res.reason], ['error', 'canceled']);
    assert.match(resolved(ex)[0].reason, /canceled by Alpaca \(not a timeout\)/);
    assert.ok(!registry.getCitizen(CID).quarantined);
  });
});

test('(e) submit "failed" but Alpaca had accepted it (found by client order id): carried on and recorded', async (t) => {
  const c = fakeClient({
    submitOrder: async () => { throw new Error('fetch failed'); },
    getOrders: async () => [{ id: 'entry-1', client_order_id: `survive-${CID}-${MISSION}-entry`, status: 'filled' }],
    getOrder: async () => FILLED,
  });
  await run(t, c, async ({ ex, envelope }) => {
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'entered');
    assert.equal(envelope.computeLifetimeLedger(CID).hasOpenPosition, true);
    assert.equal(c.submits.filter((r) => r.orderType !== 'stop').length, 1);
  });
});

test('(f) submit failed with no HTTP status AND the account cannot be checked: error + freeze (order may exist)', async (t) => {
  const c = fakeClient({
    submitOrder: async () => { throw new Error('fetch failed'); },
    getOrders: async () => { throw new Error('fetch failed'); },
  });
  await run(t, c, async ({ ex, registry }) => {
    const res = await ex.runForCitizen(CID);
    assert.deepEqual([res.outcome, res.reason], ['error', 'entry-submit-unknown']);
    assert.equal(registry.getCitizen(CID).quarantined, true);
    assert.match(resolved(ex)[0].reason, /reconciled/);
    assert.match(resolved(ex)[0].reason, new RegExp(`survive-${CID}-${MISSION}-entry`));
  });
});

test('(g) a 4xx refusal with the account lookup down is still a plain error (Alpaca refused it), no freeze', async (t) => {
  const c = fakeClient({
    submitOrder: async () => { throw new Error('Live Alpaca API POST /orders -> 403: insufficient buying power'); },
    getOrders: async () => { throw new Error('fetch failed'); },
  });
  await run(t, c, async ({ ex, registry }) => {
    const res = await ex.runForCitizen(CID);
    assert.deepEqual([res.outcome, res.reason], ['error', 'entry-submit-failed']);
    assert.ok(!registry.getCitizen(CID).quarantined);
  });
});

test('(h) duplicate client order id (422) with the order actually present is adopted, not treated as a failure', async (t) => {
  const c = fakeClient({
    submitOrder: async () => { throw new Error('Live Alpaca API POST /orders -> 422: client_order_id must be unique'); },
    getOrders: async () => [{ id: 'entry-1', client_order_id: `survive-${CID}-${MISSION}-entry`, status: 'filled' }],
    getOrder: async () => FILLED,
  });
  await run(t, c, async ({ ex }) => {
    assert.equal((await ex.runForCitizen(CID)).outcome, 'entered');
  });
});

// ---- review round 2: unknown outcomes must freeze even when the order lookup answers "nothing there" ----
const timeoutErr = () => Object.assign(new Error('Live Alpaca request timed out after 15000ms: POST /orders -- OUTCOME UNKNOWN'), { code: 'ALPACA_TIMEOUT', outcomeUnknown: true });

test('(i) submit TIMES OUT (outcome unknown), lookup succeeds but is empty: quarantined + alert, no second submit', async (t) => {
  let lookups = 0;
  const c = fakeClient({ submitOrder: async () => { throw timeoutErr(); }, getOrders: async () => { lookups++; return []; } });
  await run(t, c, async ({ ex, registry, sbx }) => {
    const res = await ex.runForCitizen(CID);
    assert.deepEqual([res.outcome, res.reason], ['error', 'entry-submit-unknown']);
    assert.equal(lookups, 2, 'lookup is retried once');
    assert.equal(registry.getCitizen(CID).quarantined, true);
    assert.ok(sbx.ntfyCalls().some((m) => /UNKNOWN/.test(m.title) && m.priority === 5));
    assert.match(resolved(ex)[0].reason, /reconciled/);
    assert.equal((await ex.runForCitizen(CID)).ranAnything, false);
    assert.equal(c.submits.length, 1);
  });
});

test('(i2) a plain "fetch failed" on submit with an empty lookup (no HTTP status) is also an unknown outcome', async (t) => {
  const c = fakeClient({ submitOrder: async () => { throw new Error('fetch failed'); }, getOrders: async () => [] });
  await run(t, c, async ({ ex, registry }) => {
    assert.equal((await ex.runForCitizen(CID)).reason, 'entry-submit-unknown');
    assert.equal(registry.getCitizen(CID).quarantined, true);
  });
});

test('(ii) DEFINITE refusals (422, and a client-side pre-network refusal) with an empty lookup: error, NOT quarantined, no alert', async (t) => {
  for (const msg of ['Live Alpaca API POST /orders -> 422: asset SGOV is not fractionable', 'limitPrice required for a limit order', 'Budget envelope refused this order for citizen T1: x']) {
    const c = fakeClient({ submitOrder: async () => { throw new Error(msg); }, getOrders: async () => [] });
    await run(t, c, async ({ ex, registry, sbx }) => {
      const res = await ex.runForCitizen(CID);
      assert.deepEqual([res.outcome, res.reason], ['error', 'entry-submit-failed'], msg);
      assert.ok(!registry.getCitizen(CID).quarantined, msg);
      assert.ok(!sbx.ntfyCalls().some((m) => /UNKNOWN/.test(m.title)), msg);
      assert.equal(ex.findLatestUnresolvedDecision(CID), null);
    });
  }
});

test('(ii2) a submit error with outcomeUnknown is never a definite refusal, even if its text contains "-> 4xx:"', async (t) => {
  const c = fakeClient({ submitOrder: async () => { throw Object.assign(new Error('weird -> 422: x'), { outcomeUnknown: true }); }, getOrders: async () => [] });
  await run(t, c, async ({ ex }) => { assert.equal((await ex.runForCitizen(CID)).reason, 'entry-submit-unknown'); });
});

test('(iii) lookup is retried once: order absent on the first try, present on the second -> adopted and recorded', async (t) => {
  let lookups = 0;
  const c = fakeClient({
    submitOrder: async () => { throw timeoutErr(); },
    getOrders: async () => (++lookups === 1 ? [] : [{ id: 'entry-1', client_order_id: `survive-${CID}-${MISSION}-entry`, status: 'filled' }]),
    getOrder: async () => FILLED,
  });
  await run(t, c, async ({ ex, envelope, registry }) => {
    assert.equal((await ex.runForCitizen(CID)).outcome, 'entered');
    assert.equal(lookups, 2);
    assert.equal(envelope.computeLifetimeLedger(CID).hasOpenPosition, true);
    assert.ok(!registry.getCitizen(CID).quarantined);
  });
});

test('(iii2) exact lookup (getOrderByClientOrderId) is preferred; a 404 first, then found; id is normalized like the client does', async (t) => {
  const asked = [];
  const c = fakeClient({
    submitOrder: async () => { throw timeoutErr(); },
    getOrder: async () => FILLED,
  });
  c.normalizeClientOrderId = (raw) => `N-${raw}`; // stands in for the client's normalizer
  c.getOrders = async () => { throw new Error('the list scan must not be used when the exact lookup exists'); };
  c.getOrderByClientOrderId = async (id) => { asked.push(id); if (asked.length === 1) throw new Error('Live Alpaca API GET /orders:by_client_order_id -> 404: order not found'); return { id: 'entry-1', client_order_id: id, status: 'filled' }; };
  await run(t, c, async ({ ex }) => {
    assert.equal((await ex.runForCitizen(CID)).outcome, 'entered');
    assert.deepEqual(asked, [`N-survive-${CID}-${MISSION}-entry`, `N-survive-${CID}-${MISSION}-entry`]);
  });
});

test('(iii3) list scan matches on the NORMALIZED client order id', async (t) => {
  const c = fakeClient({ submitOrder: async () => { throw timeoutErr(); }, getOrder: async () => FILLED });
  c.normalizeClientOrderId = (raw) => `N-${raw}`;
  c.getOrders = async () => [{ id: 'entry-1', client_order_id: `N-survive-${CID}-${MISSION}-entry`, status: 'filled' }];
  await run(t, c, async ({ ex }) => { assert.equal((await ex.runForCitizen(CID)).outcome, 'entered'); });
});

// (k) the OPTIONAL client addition (survive-alpaca-live-client.patch). Skipped unless the client under test has the method.
test('(k) client.getOrderByClientOrderId requests /orders:by_client_order_id with the normalized id', async (t) => {
  const { sbx } = setup();
  try {
    fs.writeFileSync(sbx.file('bus', 'secrets.local.json'), JSON.stringify({ ALPACA_SURVIVE_LIVE_KEY: 'k', ALPACA_SURVIVE_LIVE_SECRET: 's', ALPACA_SURVIVE_LIVE_ENDPOINT: 'https://api.alpaca.markets/v2' }));
    const orig = sbx.dir('city', 'survive-alpaca-live-client.real.js');
    const real = require(orig);
    if (typeof real.getOrderByClientOrderId !== 'function') return t.skip('client has no getOrderByClientOrderId (survive-alpaca-live-client.patch not applied)');
    const urls = [];
    globalThis.fetch = async (url) => { urls.push(url); return { ok: true, status: 200, text: async () => '{"id":"x"}' }; };
    await real.getOrderByClientOrderId('survive-C1-mission012-entry');
    assert.equal(urls[0], 'https://api.alpaca.markets/v2/orders:by_client_order_id?client_order_id=survive-C1-mission012-entry');
  } finally { sbx.cleanup(); }
});
