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
//
// Each section below is a get*() (pure data, no I/O side effects beyond
// reading) paired with a report*() that formats and prints it. Split
// this way 2026-09-03 for the live dashboard (Phase 3 piece 5,
// dashboard-status.js): the dashboard needs the SAME computed data this
// CLI report already produces, live instead of on-demand -- splitting
// compute from print means both share one definition, not two that can
// drift the way `listTaskIdsByStatus()` already prevents for "pending."

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { listAgentConfigs } = require('./agent-engine.js');
const { validate: validateAgentConfig } = require('./validate-agent-config.js');
const { listPendingTaskIds, TASKS_DIR } = require('./run-task.js');
const memoryStore = require('./memory-store.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'log.md');

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// --- Agent configs ---
function getAgentConfigStatus() {
  return listAgentConfigs().map((id) => ({ id, ...validateAgentConfig(id) }));
}
function reportAgentConfigs() {
  section('Agent configs');
  const results = getAgentConfigStatus();
  if (results.length === 0) {
    console.log('  (none found in bus/scripts/agents/)');
    return;
  }
  for (const r of results) {
    console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.id}${r.ok ? '' : ' -- ' + r.problems.join('; ')}`);
  }
}

// --- Recent task activity (last N dispatch entries from bus/log.md) ---
function getRecentActivity(limit = 8) {
  if (!fs.existsSync(LOG_PATH)) return [];
  const text = fs.readFileSync(LOG_PATH, 'utf8');
  // Each entry starts with "## <task_id> (<script>...)" -- split on that.
  const entries = text.split(/\n(?=## )/).filter((e) => e.trim().startsWith('##'));
  const recent = entries.slice(-limit);
  const out = [];
  for (const entry of recent) {
    const headerMatch = entry.match(/^## (\S+)\s*\(([^)]*)\)/);
    const statusMatch = entry.match(/status -> (\w+)/);
    const reasonMatch = entry.match(/^(?:Dependency resolution|Secret resolution|VERIFICATION) FAILED: (.+)$/m);
    if (headerMatch) {
      const [, taskId, via] = headerMatch;
      out.push({
        taskId,
        via,
        status: statusMatch ? statusMatch[1] : '(unknown)',
        reason: reasonMatch ? reasonMatch[1] : null,
      });
    }
  }
  return out;
}
function reportRecentActivity(limit = 8) {
  section(`Recent task activity (last ${limit} log entries)`);
  const recent = getRecentActivity(limit);
  if (recent.length === 0) {
    console.log(fs.existsSync(LOG_PATH) ? '  (no entries found)' : '  (no bus/log.md found)');
    return;
  }
  for (const r of recent) {
    console.log(`  ${r.status.padEnd(10)} ${r.taskId} [${r.via}]${r.reason ? ' -- ' + r.reason : ''}`);
  }
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

// --- Status counts across every task file (added 2026-09-03, the live
// dashboard) --- one tasks/-tree walk, bucketed by whatever literal
// `status:` string each file actually has -- not a hardcoded list of
// known statuses, so a future status value still counts correctly
// without this needing an update. Same exclusion list as
// `listTaskIdsByStatus()` in run-task.js (verification_suite/,
// UNVERIFIED_Cl/, _archive_tests/, the two template files) -- kept as a
// separate small walk rather than calling listTaskIdsByStatus() once
// per known status, since this doesn't know the status vocabulary in
// advance and a single pass is cheaper than N passes anyway.
function getStatusCounts() {
  const counts = {};
  let total = 0;
  if (!fs.existsSync(TASKS_DIR)) return { counts, total };
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'verification_suite' || entry.name === 'UNVERIFIED_Cl' || entry.name === '_archive_tests') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md') && entry.name !== 'task_template.md' && entry.name !== 'unverified_entry_template.md') {
        const text = fs.readFileSync(full, 'utf8');
        const statusMatch = text.match(/^status:\s*(\S+)/m);
        const status = statusMatch ? statusMatch[1] : '(unknown)';
        counts[status] = (counts[status] || 0) + 1;
        total += 1;
      }
    }
  }
  walk(TASKS_DIR);
  return { counts, total };
}

// --- Memory store (durable facts recorded via recordFact:, Phase 3
// piece 3, added 2026-09-02) ---
function getMemorySummary() {
  const keys = memoryStore.listKeys();
  if (keys.length === 0) return { keyCount: 0, totalEntries: 0, mostRecent: null };
  let totalEntries = 0;
  let mostRecent = null;
  for (const k of keys) {
    totalEntries += k.count;
    if (!mostRecent || k.latest.ts > mostRecent.ts) mostRecent = k.latest;
  }
  return { keyCount: keys.length, totalEntries, mostRecent };
}
function reportMemoryStore() {
  section('Memory store (recorded facts)');
  const summary = getMemorySummary();
  if (summary.keyCount === 0) {
    console.log('  (no facts recorded yet)');
    return;
  }
  console.log(`  ${summary.keyCount} key(s), ${summary.totalEntries} recorded fact(s) total`);
  console.log(`  Most recent: "${summary.mostRecent.key}" at ${summary.mostRecent.ts} (task_id: ${summary.mostRecent.sourceTaskId})`);
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

function reportStatusCounts() {
  section('Task status counts (all of tasks/)');
  const { counts, total } = getStatusCounts();
  if (total === 0) {
    console.log('  (no task files found)');
    return;
  }
  for (const status of Object.keys(counts).sort()) {
    console.log(`  ${String(counts[status]).padStart(4)}  ${status}`);
  }
  console.log(`  ${String(total).padStart(4)}  total`);
}

function main() {
  console.log(`/bus/ status -- ${new Date().toISOString()}`);
  reportAgentConfigs();
  reportStatusCounts();
  reportRecentActivity();
  reportPendingTasks();
  reportMemoryStore();
  reportVaultHealth();
  console.log('\n(For a fresh, live-tested result instead of the last recorded one, run: node run-verification-suite.js)');
  console.log('(For a live-updating view: node serve-dashboard.js, then open the URL it prints.)');
}

if (require.main === module) {
  main();
}

module.exports = {
  reportAgentConfigs,
  reportRecentActivity,
  reportPendingTasks,
  reportMemoryStore,
  reportVaultHealth,
  reportStatusCounts,
  getAgentConfigStatus,
  getRecentActivity,
  getStatusCounts,
  getMemorySummary,
};
