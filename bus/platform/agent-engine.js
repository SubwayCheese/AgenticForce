#!/usr/bin/env node
// agent-engine.js -- the actual Phase 2 scaffold deliverable. Everything
// that varies per specialist agent (invocation command/args, Windows
// .cmd-wrapper-vs-real-exe quirks, how output is captured, sandbox/
// permission mode names) lives in a small JSON config under
// bus/platform/agents/<id>.json. Everything that doesn't vary (dependency
// resolution, the SOURCE-tag verification gate, task file format, audit
// logging) stays in run-task.js/run-verification-suite.js's shared
// exports and is untouched by this file.
//
// This exists because adding Codex (hand-built, the only agent for
// weeks) then Claude (hand-built again, 2026-09-01, ~150 near-duplicate
// lines) proved the *pattern* generalizes but did nothing to make adding
// a THIRD agent actually easier -- it would have meant writing a third
// near-duplicate file. This engine is that generalization made real:
// adding an agent now means writing a JSON config and verifying it
// dispatches correctly, not writing a new script.
//
// Deliberately does NOT replace run-task.js/run-task-claude.js/
// run-task-collab.js -- those stay as proven, working, hand-tested
// reference implementations that other scripts (run-backlog.js,
// run-research-crew.js, watch-inbox.js, run-verification-suite.js)
// already depend on. This is an additive second path, validated by
// dispatching the SAME agents through it and confirming identical
// results (see run-verification-suite.js's engine-parity checks).

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const AGENTS_DIR = avPaths.AGENTS_CONFIG;
const IGNORE_DIRS_FOR_DIFF = new Set(['.git', 'node_modules', '.obsidian', '.graph']);

function loadAgentConfig(agentId) {
  const p = path.join(AGENTS_DIR, `${agentId}.json`);
  if (!fs.existsSync(p)) {
    return null;
  }
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function listAgentConfigs() {
  if (!fs.existsSync(AGENTS_DIR)) return [];
  return fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

// Substitutes {outputFile} in an args array with a real temp file path.
// Kept as simple string substitution (not a template engine) -- the only
// placeholder any config has needed so far, and JSON configs should stay
// plain data, not gain templating logic of their own.
function buildArgs(modeArgs, substitutions) {
  return modeArgs.map((arg) => {
    let out = arg;
    for (const [key, value] of Object.entries(substitutions)) {
      out = out.split(`{${key}}`).join(value);
    }
    return out;
  });
}

// Dispatches a single prompt to the given agent config in the given mode
// ('readOnly' or 'write'). Returns { exitCode, output }. Does NOT do
// dependency resolution, verification, or logging -- callers (typically
// run-task-generic.js) own that, reusing run-task.js's shared exports.
function dispatch(agentConfig, prompt, { mode, cwd, envOverlay }) {
  const modeConfig = agentConfig.modes[mode];
  if (!modeConfig) {
    throw new Error(`Agent "${agentConfig.id}" has no "${mode}" mode defined in its config`);
  }
  // Found 2026-09-01 during a review pass: promptDelivery was validated
  // and documented as a real config field, but never actually read
  // anywhere below -- the prompt is always piped via stdin regardless of
  // what the config says. A future agent config setting
  // promptDelivery: "positional" (or anything but "stdin") would have
  // silently done nothing, and that agent might never receive its
  // prompt at all if its CLI doesn't read stdin. Asserting explicitly
  // rather than leaving the field decorative -- loud failure at config
  // time, not silent wrong behavior at dispatch time.
  // "stdin-stream-json" (added 2026-09-23 for Antigravity's `agy`): the CLI only accepts a prompt on stdin
  // wrapped as one NDJSON user message; a bare `-p` with piped text is rejected, and a prompt on argv would
  // hit the 128KB per-argument limit on long task payloads.
  if (!['stdin', 'stdin-stream-json'].includes(agentConfig.promptDelivery)) {
    throw new Error(`Agent "${agentConfig.id}" has promptDelivery: "${agentConfig.promptDelivery}" -- only "stdin" and "stdin-stream-json" are implemented in dispatch(). Passing the prompt any other way (e.g. as a positional arg) needs real code here, not just a config value.`);
  }
  const input = agentConfig.promptDelivery === 'stdin-stream-json'
    ? `${JSON.stringify({ event: 'user', message: { content: prompt } })}\n`
    : prompt;

  let outputFile = null;
  const substitutions = {};
  if (agentConfig.outputMethod === 'file') {
    outputFile = path.join(os.tmpdir(), `bus-agent-engine-${agentConfig.id}-${crypto.randomBytes(4).toString('hex')}.txt`);
    substitutions.outputFile = outputFile;
  }

  const args = buildArgs(modeConfig.args, substitutions);

  // isWindowsCmdWrapper mirrors the exact reasoning already proven in
  // run-task.js/run-task-collab.js: a .cmd-wrapped binary (codex.exe is
  // one) needs execFileSync's shell:true to resolve at all on Windows,
  // but shell:true does NOT escape array args -- verified directly, this
  // is what broke run-task-collab.js's first draft when an arg contained
  // a space. None of today's configs pass a space-containing arg, so this
  // is safe as written; a future agent config with such an arg would need
  // the same manual-quoting care documented in run-task-collab.js.
  const execOptions = {
    cwd,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  // isWindowsCmdWrapper is a static per-config flag (codex.json's .cmd
  // wrapper needs it on Windows) -- gated on the real platform too, so a
  // Linux/Pi run doesn't carry an unneeded shell layer for a Windows-only
  // resolution quirk (see bus/deploy/pi/).
  if (agentConfig.isWindowsCmdWrapper && process.platform === 'win32') {
    execOptions.shell = true;
  }
  // envOverlay (the credential broker, Phase 3 piece 4, added
  // 2026-09-02): merged into the subprocess's own env, never the
  // prompt -- see run-task.js's resolveSecretRequirement(). Setting
  // `env` at all replaces execFileSync's default full-inherit behavior,
  // so process.env must be spread explicitly here.
  if (envOverlay && Object.keys(envOverlay).length > 0) {
    execOptions.env = { ...process.env, ...envOverlay };
  }

  let exitCode = 0;
  let stdout = '';
  try {
    stdout = execFileSync(agentConfig.binary, args, execOptions);
  } catch (err) {
    exitCode = (err && err.status) || 1;
    stdout = (err && err.stdout) || '';
  }

  let output;
  let usage;
  if (agentConfig.outputMethod === 'file') {
    output = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8').trim() : '';
    try { fs.unlinkSync(outputFile); } catch (e) { /* best-effort cleanup */ }
  } else if (agentConfig.outputMethod === 'stream-json-result') {
    const parsed = parseStreamJsonResult(stdout);
    output = parsed.output;
    usage = parsed.usage;
    if (!parsed.ok && exitCode === 0) exitCode = 1;
  } else {
    output = String(stdout).trim();
  }

  return usage ? { exitCode, output, usage } : { exitCode, output };
}

// "stream-json-result": the answer is the LAST {"event":"result"} line of an NDJSON stream. An empty
// response counts as a failure even when the CLI reports SUCCESS -- found live 2026-09-23: when agy
// headless mode soft-denies a tool call (e.g. a write in read-only mode) it ends the turn with status
// SUCCESS and response "", which must not be recorded as a real (empty) answer.
function parseStreamJsonResult(stdout) {
  let result = null;
  const denied = [];
  for (const line of String(stdout).split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      const e = JSON.parse(line);
      if (e.event === 'result' && e.result) result = e.result;
      const info = e.step_update && e.step_update.tool_info;
      const msg = info && info.error && info.error.message;
      // Found live 2026-09-23: agy headless auto-denies a tool with no allow rule (here read_url on a docs site) and
      // ENDS THE TURN right there, returning only the text written so far as a SUCCESS response. That is a truncated
      // answer, not a real one -- so a denied tool makes the whole dispatch fail with a message saying what to allow.
      if (msg && /permission check failed|user denied permission/i.test(msg) && !denied.includes(msg)) denied.push(msg);
    } catch (_) { /* partial or non-JSON line */ }
  }
  if (!result) return { ok: false, output: '' };
  let output = String(result.response || '').trim();
  if (denied.length) {
    const what = denied.map((m) => (/(?:read_url|read_file|write_file|command)\S*\s+"?[^\s"]*"?/.exec(m) || [m.slice(0, 80)])[0]).join('; ');
    output = `[antigravity turn ended early: permission denied (${what}). Allow it in ~/.gemini/antigravity-cli/settings.json (permissions.allow) and retry. Partial text follows.]\n${output}`;
  }
  return { ok: result.status === 'SUCCESS' && output.length > 0 && !denied.length, output, usage: result.usage, status: result.status, error: result.error, denied };
}

// --- Write-mode auditing: reused from run-task-collab.js's proven
// approach (independent file-diff, not trusting the agent's own claim of
// what it changed). Generalized here to work for any agent config, not
// just Codex.
function snapshotVault(vaultRoot) {
  const snap = new Map();
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORE_DIRS_FOR_DIFF.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(vaultRoot, full);
        const stat = fs.statSync(full);
        snap.set(rel, { size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  }
  walk(vaultRoot);
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

// Convenience wrapper: dispatch in write mode with before/after diffing
// baked in, since every write-mode caller needs this and it's easy to
// forget (see run-verification-suite.js's history: the first draft of
// run-task-collab.js's suite integration forgot audit logging entirely).
function dispatchWrite(agentConfig, prompt, { cwd, envOverlay }) {
  const before = snapshotVault(cwd);
  const result = dispatch(agentConfig, prompt, { mode: 'write', cwd, envOverlay });
  const after = snapshotVault(cwd);
  const diff = diffSnapshots(before, after);
  return { ...result, diff };
}

module.exports = {
  parseStreamJsonResult,
  loadAgentConfig,
  listAgentConfigs,
  dispatch,
  dispatchWrite,
  snapshotVault,
  diffSnapshots,
  AGENTS_DIR,
};
