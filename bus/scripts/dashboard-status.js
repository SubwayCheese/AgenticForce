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

module.exports = { buildSnapshot, getInFlightTasks, getBacklogRunStatus };
