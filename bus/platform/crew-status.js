#!/usr/bin/env node
// crew-status.js -- "what are they doing" on demand. Human-readable
// summary, not raw logs. Run: node bus/platform/crew-status.js

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const VAULT_ROOT = avPaths.ROOT;
const BUS_DIR = path.join(VAULT_ROOT, 'bus');
const UNVERIFIED_DIR = path.join(VAULT_ROOT, 'tasks', 'UNVERIFIED_Cl');
const STATE_PATH = path.join(BUS_DIR, 'research-crew-state.json');

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function readEntryMeta(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const field = (name) => {
    const m = new RegExp(`^${name}:[ \\t]*(.*)$`, 'm').exec(text);
    return m ? m[1].trim() : '';
  };
  return {
    topic: field('topic'),
    timestamp: field('timestamp'),
    summary: field('summary'),
    status: field('status'),
  };
}

function main() {
  const state = loadJson(STATE_PATH, null);

  console.log('=== Research crew status ===');
  if (!state) {
    console.log('Loop status: NOT YET RUN (no bus/research-crew-state.json)');
  } else {
    console.log(`Loop status: ${state.paused ? 'PAUSED -- ' + state.pauseReason : 'running (single-cycle mode; not yet scheduled continuously)'}`);
    console.log(`Cursor position: ${state.cursor}`);
    console.log(`Entries since last digest: ${state.digestSince ? state.digestSince.count : 0}`);
    console.log(`Last digest sent: ${state.lastDigestAt || '(never)'}`);
  }

  let entries = [];
  if (fs.existsSync(UNVERIFIED_DIR)) {
    entries = fs
      .readdirSync(UNVERIFIED_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const meta = readEntryMeta(path.join(UNVERIFIED_DIR, f));
        return { file: f, ...meta };
      });
  }
  const queueSize = entries.filter((e) => e.status === 'unverified_new').length;

  console.log(`\nunverified_new queue size: ${queueSize}`);

  entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  console.log('\nLast 5 entries added:');
  if (entries.length === 0) {
    console.log('  (none yet)');
  } else {
    entries.slice(0, 5).forEach((e) => {
      console.log(`  [${e.timestamp}] ${e.topic} -- ${e.summary}`);
    });
  }
}

main();
