#!/usr/bin/env node
// run-task-claude.js -- dispatches a task to a nested headless Claude Code
// specialist (`claude -p`), read-only by default. This is /bus/'s second
// real specialist, added 2026-09-01 specifically to answer a concrete
// question before designing a Phase 2 agent-scaffold system: which parts
// of run-task.js's design (dependency resolution, the SOURCE-tag
// verification gate, dispatch/logging shape) are genuinely generic across
// specialists, versus Codex-specific assumptions baked in by only ever
// having had one real specialist to test against.
//
// Usage: node run-task-claude.js <task_id>
// Task files use `to: claude-agent` (NOT `to: claude`, which stays
// reserved for orchestrator-sourced tasks -- see verifyOutput()'s
// DISPATCHED_SPECIALISTS comment in run-task.js for why that distinction
// matters).
//
// What generalized cleanly from run-task.js, found by actually building
// this rather than assumed in advance:
//   - Dependency resolution (resolveDependency), the task file format,
//     writeTaskResult, and appendLog needed ZERO changes -- reused
//     directly via require('./run-task.js'). These were never actually
//     Codex-specific, just never exercised against anything else.
//   - MANDATORY_SUFFIX's wording ("you have no live data lookup") was
//     initially reused verbatim, no Claude-specific variant. That turned
//     out to be wrong, not just unfinished: found 2026-09-01/fixed
//     2026-09-02 -- Claude retains native Read/Grep/Glob tools scoped to
//     VAULT_ROOT even under `--permission-mode plan` (it blocks writes,
//     not reads), so the blanket "no live data lookup" claim is false for
//     this specialist specifically. Now uses getMandatorySuffix(), which
//     gives claude-agent a three-way honest SOURCE tag instead of forcing
//     a choice between two options that are both false when it actually
//     opened a file. See run-task.js's LIVE_FILE_READ_CAPABLE comment.
//   - verifyOutput()'s SOURCE-tag check WAS hardcoded to `to === 'codex'`
//     specifically -- generalized to a DISPATCHED_SPECIALISTS set (see
//     run-task.js) once this file needed it too. A real, not
//     hypothetical, generalization.
//
// What did NOT generalize -- genuinely different per specialist:
//   - Invocation shape: `codex exec --sandbox read-only ... <file>` vs
//     `claude -p --permission-mode plan` (stdin-piped, plain stdout
//     capture, no --output-last-message file needed).
//   - Windows subprocess quirk: codex.exe is a .cmd wrapper, needing
//     execFileSync's shell:true (which then needed the manual-quoting
//     workaround documented in run-task-collab.js). claude.exe is a real
//     PE32+ executable -- shell:true is NOT needed here, and argv is
//     passed through cleanly. Confirmed via `file` on the binary before
//     writing this, not assumed.
//   - Sandbox vocabulary: Codex's `--sandbox read-only/workspace-write/
//     danger-full-access` vs Claude's `--permission-mode plan/
//     acceptEdits/bypassPermissions/...` -- different enum, different
//     underlying model (Claude's modes are about which actions get
//     auto-approved, not a literal filesystem read/write boundary in the
//     same sense). The read-only mapping used here (`plan`) was verified
//     empirically (a real headless call, checked the response), not
//     assumed equivalent from documentation alone.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  readTaskFile,
  writeTaskResult,
  resolveTaskDependencies,
  resolveSecretRequirement,
  verifyOutput,
  appendLog,
  taskFilePath,
  getMandatorySuffix,
} = require('./run-task.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');

function nowIso() {
  return new Date().toISOString();
}

function runClaude(prompt, { envOverlay } = {}) {
  // No shell:true -- claude.exe is a real executable (verified via `file`
  // before writing this), so execFileSync passes argv through cleanly
  // without cmd.exe's argument-mangling risk. Prompt via stdin, matching
  // run-task.js's runCodex() rationale (avoids any argv quoting question
  // entirely, moot here but kept for consistency/safety).
  let exitCode = 0;
  let output = '';
  try {
    const execOptions = { cwd: VAULT_ROOT, encoding: 'utf8', input: prompt, stdio: ['pipe', 'pipe', 'pipe'] };
    // envOverlay (the credential broker, Phase 3 piece 4, added
    // 2026-09-02): merged into the subprocess's own env, never the
    // prompt -- see run-task.js's resolveSecretRequirement().
    if (envOverlay && Object.keys(envOverlay).length > 0) {
      execOptions.env = { ...process.env, ...envOverlay };
    }
    output = execFileSync('claude', ['-p', '--permission-mode', 'plan'], execOptions);
  } catch (err) {
    exitCode = (err && err.status) || 1;
    output = (err && err.stdout) || '';
  }
  return { exitCode, output: output.trim() };
}

function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error('Usage: node run-task-claude.js <task_id>');
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
  if (task.to !== 'claude-agent') {
    console.error(`Task "${taskId}" has to: "${task.to}", expected "claude-agent". Use run-task.js for Codex, or set to: claude-agent for this script.`);
    process.exit(1);
  }

  let logEntry = `## ${taskId} (run-task-claude.js)\n\n**${nowIso()} -- run-task-claude.js**\n`;

  const dep = resolveTaskDependencies(taskId, task);
  if (!dep.ok) {
    logEntry += `Dependency resolution FAILED: ${dep.reason}\n`;
    logEntry += `Task NOT dispatched to Claude. status -> blocked.\n`;
    appendLog(logEntry);
    writeTaskResult(taskId, { status: 'blocked', reason: dep.reason });
    console.log(`BLOCKED: ${dep.reason}`);
    process.exit(0);
  }
  if (dep.logNote) logEntry += dep.logNote + '\n';

  // Added 2026-09-02 for the credential/secrets broker (Phase 3 piece 4).
  const secretReq = resolveSecretRequirement(task);
  if (!secretReq.ok) {
    logEntry += `Secret resolution FAILED: ${secretReq.reason}\n`;
    logEntry += `Task NOT dispatched to Claude. status -> blocked.\n`;
    appendLog(logEntry);
    writeTaskResult(taskId, { status: 'blocked', reason: secretReq.reason });
    console.log(`BLOCKED: ${secretReq.reason}`);
    process.exit(0);
  }
  if (task.withSecret) logEntry += `withSecret: ${task.withSecret}\nSecret resolved OK -- injected into the subprocess env, never the prompt.\n`;

  const prompt = task.payload + dep.injectedContext + getMandatorySuffix('claude-agent');

  logEntry += `\nSent (exact):\n"""\n${prompt}\n"""\n`;
  logEntry += `Command: claude -p --permission-mode plan (stdin-piped) "<prompt above>"\n`;

  const result = runClaude(prompt, { envOverlay: secretReq.envOverlay });

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
  writeTaskResult(taskId, { status, output: result.output, reason });

  if (status === 'done') console.log(`DONE: ${result.output}`);
  else if (status === 'unverified') console.log(`UNVERIFIED: ${reason}`);
  else console.log(`ERROR (exit ${result.exitCode})`);
}

if (require.main === module) {
  main();
}

module.exports = { runClaude };
