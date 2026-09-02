#!/usr/bin/env node
// memory-store.js -- Phase 3 piece 3: a small, durable key/value fact
// store for /bus/. Distinct from vault-search.js (keyword search over
// static Markdown notes a human wrote) -- this remembers facts a
// *dispatched task* produced, so a later task can ask "what's the last
// verified value of X" without knowing which task_id produced it or
// when. No new dependency (just fs, matching the "no unjustified
// complexity" precedent from Phase 1's Task-Scheduler-over-PM2 call).
//
// Storage: bus/memory.jsonl, append-only, one JSON object per line --
// {ts, key, value, sourceTaskId, taskTo}. History is never overwritten,
// same discipline as bus/log.md -- getFact() returns the latest entry
// for a key, getFactHistory() returns all of them. Committed to git
// (unlike bus/continuous-run.log / bus/queue-daemon.log, which are
// gitignored operational logs) -- this is a durable, meaningful record
// of what's been verified over time, closer in character to bus/log.md.
//
// Who writes to this: only run-task.js's writeTaskResult(), via
// maybeRecordFact() -- gated on the SOURCE-tag honesty work already
// built today (a recall-tagged guess is never promoted to "remembered
// fact"). This module itself has no opinion on eligibility; it's a
// dumb, honest store. See run-task.js for the gating logic.

const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_PATH = path.join(VAULT_ROOT, 'bus', 'memory.jsonl');

function nowIso() {
  return new Date().toISOString();
}

function recordFact(key, value, meta) {
  const entry = { ts: nowIso(), key, value, sourceTaskId: (meta && meta.sourceTaskId) || null, taskTo: (meta && meta.taskTo) || null };
  fs.appendFileSync(MEMORY_PATH, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

// Reads every line, skipping (not throwing on) a malformed one -- a
// partial write or manual edit shouldn't take the whole store down, the
// same "refuse to guess, don't crash either" posture resolveDependency()
// already applies to task state, applied here to file I/O instead.
function readAllEntries() {
  if (!fs.existsSync(MEMORY_PATH)) return [];
  const lines = fs.readFileSync(MEMORY_PATH, 'utf8').split('\n').filter((l) => l.trim());
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch (e) {
      // Skip silently -- a single malformed line is not grounds to
      // refuse every other fact in the store.
    }
  }
  return entries;
}

function getFactHistory(key) {
  return readAllEntries().filter((e) => e.key === key);
}

function getFact(key) {
  const history = getFactHistory(key);
  return history.length ? history[history.length - 1] : null;
}

// Summarizes every known key for reporting (bus-status.js, memory-query.js
// --list) -- count of recordings and the most recent one, not the full
// history (use getFactHistory() for that).
function listKeys() {
  // readAllEntries() returns entries in file (append/chronological)
  // order, so the last one set per key in this Map is naturally the
  // most recent -- no need to compare timestamps.
  const byKey = new Map();
  for (const entry of readAllEntries()) {
    const existing = byKey.get(entry.key);
    byKey.set(entry.key, { count: (existing ? existing.count : 0) + 1, latest: entry });
  }
  return Array.from(byKey.entries()).map(([key, v]) => ({ key, count: v.count, latest: v.latest }));
}

module.exports = { recordFact, getFact, getFactHistory, listKeys, MEMORY_PATH };
