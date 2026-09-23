// bus/org/events.js -- Round 26. Durable, append-only event log for the org runtime (Plan 1: "Durable queue,
// at-least-once delivery with idempotent consumers and event deduplication"). Entirely separate from the
// shared run-queue-daemon.js's tasks/ directory -- its own file, its own directory under bus/org-state/,
// mirroring the proven isolation pattern research-swarm-tasks.js already uses (that module verified
// run-queue-daemon's fs.watch is rooted only at tasks/, so a sibling directory is structurally invisible to
// it; the same is true here).
//
// Delivery model: append(event) durably logs it (through store.js's fsync'd write, so a crash right after
// append can never lose it); processEvents(handler) replays every event NOT YET marked processed, in order,
// calling handler(event) for each, and marks it processed only after the handler returns without throwing.
// Handlers must be idempotent (Plan 1 AT#2: "submit the same event twice; only one state transition and one
// external action occur") -- this module guarantees at-least-once delivery, not exactly-once; exactly-once
// side effects are the handler's job (typically: check a receipt/idempotency key already recorded in
// store.js before acting).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store.js');

let EVENTS_PATH = () => path.join(store._storeDir(), 'events.jsonl');
let PROCESSED_PATH = () => path.join(store._storeDir(), 'events-processed.json');

function _setPathsForTesting() { /* paths derive from store's dir, which tests already retarget via store._setStoreDirForTesting */ }

function readAll() {
  const p = EVENTS_PATH();
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
}

// append(): durable, locked (so two processes appending concurrently can't interleave partial lines), and
// deduplicates on `event.id` if the caller supplies one -- a caller that doesn't know whether its own append
// already succeeded (e.g. it crashed right after writing, before returning) can safely append the same
// event.id again with no double-effect.
function append(event) {
  const id = event.id || crypto.randomUUID();
  const full = { id, ts: new Date().toISOString(), ...event };
  return store.withLock('events-append', () => {
    const existing = readAll();
    if (existing.some((e) => e.id === id)) return existing.find((e) => e.id === id); // already durably recorded -- idempotent
    const p = EVENTS_PATH();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(full) + '\n', 'utf8');
    try { const fd = fs.openSync(p, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch (_) {}
    return full;
  });
}

function readProcessed() {
  const p = PROCESSED_PATH();
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return {}; }
}

function markProcessed(id, result) {
  return store.withLock('events-processed', () => {
    const cur = readProcessed();
    cur[id] = { processedAt: new Date().toISOString(), result: result === undefined ? null : result };
    store.durableWriteFileSync(PROCESSED_PATH(), JSON.stringify(cur, null, 2));
  });
}

// processEvents(handler): replays every unprocessed event in append order. Returns per-event outcomes so a
// caller (director.js, watchdog.js) can log/react without the handler itself needing to do bookkeeping.
// A throwing handler stops processing at that event (leaves it and everything after unprocessed) rather than
// skipping it -- matches Plan 1's "dead-letter review: unprocessable events are preserved for diagnosis
// rather than dropped", and a subsequent call retries from the same point.
function processEvents(handler) {
  const processed = readProcessed();
  const pending = readAll().filter((e) => !processed[e.id]);
  const outcomes = [];
  for (const e of pending) {
    let result, error = null;
    try { result = handler(e); } catch (err) { error = err.message; outcomes.push({ id: e.id, ok: false, error }); break; }
    markProcessed(e.id, result === undefined ? null : result);
    outcomes.push({ id: e.id, ok: true, result });
  }
  return outcomes;
}

function unprocessedCount() { const processed = readProcessed(); return readAll().filter((e) => !processed[e.id]).length; }

module.exports = { append, readAll, readProcessed, processEvents, unprocessedCount, _setPathsForTesting };
