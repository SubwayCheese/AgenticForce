#!/usr/bin/env node
// watch-inbox.js -- persistent, instant-reaction replacement for
// check-inbox.js's poll-and-alert-only design.
//
// Two behavior changes from check-inbox.js, both requested directly:
//   1. Reacts to new content in bus/inbox_claude.md via fs.watch, not a
//      fixed polling interval -- there is no "wait up to N minutes"
//      anymore, a file save triggers a reaction within ~a few hundred ms
//      (a short debounce to avoid double-firing on one save).
//   2. Actually ANSWERS new content via Codex and pushes the real answer
//      text over ntfy immediately, instead of only alerting "something
//      needs review."
//
// Why this is still safe, not a reversal of the earlier restriction: the
// concern with check-inbox.js was a script EXECUTING arbitrary found
// instructions unsupervised (real file/shell actions -- the same failure
// mode as the claude-adapter.js --restricted incident earlier this
// session). Answering in TEXT is different in kind, not degree: every
// Codex call in this file goes through run-task.js's runCodex(), which
// always runs `codex exec --sandbox read-only` -- the same sandboxing
// used everywhere else in /bus/. Codex is structurally unable to take a
// real action from this invocation regardless of what it's asked, so it
// can only ever produce a text answer, including for a request that reads
// like an instruction ("delete X", "run Y") -- the prompt explicitly
// tells it to say so rather than pretend to comply.
//
// A separate, reduced-frequency heartbeat (default 5 min, not tied to
// file changes) still fires so liveness stays visible even when nothing
// new has come in -- skipped if a real answer was just sent, to avoid
// double-notifying right after genuine activity.
//
// Usage: node watch-inbox.js  (long-lived; runs until killed)

const fs = require('fs');
const path = require('path');
const { runCodex, getMandatorySuffix } = require('./run-task.js');
const { sendNtfy } = require('./ntfy.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const BUS_DIR = path.join(VAULT_ROOT, 'bus');
const INBOX_PATH = path.join(BUS_DIR, 'inbox_claude.md');
const LOG_PATH = path.join(BUS_DIR, 'log.md');

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const DEBOUNCE_MS = 600;

function nowIso() {
  return new Date().toISOString();
}

function appendLog(entry) {
  fs.appendFileSync(LOG_PATH, '\n' + entry.trimEnd() + '\n', 'utf8');
}

let lastSeenText = fs.existsSync(INBOX_PATH) ? fs.readFileSync(INBOX_PATH, 'utf8') : '';
let lastActivityAt = 0;
let debounceTimer = null;

function handleChange() {
  const text = fs.existsSync(INBOX_PATH) ? fs.readFileSync(INBOX_PATH, 'utf8') : '';
  if (text === lastSeenText) return; // save with no real content change

  const added = text.length > lastSeenText.length && text.startsWith(lastSeenText)
    ? text.slice(lastSeenText.length).trim()
    : text.trim(); // if it wasn't a clean append, just answer on the whole current content

  lastSeenText = text;
  lastActivityAt = Date.now();

  if (!added) return;

  console.log(`[${nowIso()}] New inbox content, dispatching to Codex...`);
  const prompt = [
    'You are answering a direct question/instruction from the user, delivered via a shared inbox file. Give a genuinely helpful, direct answer.',
    'You have NO ability to execute file changes, run commands, or take any real action from this invocation -- if the request asks you to DO something rather than answer a question, say plainly that this channel only returns text answers and a real action needs a live Claude Code session, then still answer whatever you can in text.',
    '',
    'New inbox content:',
    added,
  ].join('\n') + getMandatorySuffix('codex');

  const result = runCodex(prompt);

  if (result.exitCode !== 0 || !result.output) {
    appendLog(`## watch-inbox: HARD FAILURE (${nowIso()})\n\nInbox content: """\n${added}\n"""\nExit code: ${result.exitCode}\nNo answer produced.\n`);
    sendNtfy({
      topic: 'ClaudeTeam',
      title: 'Inbox watcher: hard failure',
      message: `Codex invocation broke answering new inbox content (exit ${result.exitCode}). See bus/log.md.`,
      priority: 'high',
      tags: 'x',
    }).catch((e) => console.error('ntfy send failed:', e.message));
    return;
  }

  appendLog(`## watch-inbox: answered (${nowIso()})\n\nInbox content: """\n${added}\n"""\nAnswer: """\n${result.output}\n"""\n`);

  sendNtfy({
    topic: 'ClaudeTeam',
    title: 'Inbox: answered',
    message: result.output.slice(0, 500),
  }).catch((e) => console.error('ntfy send failed:', e.message));

  console.log(`[${nowIso()}] Answered and notified.`);
}

fs.watch(INBOX_PATH, { persistent: true }, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(handleChange, DEBOUNCE_MS);
});

console.log(`[${nowIso()}] Watching ${INBOX_PATH} for changes (instant reaction, no polling delay).`);

setInterval(() => {
  const sinceActivity = Date.now() - lastActivityAt;
  if (sinceActivity < HEARTBEAT_INTERVAL_MS) return; // real activity just happened, skip this beat
  sendNtfy({
    topic: 'ClaudeTeam',
    title: 'Inbox watcher heartbeat',
    message: `Still watching bus/inbox_claude.md at ${nowIso()}, nothing new since last check.`,
    tags: 'mag',
  }).catch((e) => console.error('ntfy send failed:', e.message));
}, HEARTBEAT_INTERVAL_MS);
