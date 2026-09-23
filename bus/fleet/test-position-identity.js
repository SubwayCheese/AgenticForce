#!/usr/bin/env node
// test-position-identity.js -- hermetic regression test for the three
// pre-trade gates added to execute-portfolio-setup.js on 2026-09-11
// (position/lot identity, broker idempotency, data-integrity).
//
// ZERO network calls, zero orders, zero writes to any real log: every
// fixture below is REAL historical data copied verbatim out of
// bus/paper-trades.jsonl and tasks/fleet_pilot_20260911_synthesis_r3_portfolio.md,
// embedded here so the test reproduces the actual incident forever instead
// of depending on a mutable append-only log that will have moved on.
//
//   node test-position-identity.js
//
// The incident under test: VZ was entered TWICE on 2026-09-11, ~2 hours
// apart, from two DIFFERENT round-3 cycles. The old idempotency check was
// keyed on (sourceTask, symbol), so it returned false both times and both
// orders filled -- the system had no concept of "we already hold this".

const assert = require('assert');
const executor = require('./execute-portfolio-setup.js');

// ---- REAL fixtures -------------------------------------------------------
// paper-trades.jsonl lines 16 and 17, verbatim (the two VZ fills).
const VZ_ENTRY_1 = {
  ts: '2026-09-11T17:06:08.002Z',
  type: 'research-driven-entry',
  sourceTask: 'fleet_pilot_20260910_synthesis_r3_portfolio_v2',
  symbol: 'VZ',
  assetClass: 'equity',
  direction: 'long',
  qty: 0.295847477,
  notional: 15,
  orderId: '551c38da-ca6a-47a5-adbd-f295ab666df8',
  orderStatus: 'filled',
  modeledEntry: null,
  actualFillPrice: 50.668,
  invalidationCondition: 'Exit below $46.50, or exit after 15 trading sessions if not triggered.',
  timeHorizon: '15 trading sessions',
};
const VZ_ENTRY_2 = {
  ts: '2026-09-11T19:12:22.465Z',
  type: 'research-driven-entry',
  sourceTask: 'fleet_pilot_20260911_synthesis_r3_portfolio',
  symbol: 'VZ',
  assetClass: 'equity',
  direction: 'long',
  qty: 0.297196558,
  notional: 15,
  orderId: 'ce4b94f7-c434-4cd7-908b-b3bfa0ebb8df',
  orderStatus: 'filled',
  modeledEntry: null,
  actualFillPrice: 50.438,
  invalidationCondition: 'Exit below $46.50, or exit after 10 trading sessions if not triggered.',
  timeHorizon: '10 trading sessions',
};
// A legacy closed pair (paper-trades.jsonl lines 2 and 10) -- no lotId on
// either row. Proves the open-lot replay still pairs pre-lot-id history.
const TSLA_ENTRY = {
  ts: '2026-09-08T18:12:21.134Z', type: 'research-driven-entry',
  sourceTask: 'fleet_pilot_20260908_synthesis_r3_portfolio_v2', symbol: 'TSLA',
  direction: 'short', qty: 10, modeledEntry: 367.77, actualFillPrice: 366.404,
};
const TSLA_EXIT = {
  ts: '2026-09-09T03:57:02.485Z', type: 'research-driven-exit', symbol: 'TSLA',
  assetClass: 'equity', exitFillPrice: 367.096,
  reason: 'reconciled: position no longer open on account',
};

// The real VZ conditionalCandidate from
// tasks/fleet_pilot_20260911_synthesis_r3_portfolio.md, verbatim. Note
// "inherited" sitting in its own bullCase -- and the task's riskWarnings say
// outright "VZ's trigger/invalidation levels are inherited and not
// analytically derived in this ledger". It still reached a real order.
const VZ_CANDIDATE = {
  symbol: 'VZ',
  stance: 'long',
  triggerPrice: 48.22,
  triggerType: 'at_or_above',
  conditionalSetup: {
    symbol: 'VZ',
    direction: 'long',
    entryCondition: 'Enter only on a re-verification-confirmed move at or above $48.22.',
    invalidationCondition: 'Exit below $46.50, or exit after 10 trading sessions if not triggered.',
    timeHorizon: '10 trading sessions',
  },
  bullCase: 'A defined inherited price trigger and invalidation permit a limited tactical confirmation setup.',
  bearCase: 'The levels lack supplied derivation; no current-cycle fundamental or valuation evidence supports an underwritten long.',
  oneLineRationale: 'The only candidate with an exact supplied price trigger, but suitable only as a provisional tactical alert.',
};

// A clean candidate that must NOT be blocked -- a gate that refuses
// everything is worthless, so this is tested explicitly.
const CLEAN_CANDIDATE = {
  symbol: 'MSFT',
  stance: 'long',
  triggerPrice: 495.5,
  triggerType: 'at_or_below',
  conditionalSetup: {
    symbol: 'MSFT', direction: 'long',
    entryCondition: 'Enter at or below $495.50, the 50-day average computed from this cycle\'s bar data.',
    invalidationCondition: 'Exit below $480.00, or exit after 15 trading sessions if not triggered.',
    timeHorizon: '15 trading sessions',
  },
  bullCase: 'Revenue beat by 3.1% with a 38% ROE, and price sits 2% above the 200-day average computed in this ledger.',
  bearCase: 'Valuation at 24x EV/EBITDA leaves little room if cloud growth decelerates.',
  oneLineRationale: 'Buy the confirmed uptrend at a level derived from this cycle\'s own moving averages.',
};

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

console.log('\n=== 1. Position/lot identity: the real VZ double-entry ===\n');

test('At 19:12 the ledger already shows an OPEN VZ lot from 17:06', () => {
  // Exactly the state the system was in when the second order went out:
  // entry 1 filled, no exit, second cycle about to enter.
  const ledgerAtSecondEntry = [VZ_ENTRY_1];
  const openLot = executor.findOpenLotForSymbol('VZ', ledgerAtSecondEntry);
  assert.ok(openLot, 'expected an open VZ lot to be found');
  assert.strictEqual(openLot.sourceTask, 'fleet_pilot_20260910_synthesis_r3_portfolio_v2');
  assert.strictEqual(openLot.ts, '2026-09-11T17:06:08.002Z');
});

test('The OLD (sourceTask, symbol) key did NOT catch it -- this is the root cause', () => {
  // Both entries have the same symbol but different sourceTask, so the old
  // check was false both times. Asserting the root cause, so nobody
  // "simplifies" the new check back into the old one.
  assert.notStrictEqual(VZ_ENTRY_1.sourceTask, VZ_ENTRY_2.sourceTask);
  assert.strictEqual(VZ_ENTRY_1.symbol, VZ_ENTRY_2.symbol);
});

test('Legacy entry/exit rows with NO lotId still pair correctly', () => {
  const open = executor.openLots([TSLA_ENTRY, TSLA_EXIT]);
  assert.strictEqual(open.length, 0, 'a closed legacy TSLA pair must leave no open lot');
});

test('A lotId exit closes ITS lot, not merely the first one in that symbol', () => {
  const a = { ...VZ_ENTRY_1, lotId: 'lot-a' };
  const b = { ...VZ_ENTRY_2, lotId: 'lot-b' };
  const exitB = { ts: '2026-09-11T21:00:00.000Z', type: 'research-driven-exit', lotId: 'lot-b', symbol: 'VZ', exitFillPrice: 51 };
  const open = executor.openLots([a, b, exitB]);
  assert.strictEqual(open.length, 1);
  assert.strictEqual(open[0].lotId, 'lot-a', 'the lot that was NOT exited must remain open');
});

test('An exit naming an unknown lot closes NOTHING (never the wrong lot)', () => {
  // With two concurrent lots in one symbol, falling back to symbol matching
  // when the named lot isn't open would close the wrong position half the time.
  const a = { ...VZ_ENTRY_1, lotId: 'lot-a' };
  const b = { ...VZ_ENTRY_2, lotId: 'lot-b' };
  const orphanExit = { ts: '2026-09-11T21:00:00.000Z', type: 'research-driven-exit', lotId: 'lot-unknown', symbol: 'VZ', exitFillPrice: 51 };
  const open = executor.openLots([a, b, orphanExit]);
  assert.deepStrictEqual(open.map((o) => o.lotId), ['lot-a', 'lot-b']);
});

test('Crypto position keys normalize across Alpaca\'s two symbol formats', () => {
  // /v2/positions says "ETHUSD", the order API and every log row say "ETH/USD".
  assert.strictEqual(executor.positionKey('ETHUSD'), executor.positionKey('ETH/USD'));
});

console.log('\n=== 2. Broker-level idempotency (client_order_id) ===\n');

test('The same candidate dispatched twice derives the SAME entry order id', () => {
  const a = executor.deriveEntryClientOrderId('fleet_pilot_20260911_synthesis_r3_portfolio', 'VZ');
  const b = executor.deriveEntryClientOrderId('fleet_pilot_20260911_synthesis_r3_portfolio', 'VZ');
  assert.strictEqual(a, b, 'a duplicate dispatch must collide at the broker');
});

test('Two DIFFERENT cycles derive different ids -- broker layer alone cannot catch the VZ case', () => {
  // Documents the limit of this layer honestly: the real VZ incident is two
  // legitimately different logical orders. Only the position check stops it.
  const a = executor.deriveEntryClientOrderId(VZ_ENTRY_1.sourceTask, 'VZ');
  const b = executor.deriveEntryClientOrderId(VZ_ENTRY_2.sourceTask, 'VZ');
  assert.notStrictEqual(a, b);
});

test('Stop order ids stay re-armable (a fixed id would break the safety net)', () => {
  const t1 = new Date('2026-09-11T20:57:00Z');
  const t2 = new Date('2026-09-12T14:31:00Z');
  assert.notStrictEqual(
    executor.deriveStopClientOrderId('lot-a', 'VZ', 'day', t1),
    executor.deriveStopClientOrderId('lot-a', 'VZ', 'day', t2),
    "tomorrow's re-arm must not collide with today's stop"
  );
  assert.strictEqual(
    executor.deriveStopClientOrderId('lot-a', 'VZ', 'day', t1),
    executor.deriveStopClientOrderId('lot-a', 'VZ', 'day', t1),
    'a tight retry loop within the same minute must collide'
  );
});

test('Derived ids survive Alpaca\'s 128-char client_order_id limit', () => {
  const alpaca = require('./alpaca-client.js');
  const id = executor.deriveEntryClientOrderId('fleet_pilot_20260911_synthesis_r3_portfolio', 'VZ');
  assert.ok(alpaca.normalizeClientOrderId(id).length <= alpaca.CLIENT_ORDER_ID_MAX);
  assert.ok(/^[A-Za-z0-9._-]+$/.test(alpaca.normalizeClientOrderId(id)));
});

console.log('\n=== 3. Data-integrity gate: the real non-derived VZ trigger ===\n');

test('The real VZ candidate is BLOCKED on its own "inherited" language', () => {
  const findings = executor.scanCandidateForRedFlags(VZ_CANDIDATE);
  assert.ok(findings.length > 0, 'expected at least one red flag');
  assert.ok(findings.some((f) => /inherited/i.test(f.matched)), 'expected the "inherited" flag');
  assert.ok(findings.some((f) => f.field === 'bullCase'), 'expected the flag to be located in bullCase');
});

test('A genuinely derived candidate is NOT blocked', () => {
  assert.deepStrictEqual(executor.scanCandidateForRedFlags(CLEAN_CANDIDATE), []);
});

test('The scan reaches nested conditionalSetup prose, not just top-level fields', () => {
  const nested = { symbol: 'X', conditionalSetup: { entryCondition: 'Enter at $10.00 (level carried over from the 2026-09-10 run).' } };
  const findings = executor.scanCandidateForRedFlags(nested);
  assert.ok(findings.some((f) => f.field === 'conditionalSetup.entryCondition'));
});

console.log('\n=== 4. modeledEntry regression (slippage input) ===\n');

test('The real VZ candidate yields a real modeled entry of $48.22, not null', () => {
  const { modeledEntry, modeledEntrySource } = executor.deriveModeledEntry(VZ_CANDIDATE);
  assert.strictEqual(modeledEntry, 48.22);
  assert.strictEqual(modeledEntrySource, 'candidate.triggerPrice');
});

test('Falls back to parsing entryCondition text when no numeric field exists', () => {
  const c = { conditionalSetup: { entryCondition: 'Enter on a confirmed move at or above $1,234.50.' } };
  assert.strictEqual(executor.deriveModeledEntry(c).modeledEntry, 1234.5);
});

test('Honestly returns null for a market-entry candidate with no stated price', () => {
  const c = { conditionalSetup: { direction: 'long', entryCondition: 'Enter at market on the open.' } };
  assert.strictEqual(executor.deriveModeledEntry(c).modeledEntry, null);
});

test('parseStopPrice still behaves exactly as before after the refactor', () => {
  assert.strictEqual(executor.parseStopPrice('close above $390.00, or exit after 10 sessions'), 390);
  assert.strictEqual(executor.parseStopPrice('Exit or reassess if ETH closes below $2,046.64.'), 2046.64);
  assert.strictEqual(executor.parseStopPrice('no price here'), null);
  assert.strictEqual(executor.parseStopPrice(undefined), null);
});

console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed.\n`);
process.exit(failed === 0 ? 0 : 1);
