#!/usr/bin/env node
// run-task-generic.js -- config-driven task dispatch. Reads a task's
// `to:` field, loads the matching bus/scripts/agents/<to>.json config,
// and dispatches through agent-engine.js. This is the operator-facing
// half of the Phase 2 scaffold: instead of remembering "Codex tasks go
// through run-task.js, Claude tasks go through run-task-claude.js, a
// future agent needs its own new script," there is one command, and the
// task file's own `to:` field decides the routing.
//
// Usage:
//   node run-task-generic.js <task_id>            (read-only mode)
//   node run-task-generic.js <task_id> --write     (write mode, manual-only
//                                                     -- see run-task-collab.js's
//                                                     header for why write
//                                                     mode is never wired
//                                                     into an autonomous path)
//
// Reuses run-task.js's exported primitives for everything agent-agnostic
// (dependency resolution, verification, task-file I/O, audit logging) --
// this file's own logic is only the config lookup + dispatch call.

const path = require('path');

const {
  readTaskFile,
  writeTaskResult,
  resolveTaskDependencies,
  verifyOutput,
  appendLog,
  taskFilePath,
  getMandatorySuffix,
} = require('./run-task.js');

const { loadAgentConfig, dispatch, dispatchWrite, listAgentConfigs } = require('./agent-engine.js');
const { search: vaultSearch } = require('./vault-search.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');

// Opt-in only (task file sets `enrichWithSearch: true`) -- see
// task_template.md. Never auto-applied to every task: search results are
// often irrelevant noise for a task that doesn't need vault context (a
// plain arithmetic test, a task that already has everything it needs via
// dependsOnTaskId), and auto-enriching everything would make prompts
// harder to reason about for no benefit in the common case. Read-only
// mode only -- not meaningful for write-mode collaboration tasks.
// Degrades silently to no enrichment if vault-search.js/autograph isn't
// available (search() itself never throws, by design -- see its own
// header) -- an unrelated infra gap in an optional feature should never
// block dispatch of the actual task.
function buildSearchEnrichment(task) {
  if (task.enrichWithSearch !== 'true') return '';
  const result = vaultSearch(task.payload, { limit: 3 });
  if (result.engine === 'unavailable' || result.hits.length === 0) return '';
  const lines = result.hits.map((h, i) => `${i + 1}. [${h.file}] ${h.snippet}`);
  return (
    '\n\nVault context (auto-search, top ' +
    result.hits.length +
    ' results for this task -- may be incomplete or irrelevant, use your own judgment about relevance, do not treat this as verified fact):\n\n' +
    lines.join('\n')
  );
}

function nowIso() {
  return new Date().toISOString();
}

function main() {
  const args = process.argv.slice(2);
  const writeMode = args.includes('--write');
  const taskId = args.find((a) => !a.startsWith('--'));

  if (!taskId) {
    console.error('Usage: node run-task-generic.js <task_id> [--write]');
    console.error(`Known agent configs: ${listAgentConfigs().join(', ') || '(none found)'}`);
    process.exit(1);
  }

  const task = readTaskFile(taskId);
  if (!task) {
    console.error(`No task file found for "${taskId}" at ${taskFilePath(taskId)}`);
    process.exit(1);
  }
  if (task.status !== 'pending') {
    console.error(`Task "${taskId}" has status "${task.status}", not "pending" -- refusing to re-run.`);
    process.exit(1);
  }

  // `to: claude` is reserved for orchestrator-sourced tasks (see
  // task_template.md) -- never dispatched to any process, the
  // orchestrator writes the Result block by hand. Guarded explicitly
  // rather than relying on no bus/scripts/agents/claude.json ever
  // existing -- found 2026-09-01 during a review pass: without this
  // guard, an accidentally-created claude.json config would let this
  // script silently dispatch a task that convention says must never be
  // dispatched.
  if (task.to === 'claude') {
    console.error(`Task "${taskId}" has to: "claude" -- reserved for orchestrator-sourced tasks, never dispatched. See task_template.md's "Which agent, and how to dispatch" section.`);
    process.exit(1);
  }

  const agentConfig = loadAgentConfig(task.to);
  if (!agentConfig) {
    console.error(`No agent config found for to: "${task.to}" (looked for bus/scripts/agents/${task.to}.json). Known configs: ${listAgentConfigs().join(', ') || '(none)'}`);
    process.exit(1);
  }

  let logEntry = `## ${taskId} (run-task-generic.js -- agent: ${agentConfig.displayName}, mode: ${writeMode ? 'write' : 'read-only'})\n\n**${nowIso()} -- run-task-generic.js**\n`;

  if (writeMode) {
    // Write mode intentionally does not support dependsOnTaskId or
    // dependsOnTaskIds, matching run-task-collab.js's own scoping
    // decision: this path is for direct collaborative edits, not data
    // pipelines.
    if (task.dependsOnTaskId || task.dependsOnTaskIds) {
      console.error(`Task "${taskId}" declares a dependency field -- write mode does not support dependency resolution. Use read-only mode (no --write) instead.`);
      process.exit(1);
    }
    const prompt = task.payload;
    logEntry += `Sent (exact):\n"""\n${prompt}\n"""\n`;

    const result = dispatchWrite(agentConfig, prompt, { cwd: VAULT_ROOT });

    logEntry += `Exit code: ${result.exitCode}\n`;
    logEntry += `Received (exact):\n"""\n${result.output}\n"""\n`;
    logEntry += `Files added: ${result.diff.added.length ? result.diff.added.join(', ') : '(none)'}\n`;
    logEntry += `Files modified: ${result.diff.modified.length ? result.diff.modified.join(', ') : '(none)'}\n`;
    logEntry += `Files removed: ${result.diff.removed.length ? result.diff.removed.join(', ') : '(none)'}\n`;

    const status = result.exitCode === 0 && result.output ? 'done' : 'error';
    logEntry += `status -> ${status}\n`;
    appendLog(logEntry);

    writeTaskResult(taskId, {
      status,
      output:
        result.output +
        `\n\n[diff] added:${result.diff.added.join(',')} modified:${result.diff.modified.join(',')} removed:${result.diff.removed.join(',')}`,
    });

    if (status === 'done') {
      console.log(`DONE: ${result.output}`);
      console.log(`Files changed -- added: [${result.diff.added.join(', ')}] modified: [${result.diff.modified.join(', ')}] removed: [${result.diff.removed.join(', ')}]`);
    } else {
      console.log(`ERROR (exit ${result.exitCode})`);
    }
    return;
  }

  // Read-only mode: full dependency resolution + verification gate.
  const dep = resolveTaskDependencies(taskId, task);
  if (!dep.ok) {
    logEntry += `Dependency resolution FAILED: ${dep.reason}\n`;
    logEntry += `Task NOT dispatched. status -> blocked.\n`;
    appendLog(logEntry);
    writeTaskResult(taskId, { status: 'blocked', reason: dep.reason });
    console.log(`BLOCKED: ${dep.reason}`);
    process.exit(0);
  }
  if (dep.logNote) logEntry += dep.logNote + '\n';
  const injectedContext = dep.injectedContext;

  const searchEnrichment = buildSearchEnrichment(task);
  if (task.enrichWithSearch === 'true') {
    logEntry += searchEnrichment
      ? `Search enrichment: applied (${searchEnrichment.split('\n\n').pop().split('\n').length} result lines)\n`
      : `Search enrichment: requested but unavailable or no hits -- dispatched without it\n`;
  }

  // getMandatorySuffix() picks the right honesty contract per specialist
  // (added 2026-09-02) -- a flat MANDATORY_SUFFIX here would tell every
  // agent config, including claude-agent, that it has "no live data
  // lookup," which is false for claude-agent specifically. See
  // run-task.js's LIVE_FILE_READ_CAPABLE comment.
  const prompt = task.payload + injectedContext + searchEnrichment + getMandatorySuffix(task.to);
  logEntry += `Sent (exact):\n"""\n${prompt}\n"""\n`;
  logEntry += `Command: ${agentConfig.binary} ${agentConfig.modes.readOnly.args.join(' ')} (stdin-piped)\n`;

  const result = dispatch(agentConfig, prompt, { mode: 'readOnly', cwd: VAULT_ROOT });

  logEntry += `Exit code: ${result.exitCode}\n`;
  logEntry += `Received (exact):\n"""\n${result.output}\n"""\n`;

  let status;
  let reason;
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
  writeTaskResult(taskId, { status, output: result.output, reason: status === 'unverified' ? reason : undefined });

  if (status === 'done') console.log(`DONE: ${result.output}`);
  else if (status === 'unverified') console.log(`UNVERIFIED: ${reason}`);
  else console.log(`ERROR (exit ${result.exitCode})`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
