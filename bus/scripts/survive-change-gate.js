// survive-change-gate.js -- Round 19. Pure code, no LLM. The only allowed
// path for an automated change (a later improver agent, or a human using
// the same checks) to reach the live survive/city code:
//
//   1. PROTECTED PATHS -- any touched file matching bus/protected-paths.json
//      (read from the BASE ref, so a candidate can't weaken its own guard)
//      => verdict "human-review-required", exit 3. Nothing else is run.
//   2. node --check on every touched .js in a temporary worktree of the
//      CANDIDATE ref (never the live tree, which has running writers).
//   3. The credit-free survive test suite, run inside that worktree.
//
// Usage: node survive-change-gate.js --base <ref> --candidate <ref> [--repo <dir>]
// Exit: 0 pass | 1 fail (syntax/tests) | 2 usage/error | 3 protected paths hit.

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
    else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function findProtectedHits(files, patterns) {
  const regexes = patterns.map((p) => ({ p, re: globToRegex(p) }));
  const hits = [];
  for (const f of files) {
    const m = regexes.find((r) => r.re.test(f));
    if (m) hits.push({ file: f, pattern: m.p });
  }
  return hits;
}

function git(repo, args) { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }

function loadPatterns(repo, base) {
  let text;
  try { text = git(repo, ['show', `${base}:bus/protected-paths.json`]); }
  catch (_) { text = fs.readFileSync(path.join(REPO_ROOT, 'bus', 'protected-paths.json'), 'utf8'); }
  return JSON.parse(text).patterns;
}

function changedFiles(repo, base, candidate) {
  // --no-renames: a rename must show as delete+add so both sides are checked.
  return git(repo, ['diff', '--name-only', '--no-renames', base, candidate]).split('\n').filter(Boolean);
}

function checkSyntax(dir, files) {
  const errors = [];
  for (const f of files.filter((x) => x.endsWith('.js'))) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue; // deleted in candidate
    const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
    if (r.status !== 0) errors.push({ file: f, error: (r.stderr || '').split('\n').find((l) => /Error/.test(l)) || 'syntax error' });
  }
  return errors;
}

function defaultRunTests(dir) {
  return require('./run-survive-tests.js').runSurviveTests({ root: dir });
}

function runGate({ repo = REPO_ROOT, base, candidate, runTestsFn = defaultRunTests }) {
  if (!base || !candidate) return { ok: false, exitCode: 2, verdict: 'usage', error: 'need --base and --candidate refs' };
  const files = changedFiles(repo, base, candidate);
  if (!files.length) return { ok: true, exitCode: 0, verdict: 'no-changes', files: [] };
  const protectedHits = findProtectedHits(files, loadPatterns(repo, base));
  if (protectedHits.length) return { ok: false, exitCode: 3, verdict: 'human-review-required', files, protectedHits };
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'survive-gate-'));
  try {
    git(repo, ['worktree', 'add', '--detach', wt, candidate]);
    const syntaxErrors = checkSyntax(wt, files);
    if (syntaxErrors.length) return { ok: false, exitCode: 1, verdict: 'syntax-error', files, protectedHits: [], syntaxErrors };
    const testResult = runTestsFn(wt);
    return { ok: !!testResult.ok, exitCode: testResult.ok ? 0 : 1, verdict: testResult.ok ? 'pass' : 'tests-failed', files, protectedHits: [], syntaxErrors: [], testResult };
  } finally {
    try { git(repo, ['worktree', 'remove', '--force', wt]); } catch (_) { try { fs.rmSync(wt, { recursive: true, force: true }); } catch (__) {} }
  }
}

module.exports = { runGate, findProtectedHits, globToRegex, checkSyntax, changedFiles };

if (require.main === module) {
  const a = process.argv.slice(2);
  const arg = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  let res;
  try { res = runGate({ repo: arg('--repo') ? path.resolve(arg('--repo')) : REPO_ROOT, base: arg('--base'), candidate: arg('--candidate') }); }
  catch (err) { res = { ok: false, exitCode: 2, verdict: 'error', error: err.message }; }
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.exitCode);
}
