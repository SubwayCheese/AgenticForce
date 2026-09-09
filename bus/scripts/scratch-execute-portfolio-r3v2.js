// One-off executor for fleet_pilot_20260908_synthesis_r3_portfolio_v2's 3 approved
// short setups (TSLA, GOOGL, CSCO). Not part of the permanent pipeline -- ad hoc
// script for this specific run's real paper-trade placement.
const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');

const setups = [
  { symbol: 'TSLA', direction: 'short', qty: 10, modeledEntry: 367.77, invalidation: 'close above $390.00, or exit after 10 sessions', timeHorizon: '5-10 trading sessions', sourceTask: 'fleet_pilot_20260908_synthesis_r3_portfolio_v2' },
  { symbol: 'GOOGL', direction: 'short', qty: 10, modeledEntry: 339.14, invalidation: 'close above $360.00, or exit after 10 sessions', timeHorizon: '5-10 trading sessions', sourceTask: 'fleet_pilot_20260908_synthesis_r3_portfolio_v2' },
  { symbol: 'CSCO', direction: 'short', qty: 30, modeledEntry: 109.05, invalidation: 'close above $117.00, or exit after 10 sessions', timeHorizon: '5-10 trading sessions', sourceTask: 'fleet_pilot_20260908_synthesis_r3_portfolio_v2' },
];

async function main() {
  const logPath = path.join(__dirname, '..', 'paper-trades.jsonl');
  const results = [];
  for (const s of setups) {
    console.log(`Submitting ${s.direction} order for ${s.symbol} x${s.qty}...`);
    const order = await alpaca.submitOrder({ symbol: s.symbol, direction: s.direction, qty: s.qty, orderType: 'market', timeInForce: 'day' });
    console.log(`  order id ${order.id}, status ${order.status}`);
    // Poll briefly for fill
    let filled = order;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      filled = await alpaca.getOrder(order.id);
      if (filled.status === 'filled') break;
    }
    const record = {
      ts: new Date().toISOString(),
      type: 'research-driven-entry',
      sourceTask: s.sourceTask,
      symbol: s.symbol,
      direction: s.direction,
      qty: s.qty,
      orderId: order.id,
      orderStatus: filled.status,
      modeledEntry: s.modeledEntry,
      actualFillPrice: filled.filled_avg_price ? Number(filled.filled_avg_price) : null,
      invalidationCondition: s.invalidation,
      timeHorizon: s.timeHorizon,
      note: 'Entry leg only. Portfolio-approval pipeline (round1/round2/round3-v2), 15-symbol shortlist, 3-5 cap this run per standing instruction (no cap in future runs).',
    };
    fs.appendFileSync(logPath, JSON.stringify(record) + '\n');
    results.push(record);
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
