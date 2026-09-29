// Proposed addition for bus/tests/survive/entry-symbol-allowlist.test.js (owner-reviewed; NOT applied).
// Regression/coverage for: validateDecision() (survive-executor.js) previously accepted an 'enter' for ANY symbol string; an
// LLM typo, hallucinated ticker, or an explicitly-permitted "symbol NOT in the table" (survive-supervisor.js:357) reached
// client.submitOrder() with only Alpaca's own rejection as a backstop -- which currently wedges C1 (unwrapped submit/poll,
// see docs/proposals/2026-09-26-executor-submit-try-catch.md). This checks allowedEntrySymbols()/validateDecision() restrict
// an entry to the exact set of symbols recorded in that mission's own shadow snapshot (baseline AND scan alike), fail
// closed when no snapshot exists, and leave hold/no-action/exit untouched.
//
// Runs inside the sandbox (temp copy of the code dirs, network blocked via a synchronous-throwing fetch, ntfy stubbed). The
// live Alpaca client inside the sandbox is a small fake injected via globalThis.__fakeClient, same pattern as
// docs/proposals/executor-submit-try-catch/proposed-test.js; nothing real is ever called.
//
// Run against the applied tree:     node --test bus/tests/survive/entry-symbol-allowlist.test.js
// Run against a candidate executor: EXECUTOR_UNDER_TEST=/path/to/survive-executor.js node --test <this file>
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SANDBOX = process.env.SANDBOX_HELPER
  || [path.join(__dirname, '_sandbox.js'), path.join(__dirname, '..', '..', '..', 'bus', 'tests', 'survive', '_sandbox.js')].find((p) => fs.existsSync(p));
const { makeSandbox, seedCitizen } = require(SANDBOX);

const CID = 'T1';

// Sandbox copy of survive-alpaca-live-client.js that forwards every call to globalThis.__fakeClient -- identical technique
// to docs/proposals/executor-submit-try-catch/proposed-test.js, kept local so this file has no dependency on that one.
const CLIENT_STUB = `
const f = () => globalThis.__fakeClient;
module.exports = new Proxy({}, { get: (_, k) => (...a) => f()[k](...a) });
`;

// The executor's 1s poll waits are sped up to 0 (only exactly 1000ms, so the 5s quote-fetch timeout in placeProtectiveStop
// is left alone, same discipline as the stop-price and try-catch test suites).
const realSetTimeout = global.setTimeout;
function fastTimers() { global.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, ms === 1000 ? 0 : ms, ...a); }
function slowTimers() { global.setTimeout = realSetTimeout; }

function writeDecisionTask(sbx, missionId, decision) {
  fs.writeFileSync(sbx.file('tasks', 'survive', `survive_c${CID}_${missionId}_decision.md`), [
    `## survive_c${CID}_${missionId}_decision`, 'from: t', 'to: codex', 'type: request', 'status: done', 'payload: decide', 'timestamp: 2026-01-01T00:00:00Z', '',
    'output:', '````', '```json', JSON.stringify(decision), '```', '````', '',
  ].join('\n'));
}

function setup() {
  const sbx = makeSandbox();
  seedCitizen(sbx, CID, { genesis: 50 });
  if (process.env.EXECUTOR_UNDER_TEST) fs.copyFileSync(process.env.EXECUTOR_UNDER_TEST, sbx.dir('city', 'survive-executor.js'));
  fs.writeFileSync(sbx.dir('city', 'survive-alpaca-live-client.js'), CLIENT_STUB);
  return { sbx, ex: sbx.load('survive-executor'), envelope: sbx.load('survive-budget-envelope'), shadow: sbx.load('survive-shadow') };
}

// A minimal fake broker: entries/exits/stops all "fill" on the first getOrder read.
function fakeClient() {
  const c = {
    submits: [], cancels: [], getOrdersCalls: 0,
    getLatestQuote: async () => ({ bid: 100, ask: 100.02 }),
    getOrders: async () => { c.getOrdersCalls++; return []; },
    cancelOrder: async (id) => { c.cancels.push(id); },
    submitOrder: async (req) => { c.submits.push(req); return { id: `ord-${c.submits.length}`, status: 'filled' }; },
    getOrder: async (id) => ({ id, status: 'filled', filled_avg_price: '100', filled_qty: req_qty_for(id, c) }),
  };
  return c;
}
// The exit path checks filled_qty against the ledger's own recorded lot qty only loosely (Number(filled.filled_qty ||
// openLot.qty)); a fixed '0.2' is fine for every case exercised here (entry notional $20 @ $100 -> 0.2 sh; the seeded exit
// lot below also uses 0.2 sh), so no per-call bookkeeping is needed.
function req_qty_for() { return '0.2'; }

const events = (ex) => ex.readMissionEvents(CID);
const resolved = (ex, missionId) => events(ex).filter((e) => e.type === 'mission-resolved' && e.missionId === missionId);

async function run(fn) {
  const ctx = setup();
  globalThis.__fakeClient = fakeClient();
  fastTimers();
  try { await fn(ctx); } finally { slowTimers(); ctx.sbx.cleanup(); delete globalThis.__fakeClient; }
}

const candidate = (symbol, extra = {}) => ({ symbol, ok: true, bid: 100, ask: 100.02, mid: 100.01, spreadPct: 0.02, ...extra });

test('entering a symbol present in the mission\'s own snapshot succeeds', async () => {
  await run(async ({ ex, shadow, sbx }) => {
    shadow.recordSnapshot({ citizenId: CID, missionId: 'mission001', candidateData: [candidate('SGOV'), candidate('BIL')], marketOpen: true });
    writeDecisionTask(sbx, 'mission001', { decision: 'enter', symbol: 'SGOV', notionalUsd: 20, invalidationCondition: 'Exit 5% below entry.', rationale: 't' });
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'entered');
    assert.equal(globalThis.__fakeClient.submits.filter((s) => s.symbol === 'SGOV' && s.notional === 20).length, 1);
    assert.equal(resolved(ex, 'mission001')[0].outcome, 'entered');
  });
});

test('a symbol NOT in the mission\'s snapshot is refused: mission resolves error, reason names the universe, no order submitted', async () => {
  await run(async ({ ex, shadow, sbx }) => {
    shadow.recordSnapshot({ citizenId: CID, missionId: 'mission002', candidateData: [candidate('SGOV')], marketOpen: true });
    writeDecisionTask(sbx, 'mission002', { decision: 'enter', symbol: 'QQQ', notionalUsd: 20, invalidationCondition: 'Exit 5% below entry.', rationale: 't' });
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'error');
    const r = resolved(ex, 'mission002');
    assert.equal(r.length, 1);
    assert.equal(r[0].outcome, 'error');
    assert.match(r[0].reason, /not in this mission's candidate universe/);
    assert.match(r[0].reason, /SGOV/, 'the refusal names the allowed universe so a human can see why');
    assert.equal(globalThis.__fakeClient.submits.length, 0, 'no order of any kind was submitted');
    assert.equal(events(ex).some((e) => e.type === 'mission-entered'), false);
  });
});

test('a missing snapshot fails closed: refused, not silently allowed', async () => {
  await run(async ({ ex, sbx }) => {
    // No recordSnapshot call for mission003 at all.
    writeDecisionTask(sbx, 'mission003', { decision: 'enter', symbol: 'SGOV', notionalUsd: 20, invalidationCondition: 'Exit 5% below entry.', rationale: 't' });
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'error');
    assert.match(resolved(ex, 'mission003')[0].reason, /no candidate snapshot recorded for this mission/);
    assert.equal(globalThis.__fakeClient.submits.length, 0);
  });
});

test('an unreadable/corrupt snapshot (no parseable candidate line for this mission) also fails closed', async () => {
  await run(async ({ ex, shadow, sbx }) => {
    // A snapshot line that fails JSON.parse is silently dropped by readShadowEvents() -- simulate that directly by writing
    // garbage to the shadow file instead of a real recordSnapshot() call, so mission004 has zero valid snapshots.
    // survive-shadow.js's default path is path.join(VAULT_ROOT, 'bus', 'survive-shadow.jsonl'); sbx.dir(...) already joins
    // <sandbox root>/bus/..., so sbx.dir('survive-shadow.jsonl') is that exact path inside this sandbox.
    fs.appendFileSync(sbx.dir('survive-shadow.jsonl'), 'not valid json\n');
    writeDecisionTask(sbx, 'mission004', { decision: 'enter', symbol: 'SGOV', notionalUsd: 20, invalidationCondition: 'Exit 5% below entry.', rationale: 't' });
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'error');
    assert.match(resolved(ex, 'mission004')[0].reason, /no candidate snapshot recorded for this mission/);
    assert.equal(globalThis.__fakeClient.submits.length, 0);
  });
});

test('the allow-list covers a same-day SCAN-proposed symbol exactly like a baseline one (not hardcoded to the fixed 5)', async () => {
  await run(async ({ ex, shadow, sbx }) => {
    // XLE is not in SURVIVE_CANDIDATE_UNIVERSE (survive-supervisor.js) -- stands in for a market-scan candidate. The
    // snapshot format itself carries no baseline/scan tag (survive-shadow.js's recordSnapshot only keeps symbol/bid/ask/
    // mid/spreadPct), so the allow-list is exactly "whatever this mission's table showed", scan or not.
    shadow.recordSnapshot({ citizenId: CID, missionId: 'mission005', candidateData: [candidate('SGOV'), candidate('XLE')], marketOpen: true });
    writeDecisionTask(sbx, 'mission005', { decision: 'enter', symbol: 'xle', notionalUsd: 15, invalidationCondition: 'Exit 5% below entry.', rationale: 't' });
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'entered', 'a lower-case scan symbol present in the snapshot is accepted and normalized');
    assert.equal(globalThis.__fakeClient.submits.some((s) => s.symbol === 'XLE'), true);
  });
});

test('hold/no-action never consult the allow-list, even with zero snapshots', async () => {
  await run(async ({ ex, sbx }) => {
    writeDecisionTask(sbx, 'mission006', { decision: 'hold', symbol: 'SGOV', rationale: 'staying put' });
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'no-action');
    assert.equal(resolved(ex, 'mission006')[0].outcome, 'no-action');
    assert.equal(globalThis.__fakeClient.submits.length, 0);

    globalThis.__fakeClient.submits.length = 0;
    writeDecisionTask(sbx, 'mission007', { decision: 'no-action', rationale: 'nothing compelling' });
    const res2 = await ex.runForCitizen(CID);
    assert.equal(res2.outcome, 'no-action');
  });
});

test('exit is unaffected by the allow-list: it acts on the ledger\'s open lot, not decision.symbol, even with no snapshot', async () => {
  await run(async ({ ex, envelope, sbx }) => {
    // Seed an open position directly (no need to run a real entry mission first): a prior mission bought SGOV.
    envelope.recordOrderFill({ citizenId: CID, type: 'order-fill-buy', lotId: 'seed-lot', symbol: 'SGOV', qty: 0.2, price: 100, grossUsd: 20, feeUsd: 0, orderId: 'seed-order', missionId: 'seed' });
    ex.appendMissionEvent({ type: 'mission-entered', citizenId: CID, missionId: 'seed', symbol: 'SGOV', lotId: 'seed-lot', notionalUsd: 20, orderId: 'seed-order' });
    assert.equal(envelope.computeLifetimeLedger(CID).hasOpenPosition, true);

    // No shadow snapshot recorded for this exit mission at all.
    writeDecisionTask(sbx, 'mission008', { decision: 'exit', symbol: 'SGOV', rationale: 'bear case won' });
    const res = await ex.runForCitizen(CID);
    assert.equal(res.outcome, 'exited', 'exit must not be refused just because no candidate snapshot exists for this mission');
    assert.equal(globalThis.__fakeClient.submits.some((s) => s.direction === 'short' && s.symbol === 'SGOV'), true);
  });
});
