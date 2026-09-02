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
//   5. Verifies the output before trusting it as "done" (added 2026-08-31,
//      see verifyOutput()): non-empty, has the mandatory SOURCE tag (Codex
//      tasks), and matches expectedType if the task declared one. A task
//      that fails this lands as status "unverified" with the specific
//      reason logged, never silently marked done.
//   6. Writes status + the exact captured output back into the task file's
//      own `output:` field (fenced code block), so later tasks can depend
//      on THIS task deterministically too.
//   7. Appends a structured entry to /bus/log.md documenting exactly what
//      was injected (value + source task_id) or why the task was blocked/
//      unverified, the exact prompt sent, and the exact response received
//      -- not just that the task ran.
//
// Deliberately no guessing anywhere: a missing/pending/malformed dependency
// always blocks, and a malformed/incomplete response is marked unverified
// rather than rubber-stamped done.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'log.md');

// Added 2026-08-31 after the AAPL revenue figure drifted between two
// separate codex exec calls ($391.0B vs $416.2B) -- both were real, correct
// figures for different fiscal years, but nothing marked them as unverified
// training-data recall vs a checked fact, so the drift looked like an
// error rather than what it actually was: two different years, neither one
// labeled. codex exec has no live data source (confirmed: no web-search/
// fetch flag in its CLI, and no evidence of one configured), so every
// response dispatched through this script is, by construction, training-
// data recall -- the SOURCE line is not a request, it's a statement of
// fact this script can (and should) simply assert on Codex's behalf. Real
// grounding (a verified figure from a live data source) is a categorically
// different path -- see the "orchestrator-sourced" task pattern in
// task_template.md -- and never flows through this function.
const MANDATORY_SUFFIX = [
  '',
  'Before answering, your response MUST start with this exact line:',
  'SOURCE: training-data recall, not verified live',
  '(This is true for every response you give in this pipeline -- you have',
  'no live data lookup. If a verified figure was explicitly supplied to you',
  'earlier in this prompt from a prior pipeline step, say so instead:',
  '"SOURCE: supplied by orchestrator from a prior verified step" -- but do',
  'not claim verified/live status for anything you are recalling yourself.)',
  '',
  'On the next line, state the as-of date/period your answer is anchored',
  'to (what your training knowledge actually reflects, not "current").',
  "If anything about this request's premise looks wrong, outdated, or",
  'unanswerable, say so plainly right after the SOURCE/as-of lines instead',
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
    // [ \t]* not \s* after the colon -- \s matches newlines too, so a
    // BLANK field (e.g. "dependsOnTaskId:" with nothing after it) would
    // greedily consume the newline and capture the start of the NEXT
    // line's content instead of an empty string. Verified bug, not
    // theoretical: this exact regex mis-parsed "expectedType: number" as
    // the value of a blank "dependsOnTaskId:" line above it.
    const m = new RegExp(`^${name}:[ \\t]*(.*)$`, 'm').exec(text);
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
    expectedType: field('expectedType'),
    source: field('source'),
    output: outputMatch ? outputMatch[1] : null,
  };
}

function writeTaskResult(taskId, { status, output, reason }) {
  const p = taskFilePath(taskId);
  let text = fs.readFileSync(p, 'utf8');
  text = text.replace(/^status:\s*.*$/m, `status: ${status}`);

  // Strip any prior output/reason block before appending the new one
  text = text.replace(/\n## Result \(auto\)[\s\S]*$/m, '');

  let resultBlock = '\n## Result (auto)\n';
  resultBlock += `resolved_at: ${nowIso()}\n`;
  if (reason) {
    resultBlock += `reason: ${reason}\n`;
  }
  if (output !== undefined && output !== null) {
    resultBlock += 'output:\n```\n' + output + '\n```\n';
  }
  text = text.trimEnd() + '\n' + resultBlock;
  fs.writeFileSync(p, text, 'utf8');
}

// --- Verification: a second, independent check before a task can be
// trusted as "done" -- added 2026-08-31 to close the gap agent-comms hit
// for a real reason (Antigravity self-reporting fake/unverified
// completion). Deliberately minimal: non-empty, has the mandatory SOURCE
// tag, and matches expectedType if the task declared one. Does not
// attempt semantic correctness -- that's a different, harder problem
// than "did this task even produce a checkable result."
//
// DISPATCHED_SPECIALISTS (generalized 2026-09-01): the SOURCE-tag
// requirement was originally hardcoded to `task.to === 'codex'`. That was
// an accident of only ever having dispatched to one specialist, not a
// real Codex-specific property -- the underlying reason (a bare headless
// CLI call with no live data/web tool has no way to give a verified-live
// answer) applies identically to any dispatched specialist, Claude
// included. `to: claude` stays reserved for orchestrator-sourced tasks
// (Claude, in-session, citing a real fetched source) -- that path
// legitimately skips this check by design (see the "Orchestrator-sourced
// tasks" pattern in task_template.md). `to: claude-agent` is the new
// identifier for a task actually dispatched to a nested headless Claude
// specialist via run-task-claude.js, which is NOT the orchestrator and
// gets the same tag requirement as Codex.
const DISPATCHED_SPECIALISTS = new Set(['codex', 'claude-agent']);

function verifyOutput(task, output) {
  const text = String(output || '').trim();
  if (!text) {
    return { ok: false, reason: 'output is empty' };
  }
  if (DISPATCHED_SPECIALISTS.has(task.to)) {
    const hasSourceTag =
      text.includes('SOURCE: training-data recall, not verified live') ||
      text.includes('SOURCE: supplied by orchestrator from a prior verified step');
    if (!hasSourceTag) {
      return { ok: false, reason: 'missing the mandatory SOURCE tag -- neither accepted variant found in the response' };
    }
  }
  if (task.expectedType === 'number') {
    // Tightened 2026-09-01 (closes an open item found while building the
    // verification suite): checking the whole response for any digit
    // meant a response whose only digit was in the as-of preamble (e.g.
    // "As of: 2026") passed even with a non-numeric answer. Checking only
    // the last non-empty line matches every task in this pipeline's own
    // convention ("Reply with ONLY the resulting integer on its own
    // line"). Verified against all 16 real dispatched responses recorded
    // 2026-09-01 before this change -- old and new logic agree on every
    // one; this only changes behavior for a response that would have
    // been a false positive under the old check.
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const lastLine = lines[lines.length - 1] || '';
    if (!/\d/.test(lastLine)) {
      return { ok: false, reason: 'expectedType is "number" but the last non-empty line of the output contains no digit characters' };
    }
  }
  return { ok: true };
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
  // Guard added 2026-09-01, found during a review pass: this function
  // never checked task.to before dispatching to Codex. Harmless before
  // today (Codex was the only possible dispatch target, by construction)
  // -- now that `to: claude-agent` tasks exist, running this script
  // instead of run-task-claude.js on one would silently send it to
  // Codex with no error, and a generic prompt might even happen to pass
  // verification, making the mistake invisible. run-task-claude.js
  // already guards its own `to:` this way; this closes the same gap here.
  if (task.to !== 'codex') {
    console.error(`Task "${taskId}" has to: "${task.to}", expected "codex". Use run-task-claude.js for claude-agent tasks, or run-task-generic.js for either.`);
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
      writeTaskResult(taskId, { status: 'blocked', reason: dep.reason });
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

module.exports = { readTaskFile, writeTaskResult, resolveDependency, verifyOutput, runCodex, appendLog, taskFilePath, MANDATORY_SUFFIX };
