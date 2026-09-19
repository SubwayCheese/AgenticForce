const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeSandbox } = require('./_sandbox.js');

test('glob matching: exact, single-segment star, and ** any-depth', () => {
  const sbx = makeSandbox();
  const g = sbx.load('survive-change-gate');
  const hits = (files, pats) => g.findProtectedHits(files, pats).map((h) => h.file);
  assert.deepEqual(hits(['bus/scripts/survive-executor.js', 'bus/scripts/other.js'], ['bus/scripts/survive-executor.js']), ['bus/scripts/survive-executor.js']);
  assert.deepEqual(hits(['bus/scripts/run-task-generic.js', 'bus/scripts/run-task.js', 'bus/scripts/run-tasks/x.js'], ['bus/scripts/run-task*.js']), ['bus/scripts/run-task-generic.js', 'bus/scripts/run-task.js']);
  assert.deepEqual(hits(['bus/tests/survive/a.test.js', 'bus/tests/x.js'], ['bus/tests/**']), ['bus/tests/survive/a.test.js', 'bus/tests/x.js']);
  assert.deepEqual(hits(['bus/secrets.local.json', 'bus/secrets.local.json.example', 'x/secrets.local.json'], ['**/secrets.local.json*']), ['bus/secrets.local.json', 'bus/secrets.local.json.example', 'x/secrets.local.json']);
  assert.deepEqual(hits(['bus/scripts/survive-shadow-score.js', 'bus/scripts/survive-shadow.js'], ['bus/scripts/survive-shadow*.js']).length, 2);
  sbx.cleanup();
});

function makeRepo(sbx) {
  const dir = sbx.file('repo');
  fs.mkdirSync(path.join(dir, 'bus', 'scripts'), { recursive: true });
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
  fs.writeFileSync(path.join(dir, 'bus', 'protected-paths.json'), JSON.stringify({ patterns: ['bus/scripts/survive-executor.js', 'bus/protected-paths.json'] }));
  fs.writeFileSync(path.join(dir, 'bus', 'scripts', 'survive-executor.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(dir, 'bus', 'scripts', 'helper.js'), 'module.exports = 1;\n');
  git('add', '-A'); git('commit', '-q', '-m', 'base'); git('branch', '-M', 'base');
  const branch = (name, edits) => {
    git('checkout', '-q', '-b', name, 'base');
    for (const [f, c] of Object.entries(edits)) fs.writeFileSync(path.join(dir, f), c);
    git('add', '-A'); git('commit', '-q', '-m', name);
    git('checkout', '-q', 'base');
  };
  return { dir, branch };
}

test('gate: protected touch -> exit 3 without running tests; syntax error -> 1; clean -> 0 via a real worktree', () => {
  const sbx = makeSandbox();
  const g = sbx.load('survive-change-gate');
  const { dir, branch } = makeRepo(sbx);
  let ranTests = 0;
  const runTestsFn = (wt) => { ranTests++; return { ok: fs.readFileSync(path.join(wt, 'bus/scripts/helper.js'), 'utf8').includes('CANDIDATE'), pass: 1, fail: 0 }; };

  branch('touch-protected', { 'bus/scripts/survive-executor.js': 'module.exports = 2;\n' });
  let r = g.runGate({ repo: dir, base: 'base', candidate: 'touch-protected', runTestsFn });
  assert.equal(r.exitCode, 3);
  assert.equal(r.verdict, 'human-review-required');
  assert.equal(ranTests, 0);

  branch('weaken-list', { 'bus/protected-paths.json': JSON.stringify({ patterns: [] }) });
  r = g.runGate({ repo: dir, base: 'base', candidate: 'weaken-list', runTestsFn });
  assert.equal(r.exitCode, 3, 'a candidate cannot weaken its own protection list');

  branch('bad-syntax', { 'bus/scripts/helper.js': 'module.exports = {;\n' });
  r = g.runGate({ repo: dir, base: 'base', candidate: 'bad-syntax', runTestsFn });
  assert.equal(r.exitCode, 1);
  assert.equal(r.verdict, 'syntax-error');
  assert.equal(ranTests, 0);

  branch('clean', { 'bus/scripts/helper.js': '// CANDIDATE\nmodule.exports = 3;\n' });
  r = g.runGate({ repo: dir, base: 'base', candidate: 'clean', runTestsFn });
  assert.equal(r.exitCode, 0, JSON.stringify(r));
  assert.equal(ranTests, 1, 'tests ran inside the candidate worktree (proves the diff/worktree is not blind)');

  branch('clean-but-red', { 'bus/scripts/helper.js': 'module.exports = 4;\n' });
  r = g.runGate({ repo: dir, base: 'base', candidate: 'clean-but-red', runTestsFn });
  assert.equal(r.exitCode, 1);
  assert.equal(r.verdict, 'tests-failed');
  assert.equal(execFileSync('git', ['-C', dir, 'worktree', 'list'], { encoding: 'utf8' }).trim().split('\n').length, 1, 'temporary worktrees are cleaned up');
  sbx.cleanup();
});
