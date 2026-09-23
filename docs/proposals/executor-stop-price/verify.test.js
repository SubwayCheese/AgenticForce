// Proves survive-executor.patch on a SCRATCH copy (the sandbox), never the live file. Run from the repo root:
//   node --test docs/proposals/executor-stop-price/verify.test.js
// After the owner applies the patch for real, move the four cases into bus/tests/survive/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { makeSandbox } = require('../../../bus/tests/survive/_sandbox.js');

const PATCH = path.join(__dirname, 'survive-executor.patch');
const MISSION010 = 'Exit only for a concrete reason: SGOV becomes non-tradable or halted, its bid/ask spread widens above 0.10%, or its price falls more than 0.5% below the $100.61 entry-time bid for reasons other than a monthly ex-dividend drop.';

function patched() {
  const sbx = makeSandbox();
  const r = spawnSync('patch', ['-p1', '-d', sbx.root, '-i', PATCH], { encoding: 'utf8' });
  assert.equal(r.status, 0, `patch must apply cleanly to a scratch copy: ${r.stdout}${r.stderr}`);
  return { sbx, ex: sbx.load('survive-executor') };
}

// Behaves like Alpaca did: a sell-stop at or above the live bid is rejected with a 422.
const fakeClient = (bid = 100.61) => {
  const orders = [];
  return {
    orders,
    getLatestQuote: async () => ({ bid, ask: bid + 0.01 }),
    submitOrder: async (o) => {
      orders.push(o);
      if (o.stopPrice >= bid) throw new Error('Live Alpaca API POST /orders -> 422: stop price must be less than current price');
      return { id: `ord-${orders.length}` };
    },
  };
};
const args = (client, invalidationCondition, referencePrice) => ({ client, citizenId: 'T', missionId: 'mission001', lotId: 'lot', symbol: 'SGOV', filledQty: 0.1987, invalidationCondition, referencePrice });

test('the mission010 text (first $ figure is the entry bid) now yields a stop 0.5% below the fill', async () => {
  const { sbx, ex } = patched();
  const c = fakeClient(100.61);
  const res = await ex.placeProtectiveStop(args(c, MISSION010, 100.618));
  assert.equal(res.stopPlaced, true);
  assert.equal(res.stopPriceSource, 'thesis-percentage');
  assert.equal(c.orders[0].stopPrice, 100.11);
  assert.ok(c.orders[0].stopPrice < 100.61);
  sbx.cleanup();
});

// Table of resolver cases -- every scenario codex's review reproduced against the first draft, plus the live incident.
const CASES = [
  ['mission010 text (first $ is the entry bid)', MISSION010, { fill: 100.618, bid: 100.61 }, 100.11, 'thesis-percentage'],
  ['genuine lower level is kept', 'Exit if it closes below $95.00.', { fill: 100.618, bid: 100.61 }, 95, 'thesis-derived'],
  ['only a HIGHER $ figure -> 5% fallback', 'Invalidate if it trades above $110.00.', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['tight explicit level is NOT loosened (codex #2)', 'Exit below $99.95', { fill: 100, bid: 100 }, 99.95, 'thesis-derived'],
  ['".5%" is 0.5%, not 5% (codex #3)', 'falls .5% below the $100 entry bid', { fill: 100, bid: 100 }, 99.5, 'thesis-percentage'],
  ['tighter explicit level after an entry $ (codex #4)', 'Entry $100; exit below $99.50', { fill: 100, bid: 100 }, 99.5, 'thesis-derived'],
  ['percentage with no $ at all (codex #4)', 'Falls 0.5% below entry', { fill: 100, bid: 100 }, 99.5, 'thesis-percentage'],
  ['thesis level already above the market -> valid fallback (codex #1)', '0.5% below the $100 entry bid', { fill: 100, bid: 99 }, 95, 'fallback-percentage'],
  ['a microscopic percentage is honored as "as tight as allowed" (2bp under the bid), never at/above the market (codex #1)', 'falls 0.001% below entry', { fill: 100, bid: 100 }, 99.98, 'thesis-percentage'],
  ['position already under the 5% fallback -> clamped just below the market', 'no levels here', { fill: 100, bid: 90 }, 89.98, 'fallback-percentage'],
  ['absurdly far level ($5 on a $100 asset) is ignored', 'the other asset target is $5', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['thousands separator', 'exit below $1,050.00', { fill: 1100, bid: 1100 }, 1050, 'thesis-derived'],
  // ---- round 2 (codex): each of these was a reproduced failure of the first rewrite ----
  ['an entry $ figure is not a stop even when the bid rose (r2 #1)', 'Entry $100; exit 5% below entry', { fill: 100, bid: 101 }, 95, 'thesis-percentage'],
  ['"% below average" is not a stop clause (r2 #2)', 'Volume 1% below average; exit 5% below entry', { fill: 100, bid: 100 }, 95, 'thesis-percentage'],
  ['several stop clauses -> the tightest (r2 #2)', 'Exit 10% below entry or 2% below entry', { fill: 100, bid: 100 }, 98, 'thesis-percentage'],
  ['percentage of a different reference (a peak) is ignored (r2 #2)', 'Exit 5% below the $110 peak', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['exponent percentage rejected (r2 #3)', 'falls 1e-3% below entry', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['negative percentage rejected (r2 #3)', 'exit -5% below entry', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['negative dollar rejected (r2 #3)', 'exit below -$95', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['exponent dollar rejected (r2 #3)', 'exit below $95e-2', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['percentage range rejected (r2 #3)', 'exit 1-2% below entry', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['dollar range rejected (r2 #3)', 'exit below $95-99', { fill: 100, bid: 100 }, 95, 'fallback-percentage'],
  ['a stop tighter than 2bp is clamped to 2bp under the bid, not replaced by 5% (r2 #4)', 'Exit below $99.99', { fill: 100, bid: 100 }, 99.98, 'thesis-derived'],
  ['a fill far below the market: the fallback is pulled into the 30% band (r2 #5)', 'no levels here', { fill: 100, bid: 200 }, 140, 'fallback-percentage'],
  // ---- round 3 (codex) ----
  ['a $ amount inside a percentage clause is its reference, not a stop (r3 #1)', 'Exit if price falls 5% below $100 entry.', { fill: 100, bid: 100 }, 95, 'thesis-percentage'],
  ['"2% below bid" is measured off the live bid, not the fill (r3 #2)', 'Exit 2% below bid.', { fill: 100, bid: 110 }, 107.8, 'thesis-percentage'],
  ['hyphenated "stop-loss at $98" is recognized (r3 #3)', 'Stop-loss at $98.', { fill: 100, bid: 100 }, 98, 'thesis-derived'],
  ['precision: $99.999 is rounded then re-validated (r2 #5)', 'exit below $99.999', { fill: 100, bid: 100 }, 99.98, 'thesis-derived'],
];
for (const [name, text, ctx, want, src] of CASES) {
  test(`resolveStopPrice: ${name}`, () => {
    const { sbx, ex } = patched();
    const r = ex.resolveStopPrice(text, ctx);
    assert.equal(r.price, want);
    assert.equal(r.source, src);
    assert.ok(r.price < ctx.bid, 'the stop is always strictly below the live bid');
    assert.ok(r.price >= ctx.bid * 0.7 - 0.005, 'and within 30% of it');
    sbx.cleanup();
  });
}

test('resolveStopPrice: a sub-cent price cannot produce a stop above the market (r2 #5)', () => {
  const { sbx, ex } = patched();
  const r = ex.resolveStopPrice('no levels', { fill: 0.01, bid: 0.005 });
  assert.deepEqual(r, { price: null, source: null }, 'null -> the existing loud unprotected-position alert fires instead of a bad order');
  sbx.cleanup();
});

test('placeProtectiveStop: a stale quote that leads to a 422 is retried with a FRESH bid and a lower stop (r2 #6)', async () => {
  const { sbx, ex } = patched();
  const quotes = [100, 90];
  const orders = [];
  const client = {
    getLatestQuote: async () => ({ bid: quotes.length > 1 ? quotes.shift() : quotes[0] }),
    submitOrder: async (o) => { orders.push(o); if (o.stopPrice >= 90) throw new Error('422: stop price must be less than current price'); return { id: 'ok' }; },
  };
  const res = await ex.placeProtectiveStop(args(client, 'no levels here', 100));
  assert.equal(res.stopPlaced, true);
  assert.equal(orders.length, 2);
  assert.ok(orders[1].stopPrice < orders[0].stopPrice && orders[1].stopPrice < 90);
  sbx.cleanup();
});

test('placeProtectiveStop: a quote that hangs cannot delay protection past the timeout (r2 #6)', async () => {
  const { sbx, ex } = patched();
  const client = { getLatestQuote: () => new Promise(() => {}), submitOrder: async () => ({ id: 'ok' }) };
  const t0 = Date.now();
  const res = await ex.placeProtectiveStop(args(client, 'exit below $95', 100));
  assert.equal(res.stopPlaced, true);
  assert.ok(Date.now() - t0 < 8000, 'proceeded after the 5s quote timeout');
  sbx.cleanup();
});

test('resolveStopPrice: nothing to go on (no fill, no bid) -> null, so the existing loud alert fires', () => {
  const { sbx, ex } = patched();
  assert.deepEqual(ex.resolveStopPrice('whatever', {}), { price: null, source: null });
  sbx.cleanup();
});

test('placeProtectiveStop end to end with the mission010 text: the order is accepted at $100.11', async () => {
  const { sbx, ex } = patched();
  const c = fakeClient(100.61);
  const res = await ex.placeProtectiveStop(args(c, MISSION010, 100.618));
  assert.equal(res.stopPlaced, true);
  assert.equal(c.orders[0].stopPrice, 100.11);
  sbx.cleanup();
});

test('placeProtectiveStop tolerates a client with no getLatestQuote (falls back to the fill price)', async () => {
  const { sbx, ex } = patched();
  const c = fakeClient(100.61);
  delete c.getLatestQuote;
  const res = await ex.placeProtectiveStop(args(c, MISSION010, 100.618));
  assert.equal(res.stopPlaced, true);
  sbx.cleanup();
});

test('unpatched behavior reproduces the bug (guards that this test actually detects it)', async () => {
  const sbx = makeSandbox();
  fs.appendFileSync(sbx.file('bus', 'city', 'survive-executor.js'), '\nmodule.exports.placeProtectiveStop = placeProtectiveStop;\n');
  const ex = sbx.load('survive-executor');
  const c = fakeClient(100.61);
  const res = await ex.placeProtectiveStop(args(c, MISSION010, 100.618));
  assert.equal(res.stopPlaced, false, 'without the patch the entry price is used as the stop and the broker rejects it');
  assert.equal(c.orders[0].stopPrice, 100.61);
  sbx.cleanup();
});
