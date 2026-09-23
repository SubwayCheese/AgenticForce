#!/usr/bin/env node
// run-continuous.js -- BOUNDED-DURATION supervisor for the research crew
// + inbox watcher, per explicit user request: "run continuously for 2
// hours" -- not "run forever." Runs for a fixed duration, then stops
// itself and sends a final ntfy confirming it stopped. Not a permanent
// service; re-run to start another window.
//
// Approved defaults:
//   - research crew cycle: every 20 minutes (spawned fresh each cycle --
//     no internal state to preserve between cycles, fine to isolate)
//   - inbox: switched from a 10-min poll (check-inbox.js) to an
//     instant-reaction watcher (watch-inbox.js) after the user asked for
//     faster responses to direct questions -- see that file's header for
//     why this is a real Q&A upgrade, not just a smaller interval number.
//     watch-inbox.js is long-lived, spawned ONCE here and kept running
//     for the whole window, not re-spawned per cycle.
//   - digest interval / queue-pause threshold: enforced inside
//     run-research-crew.js itself (60 min digest, 50-entry pause)
//   - duration: 2 hours, then stop (and the inbox watcher is killed too)
//
// Started via Windows Task Scheduler (one-time trigger, run now) rather
// than as a child of a Bash tool call -- a Scheduled Task process is
// managed by the OS, not tied to a terminal session's lifetime.

const avPaths = require('../lib/paths.js');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { sendNtfy } = require('./ntfy.js');

const SCRIPTS_DIR = __dirname;
const VAULT_ROOT = avPaths.ROOT;
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'continuous-run.log');

const DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const RESEARCH_INTERVAL_MS = 20 * 60 * 1000; // 20 min

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_PATH, line, 'utf8');
  console.log(line.trim());
}

function runScriptOnce(name) {
  try {
    const out = execFileSync('node', [avPaths.script(name)], {
      encoding: 'utf8',
      cwd: VAULT_ROOT,
    });
    logLine(`${name}: ${out.trim().split('\n').filter(Boolean).pop() || '(no output)'}`);
  } catch (err) {
    logLine(`${name} FAILED: ${err.message}`);
  }
}

const startedAt = Date.now();
const stopAt = startedAt + DURATION_MS;

logLine(`Continuous run started. Will stop at ${new Date(stopAt).toISOString()}.`);
sendNtfy({
  topic: 'ClaudeTeam',
  title: 'Continuous run started',
  message: `Research crew (every 20min) + instant inbox watcher started, will run for 2 hours and stop automatically at ${new Date(stopAt).toISOString()}.`,
  tags: 'rocket',
}).catch((e) => logLine(`ntfy send failed: ${e.message}`));

// Research crew: one cycle now, then every 20 min.
runScriptOnce('run-research-crew.js');
const researchTimer = setInterval(() => runScriptOnce('run-research-crew.js'), RESEARCH_INTERVAL_MS);

// Inbox: long-lived watcher, spawned once, not re-spawned per interval.
const inboxWatcher = spawn('node', [avPaths.script('watch-inbox.js')], {
  cwd: VAULT_ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
inboxWatcher.stdout.on('data', (d) => logLine(`watch-inbox: ${d.toString().trim()}`));
inboxWatcher.stderr.on('data', (d) => logLine(`watch-inbox STDERR: ${d.toString().trim()}`));
logLine(`Inbox watcher started (pid ${inboxWatcher.pid}), instant reaction to bus/inbox_claude.md.`);

setTimeout(() => {
  clearInterval(researchTimer);
  inboxWatcher.kill();
  logLine('2-hour window elapsed. Stopping (research crew + inbox watcher).');
  sendNtfy({
    topic: 'ClaudeTeam',
    title: 'Continuous run stopped',
    message: `2-hour window ended at ${new Date().toISOString()}. Research crew and inbox watcher are no longer running. Re-run bus/platform/run-continuous.js (or ask Claude to) to start another window.`,
    tags: 'stop_sign',
  })
    .catch((e) => logLine(`ntfy send failed: ${e.message}`))
    .finally(() => process.exit(0));
}, DURATION_MS);
