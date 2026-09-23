#!/usr/bin/env node
// vault-search.js -- Phase 3 groundwork: shared, queryable access to the
// vault's own knowledge for any script in /bus/, not just something a
// human browses in Obsidian. Thin wrapper around autograph's search.py
// (BM25 FTS5 + link-graph rerank, zero extra deps, degrades softly to a
// substring scan on failure -- verified live against the real vault
// before writing this wrapper, not assumed from its docstring).
//
// Why this belongs in /bus/ and not just "the vault has a search tool
// somewhere": task payloads today are built entirely by hand -- the
// orchestrator pastes in whatever context it remembers or re-reads. This
// gives any script (run-task-generic.js today; a future task-authoring
// helper) a way to pull real, ranked vault context programmatically
// before building a prompt, instead of relying on the orchestrator's own
// memory of what's in the vault.
//
// Usage:
//   node vault-search.js "<query>" [--limit N]        (CLI, prints JSON)
//   const { search } = require('./vault-search.js');
//   const hits = search('verification gate', { limit: 5 });  (programmatic)
//
// Deliberately read-only and side-effect-free -- this only queries, it
// never writes to the vault or to autograph's own .graph/ index.

const avPaths = require('../lib/paths.js');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const VAULT_ROOT = avPaths.ROOT;
const AUTOGRAPH_SEARCH_PY = path.join(
  os.homedir(),
  '.agents', 'skills', 'autograph', 'skills', 'autograph', 'scripts', 'search.py'
);

// Returns { count, engine, hits: [{ file, score, status, confidence, snippet }] }.
// On any failure (autograph not installed, uv not on PATH, etc.) returns
// { count: 0, engine: 'unavailable', hits: [], error: '<message>' } rather
// than throwing -- callers building a task prompt should treat search as
// an optional enrichment, never a hard dependency that can break dispatch.
function search(query, { limit = 5 } = {}) {
  try {
    const raw = execFileSync(
      'uv',
      ['run', AUTOGRAPH_SEARCH_PY, query, '--vault', VAULT_ROOT, '--json', '--limit', String(limit)],
      { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } }
    );
    return JSON.parse(raw);
  } catch (err) {
    return { count: 0, engine: 'unavailable', hits: [], error: String((err && err.message) || err) };
  }
}

function main() {
  const args = process.argv.slice(2);
  const limitFlagIdx = args.indexOf('--limit');
  const limit = limitFlagIdx !== -1 ? parseInt(args[limitFlagIdx + 1], 10) : 5;
  const query = args.filter((a, i) => a !== '--limit' && i !== limitFlagIdx + 1).join(' ');

  if (!query) {
    console.error('Usage: node vault-search.js "<query>" [--limit N]');
    process.exit(1);
  }

  const result = search(query, { limit });
  console.log(JSON.stringify(result, null, 2));
  if (result.engine === 'unavailable') process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = { search };
