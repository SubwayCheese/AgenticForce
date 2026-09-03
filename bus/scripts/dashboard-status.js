#!/usr/bin/env node
// dashboard-status.js -- the live snapshot for the dashboard (Phase 3
// piece 5, added 2026-09-03). One exported buildSnapshot(), called
// fresh on every /status.json request by serve-dashboard.js.
//
// Deliberately thin: every real computation already lives in
// bus-status.js (split into get*()/report*() pairs the same day this
// file was added, specifically so the CLI report and this live view
// share one definition of every number, not two that can drift) --
// this file only adds the one thing bus-status.js has no reason to
// know about, in-flight task detection, and assembles the JSON shape
// the dashboard's front end actually consumes.

const fs = require('fs');
const path = require('path');
const busStatus = require('./bus-status.js');
const runTask = require('./run-task.js');
const engine = require('./agent-engine.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const DAEMON_LOG_PATH = path.join(VAULT_ROOT, 'bus', 'queue-daemon.log');

// Parses the queue daemon's own log for tasks that have a "DISPATCHING:"
// line with no later "<taskId>: ..." completion line after it -- both
// already written by run-queue-daemon.js's dispatchOne()/log() (see
// its comments), not a new signal invented for this. A retried task
// (BLOCKED then AUTO-RETRY then DISPATCHING again) naturally re-enters
// the in-flight set on its second DISPATCHING line even though its
// first attempt already completed, since this walks top to bottom and
// tracks membership rather than "ever seen."
// logText param is test-only (see run-verification-suite.js's
// testInFlightDetectionFast()) -- omitted in every real call site, which
// reads the actual daemon log.
function getInFlightTasks(logText) {
  let text = logText;
  if (text === undefined) {
    if (!fs.existsSync(DAEMON_LOG_PATH)) return [];
    text = fs.readFileSync(DAEMON_LOG_PATH, 'utf8');
  }
  const lines = text.split('\n');
  const inFlight = new Set();
  for (const line of lines) {
    const dispatchMatch = line.match(/^\[[^\]]+\] DISPATCHING: (\S+)$/);
    if (dispatchMatch) {
      inFlight.add(dispatchMatch[1]);
      continue;
    }
    const doneMatch = line.match(/^\[[^\]]+\] (\S+): /);
    if (doneMatch && inFlight.has(doneMatch[1])) {
      inFlight.delete(doneMatch[1]);
    }
  }
  return Array.from(inFlight);
}

// The optional run-backlog.js live-progress file (pre-existing,
// 2026-08-31) -- passed through as its own panel rather than merged
// into the system-wide counts above, since it tracks a seeded
// bus/backlog.json campaign, a different (and optional -- not always
// running) thing from the standing /bus/ system. "Fresh" = updated in
// the last 5 minutes; older than that is presumed to be a finished or
// abandoned run, not a live one, and the dashboard hides the panel
// rather than showing stale progress.
const BACKLOG_STATUS_PATH = path.join(VAULT_ROOT, 'bus', 'status.json');
const BACKLOG_FRESH_MS = 5 * 60 * 1000;

function getBacklogRunStatus() {
  if (!fs.existsSync(BACKLOG_STATUS_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(BACKLOG_STATUS_PATH, 'utf8'));
    if (!data.updatedAt) return null;
    const ageMs = Date.now() - new Date(data.updatedAt).getTime();
    if (!(ageMs >= 0) || ageMs > BACKLOG_FRESH_MS) return null;
    return data;
  } catch (e) {
    return null; // malformed/mid-write -- next poll will pick up a clean read
  }
}

function buildSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    statusCounts: busStatus.getStatusCounts(),
    recentActivity: busStatus.getRecentActivity(20),
    inFlight: getInFlightTasks(),
    memory: busStatus.getMemorySummary(),
    agents: busStatus.getAgentConfigStatus(),
    backlogRun: getBacklogRunStatus(),
  };
}

// ---------- Agent hierarchy graph (added 2026-09-03, a direct
// follow-on to the dashboard) ----------
// Reads a task's real `to:` field straight from its file -- not by
// string-parsing bus/log.md's free-text "via" field, which is a
// dispatch-script description (e.g. "run-task-generic.js -- agent:
// Claude, mode: read-only"), not a clean, uniformly-populated agent id.
// This is the only reliable way to know which agent actually owns a
// given task.
const RECENT_TASKS_PER_AGENT = 6;
// Wide enough that each agent's own recent tasks are still findable
// even when heavily interleaved with the other agent's activity (a
// verification suite run alone produces dozens of interleaved entries).
const ACTIVITY_WINDOW_FOR_GRAPH = 60;

// Builds: orchestrator (root, "claude") -> each configured agent -> its
// current in-flight task (if any) plus its last few recent tasks, with
// dependency edges (dependsOnTaskId(s)) drawn only between two tasks
// that are BOTH included in this graph -- no dangling references to
// tasks not shown, so the graph stays bounded regardless of the vault's
// total task history. Nothing here hardcodes a specific number of
// agents -- reads bus/scripts/agents/*.json the same way
// bus-status.js's getAgentConfigStatus() does, so a third configured
// agent would appear automatically.
function buildAgentGraph() {
  const agentIds = engine.listAgentConfigs();
  const inFlightIds = getInFlightTasks();
  const activity = busStatus.getRecentActivity(ACTIVITY_WINDOW_FOR_GRAPH).slice().reverse(); // most recent first

  const taskCache = new Map(); // taskId -> readTaskFile() result or null, avoids re-reading the same file twice
  function getTask(taskId) {
    if (!taskCache.has(taskId)) taskCache.set(taskId, runTask.readTaskFile(taskId));
    return taskCache.get(taskId);
  }
  function buildNode(taskId, reason) {
    const task = getTask(taskId);
    if (!task) return null; // file removed since the log entry/in-flight signal was recorded
    const relPath = path.relative(VAULT_ROOT, runTask.taskFilePath(taskId)).split(path.sep).join('/');
    const dependsOn = [];
    if (task.dependsOnTaskId) dependsOn.push(task.dependsOnTaskId);
    if (task.dependsOnTaskIds) {
      task.dependsOnTaskIds.split(',').map((s) => s.trim()).filter(Boolean).forEach((id) => dependsOn.push(id));
    }
    return { taskId, to: task.to, status: task.status, reason: reason || null, path: relPath, dependsOn };
  }

  const includedTaskIds = new Set();
  const agents = agentIds.map((id) => {
    const config = engine.loadAgentConfig(id);

    let currentTask = null;
    for (const taskId of inFlightIds) {
      const task = getTask(taskId);
      if (task && task.to === id) {
        currentTask = buildNode(taskId, null);
        break;
      }
    }
    if (currentTask) includedTaskIds.add(currentTask.taskId);

    const recentTasks = [];
    for (const entry of activity) {
      if (recentTasks.length >= RECENT_TASKS_PER_AGENT) break;
      if (currentTask && entry.taskId === currentTask.taskId) continue; // already shown as the current task
      const task = getTask(entry.taskId);
      if (!task || task.to !== id) continue;
      const node = buildNode(entry.taskId, entry.reason);
      if (!node) continue;
      recentTasks.push(node);
      includedTaskIds.add(node.taskId);
    }

    return {
      id,
      displayName: (config && config.displayName) || id,
      ok: !!config,
      currentTask,
      recentTasks,
    };
  });

  const dependsOnEdges = [];
  for (const agent of agents) {
    for (const node of [agent.currentTask, ...agent.recentTasks].filter(Boolean)) {
      for (const depId of node.dependsOn) {
        if (includedTaskIds.has(depId)) dependsOnEdges.push({ from: node.taskId, to: depId });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    orchestrator: { id: 'claude', label: 'claude (orchestrator)' },
    agents,
    dependsOnEdges,
  };
}

module.exports = { buildSnapshot, getInFlightTasks, getBacklogRunStatus, buildAgentGraph };
