#!/usr/bin/env node
// check-inbox.js -- message-reading agent, SINGLE-CHECK ONLY (see
// run-research-crew.js header for why continuous scheduling isn't wired
// yet).
//
// Checks bus/inbox_claude.md (the inbox file already established at the
// start of this /bus/ protocol) for content added since the last check.
//
// DELIBERATE SCOPE LIMIT: this script detects new content and notifies --
// it does NOT interpret or act on whatever it finds. A plain Node script
// can't safely judge what an arbitrary instruction means or whether it's
// safe to execute; earlier this session, giving a coding agent
// unsupervised execution on a vague prompt caused a real incident
// (agents/claude-adapter.js missing --restricted). New inbox content
// always surfaces as "needs a human/Claude session to review," never as
// something this script executes on its own.
//
// Usage: node check-inbox.js

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sendNtfy } = require('./ntfy.js');

const VAULT_ROOT = avPaths.ROOT;
const BUS_DIR = path.join(VAULT_ROOT, 'bus');
const INBOX_PATH = path.join(BUS_DIR, 'inbox_claude.md');
const STATE_PATH = path.join(BUS_DIR, 'inbox-check-state.json');

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

function main() {
  if (!fs.existsSync(INBOX_PATH)) {
    console.error(`No inbox file at ${INBOX_PATH}`);
    process.exit(1);
  }
  const text = fs.readFileSync(INBOX_PATH, 'utf8');
  const hash = crypto.createHash('sha256').update(text).digest('hex');

  const state = loadJson(STATE_PATH, { lastHash: null, lastCheckedAt: null });
  const isNew = state.lastHash !== hash;

  if (isNew) {
    const excerpt = text.trim().slice(-400);
    sendNtfy({
      topic: 'ClaudeTeam',
      title: 'Inbox: new content found',
      message: `bus/inbox_claude.md changed since last check. Needs a real session to review and act -- this script does not execute instructions on its own. Tail: ${excerpt.slice(-200)}`,
      tags: 'envelope',
    }).catch((e) => console.error('ntfy send failed:', e.message));
    console.log('New content found, notified, NOT auto-executed.');
  } else {
    sendNtfy({
      topic: 'ClaudeTeam',
      title: 'Inbox check',
      message: `Checked inbox_claude.md at ${nowIso()}, nothing new since last check.`,
      tags: 'mag',
    }).catch((e) => console.error('ntfy send failed:', e.message));
    console.log('Checked inbox, nothing actionable found, notified.');
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify({ lastHash: hash, lastCheckedAt: nowIso() }, null, 2), 'utf8');
}

main();
