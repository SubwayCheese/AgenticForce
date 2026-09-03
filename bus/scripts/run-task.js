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
const memoryStore = require('./memory-store.js');
const secretsBroker = require('./secrets-broker.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'log.md');

// Added 2026-08-31 after the AAPL revenue figure drifted between two
// separate codex exec calls ($391.0B vs $416.2B) -- both were real, correct
// figures for different fiscal years, but nothing marked them as unverified
// training-data recall vs a checked fact, so the drift looked like an
// error rather than what it actually was: two different years, neither one
// labeled. This suffix is still exactly right for the plain-recall case.
// (Updated 2026-09-02: Codex's read-only sandbox turns out to allow real
// local file reads, confirmed via its own sandbox audit log -- see
// LIVE_FILE_READ_CAPABLE below. Updated again 2026-09-03, and this one
// was a real correction, not just an addition: the claim right above this
// paragraph used to say flatly "codex exec has no live WEB data source
// (confirmed: no web-search/fetch flag in its CLI)". That was wrong, or
// had gone stale -- re-tested live 2026-09-03 by dispatching a direct
// capability probe, and Codex used a real web-search tool without being
// told how, then explicitly refused to misuse any of the three tags that
// existed at the time to describe it ("No listed SOURCE tag is truthful
// here" -- its own words). claude-agent has the same real capability,
// confirmed the same way. See WEB_SEARCH_CAPABLE below for the honest
// tag this added, and the trust-tier reasoning next to it -- a live web
// search is NOT the same reliability tier as a local file read or an
// orchestrator-sourced fetch; the same test that confirmed the
// capability also caught a likely-hallucinated claim in the search
// results, which is exactly why this needed its own tag rather than
// being folded into SOURCE_TAG_LIVE_FILE_READ.) Real grounding via the
// orchestrator's own verified connector fetch (not a specialist's own
// web search) is a categorically different, higher-trust path -- see the
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
// Added 2026-09-03, confirmed live, not assumed: both codex and
// claude-agent, dispatched exactly as this vault already dispatches
// them, have a real working web-search tool -- see the corrected note
// on MANDATORY_SUFFIX above for the full story (this directly reversed
// an earlier wrong "Codex has no web access" claim in this same file).
// Deliberately worded "not independently verified", a visibly lower
// trust tier than SOURCE_TAG_LIVE_FILE_READ or an orchestrator-sourced
// fetch: the same capability-confirming test caught a likely-
// hallucinated claim in the search results (an AI-summarized digest
// asserting a specific executive change), which the dispatched
// specialist itself flagged as unconfirmed rather than repeating as
// fact -- exactly the behavior this tag's wording is meant to keep
// reinforcing, not undercut by implying "web search" and "verified"
// mean the same thing.
const SOURCE_TAG_WEB_SEARCH = 'SOURCE: web search performed live in this pipeline, not independently verified';

// See the note above SOURCE_TAG_WEB_SEARCH for how this was confirmed.
// Kept as its own set, separate from LIVE_FILE_READ_CAPABLE, even though
// membership is identical today -- local vault file access and reaching
// the live internet are genuinely different capabilities, and a future
// specialist could plausibly have one without the other.
const WEB_SEARCH_CAPABLE = new Set(['claude-agent', 'codex']);

// Added 2026-09-02, found via a real failure in the memory layer's own
// live test (Phase 3 piece 3): a dependency's injected value can itself
// already carry a SOURCE/as-of line from when IT was originally
// produced (any real dispatched-specialist output does) -- and when that
// embedded preamble happens to be well-formed (a real SOURCE line, a
// real as-of line, then the answer), the quoted block has EXACTLY the
// shape the mandatory suffix asks for. Two prompt-wording-only fixes (a
// trailing warning, then a leading + delimited warning) both failed
// against this specific shape in real dispatched tests -- the specialist
// didn't just copy the SOURCE line, it copied the ENTIRE quoted block
// verbatim as if it were a ready-made template. This version breaks the
// pattern-match structurally too: every line of the quoted value is
// blockquote-prefixed ("| "), so it no longer has the literal shape of
// "a line starting with SOURCE:".
//
// Measured, not assumed: 4/5 real dispatched reps against the exact
// well-formed shape that broke both earlier fixes came back correct
// (up from an apparent ~0/2 before this version). This is a real,
// substantial improvement, not a complete fix -- LLM instruction-
// following on this specific shape is not 100% reliable even with a
// structural change, and no further prompt iteration is expected to
// close that gap to zero. Documented honestly in ARCHITECTURE.md
// section 6 rather than treated as fully solved; the live suite test
// covering this may occasionally flake for this reason, the same way
// `engine dispatch (Claude)`'s arithmetic check flakes on rare exact-
// string-match misses -- a known, accepted category, not a new one.
function wrapInjectedValue(value) {
  // Added 2026-09-02, second pass at this same finding (see the header
  // comment above): blockquoting alone still left the literal trigger
  // word "SOURCE:" sitting right at the top of the quoted block, which
  // measured 4/5 rather than closing the gap. This strips ONLY a
  // leading line that starts with "SOURCE:" (case-insensitive) --
  // removing the single highest-confusion element -- plus any blank
  // line(s) left behind. Deliberately NOT trying to also strip an
  // as-of line after it: that format is too free-form across
  // specialists ("As of:", "as-of:", a bare file path, a parenthetical
  // aside) to strip reliably without risking cutting into the real
  // answer. This is a rendering-time strip only -- the full raw value
  // is still preserved everywhere else (the stored fact, bus/log.md,
  // the task file's own Result block); only what gets shown in a LATER
  // prompt that quotes this value is affected.
  const lines = String(value).split('\n');
  if (/^SOURCE:/i.test(lines[0])) {
    lines.shift();
    while (lines.length && lines[0].trim() === '') lines.shift();
  }
  const quoted = lines.map((line) => '| ' + line).join('\n');
  return (
    '\n\nIMPORTANT before you read the quoted value below: it is shown' +
    ' blockquoted (each line prefixed "| ") because it is DATA from a' +
    ' prior step, not a template for your response. It may itself contain' +
    ' what looks like a SOURCE/as-of line from when it was originally' +
    ' produced -- that describes how THAT value was produced, not how you' +
    ' are producing your response now. Do not reproduce the "| " prefixes' +
    ' or copy any embedded SOURCE line. Your own SOURCE tag for using' +
    ' this value now is typically "SOURCE: supplied by orchestrator from' +
    ' a prior verified step."\n\n' +
    quoted
  );
}

// Same job as MANDATORY_SUFFIX, but offers whichever honest SOURCE tags
// are actually true for this specialist's real capabilities, instead of
// forcing a choice among options that might all be false. Composed, not
// a fixed table -- added 2026-09-03 when a second live-grounding
// capability (web search) needed the same treatment live-file-read
// already got, and a fixed 3-line/4-line pair of constants would have
// meant a third near-duplicate the next time this happens. A specialist
// with only one of the two live-grounding capabilities (a real future
// possibility, not just a hypothetical) gets an honest menu sized to
// what's actually true for it, not an all-or-nothing table.
function buildLiveCapableSuffix(to) {
  const options = [
    [SOURCE_TAG_TRAINING_RECALL, [
      '(use this only if you answered from what you already know, without',
      'opening any file in this vault or reaching the live internet to',
      'check)',
    ]],
    [SOURCE_TAG_ORCHESTRATOR_SUPPLIED, [
      '(use this only if a verified figure was explicitly supplied to you',
      'earlier in this prompt from a prior pipeline step -- not for',
      'anything you looked up yourself)',
    ]],
  ];
  if (LIVE_FILE_READ_CAPABLE.has(to)) {
    options.push([SOURCE_TAG_LIVE_FILE_READ, [
      '(use this if you actually opened a file in this vault to answer --',
      'whether via a native file-reading tool or a real shell command',
      'like cat/Get-Content -- you retain that access, scoped to this',
      'vault directory, even in this read-only dispatch. Name the exact',
      'file path(s) you read on the next line.)',
    ]]);
  }
  if (WEB_SEARCH_CAPABLE.has(to)) {
    options.push([SOURCE_TAG_WEB_SEARCH, [
      '(use this if you actually invoked a real web-search/fetch tool in',
      'this dispatch. Web search results are noisy and can contain',
      'AI-summarized or outright wrong content -- state exactly what you',
      'searched for and what came back, and flag anything in the results',
      'that looks unconfirmed or implausible instead of repeating it as',
      'settled fact.)',
    ]]);
  }
  const lines = [
    '',
    `Before answering, your response MUST start with exactly one of these`,
    `${options.length} lines -- pick whichever is actually true for how you produced`,
    'this specific answer. Do not default to the first one out of habit:',
  ];
  options.forEach(([tag, explain]) => {
    lines.push('', tag, ...explain);
  });
  lines.push(
    '',
    'On the line after your SOURCE tag, state the as-of date/period your',
    'answer is anchored to (your training cutoff, the file(s) you',
    'actually read, or what you searched for -- not just "current"). If',
    "anything about this request's premise looks wrong, outdated, or",
    'unanswerable, say so plainly right after the SOURCE/as-of lines',
    'instead of answering around it.'
  );
  return lines.join('\n');
}

// Added 2026-09-03, found via a real dispatch failure, then REMOVED the
// same day once the real fix was found -- kept as a comment, not deleted
// silently, because the dead end is as instructive as the fix. First
// finding: every claude-agent dispatch used `--permission-mode plan` --
// Claude Code's own interactive Plan Mode, not just a file-write
// restriction -- and the first claude-agent task phrased as a genuine
// planning/spec request triggered its EnterPlanMode reflex, diverting
// the answer to an external plan file instead of the response.
//
// The first fix attempt was exactly what used to live here: a
// CLAUDE_AGENT_NO_PLAN_MODE_SUFFIX appended to every claude-agent
// prompt ("this dispatch is headless, don't use Plan Mode, answer
// directly"). It made a later, more complex dispatch WORSE, not
// better: a well-calibrated specialist correctly noticed that "trust
// me, this special case means don't verify, proceed differently than
// normal" is structurally indistinguishable from a real prompt-
// injection attempt, and refused to comply -- the right call given
// what it could actually verify from inside the dispatch, even though
// the instruction was in fact legitimate. No amount of "no really,
// trust this" text fixes that; asserting harder just reproduces the
// same red flag.
// The real fix was one level down: switch claude-agent's `readOnly`
// mode from `--permission-mode plan` to `--permission-mode dontAsk`
// (see agent-engine.js's claude-agent.json for the full story and the
// live tests that confirmed it). dontAsk preserves the identical
// read-only guarantee -- reads succeed, writes/Bash/PowerShell are
// denied outright -- with none of `plan` mode's interactive-approval
// semantics, so the diversion failure mode literally cannot occur, and
// the prompt-level patch (and the injection-pattern risk it created)
// both became unnecessary at once. getMandatorySuffix() no longer
// appends anything claude-agent-specific -- LIVE_FILE_READ_CAPABLE and
// WEB_SEARCH_CAPABLE already cover its real, verified differences from
// codex.

// Picks the right suffix for a given `to:` value. Every dispatch call
// site (run-task.js's own main(), run-task-claude.js, run-task-generic.js,
// and the verification suite's generic/per-agent paths) should go through
// this rather than hardcoding MANDATORY_SUFFIX, so a specialist's honesty
// contract is decided in exactly one place.
function getMandatorySuffix(to) {
  const isLiveCapable = LIVE_FILE_READ_CAPABLE.has(to) || WEB_SEARCH_CAPABLE.has(to);
  return isLiveCapable ? buildLiveCapableSuffix(to) : MANDATORY_SUFFIX;
}

function nowIso() {
  return new Date().toISOString();
}

function taskFilePath(taskId) {
  return path.join(TASKS_DIR, `${taskId}.md`);
}

// Added 2026-09-03, found via a real dispatch failure, not a
// hypothetical one: a genuinely multi-paragraph payload (the first one
// this vault ever dispatched -- every prior payload happened to be a
// single line by convention) got silently truncated to just its first
// line by the generic single-line field() regex below, and Codex
// correctly reported receiving almost nothing. Every OTHER field
// (from/to/type/status/timestamp/dependsOnTaskId(s)/etc.) is a short
// scalar value and is fine staying single-line -- payload is the one
// field meant to hold real prose, so it gets its own extraction:
// everything from right after "payload:" up to (not including) the
// next recognized field-name line or the "## Result" marker, instead
// of stopping at the first newline.
function extractPayload(text) {
  const startMatch = /^payload:[ \t]*/m.exec(text);
  if (!startMatch) return '';
  const afterStart = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = /\n(?:timestamp|dependsOnTaskId|dependsOnTaskIds|expectedType|enrichWithSearch|recordFact|dependsOnFact|withSecret|source):|\n## Result/.exec(afterStart);
  const raw = endMatch ? afterStart.slice(0, endMatch.index) : afterStart;
  return raw.trim();
}

// Added 2026-09-03, found via a real dispatch failure in the trading-
// fleet pilot, not a hypothetical one: a specialist's own output
// legitimately contained a nested ``` code fence (a stated scoring
// formula, wrapped in its own code block, exactly as asked for). The
// Result block always wrapped output in a plain 3-backtick fence, and
// readTaskFile()'s extraction regex was non-greedy -- it stopped at the
// FIRST closing ``` it found, which was the INNER fence from the
// specialist's own formula block, not the real outer one. The rest of
// that specialist's answer (the full ranked table, most of its
// reasoning) was silently dropped on every subsequent read, injected
// into a downstream task as truncated data. Caught only because that
// downstream task happened to notice the truncation and flag it
// explicitly -- it would have been silent data loss otherwise.
//
// Fixed the standard Markdown way: the outer fence is always LONGER
// than the longest run of backticks actually present in the content
// being wrapped, so it can never collide with anything nested inside
// it, no matter how many backticks that content uses. The fence length
// actually used is read back dynamically at extraction time (not
// assumed to be 3), via a backreference, so this is correct for
// content with zero, one, or many nested fences of any length.
function pickResultFence(content) {
  const runs = String(content == null ? '' : content).match(/`+/g) || [];
  const longestRun = runs.reduce((max, r) => Math.max(max, r.length), 0);
  return '`'.repeat(Math.max(3, longestRun + 1));
}

function extractOutputField(text) {
  const headerMatch = /^output:[ \t]*\n(`{3,})\n/m.exec(text);
  if (!headerMatch) return null;
  const fence = headerMatch[1];
  const contentStart = headerMatch.index + headerMatch[0].length;
  // fence is guaranteed longer than any backtick run inside the real
  // content (see pickResultFence), so "\n<fence>" cannot appear as a
  // false-positive substring within that content -- this indexOf finds
  // the true closing fence, not an inner one.
  const closeIdx = text.indexOf('\n' + fence, contentStart);
  if (closeIdx === -1) return null;
  return text.slice(contentStart, closeIdx);
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
  const extractedOutput = extractOutputField(text);
  return {
    path: p,
    raw: text,
    from: field('from'),
    to: field('to'),
    type: field('type'),
    status: field('status'),
    payload: extractPayload(text),
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
    // Added 2026-09-02 for the memory layer (Phase 3 piece 3). recordFact
    // is opt-in: on a successful ("done") dispatch, promote this task's
    // output into the durable fact store under this key -- see
    // maybeRecordFact() below, gated on the same SOURCE-tag honesty work
    // built earlier today. dependsOnFact looks a fact back up by key
    // (not by task_id) -- see resolveTaskDependencies() below. Distinct
    // from and combinable with dependsOnTaskId(s) (that's "this specific
    // task's fresh output"; this is "whatever the most recently verified
    // value of X is").
    recordFact: field('recordFact'),
    dependsOnFact: field('dependsOnFact'),
    // Added 2026-09-02 for the credential/secrets broker (Phase 3 piece
    // 4). Opt-in: names a secret (by key, never a value) to make
    // available to this dispatch as an environment variable -- see
    // resolveSecretRequirement() below. The prompt itself never
    // contains the secret; only the NAME appears here and in logs.
    withSecret: field('withSecret'),
    output: extractedOutput,
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
// archive_pre_daemon/ (added 2026-09-02, same day as the daemon; folded
// into _archive_tests/ later the same day, see below): six 2026-08-31/
// 09-01 hand-authored guard-test task files were left deliberately
// `status: pending` forever, to be depended-on-but-unfinished or to prove
// a script rejects them -- exactly the kind of historical audit record
// run-verification-suite.js's own header says must never be silently
// modified. A daemon that dispatches anything pending would have done
// exactly that on its first live scan. Moved here (git mv, content
// untouched) instead, and excluded from this walk the same way
// verification_suite/ already is, rather than letting new automation
// quietly mutate old evidence.
// Generalized from a pending-only walk (found needed again the same day,
// for run-queue-daemon.js's blocked-task auto-retry -- rather than write
// the same tree-walk a third time with 'blocked' hardcoded instead of
// 'pending').
//
// _archive_tests/ (added 2026-09-02): the user asked to consolidate every
// test/proof task file into one folder rather than scattering them at
// tasks/ top level -- archive_pre_daemon/'s six files were folded into
// this same folder, so the exclusion below now names _archive_tests/
// instead (archive_pre_daemon/ no longer exists as a separate directory).
function listTaskIdsByStatus(status) {
  if (!fs.existsSync(TASKS_DIR)) return [];
  const matches = [];
  function walk(dir, relBase) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'verification_suite' || entry.name === 'UNVERIFIED_Cl' || entry.name === '_archive_tests') continue;
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

  // Added 2026-09-02 for the credential/secrets broker (Phase 3 piece
  // 4): redact any currently-known secret VALUE before it's ever
  // persisted to disk. Structural, not per-call-site -- every dispatch
  // script already calls this one function to save a result, so this
  // is the one place that guarantees a leak (e.g. a subprocess echoing
  // its env) never survives into the task file. A no-op when no secrets
  // are configured.
  if (reason) reason = secretsBroker.redactSecrets(reason);
  if (output !== undefined && output !== null) output = secretsBroker.redactSecrets(output);

  let resultBlock = '\n## Result (auto)\n';
  resultBlock += `resolved_at: ${nowIso()}\n`;
  if (reason) {
    resultBlock += `reason: ${reason}\n`;
  }
  if (output !== undefined && output !== null) {
    const fence = pickResultFence(output);
    resultBlock += `output:\n${fence}\n` + output + `\n${fence}\n`;
  }
  text = text.trimEnd() + '\n' + resultBlock;
  fs.writeFileSync(p, text, 'utf8');

  // Added 2026-09-02 for the memory layer (Phase 3 piece 3). Lives here,
  // not as a new call site in each of the 5 dispatch scripts -- this is
  // already the one function every one of them calls to persist a
  // result, same "collapse it into the place that's already called
  // everywhere" move fan-in made earlier today, one level cleaner since
  // it doesn't even need a new call site. Re-reads the file just written
  // so recordFact/to reflect exactly what's on disk now.
  if (status === 'done' && output !== undefined && output !== null) {
    maybeRecordFact(taskId, readTaskFile(taskId), output);
  }
}

// Promotes a task's output into the durable fact store (memory-store.js)
// if it opted in via recordFact: AND the result is actually trustworthy
// enough to remember -- reuses the SOURCE-tag honesty work built earlier
// today rather than inventing a second trust mechanism. A recall-tagged
// guess must never get promoted to "remembered fact" status; that would
// quietly undermine the whole point of the SOURCE tag. Declining to
// record is not an error, just a silent skip -- this is the memory
// system correctly refusing to cache an unverified guess, not a failure.
function isEligibleForMemory(task, output) {
  if (task.to === 'claude') return true; // orchestrator-sourced (e.g. a real FMP fetch) -- trusted by construction, see ARCHITECTURE.md section 4
  if (DISPATCHED_SPECIALISTS.has(task.to)) {
    return !String(output).includes(SOURCE_TAG_TRAINING_RECALL);
  }
  return false; // unknown/unexpected `to` -- never guess, don't remember it either
}

function maybeRecordFact(taskId, task, output) {
  if (!task || !task.recordFact) return; // opt-in only
  if (!isEligibleForMemory(task, output)) return;
  memoryStore.recordFact(task.recordFact, output, { sourceTaskId: taskId, taskTo: task.to });
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
    // Added 2026-09-03 alongside WEB_SEARCH_CAPABLE -- see run-task.js's
    // top-of-file notes for how this was confirmed live.
    if (WEB_SEARCH_CAPABLE.has(task.to)) acceptedTags.push(SOURCE_TAG_WEB_SEARCH);
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
  // Same redaction guarantee as writeTaskResult() above, applied to
  // bus/log.md -- both are the only two places any dispatch script
  // persists text, so this pair is the entire surface that needs it.
  fs.appendFileSync(LOG_PATH, '\n' + secretsBroker.redactSecrets(entry).trimEnd() + '\n', 'utf8');
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
// Resolves task-lineage dependencies only (dependsOnTaskId/Ids) -- the
// exact logic resolveTaskDependencies() had before dependsOnFact existed
// (Phase 3 piece 3, 2026-09-02), split out so that function can resolve
// task-lineage and fact dependencies as two independent, combinable
// concerns instead of one growing conditional chain.
function resolveTaskLineageDependencies(taskId, task) {
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
        `\n\nA prior step in this pipeline (task_id: ${dep.sourceTaskId}) reported the following exact result:` +
        wrapInjectedValue(dep.value) +
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
  // Each value blockquoted (via wrapInjectedValue's "| " prefix) for the
  // same reason the single-parent/fact paths are -- a well-formed
  // embedded SOURCE/as-of preamble can make a raw value look like a
  // ready-made answer template, which text warnings alone didn't
  // reliably stop a specialist from copying wholesale in real testing.
  const lines = resolved.map((r) => `- task_id "${r.sourceTaskId}":` + wrapInjectedValue(r.value));
  return {
    ok: true,
    injectedContext:
      '\n\nPrior pipeline steps reported the following exact results:\n' +
      lines.join('\n') +
      '\n\nUse these exact values -- do not substitute different numbers from your own knowledge, even if they differ from what you would otherwise recall.',
    logNote: `dependsOnTaskIds: ${task.dependsOnTaskIds}\nAll ${ids.length} dependencies resolved OK. Injecting values verbatim.`,
  };
}

// Resolves dependsOnFact only -- a lookup by MEANING (a key in the
// durable fact store, memory-store.js) rather than by task lineage.
// Added 2026-09-02, Phase 3 piece 3.
function resolveFactDependency(task) {
  if (!task.dependsOnFact) return { ok: true, injectedContext: '', logNote: '' };
  const fact = memoryStore.getFact(task.dependsOnFact);
  if (!fact) {
    return { ok: false, reason: `dependsOnFact "${task.dependsOnFact}" -- no recorded fact found for this key yet` };
  }
  return {
    ok: true,
    injectedContext:
      `\n\nThe memory store's most recent recorded fact for key "${task.dependsOnFact}" (recorded ${fact.ts}, from task_id: ${fact.sourceTaskId}) is:` +
      wrapInjectedValue(fact.value) +
      '\n\nUse that exact figure -- do not substitute a different number from your own knowledge, even if it differs from what you would otherwise recall.',
    logNote: `dependsOnFact: ${task.dependsOnFact}\nFact resolved OK from memory store (recorded ${fact.ts}, from task_id: ${fact.sourceTaskId}).`,
  };
}

// Combines task-lineage dependencies (dependsOnTaskId/Ids) with a fact
// dependency (dependsOnFact) -- the single entry point every dispatch
// script and run-queue-daemon.js's retryBlocked() call. Task-lineage
// resolves first; unchanged behavior (same shape, same failures) for
// any task not using dependsOnFact at all. Only if that succeeds does
// the fact dependency get checked too -- combinable with, not exclusive
// to, dependsOnTaskId(s) (conceptually different: "this specific task's
// fresh output" vs "whatever the most recently verified value of X is").
function resolveTaskDependencies(taskId, task) {
  const taskDep = resolveTaskLineageDependencies(taskId, task);
  if (!taskDep.ok) return taskDep;

  const factDep = resolveFactDependency(task);
  if (!factDep.ok) return factDep;

  return {
    ok: true,
    injectedContext: taskDep.injectedContext + factDep.injectedContext,
    logNote: [taskDep.logNote, factDep.logNote].filter(Boolean).join('\n'),
  };
}

// Added 2026-09-02 for the credential/secrets broker (Phase 3 piece 4).
// Deliberately separate from resolveTaskDependencies() -- that function
// is about DATA flowing between tasks (a value goes into the prompt);
// this is about ENVIRONMENT/access (a secret goes into the subprocess's
// env, the prompt is never touched at all), a genuinely different
// concern even though the shape (opt-in field, block with a reason if
// unresolved) rhymes with it. Never retried automatically by the daemon
// -- a secret is a manual local-setup fact, not a pipeline dependency
// that resolves itself the way a task output or a memory-store fact
// does; see the plan this was built from for why that's deliberate.
function resolveSecretRequirement(task) {
  if (!task.withSecret) return { ok: true, envOverlay: {} };
  const value = secretsBroker.loadSecret(task.withSecret);
  if (value === null) {
    return { ok: false, reason: `withSecret "${task.withSecret}" -- no secret found under that name in bus/secrets.local.json` };
  }
  return { ok: true, envOverlay: { [task.withSecret]: value } };
}

function runCodex(prompt, { envOverlay } = {}) {
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
    const execOptions = { cwd: VAULT_ROOT, encoding: 'utf8', input: prompt, shell: true, stdio: ['pipe', 'pipe', 'pipe'] };
    // envOverlay (the credential broker, Phase 3 piece 4): merged into
    // the subprocess's own env, never the prompt -- process.env must be
    // spread explicitly here because setting `env` at all replaces the
    // default full-inherit behavior execFileSync has when `env` is
    // omitted.
    if (envOverlay && Object.keys(envOverlay).length > 0) {
      execOptions.env = { ...process.env, ...envOverlay };
    }
    execFileSync(
      'codex',
      ['exec', '--ephemeral', '--sandbox', 'read-only', '--skip-git-repo-check', '--output-last-message', tmpFile],
      execOptions
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

  // Added 2026-09-02 for the credential/secrets broker (Phase 3 piece
  // 4). Resolved after dependencies, before building the prompt -- the
  // secret's VALUE never enters the prompt at all, only its NAME (via
  // task.withSecret, already logged below like any other field).
  const secretReq = resolveSecretRequirement(task);
  if (!secretReq.ok) {
    logEntry += `Secret resolution FAILED: ${secretReq.reason}\n`;
    logEntry += `Task NOT dispatched to Codex. status -> blocked.\n`;
    appendLog(logEntry);
    writeTaskResult(taskId, { status: 'blocked', reason: secretReq.reason });
    console.log(`BLOCKED: ${secretReq.reason}`);
    process.exit(0);
  }
  if (task.withSecret) logEntry += `withSecret: ${task.withSecret}\nSecret resolved OK -- injected into the subprocess env, never the prompt.\n`;

  // getMandatorySuffix('codex'), not the flat MANDATORY_SUFFIX -- found
  // 2026-09-02 as a real bug (not caught by the regression suite, which
  // only exercises this via engine.dispatch()/run-task-generic.js, never
  // this script's own main()): this direct Codex-only path was missed
  // when getMandatorySuffix() was introduced, so two live re-verification
  // tests of the Codex live-read fix both silently got the OLD suffix.
  const prompt = task.payload + injectedContext + getMandatorySuffix('codex');

  logEntry += `\nSent (exact):\n"""\n${prompt}\n"""\n`;
  logEntry += `Command: codex exec --ephemeral --sandbox read-only --skip-git-repo-check --output-last-message <file> "<prompt above>"\n`;

  const result = runCodex(prompt, { envOverlay: secretReq.envOverlay });

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
  resolveSecretRequirement,
  verifyOutput,
  runCodex,
  appendLog,
  taskFilePath,
  listPendingTaskIds,
  listTaskIdsByStatus,
  MANDATORY_SUFFIX,
  LIVE_FILE_READ_CAPABLE,
  WEB_SEARCH_CAPABLE,
  SOURCE_TAG_WEB_SEARCH,
  getMandatorySuffix,
  TASKS_DIR,
  extractPayload,
  pickResultFence,
  extractOutputField,
};
