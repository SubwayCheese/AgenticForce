// Takes a synthesis task's conditionalSetup and places the actual paper order
// via alpaca-client.js. Deliberately manual-invocation only right now -- this
// does NOT watch for a setup's entry condition (e.g. "only after the 10-28
// earnings release if X") and auto-fire when it's met. That's a real, separate
// piece of engineering (parsing an arbitrary natural-language condition,
// deciding a check cadence, running unattended for a month) that hasn't been
// scoped or built yet -- see ARCHITECTURE.md / project memory. For now, a human
// (or the orchestrator, on the user's instruction) confirms the entry condition
// is actually met before running this.
//
// This does NOT do position sizing -- qty is a required argument, per the
// approved plan's explicit "position sizing is a separate, later decision"
// boundary (see the synthesis task template).

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const runTask = require('../platform/run-task.js');
const alpaca = require('./alpaca-client.js');

const VAULT_ROOT = avPaths.ROOT;
const PAPER_TRADES_LOG = path.join(VAULT_ROOT, 'bus', 'paper-trades.jsonl');

// Extracts the conditionalSetup JSON object from a synthesis task's raw output
// text. The output is prose with an embedded ```json ... ``` block (see the
// synthesis task templates) -- this pulls that block out and parses it.
function extractConditionalSetup(outputText) {
  const match = /```json\s*\n([\s\S]*?)\n```/.exec(outputText);
  if (!match) {
    // Some passes returned it as a bare `"conditionalSetup": "NO_ACTIONABLE_CANDIDATE"`
    // inline rather than a fenced block -- check for that too.
    if (/NO_ACTIONABLE_CANDIDATE/.test(outputText)) return null;
    throw new Error('No ```json conditionalSetup block found in this task\'s output, and no NO_ACTIONABLE_CANDIDATE literal either -- inspect the task manually.');
  }
  return JSON.parse(match[1]);
}

function appendTradeLog(entry) {
  fs.appendFileSync(PAPER_TRADES_LOG, JSON.stringify(entry) + '\n', 'utf8');
}

async function executeFromTask(taskId, qty) {
  const task = runTask.readTaskFile(taskId);
  if (!task || task.status !== 'done' || !task.output) {
    throw new Error(`Task "${taskId}" is not a completed task with output -- cannot extract a setup from it.`);
  }
  const setup = extractConditionalSetup(task.output);
  if (!setup) {
    throw new Error(`Task "${taskId}"'s synthesis result is NO_ACTIONABLE_CANDIDATE -- nothing to execute.`);
  }
  console.log(`Extracted setup from ${taskId}:`, JSON.stringify(setup, null, 2));
  console.log(`\nPlacing PAPER order: ${setup.direction} ${qty} ${setup.symbol}...`);

  const order = await alpaca.submitOrder({ symbol: setup.symbol, direction: setup.direction, qty });

  const logEntry = {
    ts: new Date().toISOString(),
    sourceTaskId: taskId,
    setup,
    qty,
    orderId: order.id,
    orderStatus: order.status,
    orderRaw: order,
  };
  appendTradeLog(logEntry);

  console.log(`\nOrder submitted. id=${order.id} status=${order.status}`);
  console.log(`Logged to ${PAPER_TRADES_LOG} for later performance tracking.`);
  return logEntry;
}

module.exports = { extractConditionalSetup, executeFromTask, PAPER_TRADES_LOG };

if (require.main === module) {
  // GUARD, added 2026-09-11 (maintainability sweep): this script places an
  // entry order with NO protective stop -- unlike
  // execute-portfolio-setup.js, which places the entry and its GTC stop
  // back-to-back in the same run specifically to close that gap. Running
  // THIS script directly recreates the exact real incident that motivated
  // that fix: the first real run (this script, then a separate
  // place-safety-net-stops.js run ~90 minutes later) left 3 positions open
  // with zero downside protection long enough that the user had to
  // manually close them at a loss (see execute-portfolio-setup.js's header
  // and ARCHITECTURE.md). For any candidate with a stated invalidation
  // price, use `node execute-portfolio-setup.js <taskId>` instead -- it is
  // the canonical executor. This script stays available only for a
  // genuine one-off manual case with no invalidation price to protect,
  // gated behind an explicit flag so it can't be run by accident.
  if (!process.argv.includes('--i-understand-this-bypasses-safety-checks')) {
    console.error('REFUSING TO RUN: execute-setup.js places a real paper entry order with NO protective stop.');
    console.error('execute-portfolio-setup.js <taskId> is the canonical executor (entry + stop, back-to-back) -- use that instead.');
    console.error('If you genuinely need this script anyway, re-run with --i-understand-this-bypasses-safety-checks.');
    process.exit(1);
  }

  const taskId = process.argv[2];
  const qty = process.argv[3];
  if (!taskId || !qty) {
    console.error('Usage: node execute-setup.js <synthesis_task_id> <qty> --i-understand-this-bypasses-safety-checks');
    console.error('Example: node execute-setup.js fleet_pilot_20260903_synthesis_r3v4 10 --i-understand-this-bypasses-safety-checks');
    process.exit(1);
  }
  executeFromTask(taskId, Number(qty)).catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
