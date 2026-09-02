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
// labeled. codex exec has no live WEB data source (confirmed: no web-
// search/fetch flag in its CLI, and no evidence of one configured), so a
// figure like this -- nothing in the local vault could supply it -- is,
// by construction, training-data recall. This suffix is still exactly
// right for that case. (Updated 2026-09-02: "no live data source" is no
// longer accurate as a blanket claim, though -- Codex's read-only sandbox
// turns out to allow real local file reads, confirmed via its own sandbox
// audit log; see LIVE_FILE_READ_CAPABLE below and getMandatorySuffix(),
// which give Codex a third, honest option for exactly that case instead
// of forcing this one.) Real grounding (a verified figure from a live
// data source) is a categorically different path -- see the
// "orchestrator-sourced" task pattern in task_template.md -- and never
// flows through this function.
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

// Added 2026-09-02, closes the section-6 open item found 2026-09-01: a
// dispatched read-only Claude specialist directly read ARCHITECTURE.md
// with its own Read tool and correctly refused to mislabel that as
// "training-data recall, not verified live" -- because for Claude that
// line is simply false. `--permission-mode plan` blocks writes, not
// reads; Claude retains native Read/Grep/Glob tools scoped to VAULT_ROOT
// even in this dispatch. This set names every specialist for which
// that's been actually verified true (not assumed) -- add a specialist
// here only after real evidence, the way both entries below were found,
// not from what a sandbox flag's name merely suggests.
//
// 'claude-agent': confirmed 2026-09-02 as above.
//
// 'codex': confirmed 2026-09-02 -- initially left OUT of this set
// (untested, and `--sandbox read-only`'s name alone isn't proof), then
// tested directly: dispatched a task instructing Codex to `Get-Content`
// a live vault file. It returned the correct content (vault-specific
// text with no plausible training-data-recall explanation) -- but still
// opened with "SOURCE: training-data recall, not verified live", simply
// parroting the (then-blanket) suffix rather than catching the
// contradiction the way Claude did. Ground truth wasn't taken on Codex's
// self-report alone: cross-checked against
// `~/.codex/.sandbox/sandbox.*.log`, which recorded the literal
// `Get-Content -LiteralPath 'roles/antigravity_role.md'` PowerShell call
// actually executing, with no denial/error logged around it. So Codex's
// `--sandbox read-only` DOES have the same read-but-not-write property
// Claude's `--permission-mode plan` does -- MANDATORY_SUFFIX's blanket
// "no live data lookup" claim was never actually true for either
// dispatched specialist, only for a specialist with no shell/tool access
// to the filesystem at all (which is why MANDATORY_SUFFIX stays as the
// *default* for anything not in this set, not deleted -- a future
// specialist without local file access would still need it verbatim).
const LIVE_FILE_READ_CAPABLE = new Set(['claude-agent', 'codex']);

const SOURCE_TAG_TRAINING_RECALL = 'SOURCE: training-data recall, not verified live';
const SOURCE_TAG_ORCHESTRATOR_SUPPLIED = 'SOURCE: supplied by orchestrator from a prior verified step';
const SOURCE_TAG_LIVE_FILE_READ = 'SOURCE: verified live via direct file read in this pipeline';

// Same shape as MANDATORY_SUFFIX, but offers a third, honest SOURCE tag
// instead of forcing a choice between two options that are both false
// when the specialist actually opened a file. Only used for specialists
// in LIVE_FILE_READ_CAPABLE.
const MANDATORY_SUFFIX_LIVE_READ_CAPABLE = [
  '',
  'Before answering, your response MUST start with exactly one of these',
  'three lines -- pick whichever is actually true for how you produced',
  'this specific answer. Do not default to the first one out of habit:',
  '',
  SOURCE_TAG_TRAINING_RECALL,
  '(use this only if you answered from what you already know, without',
  'opening any file in this vault to check)',
  '',
  SOURCE_TAG_ORCHESTRATOR_SUPPLIED,
  '(use this only if a verified figure was explicitly supplied to you',
  'earlier in this prompt from a prior pipeline step -- not for anything',
  'you looked up yourself)',
  '',
  SOURCE_TAG_LIVE_FILE_READ,
  '(use this if you actually opened a file in this vault to answer --',
  'whether via a native file-reading tool or a real shell command like',
  'cat/Get-Content -- you retain that access, scoped to this vault',
  'directory, even in this read-only dispatch. Name the exact file',
  'path(s) you read on the next line.)',
  '',
  'On the line after your SOURCE tag, state the as-of date/period your',
  'answer is anchored to (your training cutoff, or the file(s) you',
  'actually read -- not just "current"). If anything about this',
  "request's premise looks wrong, outdated, or unanswerable, say so",
  'plainly right after the SOURCE/as-of lines instead of answering',
  'around it.',
].join('\n');

// Picks the right suffix for a given `to:` value. Every dispatch call
// site (run-task.js's own main(), run-task-claude.js, run-task-generic.js,
// and the verification suite's generic/per-agent paths) should go through
// this rather than hardcoding MANDATORY_SUFFIX, so a specialist's honesty
// contract is decided in exactly one place.
function getMandatorySuffix(to) {
  return LIVE_FILE_READ_CAPABLE.has(to) ? MANDATORY_SUFFIX_LIVE_READ_CAPABLE : MANDATORY_SUFFIX;
}

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
    // Added 2026-09-02 for fan-in (Phase 3 piece 2): a task sets exactly
    // one of dependsOnTaskId or dependsOnTaskIds, never both -- see
    // resolveTaskDependencies() below. Comma-separated task IDs, parsed
    // there, not here (this is just field extraction, matching every
    // other field in this object).
    dependsOnTaskIds: field('dependsOnTaskIds'),
    expectedType: field('expectedType'),
    source: field('source'),
    // Added 2026-09-01: opt-in vault-search enrichment, consumed by
    // run-task-generic.js only (see task_template.md). Deliberately
    // NOT wired into run-task.js's own dispatch or verifyOutput() --
    // this is just field parsing, agent-agnostic, matching every other
    // field here; the actual enrichment behavior lives where it was
    // asked for, not spread across every dispatch script.
    enrichWithSearch: field('enrichWithSearch'),
    output: outputMatch ? outputMatch[1] : null,
  };
}

// Added 2026-09-02 for run-queue-daemon.js: extracted from bus-status.js's
// reportPendingTasks(), which had this exact walk (skip verification_suite/
// and UNVERIFIED_Cl/ -- transient/queued content, not real backlog; skip
// the two template files) inline as a print-only function. Two definitions
// of "pending" that could silently drift was a real risk the moment a
// second real consumer (the daemon) needed the same list -- this is now
// the one definition; bus-status.js calls this instead of walking itself.
// Returns task IDs (no ".md", ready to pass straight to readTaskFile()/
// taskFilePath()), not display strings.
//
// archive_pre_daemon/ (added 2026-09-02, same day as the daemon): six
// 2026-08-31/09-01 hand-authored guard-test task files were left
// deliberately `status: pending` forever, to be depended-on-but-unfinished
// or to prove a script rejects them -- exactly the kind of historical
// audit record run-verification-suite.js's own header says must never be
// silently modified. A daemon that dispatches anything pending would have
// done exactly that on its first live scan. Moved here (git mv, content
// untouched) instead, and excluded from this walk the same way
// verification_suite/ already is, rather than letting new automation
// quietly mutate old evidence.
// Generalized from a pending-only walk (found needed again the same day,
// for run-queue-daemon.js's blocked-task auto-retry -- rather than write
// the same tree-walk a third time with 'blocked' hardcoded instead of
// 'pending').
function listTaskIdsByStatus(status) {
  if (!fs.existsSync(TASKS_DIR)) return [];
  const matches = [];
  function walk(dir, relBase) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'verification_suite' || entry.name === 'UNVERIFIED_Cl' || entry.name === 'archive_pre_daemon') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, path.join(relBase, entry.name));
      } else if (entry.name.endsWith('.md') && entry.name !== 'task_template.md' && entry.name !== 'unverified_entry_template.md') {
        const text = fs.readFileSync(full, 'utf8');
        const statusMatch = text.match(/^status:\s*(\w+)/m);
        if (statusMatch && statusMatch[1] === status) {
          matches.push(path.join(relBase, entry.name.replace(/\.md$/, '')));
        }
      }
    }
  }
  walk(TASKS_DIR, '');
  return matches;
}

function listPendingTaskIds() {
  return listTaskIdsByStatus('pending');
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
    // Added 2026-09-02: accepted tags are now per-specialist, not a fixed
    // pair for everyone -- a specialist in LIVE_FILE_READ_CAPABLE
    // additionally accepts the live-file-read tag. Both real dispatched
    // specialists are in that set today (see the note above it for how
    // each was verified); a future specialist stays on the plain
    // two-tag set until it's verified the same rigorous way.
    const acceptedTags = [SOURCE_TAG_TRAINING_RECALL, SOURCE_TAG_ORCHESTRATOR_SUPPLIED];
    if (LIVE_FILE_READ_CAPABLE.has(task.to)) acceptedTags.push(SOURCE_TAG_LIVE_FILE_READ);
    const hasSourceTag = acceptedTags.some((tag) => text.includes(tag));
    if (!hasSourceTag) {
      return { ok: false, reason: `missing the mandatory SOURCE tag -- none of the ${acceptedTags.length} accepted variant(s) for "${task.to}" found in the response` };
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

// Added 2026-09-02 for fan-in (Phase 3 piece 2). Unifies single- and
// multi-parent dependency resolution AND prompt-context formatting into
// one call -- before this, the same ~15-line block (call
// resolveDependency(), block on failure, hand-format an injectedContext
// string on success) was independently duplicated across run-task.js's
// own main(), run-task-claude.js, run-task-generic.js, run-backlog.js,
// and run-verification-suite.js's two runFullTask* mirrors. Adding
// multi-parent support as a 6th duplicated block in each would have made
// that worse, and after this same session's SOURCE-tag suffix fix (where
// a missed call site caused a real bug), more duplicated copies means
// more places a future change can be missed -- so this collapses all of
// it here instead. resolveDependency() itself is untouched, still
// exported, and still what this function calls per-ID.
//
// `task` is the object readTaskFile() already returns (has both
// dependsOnTaskId and dependsOnTaskIds parsed). Returns:
//   { ok, reason?, injectedContext, logNote }
// injectedContext/logNote are '' (not undefined) when there's nothing to
// inject, so every call site can unconditionally append/log them.
function resolveTaskDependencies(taskId, task) {
  const hasSingle = !!task.dependsOnTaskId;
  const hasMulti = !!task.dependsOnTaskIds;

  if (hasSingle && hasMulti) {
    return {
      ok: false,
      reason: `task declares both dependsOnTaskId ("${task.dependsOnTaskId}") and dependsOnTaskIds ("${task.dependsOnTaskIds}") -- ambiguous, refusing to guess which is authoritative`,
    };
  }

  if (!hasSingle && !hasMulti) {
    return { ok: true, injectedContext: '', logNote: '' };
  }

  if (hasSingle) {
    const dep = resolveDependency(taskId, task.dependsOnTaskId);
    if (!dep.ok) return { ok: false, reason: dep.reason };
    return {
      ok: true,
      injectedContext:
        `\n\nA prior step in this pipeline (task_id: ${dep.sourceTaskId}) reported the following exact result:\n\n` +
        dep.value +
        '\n\nUse that exact figure -- do not substitute a different number from your own knowledge, even if it differs from what you would otherwise recall.',
      logNote: `dependsOnTaskId: ${task.dependsOnTaskId}\nDependency resolved OK. Injecting value from "${dep.sourceTaskId}" verbatim.`,
    };
  }

  // Multi-parent.
  const ids = task.dependsOnTaskIds.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, reason: 'dependsOnTaskIds is set but contains no parseable task IDs' };
  }
  const resolved = [];
  const problems = [];
  for (const id of ids) {
    const dep = resolveDependency(taskId, id);
    if (!dep.ok) problems.push(`"${id}": ${dep.reason}`);
    else resolved.push({ sourceTaskId: dep.sourceTaskId, value: dep.value });
  }
  if (problems.length > 0) {
    return { ok: false, reason: `${problems.length}/${ids.length} dependencies not ready -- ${problems.join('; ')}` };
  }
  const lines = resolved.map((r) => `- task_id "${r.sourceTaskId}": ${r.value}`);
  return {
    ok: true,
    injectedContext:
      '\n\nPrior pipeline steps reported the following exact results:\n\n' +
      lines.join('\n') +
      '\n\nUse these exact values -- do not substitute different numbers from your own knowledge, even if they differ from what you would otherwise recall.',
    logNote: `dependsOnTaskIds: ${task.dependsOnTaskIds}\nAll ${ids.length} dependencies resolved OK. Injecting values verbatim.`,
  };
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

  const dep = resolveTaskDependencies(taskId, task);
  if (!dep.ok) {
    logEntry += `Dependency resolution FAILED: ${dep.reason}\n`;
    logEntry += `Task NOT dispatched to Codex. status -> blocked.\n`;
    appendLog(logEntry);
    writeTaskResult(taskId, { status: 'blocked', reason: dep.reason });
    console.log(`BLOCKED: ${dep.reason}`);
    process.exit(0);
  }
  if (dep.logNote) logEntry += dep.logNote + '\n';
  const injectedContext = dep.injectedContext;

  // getMandatorySuffix('codex'), not the flat MANDATORY_SUFFIX -- found
  // 2026-09-02 as a real bug (not caught by the regression suite, which
  // only exercises this via engine.dispatch()/run-task-generic.js, never
  // this script's own main()): this direct Codex-only path was missed
  // when getMandatorySuffix() was introduced, so two live re-verification
  // tests of the Codex live-read fix both silently got the OLD suffix.
  const prompt = task.payload + injectedContext + getMandatorySuffix('codex');

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

module.exports = {
  readTaskFile,
  writeTaskResult,
  resolveDependency,
  resolveTaskDependencies,
  verifyOutput,
  runCodex,
  appendLog,
  taskFilePath,
  listPendingTaskIds,
  listTaskIdsByStatus,
  MANDATORY_SUFFIX,
  MANDATORY_SUFFIX_LIVE_READ_CAPABLE,
  LIVE_FILE_READ_CAPABLE,
  getMandatorySuffix,
};
