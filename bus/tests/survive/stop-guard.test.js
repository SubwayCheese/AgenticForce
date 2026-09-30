// survive-stop-guard.test.js -- coverage for bus/city/survive-stop-guard.js, the C1 live-money stop re-armer. Every
// network dependency is faked; the sandbox blocks real network/secrets access so nothing here can touch a live account.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSandbox, seedCitizen } = require('./_sandbox.js');

function setup() {
  const sbx = makeSandbox();
  return {
    sbx,
    sg: sbx.load('survive-stop-guard'),
    ex: sbx.load('survive-executor'),
    envelope: sbx.load('survive-budget-envelope'),
    registry: sbx.load('city-registry'),
  };
}

function setLastEventTs(sbx, isoTs) {
  const p = sbx.dir('survive-ledger.jsonl');
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.trim());
  const last = JSON.parse(lines[lines.length - 1]);
  last.ts = isoTs;
  lines[lines.length - 1] = JSON.stringify(last);
  fs.writeFileSync(p, lines.join('\n') + '\n');
}

function seedOpenLot({ sbx, envelope, citizenId, symbol = 'SGOV', qty = 0.5, price = 100, fillTs, missionId = 'mission001' }) {
  seedCitizen(sbx, citizenId, { genesis: 50 });
  const lotId = `survive_${citizenId}_${symbol.toLowerCase()}lot1`;
  envelope.recordOrderFill({ citizenId, type: 'order-fill-buy', lotId, symbol, qty, price, grossUsd: price * qty, feeUsd: 0, orderId: 'entry-ord-1', missionId });
  if (fillTs) setLastEventTs(sbx, fillTs);
  return lotId;
}

// Deterministic "now": 11:00 ET on a Tuesday, well inside market hours (13:30-20:00 UTC in EDT), 5h from the 16:00 ET
// close so the 10-minute gate never trips by accident in a test that isn't specifically testing it.
const NOW = new Date('2026-09-29T15:00:00.000Z');
function clockFor(now, { isOpen = true, nextCloseMinutes = 300 } = {}) {
  return { is_open: isOpen, next_close: new Date(new Date(now).getTime() + nextCloseMinutes * 60000).toISOString() };
}

// A quote as getLatestQuote returns it, stamped `ageSec` seconds before NOW (raw.t is Alpaca's quote timestamp).
function q(bid, ask, ageSec = 5) {
  return { bid, ask, raw: { t: new Date(NOW.getTime() - ageSec * 1000).toISOString() } };
}

function makeClient({ now = NOW, isOpen = true, nextCloseMinutes = 300, positions = [], openOrders = [], quote = q(99, 99.05), submitOrder, getOrderByClientOrderId, getOrder, positionsError, ordersError } = {}) {
  const submitCalls = [];
  const calls = [];
  return {
    submitCalls,
    calls,
    getClock: async () => clockFor(now, { isOpen, nextCloseMinutes }),
    getPositions: async () => { calls.push('positions'); if (positionsError) throw positionsError; return positions; },
    getOrders: async () => { calls.push('orders'); if (ordersError) throw ordersError; return openOrders; },
    getOrder: getOrder || (async (id) => ({ id, status: 'new' })),
    getLatestQuote: async () => { calls.push('quote'); return quote; },
    submitOrder: submitOrder || (async (o) => { calls.push('submit'); submitCalls.push(o); return { id: `ord-${submitCalls.length}`, status: 'new' }; }),
    getOrderByClientOrderId: getOrderByClientOrderId || (async () => null),
  };
}

const emptyBars = async () => [];

// Every run gets its own lock name so tests never contend with each other or with the live supervisor's real lock.
function uniqueLockName() {
  return `av-test-sg-${process.pid}-${Math.random().toString(36).slice(2)}`;
}
function runSg(sg, opts) {
  return sg.run({ lockName: uniqueLockName(), lockWaitMs: 0, confirmPollMs: 1, ...opts });
}

test('market closed -> no action, no orders', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1' });
  const client = makeClient({ isOpen: false });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.deepEqual(r.actions, []);
  sbx.cleanup();
});

test('less than 10 minutes to close -> no action, no orders', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1' });
  const client = makeClient({ nextCloseMinutes: 5 });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.deepEqual(r.actions, []);
  sbx.cleanup();
});

test('execution lock held by someone else (e.g. the supervisor) -> alert, no orders, no broker reads', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1' });
  const lock = sbx.load('c1-execution-lock');
  const lockName = uniqueLockName();
  const held = await lock.acquire({ name: lockName });
  assert.ok(held);
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }] });
  const r = await sg.run({ client, now: NOW, getBars: emptyBars, log: () => {}, lockName, lockWaitMs: 100 });
  assert.equal(client.submitCalls.length, 0);
  assert.deepEqual(client.calls, [], 'no positions/orders/quote read without the lock');
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.match(sbx.ntfyCalls()[0].title, /lock|busy/i);
  assert.ok(r.actions.some((a) => a.action === 'alert-lock-busy'));
  held.release();
  sbx.cleanup();
});

test('the execution lock is held during the run and released afterwards', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const lock = sbx.load('c1-execution-lock');
  const lockName = uniqueLockName();
  let heldDuringSubmit = null;
  const client = makeClient({
    positions: [{ symbol: 'SGOV', qty: 0.5 }],
    submitOrder: async () => {
      const probe = await lock.acquire({ name: lockName });
      heldDuringSubmit = !probe;
      if (probe) probe.release();
      return { id: 'ord-1', status: 'new' };
    },
  });
  await sg.run({ client, now: NOW, getBars: emptyBars, log: () => {}, lockName, lockWaitMs: 0 });
  assert.equal(heldDuringSubmit, true, 'the guard held the lock while submitting');
  const after = await lock.acquire({ name: lockName });
  assert.ok(after, 'released at the end of the run');
  after.release();
  sbx.cleanup();
});

test('a pending HOLD/no-action decision does not block protection; a pending exit/enter skips WITH an alert', async () => {
  for (const [decision, expectOrders] of [['hold', 1], ['no-action', 1], ['exit', 0], ['enter', 0]]) {
    const { sbx, sg, envelope } = setup();
    seedOpenLot({ sbx, envelope, citizenId: 'C1' });
    const taskDir = sbx.file('tasks', 'survive');
    fs.mkdirSync(taskDir, { recursive: true });
    const body = JSON.stringify({ decision, symbol: 'SGOV', notionalUsd: 5, rationale: 't' });
    fs.writeFileSync(path.join(taskDir, 'survive_cC1_mission001_decision.md'),
      '## survive/survive_cC1_mission001_decision\nstatus: done\noutput:\n````\n```json\n' + body + '\n```\n````\n');
    const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }] });
    const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
    assert.equal(client.submitCalls.length, expectOrders, `pending ${decision}`);
    if (expectOrders === 0) {
      assert.equal(sbx.ntfyCalls().length, 1, `alert on pending ${decision}`);
      assert.ok(r.actions.some((a) => a.action === 'alert-pending-trade'));
    }
    sbx.cleanup();
  }
});

test('a citizen with an unreadable unresolved decision is skipped with an alert', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1' });
  const taskDir = sbx.file('tasks', 'survive');
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(
    path.join(taskDir, 'survive_cC1_mission001_decision.md'),
    '## survive/survive_cC1_mission001_decision\nstatus: done\noutput:\n```\nplaceholder\n```\n'
  );
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.ok(r.actions.some((a) => a.action === 'alert-pending-trade'));
  sbx.cleanup();
});

test('decision lookup throwing -> alert and skip, never place (codex round-3 finding 4)', async () => {
  const { sbx, sg, ex, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1' });
  ex.findLatestUnresolvedDecision = () => { throw new Error('EIO reading tasks dir'); };
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.match(sbx.ntfyCalls()[0].message, /EIO/);
  assert.ok(r.actions.some((a) => a.action === 'alert-decision-lookup-failed'));
  sbx.cleanup();
});

test('call order: bars, then positions/orders, then the quote, then submit (codex round-3 finding 2)', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100, fillTs: '2026-09-01T14:30:00.000Z' });
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }] });
  const bars = async () => { client.calls.push('bars'); return []; };
  await runSg(sg, { client, now: NOW, getBars: bars, log: () => {} });
  assert.deepEqual(client.calls, ['bars', 'positions', 'orders', 'quote', 'submit']);
  sbx.cleanup();
});

const staleQuotes = [
  ['a day old', q(99, 99.05, 86400)],
  ['121 s old', q(99, 99.05, 121)],
  ['61 s in the future', q(99, 99.05, -61)],
  ['no timestamp', { bid: 99, ask: 99.05, raw: {} }],
  ['no raw at all', { bid: 99, ask: 99.05 }],
];
for (const [label, quote] of staleQuotes) {
  test(`quote ${label} -> alert, no order`, async () => {
    const { sbx, sg, envelope } = setup();
    seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
    const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], quote });
    await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
    assert.equal(client.submitCalls.length, 0);
    assert.equal(sbx.ntfyCalls().length, 1);
    assert.match(sbx.ntfyCalls()[0].title, /quote/i);
    sbx.cleanup();
  });
}

test('quote freshness is judged against the clock at quote time, not the run start', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  // The quote is stamped at NOW, but by the time it is read the real clock has moved 5 minutes on.
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], quote: q(99, 99.05, 0) });
  const later = () => new Date(NOW.getTime() + 300000);
  await runSg(sg, { client, now: NOW, nowFn: later, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  sbx.cleanup();
});

test('a quarantined citizen with an open lot still gets a stop', async () => {
  const { sbx, sg, envelope, registry } = setup();
  const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  registry.quarantineCitizen('C1', 'test quarantine');
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 1);
  assert.ok(r.actions.some((a) => a.action === 'stop-placed' && a.lotId === lotId));
  sbx.cleanup();
});

test('no broker position -> alert, no order', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5 });
  const client = makeClient({ positions: [] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.match(sbx.ntfyCalls()[0].message, /no broker position|no position/i);
  assert.equal(sbx.ntfyCalls()[0].priority, 4);
  assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 0);
  sbx.cleanup();
});

test('share count mismatch -> alert, no order', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5 });
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 1.0 }] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.match(sbx.ntfyCalls()[0].title, /mismatch/i);
  assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 0);
  sbx.cleanup();
});

test('an existing open sell order -> no order, silent', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5 });
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], openOrders: [{ symbol: 'SGOV', side: 'sell', type: 'stop', qty: '0.5', status: 'new' }] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 0);
  assert.deepEqual(r.actions, []);
  sbx.cleanup();
});

test('an open buy order -> no order, but an alert (protection unverified; codex round 5)', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5 });
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], openOrders: [{ symbol: 'SGOV', side: 'buy', type: 'limit' }] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.ok(r.actions.some((a) => a.action === 'alert-open-buy-order'));
  sbx.cleanup();
});

test('market clock read failing -> alert + explicit failed-check action (codex round 5)', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1' });
  const client = makeClient();
  client.getClock = async () => { throw new Error('clock 503'); };
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.match(sbx.ntfyCalls()[0].message, /503/);
  assert.ok(r.actions.some((a) => a.action === 'alert-clock-failed'));
  sbx.cleanup();
});

test('citizen registry read failing -> alert (codex round 5)', async () => {
  const { sbx, sg, envelope, registry } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1' });
  registry.listCitizens = () => { throw new Error('registry EIO'); };
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.ok(r.actions.some((a) => a.action === 'alert-registry-failed'));
  sbx.cleanup();
});

test('ledger read failing -> alert (codex round 5)', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1' });
  envelope.computeLifetimeLedger = () => { throw new Error('ledger EIO'); };
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }] });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0);
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.ok(r.actions.some((a) => a.action === 'alert-ledger-failed'));
  sbx.cleanup();
});

test('valid run: exactly one stop at the right level, deterministic client id, one stop-level event', async () => {
  const { sbx, sg, ex, envelope } = setup();
  const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], quote: q(99, 99.05) });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 1);
  const order = client.submitCalls[0];
  assert.equal(order.symbol, 'SGOV');
  assert.equal(order.direction, 'short');
  assert.equal(order.qty, 0.5);
  assert.equal(order.orderType, 'stop');
  assert.equal(order.stopPrice, 95); // fallback: 100 * 0.95
  assert.equal(order.timeInForce, 'day');
  assert.equal(order.intent, 'close');
  const lotSuffix = lotId.slice(-8);
  assert.equal(order.clientOrderId, `survive-C1-stop-${lotSuffix}-20260929`);
  const stopLevelEvents = ex.readMissionEvents('C1').filter((e) => e.type === 'stop-level' && e.lotId === lotId);
  assert.equal(stopLevelEvents.length, 1);
  assert.equal(stopLevelEvents[0].level, 95);
  assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 1);
  sbx.cleanup();
});

test('rerunning the same day after a successful stop does not place a second order', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const submitted = [];
  const client = {
    getClock: async () => clockFor(NOW),
    getPositions: async () => [{ symbol: 'SGOV', qty: 0.5 }],
    getOrders: async () => submitted.map((o) => ({ symbol: o.symbol, side: 'sell', type: 'stop', qty: String(o.qty), status: 'new', id: o.id })),
    getLatestQuote: async () => q(99, 99.05),
    submitOrder: async (o) => { const id = `ord-${submitted.length + 1}`; submitted.push({ ...o, id }); return { id, status: 'new' }; },
    getOrderByClientOrderId: async () => null,
  };
  await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(submitted.length, 1);
  const r2 = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(submitted.length, 1); // unchanged -- the broker now shows an open sell, so it's already protected
  assert.equal(r2.actions.filter((a) => a.action === 'stop-placed').length, 0);
  sbx.cleanup();
});

test('submit throws but the order is found by client id -> no alert-as-failure', async () => {
  const { sbx, sg, ex, envelope } = setup();
  const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const client = makeClient({
    positions: [{ symbol: 'SGOV', qty: 0.5 }],
    submitOrder: async () => { throw new Error('network reset'); },
    getOrderByClientOrderId: async () => ({ id: 'existing-order-1', status: 'new' }),
  });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(sbx.ntfyCalls().length, 0, 'no alert -- the order was found, so this is not a failure');
  const evts = ex.readMissionEvents('C1').filter((e) => e.type === 'stop-level' && e.lotId === lotId);
  assert.equal(evts.length, 1);
  assert.equal(evts[0].orderId, 'existing-order-1');
  assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 1);
  sbx.cleanup();
});

for (const status of ['canceled', 'expired', 'rejected', 'filled']) {
  test(`submit throws and the client-id order found is not live (${status}) -> priority-5 unprotected alert (review finding d)`, async () => {
    const { sbx, sg, ex, envelope } = setup();
    const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
    const client = makeClient({
      positions: [{ symbol: 'SGOV', qty: 0.5 }],
      submitOrder: async () => { throw new Error('422: client_order_id must be unique'); },
      getOrderByClientOrderId: async () => ({ id: 'old-order', status }),
    });
    const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
    assert.equal(sbx.ntfyCalls().length, 1);
    assert.equal(sbx.ntfyCalls()[0].priority, 5);
    assert.match(sbx.ntfyCalls()[0].title, /unprotected/i);
    assert.equal(ex.readMissionEvents('C1').filter((e) => e.type === 'stop-level' && e.lotId === lotId).length, 0);
    assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 0);
    assert.ok(r.actions.some((a) => a.action === 'alert-unprotected'));
    sbx.cleanup();
  });
}

test('submit throws and no order is found -> alert', async () => {
  const { sbx, sg, ex, envelope } = setup();
  const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const client = makeClient({
    positions: [{ symbol: 'SGOV', qty: 0.5 }],
    submitOrder: async () => { throw new Error('422: stop price must be less than current price') },
    getOrderByClientOrderId: async () => null,
  });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.equal(sbx.ntfyCalls()[0].priority, 4);
  const evts = ex.readMissionEvents('C1').filter((e) => e.type === 'stop-level' && e.lotId === lotId);
  assert.equal(evts.length, 0);
  assert.equal(r.actions.filter((a) => a.action === 'alert-submit-failed').length, 1);
  sbx.cleanup();
});

const badQuotes = [
  ['zero bid', { bid: 0, ask: 0.01 }],
  ['crossed', { bid: 100, ask: 99 }],
  ['wide spread (5%)', { bid: 100, ask: 105 }],
  ['non-finite', { bid: NaN, ask: 100 }],
];
for (const [label, quote] of badQuotes) {
  test(`bad quote (${label}) -> no order`, async () => {
    const { sbx, sg, envelope } = setup();
    seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
    const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], quote: { ...quote, raw: q(0, 0).raw } });
    const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
    assert.equal(client.submitCalls.length, 0);
    assert.equal(sbx.ntfyCalls().length, 1);
    assert.equal(sbx.ntfyCalls()[0].priority, 4);
    sbx.cleanup();
  });
}

test('desired stop at/above the bid -> priority-5 alert, no order, no market sell', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 }); // fallback initial = 95
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], quote: q(90, 90.05) }); // 95 >= 90 - 0.01
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 0, 'no stop order');
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.equal(sbx.ntfyCalls()[0].priority, 5);
  assert.match(sbx.ntfyCalls()[0].message, /owner decides/i);
  assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 0);
  sbx.cleanup();
});

test('level is never lowered: recorded history (100.11) beats the fallback (~95.59)', async () => {
  const { sbx, sg, ex, envelope } = setup();
  const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.198672205, price: 100.618 });
  ex.appendMissionEvent({ type: 'stop-level', citizenId: 'C1', lotId, symbol: 'SGOV', level: 100.11, initialLevel: 100.11, highWater: null, trailPct: 8, source: 'fallback', orderId: 'prior', clientOrderId: 'prior', date: '20260928' });
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.198672205 }], quote: q(101, 101.05) });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(client.submitCalls.length, 1);
  assert.equal(client.submitCalls[0].stopPrice, 100.11);
  sbx.cleanup();
});

test('trailing ratchets up from completed closes and excludes today\'s bar', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100, fillTs: '2026-09-01T14:30:00.000Z' }); // fallback initial = 95
  const bars = async () => [
    { date: '2026-09-02', close: 110 },
    { date: '2026-09-15', close: 120 }, // highest COMPLETED close
    { date: '2026-09-29', close: 200 }, // today (per NOW) -- must be excluded
  ];
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], quote: q(115, 115.05) });
  const r = await runSg(sg, { client, now: NOW, getBars: bars, log: () => {} });
  assert.equal(client.submitCalls.length, 1);
  // trailing = floor2(120 * 0.92) = 110.4, which beats the 95 fallback and must NOT reflect the excluded 200 bar (which
  // would give floor2(200*0.92) = 184, above the 115 bid and thus a different outcome entirely).
  assert.equal(client.submitCalls[0].stopPrice, 110.4);
  sbx.cleanup();
});

test('bars fetch failing -> falls back to the initial level', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100, fillTs: '2026-09-01T14:30:00.000Z' });
  const failingBars = async () => { throw new Error('bars endpoint timed out'); };
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], quote: q(99, 99.05) });
  const r = await runSg(sg, { client, now: NOW, getBars: failingBars, log: () => {} });
  assert.equal(client.submitCalls.length, 1);
  assert.equal(client.submitCalls[0].stopPrice, 95); // initial fallback, bars ignored
  sbx.cleanup();
});

test('--dry-run sends nothing and writes no files', async () => {
  const { sbx, sg, ex, envelope } = setup();
  const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], quote: q(99, 99.05) });
  const lines = [];
  const r = await runSg(sg, { client, now: NOW, dryRun: true, getBars: emptyBars, log: (s) => lines.push(s) });
  assert.equal(client.submitCalls.length, 0, 'the real submitOrder was never reached');
  assert.equal(sbx.ntfyCalls().length, 0);
  assert.equal(fs.existsSync(sg.HEARTBEAT_PATH), false);
  const evts = ex.readMissionEvents('C1').filter((e) => e.type === 'stop-level' && e.lotId === lotId);
  assert.equal(evts.length, 0);
  assert.ok(lines.some((l) => /dry-run/i.test(l)), 'printed a plan');
  sbx.cleanup();
});

test('--assume-open rehearses the full placement path on a closed market, dry-run only', async () => {
  const { sbx, sg } = setup();
  seedOpenLot({ sbx, envelope: sbx.load('survive-budget-envelope'), citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const client = makeClient({ isOpen: false, positions: [{ symbol: 'SGOV', qty: 0.5 }], quote: q(99, 99.05) });
  await assert.rejects(runSg(sg, { client, now: NOW, assumeOpen: true, getBars: emptyBars, log: () => {} }), /dry-run/);
  assert.equal(client.submitCalls.length, 0);
  const lines = [];
  await runSg(sg, { client, now: NOW, dryRun: true, assumeOpen: true, getBars: emptyBars, log: (s) => lines.push(s) });
  assert.equal(client.submitCalls.length, 0, 'nothing sent');
  assert.ok(lines.some((l) => /would submit stop order/.test(l)), 'placement path was exercised: ' + lines.join(' | '));
  sbx.cleanup();
});

// --- pure helper unit tests ---

test('validateQuote: rejects zero/crossed/wide/non-finite, accepts a tight real quote', () => {
  const { sbx, sg } = setup();
  assert.equal(sg.validateQuote({ bid: 0, ask: 0.01 }).valid, false);
  assert.equal(sg.validateQuote({ bid: 100, ask: 99 }).valid, false);
  assert.equal(sg.validateQuote({ bid: 100, ask: 105 }).valid, false);
  assert.equal(sg.validateQuote({ bid: NaN, ask: 100 }).valid, false);
  assert.equal(sg.validateQuote({ bid: 99, ask: 99.05 }).valid, true);
  sbx.cleanup();
});

test('computeDesiredLevel: never lowers below recorded history', () => {
  const { sbx, sg } = setup();
  const lot = { lotId: 'lot1', symbol: 'SGOV', qty: 0.5, costUsd: 50 };
  const missionEvents = [{ type: 'stop-level', lotId: 'lot1', level: 100.11 }];
  const r = sg.computeDesiredLevel({ lot, missionEvents, fillPrice: 100.618, fillDate: '2026-09-01', bars: [], now: NOW });
  assert.equal(r.desired, 100.11);
  sbx.cleanup();
});

test('floor2 rounds down and avoids float artifacts', () => {
  const { sbx, sg } = setup();
  assert.equal(sg.floor2(95.999), 95.99);
  assert.equal(sg.floor2(110.4), 110.4);
  sbx.cleanup();
});

// --- codex round-4 findings ---

const unverifiedSells = [
  ['a small limit sell', { symbol: 'SGOV', side: 'sell', type: 'limit', qty: '0.1', status: 'new' }],
  ['an undersized stop', { symbol: 'SGOV', side: 'sell', type: 'stop', qty: '0.1', status: 'new' }],
  ['a full-size stop awaiting cancel', { symbol: 'SGOV', side: 'sell', type: 'stop', qty: '0.5', status: 'pending_cancel' }],
  ['a full-size market sell', { symbol: 'SGOV', side: 'sell', type: 'market', qty: '0.5', status: 'new' }],
];
for (const [label, order] of unverifiedSells) {
  test(`open sell that is not a verified full-size working stop (${label}) -> alert, no new order`, async () => {
    const { sbx, sg, envelope } = setup();
    seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5 });
    const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], openOrders: [order] });
    const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
    assert.equal(client.submitCalls.length, 0, 'never stacks a second sell on top');
    assert.equal(sbx.ntfyCalls().length, 1, 'not silent');
    assert.ok(r.actions.some((a) => a.action === 'alert-unverified-sell'));
    sbx.cleanup();
  });
}

for (const status of ['rejected', 'canceled', 'expired']) {
  test(`submit succeeds but returns a dead order (${status}) -> priority-5 unprotected alert, no stop-level event`, async () => {
    const { sbx, sg, ex, envelope } = setup();
    const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
    const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], submitOrder: async () => ({ id: 'dead', status }) });
    const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
    assert.equal(sbx.ntfyCalls().length, 1);
    assert.equal(sbx.ntfyCalls()[0].priority, 5);
    assert.equal(ex.readMissionEvents('C1').filter((e) => e.type === 'stop-level' && e.lotId === lotId).length, 0);
    assert.ok(r.actions.some((a) => a.action === 'alert-unprotected'));
    assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 0);
    sbx.cleanup();
  });
}

test('submit returns pending_new, a follow-up read shows new -> stop-placed, no alert', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  let reads = 0;
  const client = makeClient({
    positions: [{ symbol: 'SGOV', qty: 0.5 }],
    submitOrder: async () => ({ id: 'o1', status: 'pending_new' }),
    getOrder: async (id) => { reads++; return { id, status: reads >= 2 ? 'new' : 'pending_new' }; },
  });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(sbx.ntfyCalls().length, 0);
  assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 1);
  sbx.cleanup();
});

test('submit returns pending_new and it never confirms -> priority-4 unconfirmed alert, level recorded, not stop-placed', async () => {
  const { sbx, sg, ex, envelope } = setup();
  const lotId = seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const client = makeClient({
    positions: [{ symbol: 'SGOV', qty: 0.5 }],
    submitOrder: async () => ({ id: 'o1', status: 'pending_new' }),
    getOrder: async (id) => ({ id, status: 'accepted' }),
  });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.equal(sbx.ntfyCalls()[0].priority, 4);
  assert.match(sbx.ntfyCalls()[0].title, /unconfirmed/i);
  assert.equal(ex.readMissionEvents('C1').filter((e) => e.type === 'stop-level' && e.lotId === lotId).length, 1);
  assert.ok(r.actions.some((a) => a.action === 'stop-unconfirmed'));
  assert.equal(r.actions.filter((a) => a.action === 'stop-placed').length, 0);
  sbx.cleanup();
});

test('submit returns pending_new, the follow-up shows it rejected -> priority-5 unprotected alert', async () => {
  const { sbx, sg, envelope } = setup();
  seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
  const client = makeClient({
    positions: [{ symbol: 'SGOV', qty: 0.5 }],
    submitOrder: async () => ({ id: 'o1', status: 'pending_new' }),
    getOrder: async (id) => ({ id, status: 'rejected' }),
  });
  const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
  assert.equal(sbx.ntfyCalls().length, 1);
  assert.equal(sbx.ntfyCalls()[0].priority, 5);
  assert.ok(r.actions.some((a) => a.action === 'alert-unprotected'));
  sbx.cleanup();
});

for (const which of ['positions', 'orders']) {
  test(`broker ${which} read failing -> alert + explicit failed-check action, no order`, async () => {
    const { sbx, sg, envelope } = setup();
    seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5 });
    const err = new Error(`${which} 503`);
    const client = makeClient({ positions: [{ symbol: 'SGOV', qty: 0.5 }], [`${which}Error`]: err });
    const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
    assert.equal(client.submitCalls.length, 0);
    assert.equal(sbx.ntfyCalls().length, 1);
    assert.match(sbx.ntfyCalls()[0].message, /503/);
    assert.ok(r.actions.some((a) => a.action === 'alert-broker-read-failed'));
    sbx.cleanup();
  });
}

for (const [label, finalStatus, expectAction] of [['unconfirmed', 'accepted', 'stop-unconfirmed'], ['confirmed', 'new', 'stop-placed']]) {
  test(`stop-level append throwing on an ${label} stop -> run still alerts and records the action (codex round 6)`, async () => {
    const { sbx, sg, ex, envelope } = setup();
    seedOpenLot({ sbx, envelope, citizenId: 'C1', symbol: 'SGOV', qty: 0.5, price: 100 });
    ex.appendMissionEvent = () => { throw new Error('ENOSPC'); };
    const client = makeClient({
      positions: [{ symbol: 'SGOV', qty: 0.5 }],
      submitOrder: async () => ({ id: 'o1', status: 'pending_new' }),
      getOrder: async (id) => ({ id, status: finalStatus }),
    });
    const r = await runSg(sg, { client, now: NOW, getBars: emptyBars, log: () => {} });
    assert.ok(r.actions.some((a) => a.action === expectAction), 'the run completed its action');
    assert.ok(r.actions.some((a) => a.action === 'alert-record-failed'));
    assert.ok(sbx.ntfyCalls().some((m) => /ENOSPC/.test(m.message)), 'the write failure was reported');
    if (label === 'unconfirmed') assert.ok(sbx.ntfyCalls().some((m) => /unconfirmed/i.test(m.title)), 'the unconfirmed alert still went out');
    sbx.cleanup();
  });
}
