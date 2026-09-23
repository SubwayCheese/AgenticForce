// bus/org/store.js -- Round 26. Durable state store for the org runtime (Plan 1 "Foundation": Mission,
// Strategy, Project, Task, AgentSpec, Evidence, Action, Receipt, Memory). node:sqlite is NOT available on
// this Node build (20.20.2, confirmed -- no --experimental-sqlite flag exists on it either) and no native
// module (better-sqlite3) is installed; consistent with this codebase's no-new-dependency discipline
// (alpaca-client.js, ntfy.js etc. all use plain fetch, no SDK), storage here is one versioned JSON document
// per object, written durably (fsync'd temp file + fsync'd rename, see durableWriteFileSync below).
//
// Cross-process safety (the real gap a review found in the first draft): director.js and watchdog.js are
// SEPARATE `node` invocations, exactly like every other pair of scripts in this repo (run-queue-daemon.js is
// its own process, research-swarm-cycle.js is its own process) -- an in-process async queue alone cannot
// serialize writes between two OS processes. Every mutation here goes through withLock(), a cross-process
// mutex built on atomic exclusive directory creation (`fs.mkdirSync` with no recursive flag is atomic and
// exclusive on a POSIX filesystem -- a well-established lock primitive, no native/npm dependency needed),
// with staleness detection (a lock older than LOCK_STALE_MS from a dead process is broken) so a killed
// holder can never wedge the store forever. Every object additionally carries a `version` field checked with
// optimistic concurrency (CAS): a write is rejected, not silently applied, if the caller's expected version
// doesn't match what's on disk -- the caller must reload and retry (Plan 1 acceptance test #3: "one wins and
// the other reloads rather than overwriting silently").

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const avPaths = require('../lib/paths.js');

let ORG_DIR = avPaths.bus('org-state');
const LOCK_STALE_MS = 15000;
const LOCK_RETRY_MS = 25;

function _setStoreDirForTesting(dir) { ORG_DIR = dir; }
function _storeDir() { return ORG_DIR; }

const TASK_STATES = Object.freeze(['QUEUED', 'READY', 'RUNNING', 'WAITING', 'BLOCKED', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'EXHAUSTED']);
const COLLECTIONS = Object.freeze(['missions', 'strategies', 'projects', 'tasks', 'agentspecs', 'evidence', 'actions', 'receipts', 'memory']);

function collectionDir(coll) {
  if (!COLLECTIONS.includes(coll)) throw new Error(`store: unknown collection "${coll}"`);
  return path.join(ORG_DIR, coll);
}

// ---- durable, fsync'd atomic write (the second real gap a review found: temp+rename with no fsync is not
// power-loss-safe -- rename() can land before the data is actually durable on a Pi's SD card). Writes the
// temp file, fsyncs its fd, renames over the target, then fsyncs the containing directory's fd too (Linux;
// this repo already relies on Linux-only tooling elsewhere -- unshare, systemd -- so this is consistent).
function durableWriteFileSync(targetPath, contents) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, contents); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, targetPath);
  try { const dfd = fs.openSync(dir, 'r'); try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); } } catch (_) { /* dir fsync is best-effort on some fs types */ }
}

function isPidAlive(pid) { try { process.kill(pid, 0); return true; } catch (_) { return false; } }

// Cross-process mutex: atomic exclusive mkdir as the lock. Breaks (removes) a stale lock -- one whose owning
// PID is dead, or that has simply been held past LOCK_STALE_MS (covers a lock held by a process on a
// different host/PID-namespace, e.g. inside a container, where isPidAlive can't see it).
function acquireLock(name, { timeoutMs = 5000 } = {}) {
  const lockDir = path.join(ORG_DIR, '.locks', name);
  fs.mkdirSync(path.dirname(lockDir), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      fs.writeFileSync(path.join(lockDir, 'holder.json'), JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
      return lockDir;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let holder = null;
      try { holder = JSON.parse(fs.readFileSync(path.join(lockDir, 'holder.json'), 'utf8')); } catch (_) { /* lock dir created but holder file not written yet -- treat as fresh */ }
      const stale = holder && (!isPidAlive(holder.pid) || Date.now() - Date.parse(holder.acquiredAt) > LOCK_STALE_MS);
      if (stale) { try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch (_) {} continue; }
      if (Date.now() > deadline) throw new Error(`store: lock "${name}" timed out (held by pid ${holder ? holder.pid : '?'})`);
      const until = Date.now() + LOCK_RETRY_MS; while (Date.now() < until) { /* busy-wait a few ms; no sleep() in sync code */ }
    }
  }
}
function releaseLock(lockDir) { try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch (_) {} }
function withLock(name, fn) { const l = acquireLock(name); try { return fn(); } finally { releaseLock(l); } }

function readDoc(coll, id) {
  const p = path.join(collectionDir(coll), `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (err) { throw new Error(`store: corrupt document ${coll}/${id}: ${err.message}`); }
}

function listDocs(coll) {
  const dir = collectionDir(coll);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readDoc(coll, f.replace(/\.json$/, ''))).filter(Boolean);
}

// create(): fails if the id already exists (matches Plan 1's "no silent overwrite" invariant for a brand-new
// object; use put() to update an existing one under CAS).
function create(coll, id, fields) {
  return withLock(`${coll}:${id}`, () => {
    if (readDoc(coll, id)) throw new Error(`store: ${coll}/${id} already exists`);
    const doc = { id, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...fields };
    durableWriteFileSync(path.join(collectionDir(coll), `${id}.json`), JSON.stringify(doc, null, 2));
    return doc;
  });
}

// put(): optimistic-concurrency update. `expectedVersion` must match the on-disk version or the write is
// REJECTED (the caller must reload and retry) -- this is what makes AT#3 ("one wins, the other reloads
// rather than overwriting silently") true, across processes, not just within one.
function put(coll, id, expectedVersion, patch) {
  return withLock(`${coll}:${id}`, () => {
    const cur = readDoc(coll, id);
    if (!cur) throw new Error(`store: ${coll}/${id} does not exist`);
    if (cur.version !== expectedVersion) return { ok: false, reason: 'version-conflict', current: cur };
    const next = { ...cur, ...patch, id, version: cur.version + 1, updatedAt: new Date().toISOString() };
    durableWriteFileSync(path.join(collectionDir(coll), `${id}.json`), JSON.stringify(next, null, 2));
    return { ok: true, doc: next };
  });
}

function get(coll, id) { return readDoc(coll, id); }
function list(coll, filterFn) { const all = listDocs(coll); return filterFn ? all.filter(filterFn) : all; }

// ---- Task state machine (Plan 1 sec 5) ----
function assertValidTaskState(s) { if (!TASK_STATES.includes(s)) throw new Error(`store: invalid task state "${s}"`); }

function createTask(id, fields) {
  assertValidTaskState(fields.state || 'QUEUED');
  return create('tasks', id, { state: 'QUEUED', lease: null, attempts: 0, ...fields });
}

// transitionTask(): the ONLY way a task's state field changes. Refuses an illegal state to appear even if a
// caller passes one (defense in depth on top of authority.js's separate action-level gate).
function transitionTask(id, expectedVersion, nextState, extra = {}) {
  assertValidTaskState(nextState);
  return put('tasks', id, expectedVersion, { state: nextState, ...extra });
}

// ---- Leases (Plan 1 "Persistence and Anti Stall Runtime": RUNNING tasks expire and return to READY if a
// worker disappears). A lease lives ON the task document (not a separate collection) so it is covered by the
// same CAS write as every other task mutation -- no separate lock ordering to reason about.
function acquireLease(taskId, holderId, ttlMs) {
  const t = get('tasks', taskId);
  if (!t) throw new Error(`store: task ${taskId} does not exist`);
  if (t.lease && Date.parse(t.lease.expiresAt) > Date.now() && t.lease.holderId !== holderId) return { ok: false, reason: 'leased', lease: t.lease };
  const lease = { holderId, acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlMs).toISOString() };
  return put('tasks', taskId, t.version, { state: 'RUNNING', lease, attempts: (t.attempts || 0) + 1 });
}

function releaseLease(taskId, holderId, nextState, extra = {}) {
  const t = get('tasks', taskId);
  if (!t) throw new Error(`store: task ${taskId} does not exist`);
  if (t.lease && t.lease.holderId !== holderId) return { ok: false, reason: 'not-holder' };
  return transitionTask(taskId, t.version, nextState, { lease: null, ...extra });
}

// Sweeps every RUNNING task whose lease has expired back to READY. Called by watchdog.js on its own poll
// cadence; safe to call from multiple processes since each individual task write is still CAS-guarded.
function sweepExpiredLeases(now = Date.now()) {
  const recovered = [];
  for (const t of list('tasks', (x) => x.state === 'RUNNING' && x.lease && Date.parse(x.lease.expiresAt) <= now)) {
    const r = transitionTask(t.id, t.version, 'READY', { lease: null, recoveredFromLeaseExpiryAt: new Date().toISOString() });
    if (r.ok) recovered.push(t.id);
  }
  return recovered;
}

module.exports = {
  TASK_STATES, COLLECTIONS,
  create, put, get, list,
  createTask, transitionTask, acquireLease, releaseLease, sweepExpiredLeases,
  withLock, durableWriteFileSync,
  _setStoreDirForTesting, _storeDir,
};
