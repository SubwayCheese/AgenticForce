#!/usr/bin/env node
// prune-memory.js -- manual compaction for bus/memory.jsonl.
//
// memory-store.js is deliberately append-only (recordFact() never
// overwrites) so getFactHistory() can answer "what did this used to be."
// Nothing physically removes a superseded entry, so the file only ever
// grows (233 entries as of 2026-09-09, zero prior pruning). This script
// is the missing "actually shrink it" step -- run by hand, not scheduled,
// since deciding to compact history is a deliberate human action, not
// something that should happen silently in the background.
//
// What it does: backs up the full file (nothing is deleted, only moved),
// then rewrites bus/memory.jsonl to hold only the latest entry per key --
// reusing memory-store.js's own listKeys(), not re-parsing the file, so
// "latest" here means exactly what getFact() already means everywhere
// else in /bus/.

const fs = require('fs');
const path = require('path');
const { MEMORY_PATH, listKeys } = require('./memory-store.js');

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function main() {
  if (!fs.existsSync(MEMORY_PATH)) {
    console.log('No bus/memory.jsonl found -- nothing to prune.');
    return;
  }

  const before = fs.readFileSync(MEMORY_PATH, 'utf8').split('\n').filter((l) => l.trim()).length;
  const summary = listKeys(); // [{key, count, latest}], one row per distinct key

  const backupPath = path.join(path.dirname(MEMORY_PATH), `memory.jsonl.backup-${dateStamp()}`);
  if (fs.existsSync(backupPath)) {
    console.log(`Backup already exists at ${backupPath} -- refusing to overwrite. Run again tomorrow, or remove it manually if you really want to re-run today's prune.`);
    return;
  }
  fs.copyFileSync(MEMORY_PATH, backupPath);

  const compacted = summary
    .sort((a, b) => new Date(a.latest.ts) - new Date(b.latest.ts))
    .map((row) => JSON.stringify(row.latest))
    .join('\n') + '\n';
  fs.writeFileSync(MEMORY_PATH, compacted, 'utf8');

  console.log(`Pruned bus/memory.jsonl: ${before} lines -> ${summary.length} lines (${summary.length} distinct keys).`);
  console.log(`Full history preserved at ${backupPath}.`);
}

main();
