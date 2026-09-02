#!/usr/bin/env node
// run-task-collab.js -- MANUAL-ONLY, write-enabled Codex dispatch for
// supervised collaboration on the vault itself (e.g. improving /bus/,
// editing shared docs, leaving notes for the next session). Distinct from
// run-task.js on purpose:
//
//   - run-task.js: --sandbox read-only, used everywhere autonomous/
//     unattended (run-continuous.js, run-research-crew.js, watch-inbox.js).
//     Codex can only ever produce a text answer there, by construction.
//   - run-task-collab.js (this file): --sandbox workspace-write, scoped to
//     VAULT_ROOT via --cd (no --add-dir, so nothing outside the vault is
//     writable). Only ever invoked directly by a human-present session --
//     nothing in this repo calls this script automatically. Do not wire it
//     into run-continuous.js, run-research-crew.js, or watch-inbox.js.
//
// Why this exists (2026-09-01): read-only was the right default while the
// verification gate was young, but it means Claude only ever sees Codex's
// TEXT reply, never anything Codex actually changed on disk -- there was no
// way for Codex to, say, leave its own note in the vault or edit a shared
// doc directly. For a supervised session (user + Claude both present) that
// tradeoff no longer makes sense. The autonomous paths are explicitly out
// of scope for this change and stay read-only.
//
// Because Codex can now touch the filesystem, this script snapshots the
// vault directory before and after the call and logs exactly which files
// were added/modified/removed -- so the write itself is auditable the same
// way run-task.js audits the text exchange, and Claude isn't just trusting
// Codex's own summary of what it did.
//
// Usage: node run-task-collab.js <task_id>
// (dependsOnTaskId resolution is intentionally NOT supported here -- this
// is for direct collaborative edits, not data pipelines. Use run-task.js
// for anything that needs dependency chaining.)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const {
  readTaskFile,
  writeTaskResult,
  appendLog,
  taskFilePath,
} = require('./run-task.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
// .obsidian excluded 2026-09-01 after a real false positive: the vault's
// own Obsidian app was open and autosaved .obsidian/workspace.json (open
// tabs/cursor state) during a sandbox-boundary test, and the diff wrongly
// attributed that background write to Codex. Not vault content -- app
// chrome, and provably not something Codex's own writes should ever touch.
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.obsidian']);

const MANDATORY_SUFFIX_COLLAB = [
  '',
  'You have write access to this directory (the vault at ' + VAULT_ROOT + '),',
  'and only this directory -- nothing outside it is writable. If you create,',
  'edit, or delete any file, end your response with a short "Changes:"',
  'section listing each path you touched and why. If you made no file',
  'changes, say so explicitly rather than leaving it ambiguous.',
].join('\n');

function nowIso() {
  return new Date().toISOString();
}

// Recursively records relative-path -> {size, mtimeMs} for every file under
// VAULT_ROOT (excluding IGNORE_DIRS), so a before/after diff can report
// exactly what Codex changed -- not just what it claims it changed.
function snapshotVault() {
  const snap = new Map();
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(VAULT_ROOT, full);
        const stat = fs.statSync(full);
        snap.set(rel, { size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  }
  walk(VAULT_ROOT);
  return snap;
}

function diffSnapshots(before, after) {
  const added = [];
  const modified = [];
  const removed = [];
  for (const [rel, stat] of after) {
    if (!before.has(rel)) {
      added.push(rel);
    } else {
      const prev = before.get(rel);
      if (prev.size !== stat.size || prev.mtimeMs !== stat.mtimeMs) {
        modified.push(rel);
      }
    }
  }
  for (const rel of before.keys()) {
    if (!after.has(rel)) removed.push(rel);
  }
  return { added, modified, removed };
}

function runCodexWrite(prompt) {
  // Same stdin-piping rationale as run-task.js's runCodex(): argv mangles
  // multi-line/quoted prompts on Windows, stdin doesn't. --sandbox
  // workspace-write scopes writes to codex's working root, which defaults
  // to the process cwd -- deliberately NOT passed as an explicit --cd
  // argument here: execFileSync's shell:true does not quote array args on
  // Windows (Node warns about this directly), so `--cd` with this path
  // (contains a space: "1. AgentVault") got silently split into multiple
  // broken arguments and codex exec failed immediately with no output.
  // Verified: the exact same command run manually in a properly-quoting
  // shell works fine. The `cwd` execFileSync option below achieves the
  // same working-root scoping without going through argv at all -- this
  // is exactly what run-task.js's own runCodex() already does.
  const tmpFile = path.join(
    require('os').tmpdir(),
    `bus-run-task-collab-${crypto.randomBytes(4).toString('hex')}.txt`
  );
  let exitCode = 0;
  try {
    execFileSync(
      'codex',
      [
        'exec', '--ephemeral',
        '--sandbox', 'workspace-write',
        '--skip-git-repo-check',
        '--output-last-message', tmpFile,
      ],
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
    console.error('Usage: node run-task-collab.js <task_id>');
    console.error('(manual-only, write-enabled -- see file header before using)');
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
  // Same guard added to run-task.js and found the same way (2026-09-01
  // review pass): this never checked task.to before dispatching to
  // Codex. Harmless before a second agent existed; not harmless now.
  if (task.to !== 'codex') {
    console.error(`Task "${taskId}" has to: "${task.to}", expected "codex". This script is Codex-only write mode; use run-task-generic.js <task_id> --write for either agent.`);
    process.exit(1);
  }
  if (task.dependsOnTaskId) {
    console.error(`Task "${taskId}" declares dependsOnTaskId -- this script does not support dependency resolution. Use run-task.js instead.`);
    process.exit(1);
  }

  const prompt = task.payload + MANDATORY_SUFFIX_COLLAB;

  let logEntry = `## ${taskId} (run-task-collab.js -- WRITE MODE)\n\n**${nowIso()} -- run-task-collab.js**\n`;
  logEntry += `Sent (exact):\n"""\n${prompt}\n"""\n`;
  logEntry += `Command: codex exec --ephemeral --sandbox workspace-write --skip-git-repo-check --output-last-message <file> "<prompt above>" (cwd: ${VAULT_ROOT})\n`;

  const before = snapshotVault();
  const result = runCodexWrite(prompt);
  const after = snapshotVault();
  const diff = diffSnapshots(before, after);

  logEntry += `Exit code: ${result.exitCode}\n`;
  logEntry += `Received (exact):\n"""\n${result.output}\n"""\n`;
  logEntry += `Files added: ${diff.added.length ? diff.added.join(', ') : '(none)'}\n`;
  logEntry += `Files modified: ${diff.modified.length ? diff.modified.join(', ') : '(none)'}\n`;
  logEntry += `Files removed: ${diff.removed.length ? diff.removed.join(', ') : '(none)'}\n`;

  let status;
  let reason;
  if (result.exitCode !== 0 || !result.output) {
    status = 'error';
    reason = `codex exec exited ${result.exitCode} with ${result.output ? 'output' : 'no output'}`;
  } else {
    status = 'done';
  }
  logEntry += `status -> ${status}\n`;

  appendLog(logEntry);

  const outputWithDiff =
    result.output +
    '\n\n[run-task-collab.js file diff]\n' +
    `added: ${diff.added.length ? diff.added.join(', ') : '(none)'}\n` +
    `modified: ${diff.modified.length ? diff.modified.join(', ') : '(none)'}\n` +
    `removed: ${diff.removed.length ? diff.removed.join(', ') : '(none)'}`;

  writeTaskResult(taskId, { status, output: outputWithDiff, reason });

  if (status === 'done') {
    console.log(`DONE: ${result.output}`);
    console.log(`Files changed -- added: [${diff.added.join(', ')}] modified: [${diff.modified.join(', ')}] removed: [${diff.removed.join(', ')}]`);
  } else {
    console.log(`ERROR (exit ${result.exitCode})`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { snapshotVault, diffSnapshots, runCodexWrite, MANDATORY_SUFFIX_COLLAB };
