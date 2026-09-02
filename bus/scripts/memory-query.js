#!/usr/bin/env node
// memory-query.js -- CLI for the durable fact store (memory-store.js,
// Phase 3 piece 3). Mirrors vault-search.js's usability: lets the user
// or the orchestrator inspect what's been remembered directly, not only
// through task dispatch.
//
// Usage:
//   node memory-query.js <key>            latest recorded fact for key
//   node memory-query.js <key> --history  full history for key, oldest first
//   node memory-query.js --list           every known key, count, most recent

const { getFact, getFactHistory, listKeys } = require('./memory-store.js');

function printEntry(entry) {
  console.log(`  ts:          ${entry.ts}`);
  console.log(`  sourceTaskId: ${entry.sourceTaskId}`);
  console.log(`  taskTo:      ${entry.taskTo}`);
  console.log(`  value:`);
  console.log(String(entry.value).split('\n').map((l) => '    ' + l).join('\n'));
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    const keys = listKeys();
    if (keys.length === 0) {
      console.log('(no facts recorded yet)');
      return;
    }
    for (const k of keys) {
      console.log(`${k.key}  (${k.count} recording${k.count === 1 ? '' : 's'}, latest ${k.latest.ts})`);
    }
    return;
  }

  const key = args.find((a) => !a.startsWith('--'));
  if (!key) {
    console.error('Usage: node memory-query.js <key> [--history]');
    console.error('       node memory-query.js --list');
    process.exit(1);
  }

  if (args.includes('--history')) {
    const history = getFactHistory(key);
    if (history.length === 0) {
      console.log(`(no recorded facts for key "${key}")`);
      return;
    }
    history.forEach((entry, i) => {
      console.log(`--- recording ${i + 1}/${history.length} ---`);
      printEntry(entry);
    });
    return;
  }

  const fact = getFact(key);
  if (!fact) {
    console.log(`(no recorded fact for key "${key}")`);
    return;
  }
  printEntry(fact);
}

if (require.main === module) {
  main();
}

module.exports = { main };
