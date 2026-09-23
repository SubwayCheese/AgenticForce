#!/usr/bin/env node
// ask-agents.js -- a command-line pathway between specialists (codex, antigravity, claude-agent), built on the
// existing task queue rather than beside it: it only writes task files; run-queue-daemon.js dispatches them
// through run-task-generic.js / agent-engine.js, with the usual dependency relay, SOURCE-tag verification and
// logging. A reviewer task depends on the answer task, so the reviewer receives the first agent's output.
//
// Usage:
//   node ask-agents.js --to antigravity [--review-by codex] [--wait] [--timeout-min 20] "question"
//   node ask-agents.js --to codex --review-by antigravity --wait "question"
// Prints the task ids; with --wait, polls until both tasks finish and prints their results.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { listAgentConfigs } = require('./agent-engine.js');
const { readTaskFile } = require('./run-task.js');

const RELAY_DIR = 'relay';
// Field names run-task.js treats as the end of a payload; a payload line starting with one would be misparsed.
const RESERVED_FIELD_RE = /^(timestamp|dependsOnTaskId|dependsOnTaskIds|expectedType|enrichWithSearch|recordFact|dependsOnFact|withSecret|source|status|to|from|type):/i;

function newRelayId(now = new Date()) {
  return `relay_${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${crypto.randomBytes(3).toString('hex')}`;
}

function safePayload(text) {
  return String(text).split('\n').map((l) => (RESERVED_FIELD_RE.test(l.trim()) ? ` ${l}` : l)).join('\n').trim();
}

function taskText(taskId, { to, payload, dependsOnTaskId, now }) {
  const lines = [`## ${taskId}`, 'from: ask-agents', `to: ${to}`, 'type: request', 'status: pending', `payload: ${safePayload(payload)}`, `timestamp: ${now.toISOString()}`];
  if (dependsOnTaskId) lines.push(`dependsOnTaskId: ${dependsOnTaskId}`);
  return lines.join('\n') + '\n';
}

function reviewPrompt(question, answerer) {
  return [
    `You are reviewing another AI agent's answer (${answerer}) to this question:`,
    `"${question}"`,
    'The answer is in the dependency output below. Check its claims against real sources you can read or search.',
    'List anything wrong, unsupported or missing, then end with one line: "Verdict: accurate | partly accurate | inaccurate".',
  ].join('\n');
}

// Writes the answer task (and the optional reviewer task) into tasks/relay/. Never overwrites.
function createRelay({ question, to, reviewBy, tasksDir = avPaths.TASKS, agents = listAgentConfigs(), now = new Date() }) {
  if (!question || !String(question).trim()) throw new Error('a question is required');
  for (const a of [to, reviewBy].filter(Boolean)) {
    if (a === 'claude') throw new Error('"claude" is reserved for orchestrator-sourced tasks and is never dispatched');
    if (!agents.includes(a)) throw new Error(`unknown agent "${a}" (known: ${agents.join(', ')})`);
  }
  if (!to) throw new Error('--to is required');
  const id = newRelayId(now);
  const askId = `${RELAY_DIR}/${id}_ask`;
  const reviewId = reviewBy ? `${RELAY_DIR}/${id}_review` : null;
  fs.mkdirSync(path.join(tasksDir, RELAY_DIR), { recursive: true });
  const write = (taskId, text) => {
    const p = path.join(tasksDir, `${taskId}.md`);
    fs.writeFileSync(p, text, { flag: 'wx' });
  };
  write(askId, taskText(askId, { to, payload: question, now }));
  if (reviewBy) write(reviewId, taskText(reviewId, { to: reviewBy, payload: reviewPrompt(question, to), dependsOnTaskId: askId, now }));
  return { askId, reviewId };
}

function resultOf(taskId, read = readTaskFile) {
  const t = read(taskId);
  if (!t) return { status: 'missing' };
  return { status: t.status, text: t.status === 'done' || t.status === 'error' ? extractResult(t) : null };
}

function extractResult(task) {
  const raw = task.raw || task.text || '';
  const i = raw.indexOf('## Result');
  return i >= 0 ? raw.slice(i) : (task.result || '');
}

async function waitFor(taskIds, { timeoutMs, pollMs = 5000, read = readTaskFile, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const states = taskIds.map((id) => ({ id, ...resultOf(id, read) }));
    if (states.every((s) => ['done', 'error'].includes(s.status))) return states;
    if (states.some((s) => s.status === 'error')) return states; // a failed answer means the reviewer will never run
    if (Date.now() > deadline) return states;
    await sleep(pollMs);
  }
}

module.exports = { createRelay, waitFor, resultOf, reviewPrompt, safePayload, newRelayId, RELAY_DIR };

if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
    const flags = new Set(['--to', '--review-by', '--timeout-min']);
    const question = argv.filter((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1])).join(' ');
    let relay;
    try {
      relay = createRelay({ question, to: opt('--to'), reviewBy: opt('--review-by') });
    } catch (err) {
      console.error(`ask-agents: ${err.message}\nusage: node ask-agents.js --to <agent> [--review-by <agent>] [--wait] "question"`);
      process.exit(2);
    }
    const ids = [relay.askId, relay.reviewId].filter(Boolean);
    console.log(`queued: ${ids.join(' -> ')} (run-queue-daemon.js dispatches them)`);
    if (!argv.includes('--wait')) return;
    const states = await waitFor(ids, { timeoutMs: Number(opt('--timeout-min') || 20) * 60000 });
    for (const s of states) console.log(`\n===== ${s.id} [${s.status}]\n${s.text || ''}`);
    if (states.some((s) => s.status !== 'done')) process.exit(1);
  })();
}
