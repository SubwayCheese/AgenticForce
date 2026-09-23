#!/usr/bin/env node
// run-research-crew.js -- background research crew, SINGLE-CYCLE ONLY.
//
// Runs exactly one research cycle and exits. Deliberately NOT wired to a
// setInterval/Task Scheduler loop yet -- the user asked to confirm scope +
// thresholds before this runs continuously and unattended. Once
// confirmed, wrapping this in a scheduled loop (same pattern as
// agent-comms' supervisor.js, or a Windows Scheduled Task on an interval)
// is a small addition, not a rewrite.
//
// One cycle:
//   1. Check the pause condition FIRST: if the unverified_new queue in
//      /tasks/UNVERIFIED_Cl/ is already at or over the threshold, pause
//      (write state, send an immediate ntfy notification) and do nothing
//      else this cycle. A paused crew stays paused across cycles until a
//      human clears entries and someone resets state.
//   2. Otherwise, pick the next {ticker, category} from bus/research-scope.json
//      (round-robin via a cursor persisted in bus/research-crew-state.json).
//   3. Dispatch to Codex via run-task.js's real runCodex(), with the same
//      mandatory SOURCE-tag suffix as every other Codex task in this
//      protocol -- unverified_new does NOT relax that rule.
//   4. On success: write one entry file to /tasks/UNVERIFIED_Cl/, status
//      unverified_new, with source/topic/summary extracted from the real
//      response. On hard failure (codex exec itself broke): send an
//      immediate ntfy notification, log it, do NOT fabricate an entry.
//   5. Update digest counters; if the digest interval has elapsed, send a
//      summary ntfy notification and reset the counters.
//
// Usage: node run-research-crew.js

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runCodex, getMandatorySuffix } = require('./run-task.js');
const { sendNtfy } = require('./ntfy.js');

const VAULT_ROOT = avPaths.ROOT;
const BUS_DIR = path.join(VAULT_ROOT, 'bus');
const UNVERIFIED_DIR = path.join(VAULT_ROOT, 'tasks', 'UNVERIFIED_Cl');
const SCOPE_PATH = path.join(BUS_DIR, 'research-scope.json');
const STATE_PATH = path.join(BUS_DIR, 'research-crew-state.json');
const LOG_PATH = path.join(BUS_DIR, 'log.md');

// --- Configurable thresholds -- awaiting user confirmation before this
// script is wired to run unattended on a schedule (see file header). ---
const QUEUE_PAUSE_THRESHOLD = 50; // pause + notify if unverified_new count reaches this
const DIGEST_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function nowIso() {
  return new Date().toISOString();
}

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function appendLog(entry) {
  fs.appendFileSync(LOG_PATH, '\n' + entry.trimEnd() + '\n', 'utf8');
}

function countQueue() {
  if (!fs.existsSync(UNVERIFIED_DIR)) return 0;
  return fs.readdirSync(UNVERIFIED_DIR).filter((f) => f.endsWith('.md')).length;
}

function extractSourceLine(text) {
  const m = /^SOURCE:.*$/m.exec(text || '');
  return m ? m[0].trim() : '(no SOURCE line found -- see full output)';
}

function oneLineSummary(text) {
  const body = String(text || '')
    .split('\n')
    .filter((l) => l.trim() && !/^SOURCE:/.test(l.trim()) && !/^AS OF:|^As of:/.test(l.trim()))
    .join(' ')
    .trim();
  return body.length > 160 ? body.slice(0, 157) + '...' : body || '(empty)';
}

function main() {
  fs.mkdirSync(UNVERIFIED_DIR, { recursive: true });

  const state = loadJson(STATE_PATH, {
    cursor: 0,
    paused: false,
    pauseReason: null,
    lastDigestAt: nowIso(),
    digestSince: { count: 0, topics: [] },
  });

  const queueSize = countQueue();

  if (queueSize >= QUEUE_PAUSE_THRESHOLD && !state.paused) {
    state.paused = true;
    state.pauseReason = `unverified_new queue reached ${queueSize} (threshold ${QUEUE_PAUSE_THRESHOLD}) with none cleared`;
    saveJson(STATE_PATH, state);
    appendLog(`## research-crew PAUSED (${nowIso()})\n\nQueue size ${queueSize} >= threshold ${QUEUE_PAUSE_THRESHOLD}. Pausing until entries are cleared and state is reset.\n`);
    sendNtfy({
      topic: 'ClaudeTeam',
      title: 'Research crew PAUSED',
      message: `unverified_new queue hit ${queueSize} (threshold ${QUEUE_PAUSE_THRESHOLD}) with none cleared. Loop paused -- clear entries in tasks/UNVERIFIED_Cl and reset bus/research-crew-state.json to resume.`,
      priority: 'high',
      tags: 'warning',
    }).catch((e) => console.error('ntfy send failed:', e.message));
    console.log('PAUSED:', state.pauseReason);
    return;
  }

  if (state.paused) {
    console.log(`Crew is paused (${state.pauseReason}). Not running a cycle. Clear the queue and reset state to resume.`);
    return;
  }

  const scope = loadJson(SCOPE_PATH, null);
  if (!scope || !scope.watchlist || !scope.categories) {
    console.error(`No valid scope file at ${SCOPE_PATH}`);
    process.exit(1);
  }

  const totalItems = scope.watchlist.length * scope.categories.length;
  const idx = state.cursor % totalItems;
  const tickerIdx = Math.floor(idx / scope.categories.length);
  const categoryIdx = idx % scope.categories.length;
  const ticker = scope.watchlist[tickerIdx];
  const category = scope.categories[categoryIdx];

  const prompt = category.prompt.replace(/\{TICKER\}/g, ticker) + getMandatorySuffix('codex');

  console.log(`Cycle: ${ticker} / ${category.id}`);
  const result = runCodex(prompt);

  const entryId = `${new Date().toISOString().slice(0, 10)}_${ticker}_${category.id}_${crypto.randomBytes(3).toString('hex')}`;

  if (result.exitCode !== 0 || !result.output) {
    appendLog(`## research-crew: HARD FAILURE (${nowIso()})\n\nticker: ${ticker}\ncategory: ${category.id}\nSent: """\n${prompt}\n"""\nExit code: ${result.exitCode}\nOutput: """\n${result.output}\n"""\nNo entry written -- did not fabricate a result from a broken call.\n`);
    sendNtfy({
      topic: 'ClaudeTeam',
      title: 'Research crew: hard failure',
      message: `Codex invocation broke on ${ticker} / ${category.id} (exit ${result.exitCode}). No entry written. See bus/log.md.`,
      priority: 'high',
      tags: 'x',
    }).catch((e) => console.error('ntfy send failed:', e.message));
    state.cursor += 1; // move on rather than retry the same item forever
    saveJson(STATE_PATH, state);
    console.log('HARD FAILURE, notified, no entry written.');
    return;
  }

  const entryPath = path.join(UNVERIFIED_DIR, `${entryId}.md`);
  const source = extractSourceLine(result.output);
  const summary = oneLineSummary(result.output);
  const entryText = [
    `## ${entryId}`,
    `from: codex`,
    `to: research-crew`,
    `type: response`,
    `status: unverified_new`,
    `topic: ${ticker} / ${category.id}`,
    `timestamp: ${nowIso()}`,
    `source: ${source}`,
    `summary: ${summary}`,
    '',
    '## Result (auto)',
    'output:',
    '```',
    result.output,
    '```',
    '',
  ].join('\n');
  fs.writeFileSync(entryPath, entryText, 'utf8');

  appendLog(`## research-crew entry: ${entryId} (${nowIso()})\n\nticker: ${ticker}\ncategory: ${category.id}\nSent: """\n${prompt}\n"""\nReceived: """\n${result.output}\n"""\nWritten to tasks/UNVERIFIED_Cl/${entryId}.md, status unverified_new.\n`);

  state.cursor += 1;
  state.digestSince.count += 1;
  state.digestSince.topics.push(`${ticker}/${category.id}`);

  const msSinceDigest = Date.now() - new Date(state.lastDigestAt).getTime();
  if (msSinceDigest >= DIGEST_INTERVAL_MS && state.digestSince.count > 0) {
    const topicsStr = state.digestSince.topics.join(', ');
    sendNtfy({
      topic: 'ClaudeTeam',
      title: 'Research crew digest',
      message: `${state.digestSince.count} new unverified_new entries since last digest: ${topicsStr}. Queue size now ${countQueue()}.`,
      tags: 'clipboard',
    }).catch((e) => console.error('ntfy send failed:', e.message));
    state.lastDigestAt = nowIso();
    state.digestSince = { count: 0, topics: [] };
  }

  saveJson(STATE_PATH, state);
  console.log(`Entry written: ${entryId}`);
}

main();
