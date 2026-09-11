// conditional-triggers.js -- the "keep passively scanning, confirm before
// firing" path added 2026-09-10, direct user request: round-3 shouldn't be
// stuck choosing between "execute now" and "nothing happens today" --
// a genuinely conditional thesis (sound reasoning, wrong current price)
// should sit as a watched price trigger, and when that price is actually
// touched, a brief automated rescan re-verifies the thesis BEFORE anything
// fires -- never a blind fill.
//
// State machine per (sourceTask, symbol): armed -> fired (rescan
// dispatched) -> confirmed (executed) | invalidated | expired. Tracked in
// bus/pending-triggers.jsonl, append-only event log -- same discipline as
// bus/paper-trades.jsonl, latest event per key wins for current state.
//
// Live price comes from alpaca-client.js's getLatestQuote() (the execution
// venue's own market-data API), NOT FMP -- this works today even though
// FMP_API_KEY isn't configured yet, and it's the more honest source of
// truth for "would this order actually fill near this price."

const fs = require('fs');
const path = require('path');
const runTask = require('./run-task.js');
const fleetStatus = require('./fleet-status.js');
const cryptoStatus = require('./crypto-status.js');
const alpaca = require('./alpaca-client.js');
const cryptoSymbols = require('./crypto-symbols.js');
const gen = require('./generate-pilot-tasks.js');
const executor = require('./execute-portfolio-setup.js');
const ntfy = require('./ntfy.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'pending-triggers.jsonl');

function nowIso() {
  return new Date().toISOString();
}

function appendEvent(record) {
  fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: nowIso(), ...record }) + '\n', 'utf8');
}

function readEvents() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

// Groups events by "sourceTask::symbol" and returns only the latest event
// per key -- that latest event's `type` IS the current state.
function latestStateByKey() {
  const byKey = new Map();
  for (const e of readEvents()) {
    const key = `${e.sourceTask}::${e.symbol}`;
    byKey.set(key, e); // later in file wins, matches append-only + chronological order
  }
  return byKey;
}

// Same JSON-fence extraction pattern as execute-portfolio-setup.js's
// extractApprovedCandidates(), for the new conditionalCandidates array.
function extractConditionalCandidates(taskId) {
  const taskPath = path.join(VAULT_ROOT, 'tasks', `${taskId}.md`);
  if (!fs.existsSync(taskPath)) return [];
  const text = fs.readFileSync(taskPath, 'utf8');
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed.conditionalCandidates)) return parsed.conditionalCandidates;
    } catch (_) { /* try next fence */ }
  }
  return [];
}

function findLatestRound3(pilot) {
  const status = pilot === 'crypto' ? cryptoStatus : fleetStatus;
  const findDate = pilot === 'crypto' ? status.findLatestCryptoPipelineDate : status.findLatestPipelineDate;
  const date = findDate();
  if (!date) return null;
  const versions = status.discoverRound3Versions(date);
  if (!versions.length) return null;
  return versions[versions.length - 1].taskId;
}

// Arms any conditionalCandidate from the latest round-3 synthesis that
// isn't already tracked (by sourceTask::symbol) -- safe to call every
// supervisor wake, idempotent by construction (readEvents() check below).
function armNewTriggers(pilot) {
  const taskId = findLatestRound3(pilot);
  if (!taskId) return [];
  const task = runTask.readTaskFile(taskId);
  if (!task || task.status !== 'done') return [];

  const candidates = extractConditionalCandidates(taskId);
  if (!candidates.length) return [];

  const known = latestStateByKey();
  const armed = [];
  for (const c of candidates) {
    const symbol = c.conditionalSetup ? c.conditionalSetup.symbol : c.symbol;
    const key = `${taskId}::${symbol}`;
    if (known.has(key)) continue; // already armed (or further along) this cycle
    if (typeof c.triggerPrice !== 'number' || !['at_or_below', 'at_or_above'].includes(c.triggerType)) {
      console.log(`[conditional-triggers] SKIPPED ${symbol}: malformed triggerPrice/triggerType, not arming (got ${JSON.stringify({ triggerPrice: c.triggerPrice, triggerType: c.triggerType })})`);
      continue;
    }
    appendEvent({
      type: 'trigger-armed',
      sourceTask: taskId,
      pilot,
      symbol,
      direction: c.conditionalSetup && c.conditionalSetup.direction,
      triggerPrice: c.triggerPrice,
      triggerType: c.triggerType,
      candidate: c, // full candidate payload, needed later to execute or rescan
    });
    armed.push(symbol);
  }
  if (armed.length) console.log(`[conditional-triggers] Armed ${armed.length} trigger(s) from ${taskId}: ${armed.join(', ')}`);
  return armed;
}

function isTriggered(mid, triggerPrice, triggerType) {
  return triggerType === 'at_or_below' ? mid <= triggerPrice : mid >= triggerPrice;
}

// For every currently-"armed" (watching) trigger: fetch a live quote,
// check against triggerPrice/triggerType. On a match, this does NOT
// execute -- it dispatches a brief rescan task and logs "trigger-fired".
// Actual execution only happens in checkRescanResults(), and only if that
// rescan comes back STILL VALID.
async function checkTriggers() {
  const byKey = latestStateByKey();
  const watching = Array.from(byKey.values()).filter((e) => e.type === 'trigger-armed');
  const fired = [];

  for (const record of watching) {
    let quote;
    try {
      quote = await alpaca.getLatestQuote(record.symbol);
    } catch (err) {
      console.log(`[conditional-triggers] ${record.symbol}: quote lookup failed, skipping this check -- ${err.message}`);
      continue;
    }
    if (!isTriggered(quote.mid, record.triggerPrice, record.triggerType)) continue;

    const datePrefix = gen.todayDatePrefix();
    const rescanTaskId = gen.generateRescanTask(record.pilot, record.symbol, datePrefix, record.sourceTask, quote.mid, record.triggerPrice, record.triggerType);
    appendEvent({
      type: 'trigger-fired',
      sourceTask: record.sourceTask,
      pilot: record.pilot,
      symbol: record.symbol,
      livePrice: quote.mid,
      triggerPrice: record.triggerPrice,
      triggerType: record.triggerType,
      rescanTaskId,
      candidate: record.candidate,
    });
    console.log(`[conditional-triggers] TRIGGERED ${record.symbol}: live $${quote.mid} vs trigger $${record.triggerPrice} (${record.triggerType}) -- rescan dispatched: ${rescanTaskId}`);
    fired.push(record.symbol);
  }
  return fired;
}

function parseVerdict(outputText) {
  const text = String(outputText || '');
  if (/VERDICT:\s*STILL VALID/i.test(text)) return 'still_valid';
  if (/VERDICT:\s*NO LONGER VALID/i.test(text)) return 'no_longer_valid';
  return null; // malformed/missing verdict -- never guess, treat as unresolved
}

// For every "trigger-fired" (rescan dispatched, awaiting result) trigger:
// check whether its rescan task has completed, and if so, act on the
// verdict. STILL VALID -> execute for real via execute-portfolio-setup.js's
// own executeOne() (idempotency-guarded there too, so a duplicate check
// never double-enters). NO LONGER VALID -> logged, nothing executed. A
// malformed/missing verdict is left pending rather than assumed either way.
async function checkRescanResults() {
  const byKey = latestStateByKey();
  const pendingRescans = Array.from(byKey.values()).filter((e) => e.type === 'trigger-fired');
  const results = [];

  for (const record of pendingRescans) {
    const rescanTask = runTask.readTaskFile(record.rescanTaskId);
    if (!rescanTask || rescanTask.status !== 'done' || !rescanTask.output) continue; // still waiting

    const verdict = parseVerdict(rescanTask.output);
    if (verdict === null) {
      console.log(`[conditional-triggers] ${record.symbol}: rescan ${record.rescanTaskId} completed but has no parseable VERDICT line -- leaving pending, not guessing.`);
      continue;
    }

    if (verdict === 'no_longer_valid') {
      appendEvent({
        type: 'trigger-invalidated',
        sourceTask: record.sourceTask,
        pilot: record.pilot,
        symbol: record.symbol,
        rescanTaskId: record.rescanTaskId,
        reason: 'rescan verdict: NO LONGER VALID',
      });
      console.log(`[conditional-triggers] INVALIDATED ${record.symbol}: rescan said no longer valid, not executing.`);
      results.push({ symbol: record.symbol, verdict });
      continue;
    }

    // STILL VALID -- execute for real, same micro sizing as every other
    // --auto execution (execute-portfolio-setup.js's computeMicroSizing()).
    const setup = record.candidate.conditionalSetup;
    const isCrypto = cryptoSymbols.isCryptoSymbol(setup.symbol);
    const sizing = await executor.computeMicroSizing(setup.symbol, setup.direction, isCrypto);
    try {
      await executor.executeOne(record.candidate, record.sourceTask, sizing);
      appendEvent({
        type: 'trigger-confirmed',
        sourceTask: record.sourceTask,
        pilot: record.pilot,
        symbol: record.symbol,
        rescanTaskId: record.rescanTaskId,
        sizing,
      });
      console.log(`[conditional-triggers] CONFIRMED + EXECUTED ${record.symbol}: rescan said still valid.`);
      await ntfy.sendNtfy({
        title: `${record.symbol}: conditional trigger confirmed and executed`,
        message: `${record.symbol} hit its trigger ($${record.triggerPrice}), rescan confirmed the thesis still holds, and the entry was placed (paper).`,
        priority: 4,
      }).catch(() => {});
    } catch (err) {
      console.log(`[conditional-triggers] ${record.symbol}: execution FAILED after confirmed rescan -- ${err.message}`);
      appendEvent({
        type: 'trigger-execution-failed',
        sourceTask: record.sourceTask,
        pilot: record.pilot,
        symbol: record.symbol,
        rescanTaskId: record.rescanTaskId,
        error: err.message,
      });
    }
    results.push({ symbol: record.symbol, verdict });
  }
  return results;
}

async function main() {
  armNewTriggers('fleet');
  armNewTriggers('crypto');
  const fired = await checkTriggers();
  const resolved = await checkRescanResults();
  console.log(`[conditional-triggers] Wake complete: ${fired.length} newly fired, ${resolved.length} rescan(s) resolved.`);
}

if (require.main === module) {
  main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}

module.exports = { appendEvent, readEvents, latestStateByKey, extractConditionalCandidates, findLatestRound3, armNewTriggers, checkTriggers, checkRescanResults, isTriggered, parseVerdict, main, LOG_PATH };
