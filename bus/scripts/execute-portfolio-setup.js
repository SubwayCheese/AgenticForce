// Canonical executor for a portfolio-approval round-3 task's approvedCandidates
// array (the "higher agent" design -- see fleet_pilot_20260908_synthesis_r3_portfolio_v2
// and ARCHITECTURE.md's paper-trading section for the full pipeline: 50-stock
// scan -> top 15-20 shortlist -> round1 (thesis) -> round2 (challenge) ->
// round3 (portfolio approval, multiple independent candidates, not a single
// winner)).
//
// Supersedes the two-step process used for the first real run
// (scratch-execute-portfolio-r3v2.js entry, then a SEPARATE
// place-safety-net-stops.js run ~90 minutes later for the stop). That gap
// left 3 positions open with zero downside protection long enough that the
// user had to manually close them at a loss. This script closes that gap
// structurally: for EACH approved candidate, the entry order and its
// protective GTC stop order are placed back-to-back in the same run, with no
// human-timed step in between.
//
// It does NOT handle the time-based ("exit after N sessions") half of the
// exit rule -- that's monitor-paper-trades.js's job, run separately (see
// that file's header for why a stop order can't express a time-based exit).
//
// Usage: node execute-portfolio-setup.js <taskId>
//   Reads tasks/<taskId>.md, extracts the ```json ... ``` block containing
//   approvedCandidates, and for each candidate: places the entry (market),
//   confirms the fill, parses the stop price out of invalidationCondition,
//   and places the protective stop (GTC) immediately after.

const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');
const cryptoSymbols = require('./crypto-symbols.js');

const VAULT_ROOT = path.join(__dirname, '..', '..');
const LOG_PATH = path.join(__dirname, '..', 'paper-trades.jsonl');

function appendLog(record) {
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n');
}

function extractApprovedCandidates(taskId) {
  const taskPath = path.join(VAULT_ROOT, 'tasks', `${taskId}.md`);
  const text = fs.readFileSync(taskPath, 'utf8');
  // Find every ```json ... ``` fenced block, use the first that parses and
  // contains an approvedCandidates array.
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed.approvedCandidates)) return parsed.approvedCandidates;
    } catch (_) { /* try next fence */ }
  }
  throw new Error(`No parseable approvedCandidates JSON block found in ${taskPath}`);
}

// Pulls the first dollar figure out of an invalidationCondition string, e.g.
// "Invalidate if TSLA closes above $390.00, or exit..." -> 390.00
function parseStopPrice(invalidationCondition) {
  const m = /\$([\d,]+\.?\d*)/.exec(invalidationCondition || '');
  if (!m) return null;
  return Number(m[1].replace(/,/g, ''));
}

// sizing: { qty } for equities, { notional } for crypto (dollar amount --
// crypto trades in fractional/continuous sizes, a share-count is the wrong
// unit; Alpaca confirmed live: BTC min order size ~0.0000126, ~$1).
async function executeOne(candidate, sourceTask, sizing) {
  const setup = candidate.conditionalSetup;
  const symbol = setup.symbol;
  const direction = setup.direction; // "long" | "short"
  const isCrypto = cryptoSymbols.isCryptoSymbol(symbol);
  const sizeLabel = sizing.qty != null ? `${sizing.qty}sh` : `$${sizing.notional} notional`;
  console.log(`\n=== ${symbol} (${direction}) ===`);

  console.log(`Submitting entry: ${direction} ${sizeLabel} market...`);
  // Crypto rejects "day" (equity-only value, confirmed live: 422 "invalid
  // crypto time_in_force") -- crypto entries use "gtc" instead.
  const entryTimeInForce = isCrypto ? 'gtc' : 'day';
  const entryOrder = await alpaca.submitOrder({ symbol, direction, ...sizing, orderType: 'market', timeInForce: entryTimeInForce });
  let filledEntry = entryOrder;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    filledEntry = await alpaca.getOrder(entryOrder.id);
    if (filledEntry.status === 'filled') break;
  }
  const actualFillPrice = filledEntry.filled_avg_price ? Number(filledEntry.filled_avg_price) : null;
  let filledQty = filledEntry.filled_qty ? Number(filledEntry.filled_qty) : (sizing.qty || null);
  console.log(`  Entry filled @ $${actualFillPrice}`);

  // Crypto fees are deducted IN-KIND from the asset itself, confirmed live:
  // an order's own filled_qty can be a hair larger than what's actually
  // available in the resulting position (e.g. 0.000124636 filled vs
  // 0.000124324 available). Sizing the protective stop off filled_qty can
  // therefore request more than the account holds and get rejected (403
  // "insufficient balance"). Re-fetch the live position and use ITS qty for
  // crypto, which reflects the fee deduction; equities have no such
  // in-kind-fee mechanic so filled_qty stays authoritative there.
  if (isCrypto) {
    const positions = await alpaca.getPositions();
    const live = positions.find((p) => cryptoSymbols.isCryptoSymbol(p.symbol) && cryptoSymbols.toAlpacaSymbol(p.symbol) === symbol);
    if (live) filledQty = Number(live.qty_available || live.qty);
  }

  appendLog({
    ts: new Date().toISOString(),
    type: 'research-driven-entry',
    sourceTask,
    symbol,
    assetClass: isCrypto ? 'crypto' : 'equity',
    direction,
    qty: filledQty,
    notional: sizing.notional || null,
    orderId: entryOrder.id,
    orderStatus: filledEntry.status,
    modeledEntry: null,
    actualFillPrice,
    invalidationCondition: setup.invalidationCondition,
    timeHorizon: setup.timeHorizon,
    note: 'Placed via execute-portfolio-setup.js -- stop order placed immediately after, same run, no manual gap.',
  });

  const stopPrice = parseStopPrice(setup.invalidationCondition);
  if (stopPrice === null) {
    console.log(`  WARNING: could not parse a stop price out of invalidationCondition ("${setup.invalidationCondition}") -- NO STOP PLACED. Handle manually.`);
    return;
  }
  if (!filledQty) {
    console.log(`  WARNING: no filled quantity available to size the protective stop -- NO STOP PLACED. Handle manually.`);
    return;
  }
  // A stop that CLOSES a short is a buy-stop (direction "long" in
  // submitOrder's convention); a stop that closes a long is a sell-stop.
  // A crypto entry is always "long" here (enforced upstream -- crypto is
  // spot/long-only), so this is always the sell-stop-closes-a-long case for
  // crypto rows, never the short-closing branch.
  const stopDirection = direction === 'short' ? 'long' : 'short';
  // Crypto rejects plain "stop" (confirmed live: 422 "invalid order type for
  // crypto order") -- Alpaca crypto only supports stop_limit, not stop-market.
  // A 1% buffer between stop and limit keeps the order fillable through
  // normal slippage rather than sitting unfilled at an exact price.
  const stopOrderType = isCrypto ? 'stop_limit' : 'stop';
  const stopLimitPrice = isCrypto
    ? (stopDirection === 'short' ? stopPrice * 0.99 : stopPrice * 1.01)
    : undefined;
  console.log(`Placing protective GTC ${stopOrderType}: ${stopDirection} ${filledQty} @ stop $${stopPrice}${stopLimitPrice ? ` / limit $${stopLimitPrice.toFixed(8)}` : ''}...`);
  const stopOrder = await alpaca.submitOrder({ symbol, direction: stopDirection, qty: filledQty, orderType: stopOrderType, stopPrice, limitPrice: stopLimitPrice, timeInForce: 'gtc', intent: 'close' });
  console.log(`  Stop order id ${stopOrder.id}, status ${stopOrder.status}`);

  appendLog({
    ts: new Date().toISOString(),
    type: 'stop-order-placed',
    sourceTask,
    symbol,
    assetClass: isCrypto ? 'crypto' : 'equity',
    qty: filledQty,
    stopPrice,
    orderId: stopOrder.id,
    orderStatus: stopOrder.status,
    note: 'GTC stop placed immediately after entry fill in the same run (execute-portfolio-setup.js) -- no manual gap between entry and protection.',
  });
}

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error('Usage: node execute-portfolio-setup.js <taskId> [qtyPerLeg] [--notionalPerLeg=<dollars>]');
    process.exit(1);
  }
  const notionalArg = process.argv.find((a) => a.startsWith('--notionalPerLeg='));
  const notionalPerLeg = notionalArg ? Number(notionalArg.split('=')[1]) : null;
  const qtyPerLeg = Number(process.argv[3]) || null; // if not given, uses a fixed placeholder qty (equities only) below
  const candidates = extractApprovedCandidates(taskId);
  console.log(`Found ${candidates.length} approved candidate(s) in ${taskId}.`);

  for (const candidate of candidates) {
    const symbol = candidate.conditionalSetup.symbol;
    const isCrypto = cryptoSymbols.isCryptoSymbol(symbol);
    if (isCrypto) {
      // No default dollar amount is invented for crypto -- position sizing
      // is explicitly the human operator's call (same boundary as equity
      // qtyPerLeg), and a wrong guess here is real money-shaped, even in
      // paper: fail loudly rather than silently pick a number.
      if (!notionalPerLeg) {
        console.error(`FAILED: ${symbol} is a crypto candidate but no --notionalPerLeg=<dollars> was supplied. Crypto positions size by dollar notional, not share qty -- pass e.g. --notionalPerLeg=50.`);
        process.exit(1);
      }
      await executeOne(candidate, taskId, { notional: notionalPerLeg });
    } else {
      // Position sizing remains explicitly out of scope for this pipeline's
      // own logic (see ARCHITECTURE.md) -- qtyPerLeg is either passed in by
      // the human operator, or this falls back to a fixed small placeholder
      // qty (10 shares) rather than inventing a sizing formula.
      const qty = qtyPerLeg || 10;
      await executeOne(candidate, taskId, { qty });
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
