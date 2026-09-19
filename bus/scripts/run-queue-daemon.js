#!/usr/bin/env node
// run-queue-daemon.js -- Phase 3, piece 1: the actual "runs on its own"
// task queue. Long-lived (like watch-inbox.js -- runs until killed, no
// duration cap; this is standing infrastructure, not a bounded content-
// generation window like run-continuous.js's research-crew run).
//
// Before this existed, every /bus/ dispatch -- Codex or Claude, chain or
// not -- required a human to type `node run-task-generic.js <task_id>`
// by hand. This watches tasks/ and dispatches new `status: pending`
// files automatically, and separately retries `status: blocked` tasks
// once their dependency finishes, so a multi-step chain no longer needs
// a human to notice and manually reset the blocked step.
//
// Deliberately unchanged: the dispatch/verification path itself (this is
// purely a new caller of run-task-generic.js, not a new dispatch
// mechanism), and persistence across logoff/reboot (Task Scheduler
// wiring is a separate, later decision -- see the plan this was built
// from). The dependency model itself gained multi-parent support
// (dependsOnTaskIds, Phase 3 piece 2) and a fact-based dependency
// (dependsOnFact, Phase 3 piece 3 -- see memory-store.js) the same day
// -- retryBlocked() below got both for free via
// resolveTaskDependencies(), no daemon-specific logic needed for either.
//
// Usage: node run-queue-daemon.js  (long-lived; runs until killed)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  readTaskFile,
  taskFilePath,
  resolveTaskDependencies,
  listPendingTaskIds,
  listTaskIdsByStatus,
} = require('./run-task.js');
const { sendNtfy } = require('./ntfy.js');

const SCRIPTS_DIR = __dirname;
const VAULT_ROOT = path.resolve(SCRIPTS_DIR, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'queue-daemon.log');
const RUN_TASK_GENERIC = path.join(SCRIPTS_DIR, 'run-task-generic.js');
const PID_PATH = path.join(VAULT_ROOT, 'bus', 'queue-daemon.pid');
const INFLIGHT_PATH = path.join(VAULT_ROOT, 'bus', 'queue-daemon-inflight.json');

const DEBOUNCE_MS = 600;
// Overridable via QUEUE_DAEMON_BLOCKED_RETRY_MS so run-verification-suite.js
// can test the auto-retry path in seconds instead of waiting out the real
// 2-minute production interval -- the interval itself isn't what's being
// tested, the transition logic is.
const BLOCKED_RETRY_INTERVAL_MS = process.env.QUEUE_DAEMON_BLOCKED_RETRY_MS
  ? parseInt(process.env.QUEUE_DAEMON_BLOCKED_RETRY_MS, 10)
  : 2 * 60 * 1000; // 2 min
const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; // 30 min

function nowIso() {
  return new Date().toISOString();
}

function log(msg) {
  const line = `[${nowIso()}] ${msg}`;
  fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  console.log(line);
}

// Tracks task IDs already enqueued or currently dispatching, so a
// debounced re-scan (or the blocked-retry tick enqueueing the same task
// scanAndEnqueue() would also find) can't double-enqueue. A task leaves
// this set the moment its own dispatch finishes -- by then its status is
// no longer 'pending', so listPendingTaskIds() naturally stops returning
// it and there's nothing left to guard against for that ID.
const queuedOrProcessing = new Set();

// `to: claude` tasks are reserved for the orchestrator (see
// task_template.md) and stay pending forever by design -- read and
// logged once, then never re-read every scan (this set is never cleared;
// unlike queuedOrProcessing, these tasks never change status via this
// daemon, so there is no reason to reconsider them).
const reservedSkipped = new Set();

const queue = [];
let processing = false;
let lastActivityAt = Date.now();

// Rate-limit backoff, added for the 24/7 unattended pilot (ARCHITECTURE.md
// section 9) -- real incidents confirmed in bus/log.md (session-limit hits
// on claude-agent dispatches), and until now dispatchOne() just logged a
// failure and dropped the task on the floor, no retry of any kind. Scoped
// to rate-limit-SHAPED failures only (real logic/verification failures
// should NOT be silently retried) and capped at 3 attempts per taskId per
// process lifetime, so a persistently broken task can't loop forever.
const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000; // 15 min
const MAX_RATE_LIMIT_RETRIES = 3;
const rateLimitRetryCounts = new Map();

// Real incident, 2026-09-15: Codex's actual live error text for a hit
// 5-hour usage window was "Your workspace is out of credits. Ask your
// workspace owner to refill in order to continue." -- confirmed live via
// a direct trivial codex exec call, captured verbatim. That phrasing
// matched NONE of the patterns below (no "429"/"rate limit"/"quota"/
// "resets "/"session limit"), so real automated dispatches (a synthesis,
// a rescan, a journal reflection) landed as hard, un-retried `error`
// instead of the graceful backoff this function exists to provide.
function isRateLimitError(text) {
  const t = String(text || '').toLowerCase();
  // 'resets ' tightened to a real reset-time shape (e.g. "resets 11:47am")
  // now that run-task-generic.js's exit-code fix makes this function
  // actually reachable in production -- the old bare substring check was
  // harmless while dead code, but a false positive here now means a real
  // logic/verification failure gets silently requeued instead of surfaced.
  return /\b429\b/.test(t) || t.includes('rate limit') || t.includes('quota') || /resets \d{1,2}:\d{2}\s*(am|pm)/.test(t) || t.includes('session limit') || t.includes('out of credits') || t.includes('workspace owner');
}

// Singleton guard -- added after a real incident (2026-09-15): a manual
// `node -e "require('./run-queue-daemon.js')"` verification command
// accidentally started a second live instance of this daemon (this file
// has no guard against being require()'d, and always runs its dispatch
// loop unconditionally). Two instances racing the same tasks/ directory
// risk double-dispatching the same pending task. Caught via `ps aux` and
// killed by hand that time; this makes a second instance fail loud and
// refuse to start instead of relying on a human noticing.
function assertSingleton() {
  if (fs.existsSync(PID_PATH)) {
    const existingPid = parseInt(fs.readFileSync(PID_PATH, 'utf8').trim(), 10);
    if (Number.isFinite(existingPid)) {
      try {
        process.kill(existingPid, 0); // signal 0: existence check only, never actually signals the process
        console.error(`Another run-queue-daemon.js instance appears to already be running (pid ${existingPid}, per ${PID_PATH}). Refusing to start a second instance -- stop it first if this is actually stale.`);
        process.exit(1);
      } catch (err) {
        if (err.code !== 'ESRCH') throw err; // anything other than "no such process" is unexpected -- surface it
        // Stale pid file (that process no longer exists) -- safe to reclaim.
      }
    }
  }
  fs.writeFileSync(PID_PATH, String(process.pid), 'utf8');
}

function releaseSingleton() {
  try {
    if (fs.existsSync(PID_PATH) && fs.readFileSync(PID_PATH, 'utf8').trim() === String(process.pid)) {
      fs.unlinkSync(PID_PATH);
    }
  } catch (_) {}
}

// In-flight marker -- records which task is mid-dispatch so a crash
// between dispatch start and completion leaves a diagnostic trail instead
// of silence. execFileSync is synchronous and the task file's own status
// write is authoritative (a crashed parent typically leaves the child
// subprocess to finish and write its own result), so this is deliberately
// diagnostic rather than an attempt to "resume" anything clever on restart.
function markInflight(taskId) {
  try { fs.writeFileSync(INFLIGHT_PATH, JSON.stringify({ taskId, startedAt: nowIso(), pid: process.pid })); } catch (_) {}
}

function clearInflight() {
  try { if (fs.existsSync(INFLIGHT_PATH)) fs.unlinkSync(INFLIGHT_PATH); } catch (_) {}
}

function reconcileStaleInflight() {
  if (!fs.existsSync(INFLIGHT_PATH)) return;
  try {
    const stale = JSON.parse(fs.readFileSync(INFLIGHT_PATH, 'utf8'));
    log(`WARNING: found a stale in-flight marker from a previous run -- taskId=${stale.taskId}, startedAt=${stale.startedAt}, pid=${stale.pid}. That process likely crashed mid-dispatch. The task file's own status is authoritative: if it's still 'pending' it will be picked up by the normal scan below; if the subprocess finished writing a result before the crash, nothing further is needed.`);
  } catch (_) {
    log(`WARNING: found a malformed in-flight marker at ${INFLIGHT_PATH} from a previous run -- ignoring it.`);
  }
  clearInflight();
}

function resetBlockedToPending(taskId) {
  const p = taskFilePath(taskId);
  const text = fs.readFileSync(p, 'utf8').replace(/^status:\s*.*$/m, 'status: pending');
  fs.writeFileSync(p, text, 'utf8');
}

function dispatchOne(taskId) {
  log(`DISPATCHING: ${taskId}`);
  lastActivityAt = Date.now();
  markInflight(taskId);
  try {
  let out = '';
  try {
    out = execFileSync('node', [RUN_TASK_GENERIC, taskId], { cwd: VAULT_ROOT, encoding: 'utf8' });
  } catch (err) {
    out = (err && err.stdout) || '';
    const failureText = `${err.message}\n${out}`;
    if (isRateLimitError(failureText)) {
      const attempts = (rateLimitRetryCounts.get(taskId) || 0) + 1;
      rateLimitRetryCounts.set(taskId, attempts);
      if (attempts <= MAX_RATE_LIMIT_RETRIES) {
        log(`${taskId}: rate-limit-shaped failure (attempt ${attempts}/${MAX_RATE_LIMIT_RETRIES}) -- requeueing in ${RATE_LIMIT_BACKOFF_MS / 60000} min instead of dropping.`);
        setTimeout(() => {
          resetBlockedToPending(taskId); // no-op if already pending; safe either way
          queuedOrProcessing.add(taskId);
          queue.push(taskId);
          processQueue();
        }, RATE_LIMIT_BACKOFF_MS);
        return;
      }
      log(`${taskId}: rate-limit-shaped failure, exhausted ${MAX_RATE_LIMIT_RETRIES} retries -- giving up, alerting.`);
      sendNtfy({
        title: `${taskId}: dispatch retries exhausted`,
        message: `run-queue-daemon.js gave up on ${taskId} after ${MAX_RATE_LIMIT_RETRIES} rate-limit-shaped failures. Last error: ${err.message.split('\n')[0]}`,
        priority: 4,
      }).catch(() => {});
      return;
    }
    // Full captured output, not just the last line -- the last line alone
    // (via .pop()) routinely discarded the actually useful diagnostic text
    // in run-task-generic.js's own ERROR/UNVERIFIED body.
    log(`${taskId}: run-task-generic.js exited non-zero -- ${err.message.split('\n')[0]}${out ? ` -- output: ${out.trim()}` : ''}`);
    return;
  }
  // First line, not last: run-task-generic.js's DONE case prints
  // `DONE: ${multi-line output}` as one console.log call, so the status
  // word only survives on the first line -- the last line is just
  // whatever the task's own answer happened to end with.
  const resultLine = out.trim().split('\n').filter(Boolean)[0] || '(no output)';
  log(`${taskId}: ${resultLine}`);
  } finally {
    clearInflight();
  }
}

function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const taskId = queue.shift();
      dispatchOne(taskId);
      queuedOrProcessing.delete(taskId);
    }
  } finally {
    processing = false;
  }
}

function scanAndEnqueue() {
  for (const taskId of listPendingTaskIds()) {
    if (queuedOrProcessing.has(taskId) || reservedSkipped.has(taskId)) continue;
    const task = readTaskFile(taskId);
    if (!task) continue; // race: file listed, then removed/renamed before this read
    if (task.to === 'claude') {
      reservedSkipped.add(taskId);
      log(`SKIP (reserved, to: claude, orchestrator-only -- never dispatched): ${taskId}`);
      continue;
    }
    queuedOrProcessing.add(taskId);
    queue.push(taskId);
    log(`QUEUED: ${taskId} (to: ${task.to})`);
  }
  processQueue();
}

// The actual "hands-off chain" payoff -- without this, a blocked task
// still needs a human to notice its dependency finished and manually
// reset status back to pending.
function retryBlocked() {
  for (const taskId of listTaskIdsByStatus('blocked')) {
    if (queuedOrProcessing.has(taskId)) continue;
    const task = readTaskFile(taskId);
    if (!task || (!task.dependsOnTaskId && !task.dependsOnTaskIds && !task.dependsOnFact)) continue; // blocked for a reason other than an unresolved dependency -- leave it, not this daemon's call to make
    // resolveTaskDependencies() handles single-parent, multi-parent, and
    // fact dependencies alike (added 2026-09-02 for fan-in, then the
    // memory layer, same day) -- no daemon-specific logic needed here. A
    // task blocked purely on a missing fact gets auto-retried the moment
    // ANY other task records it, without this daemon knowing in advance
    // which task that will be.
    const dep = resolveTaskDependencies(taskId, task);
    if (dep.ok) {
      const parts = [];
      if (task.dependsOnTaskIds) parts.push(`dependencies "${task.dependsOnTaskIds}"`);
      else if (task.dependsOnTaskId) parts.push(`dependency "${task.dependsOnTaskId}"`);
      if (task.dependsOnFact) parts.push(`fact "${task.dependsOnFact}"`);
      resetBlockedToPending(taskId);
      log(`AUTO-RETRY: ${taskId} -- ${parts.join(' and ')} now resolved, reset status blocked -> pending`);
      queuedOrProcessing.add(taskId);
      queue.push(taskId);
    }
  }
  processQueue();
}

assertSingleton();
reconcileStaleInflight();

log(`Queue daemon started. Watching ${TASKS_DIR} (recursive), long-lived until killed.`);
sendNtfy({
  topic: 'ClaudeTeam',
  title: 'Queue daemon started',
  message: `Watching tasks/ for pending work and retrying blocked chains every ${BLOCKED_RETRY_INTERVAL_MS / 60000} min. Long-lived -- runs until stopped.`,
  tags: 'rocket',
}).catch((e) => log(`ntfy send failed: ${e.message}`));

scanAndEnqueue(); // catch anything already pending at startup

let debounceTimer = null;
fs.watch(TASKS_DIR, { recursive: true, persistent: true }, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scanAndEnqueue, DEBOUNCE_MS);
});

setInterval(retryBlocked, BLOCKED_RETRY_INTERVAL_MS);

setInterval(() => {
  const sinceActivity = Date.now() - lastActivityAt;
  if (sinceActivity < HEARTBEAT_INTERVAL_MS) return; // real activity just happened, skip this beat
  sendNtfy({
    topic: 'ClaudeTeam',
    title: 'Queue daemon heartbeat',
    message: `Still watching tasks/ at ${nowIso()}, nothing dispatched since last check.`,
    tags: 'mag',
  }).catch((e) => log(`ntfy send failed: ${e.message}`));
}, HEARTBEAT_INTERVAL_MS);

process.on('SIGINT', () => {
  log('Queue daemon stopping (SIGINT).');
  releaseSingleton();
  process.exit(0);
});
process.on('SIGTERM', () => {
  log('Queue daemon stopping (SIGTERM).');
  releaseSingleton();
  process.exit(0);
});
