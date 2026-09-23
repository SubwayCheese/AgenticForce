// trading-journal.js -- "the stock is the teacher": every closed
// research-driven trade gets a durable, structured lesson, not just a
// P&L number in paper-trades.jsonl. Direct user request: agents should
// be "always running... making micro trades and documenting their
// learnings like a student." Two layers, deliberately different cost:
//
// 1. journalClosedTrades() -- mechanical, cheap, runs every supervisor
//    wake: matches each closed entry/exit pair, computes real win/loss +
//    pnl%, pulls the original thesis back out of its source round-3 task,
//    writes one row to bus/trading-journal.jsonl. Always happens, no
//    agent dispatch.
// 2. synthesizeRecentLessons() -- a real agent reflection pass, run only
//    periodically (once enough new closed trades accumulate), that reads
//    a batch of raw thesis+outcome pairs and writes actual prose lessons
//    back onto those journal rows. This is what makes "the stock is the
//    teacher" literal rather than just a log -- but it's a real Codex
//    dispatch, so it's batched, not fired per micro-trade.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const VAULT_ROOT = avPaths.ROOT;
const JOURNAL_PATH = path.join(VAULT_ROOT, 'bus', 'trading-journal.jsonl');
const TRADES_PATH = path.join(VAULT_ROOT, 'bus', 'paper-trades.jsonl');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');

function nowIso() {
  return new Date().toISOString();
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

function readTrades() {
  return readJsonl(TRADES_PATH);
}

function readJournal() {
  return readJsonl(JOURNAL_PATH);
}

function appendJournalEntry(entry) {
  fs.appendFileSync(JOURNAL_PATH, JSON.stringify({ ts: nowIso(), ...entry }) + '\n', 'utf8');
}

// Pulls the original bull/bear/rationale for one symbol back out of its
// source round-3 task -- same JSON-fence extraction pattern already
// proven in execute-portfolio-setup.js/conditional-triggers.js.
function extractCandidateThesis(sourceTaskId, symbol) {
  if (!sourceTaskId) return null;
  const taskPath = path.join(TASKS_DIR, `${sourceTaskId}.md`);
  if (!fs.existsSync(taskPath)) return null;
  const text = fs.readFileSync(taskPath, 'utf8');
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const pools = [parsed.approvedCandidates, parsed.conditionalCandidates, parsed.rejectedCandidates].filter(Array.isArray);
      for (const pool of pools) {
        const found = pool.find((c) => c.symbol === symbol || (c.conditionalSetup && c.conditionalSetup.symbol === symbol));
        if (found) return found;
      }
    } catch (_) { /* try next fence */ }
  }
  return null;
}

// Pairs one entry row with the exit row that actually closed IT, not merely
// the next exit in the same symbol. Two rules, in order:
//   1. lotId match -- exact, unambiguous, works even with two concurrent
//      lots in one symbol (the 2026-09-11 VZ double-entry state);
//   2. legacy fallback for rows written before lot ids existed: the earliest
//      exit after this entry in the same symbol that no earlier entry has
//      already claimed. `claimed` is what stops two entries in a symbol from
//      both pointing at the same single exit and double-counting a trade.
// Never throws on a record missing lotId -- every historical row is that shape.
function findMatchingExit(entry, exits, claimed) {
  if (entry.lotId) {
    const byLot = exits.find((e) => e.lotId && e.lotId === entry.lotId);
    if (byLot) return byLot;
  }
  return exits.find((e) => e.symbol === entry.symbol && e.ts > entry.ts && !claimed.has(e) && !e.lotId) || null;
}

// Mechanical, cheap, idempotent -- safe to call every supervisor wake.
// Matches each closed (entry, exit) pair that hasn't been journaled yet,
// computes real win/loss, writes one row.
function journalClosedTrades() {
  const trades = readTrades();
  const journal = readJournal();
  const journaledKeys = new Set(journal.map((j) => `${j.entryTs}::${j.symbol}`));

  const entries = trades.filter((t) => t.type === 'research-driven-entry')
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const exits = trades.filter((t) => t.type === 'research-driven-exit')
    .sort((a, b) => a.ts.localeCompare(b.ts));
  const claimed = new Set();

  const newEntries = [];
  for (const entry of entries) {
    const key = `${entry.ts}::${entry.symbol}`;
    const exit = findMatchingExit(entry, exits, claimed);
    if (exit) claimed.add(exit);
    if (journaledKeys.has(key)) continue;
    if (!exit) continue; // still open -- nothing to journal yet, not an error

    const entryPrice = entry.actualFillPrice;
    const exitPrice = exit.exitFillPrice;
    let pnlPct = null;
    if (entryPrice && exitPrice) {
      pnlPct = entry.direction === 'short'
        ? ((entryPrice - exitPrice) / entryPrice) * 100
        : ((exitPrice - entryPrice) / entryPrice) * 100;
    }
    const outcome = pnlPct === null ? 'unknown' : (pnlPct > 0 ? 'win' : (pnlPct < 0 ? 'loss' : 'flat'));
    const thesis = extractCandidateThesis(entry.sourceTask, entry.symbol);

    const record = {
      type: 'trade-closed',
      // Additive, null on every historical row by design -- the immutable
      // identity of the position this row is about, so a journal row can be
      // tied back to its exact lot in paper-trades.jsonl rather than to a
      // symbol that may have been traded several times.
      lotId: entry.lotId || null,
      entryTs: entry.ts,
      exitTs: exit.ts,
      symbol: entry.symbol,
      assetClass: entry.assetClass || 'equity',
      sourceTask: entry.sourceTask,
      direction: entry.direction,
      entryPrice,
      // The price the thesis intended to enter at, when the candidate
      // supplied one -- performance-scorecard.js measures entry slippage
      // against this. Null (honestly) for a market-entry candidate with no
      // stated level, and for every row written while execute-portfolio-setup.js
      // was hardcoding modeledEntry:null.
      modeledEntry: entry.modeledEntry != null ? entry.modeledEntry : null,
      qty: entry.qty != null ? entry.qty : null,
      notional: entry.notional != null ? entry.notional : null,
      exitPrice,
      pnlPct,
      outcome,
      exitReason: exit.reason,
      entryThesis: thesis ? {
        stance: thesis.stance,
        bullCase: thesis.bullCase,
        bearCase: thesis.bearCase,
        oneLineRationale: thesis.oneLineRationale,
      } : null,
      lesson: null, // filled in later by synthesizeRecentLessons()'s reflection pass
      reflectionTaskId: null,
    };
    appendJournalEntry(record);
    newEntries.push(record);
  }
  if (newEntries.length) {
    console.log(`[trading-journal] Journaled ${newEntries.length} newly-closed trade(s): ${newEntries.map((e) => `${e.symbol} (${e.outcome})`).join(', ')}`);
  }
  return newEntries;
}

// Merges each 'trade-closed' row with the latest 'lesson-added' row (if
// any) sharing the same entryTs::symbol key -- same append-only +
// latest-wins discipline as conditional-triggers.js's pending-triggers.jsonl,
// so a lesson can be attached later without rewriting the original row.
function getJournalEntriesWithLessons() {
  const rows = readJournal();
  const base = new Map();
  const dispatched = new Map();
  const lessons = new Map();
  for (const r of rows) {
    const key = `${r.entryTs}::${r.symbol}`;
    if (r.type === 'trade-closed') base.set(key, r);
    if (r.type === 'reflection-dispatched') dispatched.set(key, r); // later wins
    if (r.type === 'lesson-added') lessons.set(key, r); // later wins
  }
  return Array.from(base.entries()).map(([key, record]) => {
    const lessonRow = lessons.get(key);
    if (lessonRow) return { ...record, lesson: lessonRow.lesson, reflectionTaskId: lessonRow.reflectionTaskId };
    const dispatchRow = dispatched.get(key);
    if (dispatchRow) return { ...record, reflectionTaskId: dispatchRow.reflectionTaskId };
    return record;
  });
}

const REFLECTION_BATCH_SIZE = 3;
const REFLECTION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // don't let a slow trickle wait forever for a full batch

// Dispatches a real agent reflection once enough newly-closed trades have
// accumulated (or the oldest un-reflected one has waited long enough) --
// deliberately batched, not one agent call per micro-trade.
function maybeDispatchReflection(gen) {
  const all = getJournalEntriesWithLessons();
  const pending = all.filter((e) => !e.lesson && !e.reflectionTaskId);
  if (!pending.length) return null;

  const oldestAgeMs = Date.now() - new Date(pending[0].entryTs).getTime();
  if (pending.length < REFLECTION_BATCH_SIZE && oldestAgeMs < REFLECTION_MAX_AGE_MS) return null;

  const batch = pending.slice(0, Math.max(REFLECTION_BATCH_SIZE, pending.length));
  const datePrefix = gen.todayDatePrefix();
  const taskId = gen.generateReflectionTask(datePrefix, batch);
  for (const entry of batch) {
    appendJournalEntry({ type: 'reflection-dispatched', entryTs: entry.entryTs, symbol: entry.symbol, reflectionTaskId: taskId });
  }
  console.log(`[trading-journal] Dispatched reflection ${taskId} for ${batch.length} closed trade(s): ${batch.map((b) => b.symbol).join(', ')}`);
  return taskId;
}

// For every dispatched-but-unresolved reflection: check if it's done, and
// if so, write a 'lesson-added' row per trade in that batch.
function checkReflectionResults(runTask) {
  const all = getJournalEntriesWithLessons();
  const pendingTaskIds = new Set(all.filter((e) => e.reflectionTaskId && !e.lesson).map((e) => e.reflectionTaskId));
  const resolved = [];

  for (const taskId of pendingTaskIds) {
    const task = runTask.readTaskFile(taskId);
    if (!task || task.status !== 'done' || !task.output) continue;

    let parsed;
    const fenceRe = /```json\s*([\s\S]*?)```/;
    const m = fenceRe.exec(task.output);
    if (m) { try { parsed = JSON.parse(m[1]); } catch (_) { parsed = null; } }
    if (!parsed || !Array.isArray(parsed.lessons)) {
      console.log(`[trading-journal] ${taskId}: completed but no parseable lessons[] -- leaving pending, not guessing.`);
      continue;
    }

    const batchEntries = all.filter((e) => e.reflectionTaskId === taskId && !e.lesson);
    for (const entry of batchEntries) {
      const lessonRow = parsed.lessons.find((l) => l.symbol === entry.symbol);
      const lesson = lessonRow ? lessonRow.lesson : (parsed.crossTradePattern || 'No per-symbol lesson returned.');
      appendJournalEntry({ type: 'lesson-added', entryTs: entry.entryTs, symbol: entry.symbol, reflectionTaskId: taskId, lesson });
      resolved.push({ symbol: entry.symbol, lesson });
    }
    if (parsed.crossTradePattern) {
      console.log(`[trading-journal] ${taskId} cross-trade pattern: ${parsed.crossTradePattern}`);
    }
  }
  return resolved;
}

// Real, per-symbol trading HISTORY (not methodology critique) -- this is
// what makes "the stock is the teacher" concrete: a symbol's own past
// trades feed directly into its next thesis.
function getSymbolHistory(symbol, limit = 5) {
  return getJournalEntriesWithLessons()
    .filter((e) => e.symbol === symbol && e.lesson)
    .sort((a, b) => b.exitTs.localeCompare(a.exitTs))
    .slice(0, limit);
}

module.exports = {
  readTrades, readJournal, readJsonl, appendJournalEntry, extractCandidateThesis,
  journalClosedTrades, findMatchingExit, getJournalEntriesWithLessons, maybeDispatchReflection,
  checkReflectionResults, getSymbolHistory, JOURNAL_PATH, TRADES_PATH,
};
