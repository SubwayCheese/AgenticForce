// One-off: places real GTC buy-stop orders on the 3 open shorts from
// fleet_pilot_20260908_synthesis_r3_portfolio_v2 (TSLA/GOOGL/CSCO), at each
// setup's stated invalidation price. This closes the position automatically
// if price breaches the invalidation level -- it does NOT handle the
// time-based ("exit after 10 sessions") half of the exit rule; that's
// monitor-paper-trades.js's job. Logged to bus/paper-trades.jsonl as a
// distinct "stop-order-placed" record type (not an entry or exit).
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');

const stops = [
  { symbol: 'TSLA', qty: 10, stopPrice: 390.00, sourceTask: 'fleet_pilot_20260908_synthesis_r3_portfolio_v2' },
  { symbol: 'GOOGL', qty: 10, stopPrice: 360.00, sourceTask: 'fleet_pilot_20260908_synthesis_r3_portfolio_v2' },
  { symbol: 'CSCO', qty: 30, stopPrice: 117.00, sourceTask: 'fleet_pilot_20260908_synthesis_r3_portfolio_v2' },
];

async function main() {
  const logPath = path.join(__dirname, '..', 'paper-trades.jsonl');
  for (const s of stops) {
    console.log(`Placing GTC buy-stop for ${s.symbol} x${s.qty} @ ${s.stopPrice}...`);
    // direction "long" -> side "buy" -- this CLOSES the existing short, per
    // submitOrder's documented convention (direction = side of the order
    // being placed, not the position's original direction).
    const order = await alpaca.submitOrder({
      symbol: s.symbol,
      direction: 'long',
      qty: s.qty,
      orderType: 'stop',
      stopPrice: s.stopPrice,
      timeInForce: 'gtc',
    });
    console.log(`  stop order id ${order.id}, status ${order.status}`);
    const record = {
      ts: new Date().toISOString(),
      type: 'stop-order-placed',
      sourceTask: s.sourceTask,
      symbol: s.symbol,
      qty: s.qty,
      stopPrice: s.stopPrice,
      orderId: order.id,
      orderStatus: order.status,
      note: 'GTC buy-stop to close the short if price breaches the invalidation level. Does not cover the time-based (session-count) exit -- see monitor-paper-trades.js.',
    };
    fs.appendFileSync(logPath, JSON.stringify(record) + '\n');
  }
  console.log('Done. Verifying open orders...');
  const orders = await alpaca.getOrders('open');
  console.log(JSON.stringify(orders.map(o => ({ id: o.id, symbol: o.symbol, side: o.side, type: o.type, stop_price: o.stop_price, status: o.status })), null, 2));
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
