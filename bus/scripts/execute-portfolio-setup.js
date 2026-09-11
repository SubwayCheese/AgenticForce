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
const fleetStatus = require('./fleet-status.js');
const cryptoStatus = require('./crypto-status.js');
const runTask = require('./run-task.js');
const ntfy = require('./ntfy.js');

const VAULT_ROOT = path.join(__dirname, '..', '..');
const LOG_PATH = path.join(__dirname, '..', 'paper-trades.jsonl');

// Sizing used ONLY on the --auto path (pilot-supervisor.js's unattended
// runs). Revised 2026-09-10 per direct user instruction: "micro trades,"
// not the earlier 10-share/$50 scale -- the whole point is many small,
// frequent, low-stakes learning trades (see trading-journal.js), not a
// few large convictions. $15/leg across every asset class/price range
// (see computeMicroSizing() below for how this becomes qty for the one
// case notional orders don't work -- short equity). The manual <taskId>
// path below is completely unaffected and keeps its existing fail-loud/
// 10-share-default behavior.
const AUTO_MICRO_NOTIONAL_PER_LEG = 15; // dollars/leg -- true micro sizing

function appendLog(record) {
  fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n');
}

function readTradeLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

// Real gap fixed here regardless of autonomy: nothing previously checked
// whether a candidate had already been executed before placing a new
// order, so re-running this script twice against the same round-3 task
// would double-enter positions. Applies to BOTH the manual and --auto
// paths.
function alreadyExecuted(sourceTask, symbol) {
  const entries = readTradeLog();
  return entries.some((r) => r.type === 'research-driven-entry' && r.sourceTask === sourceTask && r.symbol === symbol);
}

// Finds the latest status:done round-3 task for a pilot that hasn't been
// executed yet (no research-driven-entry log rows referencing it at all).
// Reuses the same discovery functions the dashboards already trust.
function findLatestUnexecutedRound3(pilot) {
  const status = pilot === 'crypto' ? cryptoStatus : fleetStatus;
  const findDate = pilot === 'crypto' ? status.findLatestCryptoPipelineDate : status.findLatestPipelineDate;
  const date = findDate();
  if (!date) return null;
  const versions = status.discoverRound3Versions(date);
  if (!versions.length) return null;
  const latest = versions[versions.length - 1];
  const task = runTask.readTaskFile(latest.taskId);
  if (!task || task.status !== 'done' || !task.output) return null;

  const entries = readTradeLog();
  const alreadyRun = entries.some((r) => r.sourceTask === latest.taskId);
  if (alreadyRun) return null; // today's cycle already executed -- --auto is safe to call every supervisor wake

  return latest.taskId;
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

// Genuinely urgent, unlike the market-closed skip below (which self-heals
// on the next retry, nothing has been risked yet) -- this means a REAL
// position now exists on the account with no protective stop. Never let
// this fail silently into just a console.log.
async function alertUnprotectedPosition(symbol, sourceTask, reason) {
  try {
    await ntfy.sendNtfy({
      title: `${symbol}: filled with NO protective stop`,
      message: `${symbol} (from ${sourceTask}) entered successfully but no stop could be placed: ${reason}. Real, unprotected position on the paper account -- place a stop manually.`,
      priority: 5,
    });
  } catch (_) { /* best-effort -- the console.log above is the fallback signal */ }
}

// sizing: { qty } for equities, { notional } for crypto (dollar amount --
// crypto trades in fractional/continuous sizes, a share-count is the wrong
// unit; Alpaca confirmed live: BTC min order size ~0.0000126, ~$1).
// Real incident, 2026-09-10/11: a conditional trigger fired and confirmed
// STILL VALID while the equity market was closed (a "day" market order
// submitted after-hours sits "accepted", not "filled" -- Alpaca queues it
// for next open). executeOne() used to wait 10s, give up, and proceed
// anyway with a null fill price and NO STOP PLACED -- the exact
// entry-without-protection gap this whole script exists to prevent,
// except now the position wouldn't even exist yet to notice was
// unprotected. Cancelled that real pending order manually; this return
// value is the structural fix -- callers must check `.skipped` and NOT
// mark a trigger/candidate as resolved when it's true, so the next
// supervisor wake (once the market is actually open) retries for real.
async function executeOne(candidate, sourceTask, sizing) {
  const setup = candidate.conditionalSetup;
  const symbol = setup.symbol;
  const direction = setup.direction; // "long" | "short"
  const isCrypto = cryptoSymbols.isCryptoSymbol(symbol);
  const sizeLabel = sizing.qty != null ? `${sizing.qty}sh` : `$${sizing.notional} notional`;
  console.log(`\n=== ${symbol} (${direction}) ===`);

  if (alreadyExecuted(sourceTask, symbol)) {
    console.log(`  SKIPPED: ${sourceTask}::${symbol} already has a research-driven-entry in paper-trades.jsonl -- not re-entering.`);
    return { skipped: true, reason: 'already-executed' };
  }

  if (!isCrypto) {
    const clock = await alpaca.apiRequest('GET', '/clock');
    if (!clock.is_open) {
      console.log(`  SKIPPED: equity market is closed (next open ${clock.next_open}) -- a "day" market order would sit pending unfilled and unprotected until then. Not submitting now; retry once the market is open.`);
      return { skipped: true, reason: 'market-closed', nextOpen: clock.next_open };
    }
  }

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
  if (filledEntry.status !== 'filled') {
    // Never leave an accepted-but-unfilled order sitting unprotected --
    // cancel it outright and report failure rather than proceeding with a
    // null fill price and no stop, exactly the gap this comment block
    // documents above.
    console.log(`  WARNING: entry did not fill within the retry window (status: ${filledEntry.status}) -- cancelling rather than leaving an unprotected pending order.`);
    try { await alpaca.cancelOrder(entryOrder.id); } catch (_) { /* best-effort */ }
    return { skipped: true, reason: 'fill-timeout' };
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
    await alertUnprotectedPosition(symbol, sourceTask, 'no parseable stop price in invalidationCondition');
    return { skipped: false, executed: true, stopPlaced: false, reason: 'unparseable-stop-price' };
  }
  if (!filledQty) {
    console.log(`  WARNING: no filled quantity available to size the protective stop -- NO STOP PLACED. Handle manually.`);
    await alertUnprotectedPosition(symbol, sourceTask, 'no filled quantity available to size the stop');
    return { skipped: false, executed: true, stopPlaced: false, reason: 'no-filled-qty' };
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
  return { skipped: false, executed: true, stopPlaced: true, actualFillPrice };
}

// --auto-only path: true "micro trade" sizing, direct user request
// ("agents always running... making micro trades and documenting their
// learnings"). A single flat dollar target across every asset class/price
// range, not the old flat-10-shares/flat-$50 constants (10 shares of LLY
// was never micro). Alpaca supports fractional/notional orders for long
// equity and all crypto, but NOT for short equity (a real, documented
// Alpaca limit) -- so a short computes a whole-share qty approximating
// the same dollar target from a live quote instead.
async function computeMicroSizing(symbol, direction, isCrypto) {
  if (isCrypto || direction === 'long') return { notional: AUTO_MICRO_NOTIONAL_PER_LEG };
  const quote = await alpaca.getLatestQuote(symbol);
  const qty = Math.max(1, Math.floor(AUTO_MICRO_NOTIONAL_PER_LEG / quote.mid));
  return { qty };
}

async function runForTaskMicro(taskId) {
  const candidates = extractApprovedCandidates(taskId);
  console.log(`[--auto] Found ${candidates.length} approved candidate(s) in ${taskId}, sizing each as a ~$${AUTO_MICRO_NOTIONAL_PER_LEG} micro trade.`);
  for (const candidate of candidates) {
    const setup = candidate.conditionalSetup;
    const isCrypto = cryptoSymbols.isCryptoSymbol(setup.symbol);
    const sizing = await computeMicroSizing(setup.symbol, setup.direction, isCrypto);
    await executeOne(candidate, taskId, sizing);
  }
}

async function runForTask(taskId, notionalPerLeg, qtyPerLeg) {
  const candidates = extractApprovedCandidates(taskId);
  console.log(`Found ${candidates.length} approved candidate(s) in ${taskId}.`);

  for (const candidate of candidates) {
    const symbol = candidate.conditionalSetup.symbol;
    const isCrypto = cryptoSymbols.isCryptoSymbol(symbol);
    if (isCrypto) {
      // No default dollar amount is invented for crypto on the MANUAL
      // path -- position sizing is explicitly the human operator's call,
      // and a wrong guess here is real money-shaped, even in paper: fail
      // loudly rather than silently pick a number. (--auto uses
      // computeMicroSizing() instead -- see runForTaskMicro().)
      if (!notionalPerLeg) {
        console.error(`FAILED: ${symbol} is a crypto candidate but no --notionalPerLeg=<dollars> was supplied. Crypto positions size by dollar notional, not share qty -- pass e.g. --notionalPerLeg=50.`);
        process.exit(1);
      }
      await executeOne(candidate, taskId, { notional: notionalPerLeg });
    } else {
      const qty = qtyPerLeg || 10;
      await executeOne(candidate, taskId, { qty });
    }
  }
}

async function main() {
  const isAuto = process.argv.includes('--auto');

  if (isAuto) {
    const pilotArg = process.argv.find((a) => a.startsWith('--pilot='));
    const pilot = pilotArg ? pilotArg.split('=')[1] : null;
    if (pilot !== 'fleet' && pilot !== 'crypto') {
      console.error('Usage: node execute-portfolio-setup.js --auto --pilot=fleet|crypto');
      process.exit(1);
    }
    const taskId = findLatestUnexecutedRound3(pilot);
    if (!taskId) {
      console.log(`[--auto] No unexecuted status:done round-3 task found for ${pilot} -- nothing to do.`);
      return;
    }
    console.log(`[--auto] Executing ${taskId} (${pilot}), micro sizing ($${AUTO_MICRO_NOTIONAL_PER_LEG}/leg).`);
    await runForTaskMicro(taskId);
    console.log('\nDone.');
    return;
  }

  const taskId = process.argv[2];
  if (!taskId) {
    console.error('Usage: node execute-portfolio-setup.js <taskId> [qtyPerLeg] [--notionalPerLeg=<dollars>]\n   or: node execute-portfolio-setup.js --auto --pilot=fleet|crypto');
    process.exit(1);
  }
  const notionalArg = process.argv.find((a) => a.startsWith('--notionalPerLeg='));
  const notionalPerLeg = notionalArg ? Number(notionalArg.split('=')[1]) : null;
  const qtyPerLeg = Number(process.argv[3]) || null;
  await runForTask(taskId, notionalPerLeg, qtyPerLeg);
  console.log('\nDone.');
}

// Guarded so this file can be require()'d as a library (conditional-triggers.js
// reuses executeOne()/alreadyExecuted() for the confirm-then-fire path) without
// its own CLI main() running unsolicited -- previously main() ran unconditionally
// on require, a real blocker the first time this was attempted.
if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
}

module.exports = { executeOne, alreadyExecuted, extractApprovedCandidates, runForTask, runForTaskMicro, computeMicroSizing, AUTO_MICRO_NOTIONAL_PER_LEG };
