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

const fs = require('fs');
const path = require('path');
const runTask = require('./run-task.js');
const alpaca = require('./alpaca-client.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
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
  const taskId = process.argv[2];
  const qty = process.argv[3];
  if (!taskId || !qty) {
    console.error('Usage: node execute-setup.js <synthesis_task_id> <qty>');
    console.error('Example: node execute-setup.js fleet_pilot_20260903_synthesis_r3v4 10');
    process.exit(1);
  }
  executeFromTask(taskId, Number(qty)).catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
