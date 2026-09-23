#!/usr/bin/env node
// run-backlog.js -- processes a seeded list of task_ids in sequence
// (bus/backlog.json), writing live status to bus/status.json after every
// real status change, for the dashboard to poll.
//
// This is NOT a separate task-execution engine -- it requires run-task.js
// and reuses its real functions (resolveDependency, runCodex,
// verifyOutput, writeTaskResult, appendLog) directly, so a task processed
// here goes through exactly the same dependency resolution, SOURCE-tag
// enforcement, and verification gate as running it individually via
// run-task.js. The only thing added here is finer-grained status
// reporting: run-task.js does dependency-resolve + dispatch + verify as
// one atomic call with one before/after status; this script observes and
// reports the same real steps as they happen (research -> write -> verify
// -> done/unverified/blocked), because the dashboard has icons for each of
// those phases and showing a task jump straight from pending to done would
// misrepresent how long the real work actually took.
//
// Orchestrator-sourced tasks (to: claude) are NOT executed by this script
// -- there is no API credential available to a standalone script (see
// ARCHITECTURE.md section 4/6). They must already be status: done before
// the backlog runs (Claude populates them directly, in-conversation, the
// same way as every other orchestrator-sourced task this session). This
// script reflects their already-real state; it does not fake progress for
// them and does not silently skip mentioning that constraint.
//
// Usage: node run-backlog.js [path/to/backlog.json]  (defaults to
// bus/backlog.json)

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const {
  readTaskFile,
  writeTaskResult,
  resolveTaskDependencies,
  verifyOutput,
  runCodex,
  appendLog,
  getMandatorySuffix,
} = require('./run-task.js');

const VAULT_ROOT = avPaths.ROOT;
const BUS_DIR = path.join(VAULT_ROOT, 'bus');
const STATUS_PATH = path.join(BUS_DIR, 'status.json');
const DEFAULT_BACKLOG_PATH = path.join(BUS_DIR, 'backlog.json');

// Maps our real task statuses/phases to the dashboard mockup's icon
// states. The dashboard has exactly 6 icon states (pending/research/
// write/verify/done/blocked); our real vocabulary also has 6 values
// (pending/dispatched/verifying/done/unverified/blocked) but they don't
// line up 1:1 by name -- "write" has no literal real-status counterpart
// (it represents the live "dispatched to Codex, awaiting response" phase,
// which this script observes directly rather than reading off a stored
// status value), and "unverified" has no distinct icon, so it's shown as
// "blocked" (both mean "did not cleanly complete, needs a look") while the
// underlying real status string stays distinct in status.json's realStatus
// field and in the task file itself -- this mapping is display-only, never
// lossy in the actual data.
const DASHBOARD_ICON = {
  pending: 'pending',
  research: 'research', // dependency resolution / orchestrator fact already fetched
  write: 'write', // dispatched to Codex, awaiting response
  verify: 'verify', // response received, running verifyOutput
  done: 'done',
  unverified: 'blocked',
  blocked: 'blocked',
  error: 'blocked',
};

function nowIso() {
  return new Date().toISOString();
}

function tickerFromTaskId(taskId) {
  const base = taskId.split('/').pop() || taskId;
  return base.replace(/_(fetch|flag)$/, '');
}

function labelFor(taskId, task) {
  const ticker = tickerFromTaskId(taskId);
  if (task.to === 'claude') return `${ticker} revenue — verified fetch`;
  if (task.to === 'codex') return `${ticker} notable-move flag`;
  return taskId;
}

let items = []; // [{taskId, name, agent, status}]
let logLines = []; // [{ts, msg}], newest last, capped to 20

function log(msg) {
  logLines.push({ ts: nowIso(), msg });
  if (logLines.length > 20) logLines = logLines.slice(-20);
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function writeStatus() {
  const payload = {
    updatedAt: nowIso(),
    items: items.map((it) => ({
      name: it.name,
      agent: it.agent,
      status: DASHBOARD_ICON[it.status] || 'pending',
      realStatus: it.status,
    })),
    log: logLines,
  };
  fs.writeFileSync(STATUS_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

function setItemStatus(taskId, status) {
  const it = items.find((x) => x.taskId === taskId);
  if (it) it.status = status;
  writeStatus();
}

function processClaudeTask(taskId, task) {
  // Orchestrator-sourced -- already real, already done before this script
  // ever ran. Reflect its true status, don't fake a live progression.
  if (task.status !== 'done') {
    setItemStatus(taskId, 'blocked');
    log(`${taskId}: orchestrator-sourced task is not done (status: ${task.status || '(none)'}) -- cannot proceed, this is a real gap, not simulated`);
    return;
  }
  setItemStatus(taskId, 'done');
  log(`${taskId}: orchestrator-sourced fact already verified (${task.source ? task.source.slice(0, 60) + '…' : 'see source: field'})`);
}

function processCodexTask(taskId, task) {
  if (task.status !== 'pending') {
    // Already resolved in an earlier run -- reflect it, don't re-dispatch.
    setItemStatus(taskId, task.status);
    log(`${taskId}: already ${task.status}, not re-running`);
    return;
  }

  setItemStatus(taskId, 'research');
  log(`${taskId}: resolving dependency…`);

  const dep = resolveTaskDependencies(taskId, task);
  if (!dep.ok) {
    setItemStatus(taskId, 'blocked');
    log(`${taskId}: BLOCKED -- ${dep.reason}`);
    writeTaskResult(taskId, { status: 'blocked', reason: dep.reason });
    appendLog(
      `## ${taskId} (run-backlog.js)\n\n**${nowIso()} -- run-backlog.js**\nDependency resolution FAILED: ${dep.reason}\nTask NOT dispatched to Codex. status -> blocked.\n`
    );
    return;
  }

  setItemStatus(taskId, 'write');
  log(`${taskId}: dispatched to Codex, awaiting response…`);

  const prompt = task.payload + dep.injectedContext + getMandatorySuffix('codex');
  const result = runCodex(prompt);

  setItemStatus(taskId, 'verify');
  log(`${taskId}: response received, verifying…`);

  let status;
  let reason;
  let logEntry = `## ${taskId} (run-backlog.js)\n\n**${nowIso()} -- run-backlog.js**\n`;
  if (dep.logNote) logEntry += dep.logNote + '\n';
  logEntry += `\nSent (exact):\n"""\n${prompt}\n"""\n`;
  logEntry += `Command: codex exec --ephemeral --sandbox read-only --skip-git-repo-check --output-last-message <file> (via stdin)\n`;
  logEntry += `Exit code: ${result.exitCode}\n`;
  logEntry += `Received (exact):\n"""\n${result.output}\n"""\n`;

  if (result.exitCode !== 0 || !result.output) {
    status = 'error';
  } else {
    const verification = verifyOutput(task, result.output);
    if (verification.ok) {
      status = 'done';
    } else {
      status = 'unverified';
      reason = verification.reason;
      logEntry += `VERIFICATION FAILED: ${verification.reason}\n`;
    }
  }
  logEntry += `status -> ${status}\n`;
  appendLog(logEntry);
  writeTaskResult(taskId, { status, output: result.output, reason });

  setItemStatus(taskId, status);
  if (status === 'done') {
    const firstLine = String(result.output || '').split('\n').find((l) => /^(FLAG|NO FLAG):/.test(l.trim()));
    log(`${taskId}: done${firstLine ? ' -- ' + firstLine.trim() : ''}`);
  } else if (status === 'unverified') {
    log(`${taskId}: UNVERIFIED -- ${reason}`);
  } else {
    log(`${taskId}: ERROR (codex exec exit ${result.exitCode})`);
  }
}

function main() {
  const backlogPath = process.argv[2] || DEFAULT_BACKLOG_PATH;
  if (!fs.existsSync(backlogPath)) {
    console.error(`No backlog file at ${backlogPath}`);
    process.exit(1);
  }
  const taskIds = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));

  // Seed items from current on-disk state before doing anything, so the
  // dashboard has something real to show the instant it starts polling.
  items = taskIds.map((taskId) => {
    const task = readTaskFile(taskId);
    if (!task) {
      return { taskId, name: taskId, agent: '(unknown)', status: 'blocked' };
    }
    return { taskId, name: labelFor(taskId, task), agent: task.to, status: task.status || 'pending' };
  });
  writeStatus();
  log(`backlog runner started -- ${items.length} items queued from ${path.relative(VAULT_ROOT, backlogPath)}`);

  for (const taskId of taskIds) {
    const task = readTaskFile(taskId);
    if (!task) {
      setItemStatus(taskId, 'blocked');
      log(`${taskId}: task file not found -- BLOCKED`);
      continue;
    }
    if (task.to === 'claude') {
      processClaudeTask(taskId, task);
    } else if (task.to === 'codex') {
      processCodexTask(taskId, task);
    } else {
      setItemStatus(taskId, 'blocked');
      log(`${taskId}: unknown agent "${task.to}" -- BLOCKED`);
    }
  }

  log('backlog complete.');
  writeStatus();
}

main();
