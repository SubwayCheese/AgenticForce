#!/usr/bin/env node
// bus-status.js -- "what's the state of the whole /bus/ system" on
// demand. Phase 3 infrastructure: a single, human-readable snapshot
// instead of manually cross-referencing bus/log.md, running the
// verification suite, and checking vault health separately every time.
// Mirrors crew-status.js's existing pattern (a focused summary, not raw
// logs) generalized from "the research crew" to the whole system.
//
// Read-only, side-effect-free -- runs no live agent dispatch itself
// (that's what run-verification-suite.js is for). Reports the LAST
// recorded suite result (from bus/log.md and task files), not a fresh
// one, so this stays fast.
//
// Usage: node bus-status.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { listAgentConfigs } = require('./agent-engine.js');
const { validate: validateAgentConfig } = require('./validate-agent-config.js');
const { listPendingTaskIds } = require('./run-task.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'log.md');

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// --- Agent configs ---
function reportAgentConfigs() {
  section('Agent configs');
  const ids = listAgentConfigs();
  if (ids.length === 0) {
    console.log('  (none found in bus/scripts/agents/)');
    return;
  }
  for (const id of ids) {
    const result = validateAgentConfig(id);
    console.log(`  ${result.ok ? 'OK  ' : 'FAIL'} ${id}${result.ok ? '' : ' -- ' + result.problems.join('; ')}`);
  }
}

// --- Recent task activity (last N dispatch entries from bus/log.md) ---
function reportRecentActivity(limit = 8) {
  section(`Recent task activity (last ${limit} log entries)`);
  if (!fs.existsSync(LOG_PATH)) {
    console.log('  (no bus/log.md found)');
    return;
  }
  const text = fs.readFileSync(LOG_PATH, 'utf8');
  // Each entry starts with "## <task_id> (<script>...)" -- split on that.
  const entries = text.split(/\n(?=## )/).filter((e) => e.trim().startsWith('##'));
  const recent = entries.slice(-limit);
  for (const entry of recent) {
    const headerMatch = entry.match(/^## (\S+)\s*\(([^)]*)\)/);
    const statusMatch = entry.match(/status -> (\w+)/);
    if (headerMatch) {
      const [, taskId, via] = headerMatch;
      const status = statusMatch ? statusMatch[1] : '(unknown)';
      console.log(`  ${status.padEnd(10)} ${taskId} [${via}]`);
    }
  }
  if (recent.length === 0) console.log('  (no entries found)');
}

// --- Pending tasks (created but never run) ---
// Walk logic lives in run-task.js's listPendingTaskIds() (added
// 2026-09-02 for run-queue-daemon.js) -- this just formats it, so the
// daemon and this report share one definition of "pending," not two
// that can drift.
function reportPendingTasks() {
  section('Pending tasks (created, never dispatched)');
  const pending = listPendingTaskIds();
  if (pending.length === 0) {
    console.log('  (none)');
  } else {
    pending.forEach((p) => console.log(`  ${p}`));
  }
}

// --- Vault health (via autograph, if installed) ---
function reportVaultHealth() {
  section('Vault health (autograph)');
  const scriptPath = path.join(
    require('os').homedir(),
    '.agents', 'skills', 'autograph', 'skills', 'autograph', 'scripts', 'graph.py'
  );
  if (!fs.existsSync(scriptPath)) {
    console.log('  autograph not installed -- skipping');
    return;
  }
  try {
    const raw = execFileSync('uv', ['run', scriptPath, 'health', VAULT_ROOT], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONUTF8: '1' },
    });
    const scoreMatch = raw.match(/Health Score:\s*([\d.]+)\/100/);
    const orphanMatch = raw.match(/Orphan files:\s*(\d+)/);
    const brokenMatch = raw.match(/Broken links:\s*(\d+)/);
    console.log(`  Score: ${scoreMatch ? scoreMatch[1] : '?'}/100  Orphans: ${orphanMatch ? orphanMatch[1] : '?'}  Broken links: ${brokenMatch ? brokenMatch[1] : '?'}`);
  } catch (err) {
    console.log(`  health check failed: ${String((err && err.message) || err).split('\n')[0]}`);
  }
}

function main() {
  console.log(`/bus/ status -- ${new Date().toISOString()}`);
  reportAgentConfigs();
  reportRecentActivity();
  reportPendingTasks();
  reportVaultHealth();
  console.log('\n(For a fresh, live-tested result instead of the last recorded one, run: node run-verification-suite.js)');
}

if (require.main === module) {
  main();
}

module.exports = { reportAgentConfigs, reportRecentActivity, reportPendingTasks, reportVaultHealth };
