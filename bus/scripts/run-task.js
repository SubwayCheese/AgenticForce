#!/usr/bin/env node
// run-task.js -- deterministic dependency resolution + Codex dispatch for
// the /bus/ protocol.
//
// This exists to close a specific gap: the AAPL revenue -> 25% dependency-
// chain test passed once, but only because Claude (the orchestrator)
// manually read task A's output and typed it into task B's prompt. That is
// a habit, not a guarantee -- nothing stopped a future run from silently
// skipping the injection, injecting a paraphrase instead of the literal
// value, or injecting a recalled/guessed value instead of the real one.
//
// Usage: node run-task.js <task_id>
//
// What it does, in order, for /tasks/<task_id>.md:
//   1. Refuses to run a task that isn't 'pending' (no re-running done work).
//   2. If the task declares dependsOnTaskId, resolves it deterministically:
//        - dependency file missing -> BLOCKED, task never dispatched
//        - dependency status != done -> BLOCKED, task never dispatched
//        - dependency done but has no parseable output field -> BLOCKED
//        - otherwise: the dependency's output field (exact text, this
//          script's own prior write) is injected verbatim into the new
//          task's prompt, with an explicit "do not substitute" instruction
//   3. Builds the full prompt (payload + mandatory as-of/invalid-premise
//      suffix from task_template.md + injected dependency context if any).
//   4. Runs `codex exec` for real, captures the actual output.
//   5. Writes status + the exact captured output back into the task file's
//      own `output:` field (fenced code block), so later tasks can depend
//      on THIS task deterministically too.
//   6. Appends a structured entry to /bus/log.md documenting exactly what
//      was injected (value + source task_id) or why the task was blocked,
//      the exact prompt sent, and the exact response received -- not just
//      that the task ran.
//
// Deliberately no guessing anywhere: a missing/pending/malformed dependency
// always blocks, never falls back to a recalled or assumed value.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'log.md');

const MANDATORY_SUFFIX = [
  '',
  'Before answering: state the as-of date/period your answer is anchored',
  'to (you have no live data lookup, so say what your knowledge reflects).',
  "If anything about this request's premise looks wrong, outdated, or",
  'unanswerable, say so plainly as the first line of your response instead',
  'of answering around it.',
].join('\n');

function nowIso() {
  return new Date().toISOString();
}

function taskFilePath(taskId) {
  return path.join(TASKS_DIR, `${taskId}.md`);
}

function readTaskFile(taskId) {
  const p = taskFilePath(taskId);
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  const field = (name) => {
    const m = new RegExp(`^${name}:\\s*(.*)$`, 'm').exec(text);
    return m ? m[1].trim() : '';
  };
  const outputMatch = /^output:\s*\n```\n([\s\S]*?)\n```/m.exec(text);
  return {
    path: p,
    raw: text,
    from: field('from'),
    to: field('to'),
    type: field('type'),
    status: field('status'),
    payload: field('payload'),
    timestamp: field('timestamp'),
    dependsOnTaskId: field('dependsOnTaskId'),
    output: outputMatch ? outputMatch[1] : null,
  };
}

function writeTaskResult(taskId, { status, output, blockedReason }) {
  const p = taskFilePath(taskId);
  let text = fs.readFileSync(p, 'utf8');
  text = text.replace(/^status:\s*.*$/m, `status: ${status}`);

  // Strip any prior output/blocked-reason block before appending the new one
  text = text.replace(/\n## Result \(auto\)[\s\S]*$/m, '');

  let resultBlock = '\n## Result (auto)\n';
  resultBlock += `resolved_at: ${nowIso()}\n`;
  if (blockedReason) {
    resultBlock += `blocked_reason: ${blockedReason}\n`;
  }
  if (output !== undefined && output !== null) {
    resultBlock += 'output:\n```\n' + output + '\n```\n';
  }
  text = text.trimEnd() + '\n' + resultBlock;
  fs.writeFileSync(p, text, 'utf8');
}

function appendLog(entry) {
  fs.appendFileSync(LOG_PATH, '\n' + entry.trimEnd() + '\n', 'utf8');
}

function resolveDependency(taskId, dependsOnTaskId) {
  const dep = readTaskFile(dependsOnTaskId);
  if (!dep) {
    return { ok: false, reason: `dependency task_id "${dependsOnTaskId}" not found (no file at tasks/${dependsOnTaskId}.md)` };
  }
  if (dep.status !== 'done') {
    return { ok: false, reason: `dependency "${dependsOnTaskId}" has status "${dep.status || '(none)'}", not "done" -- refusing to guess its eventual output` };
  }
  if (!dep.output) {
    return { ok: false, reason: `dependency "${dependsOnTaskId}" is marked done but has no parseable output field -- refusing to proceed on a malformed/missing value` };
  }
  return { ok: true, value: dep.output, sourceTaskId: dependsOnTaskId };
}

function runCodex(prompt) {
  // The prompt is passed via stdin, not as a command-line argument.
  // codex.exe is a .cmd wrapper on Windows, so execFileSync needs
  // shell:true to resolve it at all -- but shell:true does NOT escape
  // array args (Node warns about this), and a prompt containing newlines
  // or double quotes gets silently mangled/truncated by cmd.exe's argument
  // parser if passed as an arg (verified directly: a 3-line prompt with an
  // embedded quote survived as one truncated line). Piping via stdin
  // sidesteps cmd.exe argument parsing entirely and was verified to
  // survive multi-line + quoted content intact.
  const tmpFile = path.join(
    require('os').tmpdir(),
    `bus-run-task-${crypto.randomBytes(4).toString('hex')}.txt`
  );
  let exitCode = 0;
  try {
    execFileSync(
      'codex',
      ['exec', '--ephemeral', '--sandbox', 'read-only', '--skip-git-repo-check', '--output-last-message', tmpFile],
      { cwd: VAULT_ROOT, encoding: 'utf8', input: prompt, shell: true, stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (err) {
    exitCode = (err && err.status) || 1;
  }
  const output = fs.existsSync(tmpFile) ? fs.readFileSync(tmpFile, 'utf8').trim() : '';
  return { exitCode, output };
}

function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error('Usage: node run-task.js <task_id>');
    process.exit(1);
  }

  const task = readTaskFile(taskId);
  if (!task) {
    console.error(`No task file found for "${taskId}" at ${taskFilePath(taskId)}`);
    process.exit(1);
  }
  if (task.status !== 'pending') {
    console.error(`Task "${taskId}" has status "${task.status}", not "pending" -- refusing to re-run. Delete the ## Result (auto) block and reset status to pending if you really want to re-run it.`);
    process.exit(1);
  }

  let logEntry = `## ${taskId} (run-task.js)\n\n**${nowIso()} -- run-task.js**\n`;

  let injectedContext = '';
  if (task.dependsOnTaskId) {
    const dep = resolveDependency(taskId, task.dependsOnTaskId);
    if (!dep.ok) {
      logEntry += `dependsOnTaskId: ${task.dependsOnTaskId}\n`;
      logEntry += `Dependency resolution FAILED: ${dep.reason}\n`;
      logEntry += `Task NOT dispatched to Codex. status -> blocked.\n`;
      appendLog(logEntry);
      writeTaskResult(taskId, { status: 'blocked', blockedReason: dep.reason });
      console.log(`BLOCKED: ${dep.reason}`);
      process.exit(0);
    }
    logEntry += `dependsOnTaskId: ${task.dependsOnTaskId}\n`;
    logEntry += `Dependency resolved OK. Injecting the following value, read verbatim from task "${dep.sourceTaskId}"'s own output field (not retyped, not recalled):\n`;
    logEntry += '```\n' + dep.value + '\n```\n';
    injectedContext =
      `\n\nA prior step in this pipeline (task_id: ${dep.sourceTaskId}) reported the following exact result:\n\n` +
      dep.value +
      '\n\nUse that exact figure -- do not substitute a different number from your own knowledge, even if it differs from what you would otherwise recall.';
  }

  const prompt = task.payload + injectedContext + MANDATORY_SUFFIX;

  logEntry += `\nSent (exact):\n"""\n${prompt}\n"""\n`;
  logEntry += `Command: codex exec --ephemeral --sandbox read-only --skip-git-repo-check --output-last-message <file> "<prompt above>"\n`;

  const result = runCodex(prompt);

  logEntry += `Exit code: ${result.exitCode}\n`;
  logEntry += `Received (exact):\n"""\n${result.output}\n"""\n`;

  const status = result.exitCode === 0 && result.output ? 'done' : 'error';
  logEntry += `status -> ${status}\n`;

  appendLog(logEntry);
  writeTaskResult(taskId, { status, output: result.output });

  console.log(status === 'done' ? `DONE: ${result.output}` : `ERROR (exit ${result.exitCode})`);
}

main();
