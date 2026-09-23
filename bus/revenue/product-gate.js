// product-gate.js -- Round 20. The gate a built product must pass before it
// can be released. Pure code, no LLM, and it never trusts the builder's own
// claims: the agent writes the product AND its own tests, so an
// orchestrator-owned ACCEPTANCE run (cases from the spec, executed here in an
// offline network namespace) is the check that counts.
//   1. secrets scan (patterns + literal values from the secrets file)
//   2. manifest: package.json, LICENSE, README, exact-pinned allowlisted deps,
//      no install-time scripts
//   3. policy: no child_process/eval/new Function, and every URL host literal
//      must be in the spec's allowedHosts (no exfil, no scraping unlisted sites)
//   4. the product's own tests, offline
//   5. acceptance cases from the spec, offline
// Offline = `unshare -rn` (verified available on this Pi). If it is not
// available the gate FAILS CLOSED.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const VAULT_ROOT = avPaths.ROOT;
const SECRET_PATTERNS = [
  ['stripe-key', /\b[sr]k_(live|test)_[A-Za-z0-9]{10,}/],
  ['stripe-webhook', /\bwhsec_[A-Za-z0-9]{10,}/],
  ['aws-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['alpaca-key', /\b(PK|AK)[A-Z0-9]{18}\b/],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['agentmail-key', /\bam_us_[A-Za-z0-9_]{10,}/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['slack-token', /\bxox[bp]-[A-Za-z0-9-]{10,}/],
];
const BANNED_CODE = [
  ['child_process', /require\(\s*['"](node:)?child_process['"]\s*\)|from\s+['"](node:)?child_process['"]/],
  ['eval', /\beval\s*\(/],
  ['new-Function', /\bnew\s+Function\s*\(/],
];
const INSTALL_HOOKS = ['preinstall', 'install', 'postinstall', 'prepare'];
const SKIP_DIRS = new Set(['node_modules', '.git']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.isFile()) out.push(p);
  }
  return out;
}

function loadSecretLiterals(secretsPath = path.join(VAULT_ROOT, 'bus', 'secrets.local.json')) {
  try {
    return Object.values(JSON.parse(fs.readFileSync(secretsPath, 'utf8'))).filter((v) => typeof v === 'string' && v.length >= 8 && !/^https?:/.test(v));
  } catch (_) { return []; }
}

function scanSecrets(dir, literals = loadSecretLiterals()) {
  const hits = [];
  for (const f of walk(dir)) {
    let text; try { text = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    for (const [name, re] of SECRET_PATTERNS) if (re.test(text)) hits.push({ file: path.relative(dir, f), kind: name });
    for (const lit of literals) if (text.includes(lit)) hits.push({ file: path.relative(dir, f), kind: 'secret-literal' });
  }
  return hits;
}

function checkManifest(dir, { allowedDeps = [], maxDeps = 8 } = {}) {
  const errs = [];
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch (_) { return ['package.json missing or invalid']; }
  for (const f of ['LICENSE', 'README.md']) if (!fs.existsSync(path.join(dir, f))) errs.push(`${f} missing`);
  for (const h of INSTALL_HOOKS) if (pkg.scripts && pkg.scripts[h]) errs.push(`install-time script "${h}" is not allowed`);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (Object.keys(deps).length > maxDeps) errs.push(`too many dependencies (${Object.keys(deps).length} > ${maxDeps})`);
  for (const [name, ver] of Object.entries(deps)) {
    if (!allowedDeps.includes(name)) errs.push(`dependency "${name}" is not in the allowlist`);
    if (!/^\d+\.\d+\.\d+$/.test(ver)) errs.push(`dependency "${name}" must be exact-pinned (got "${ver}")`);
  }
  return errs;
}

function checkPolicy(dir, { allowedHosts = [] } = {}) {
  const errs = [];
  const srcFiles = walk(dir).filter((f) => /\.(m?js|cjs|ts)$/.test(f) && !/[\\/]tests?[\\/]/.test(f));
  for (const f of srcFiles) {
    const text = fs.readFileSync(f, 'utf8'); const rel = path.relative(dir, f);
    for (const [name, re] of BANNED_CODE) if (re.test(text)) errs.push(`${rel}: banned construct ${name}`);
    for (const m of text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
      const host = m[1].toLowerCase();
      if (!allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) errs.push(`${rel}: host "${host}" is not in allowedHosts`);
    }
  }
  return [...new Set(errs)];
}

function sandboxAvailable() { return spawnSync('unshare', ['-rn', 'true']).status === 0; }

function offline(cmd, args, opts = {}) {
  return spawnSync('unshare', ['-rn', cmd, ...args], { encoding: 'utf8', timeout: opts.timeoutMs || 120000, cwd: opts.cwd, env: { PATH: process.env.PATH, HOME: os.tmpdir() } });
}

function runOwnTests(dir) {
  const td = path.join(dir, 'tests');
  const files = fs.existsSync(td) ? fs.readdirSync(td).filter((f) => /\.(m?js|cjs)$/.test(f)).map((f) => path.join(td, f)) : [];
  if (!files.length) return { ok: false, detail: 'no tests found in tests/' };
  const r = offline(process.execPath, ['--test', ...files], { cwd: dir });
  return { ok: r.status === 0, detail: r.status === 0 ? 'pass' : `${(r.stdout || '').split('\n').filter((l) => /^not ok|Error/.test(l)).slice(0, 5).join(' | ') || r.stderr || 'failed'}` };
}

// Subset match: expected objects are subsets, arrays compare length + elementwise.
function partialMatch(exp, act, p = '$') {
  if (exp !== null && typeof exp === 'object') {
    if (act === null || typeof act !== 'object') return `${p}: expected object, got ${act}`;
    if (Array.isArray(exp)) {
      if (!Array.isArray(act) || act.length !== exp.length) return `${p}: expected array of ${exp.length}, got ${Array.isArray(act) ? act.length : typeof act}`;
      for (let i = 0; i < exp.length; i++) { const e = partialMatch(exp[i], act[i], `${p}[${i}]`); if (e) return e; }
      return null;
    }
    for (const k of Object.keys(exp)) { const e = partialMatch(exp[k], act[k], `${p}.${k}`); if (e) return e; }
    return null;
  }
  if (typeof exp === 'number' && typeof act === 'number') return Math.abs(exp - act) < 1e-9 ? null : `${p}: expected ${exp}, got ${act}`;
  return exp === act ? null : `${p}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`;
}

const ACCEPTANCE_RUNNER = `
const path = require('path');
const { dir, entry, cases } = JSON.parse(process.argv[2]);
const partial = ${partialMatch.toString()};
const core = require(path.join(dir, 'src', 'core.js'));
const failures = [];
for (const c of cases) {
  try {
    const fn = core[c.entry || entry];
    const out = c.spread ? fn(...c.input) : fn(c.input);
    const e = partial(c.expect, out);
    if (e) failures.push(c.name + ': ' + e);
  } catch (err) { failures.push(c.name + ': threw ' + err.message); }
}
console.log(JSON.stringify({ failures }));
`;

function runAcceptance(dir, spec) {
  const runner = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'accept-')), 'run.js');
  fs.writeFileSync(runner, ACCEPTANCE_RUNNER);
  const r = offline(process.execPath, [runner, JSON.stringify({ dir, entry: spec.entry, cases: spec.acceptance })], { cwd: dir });
  try { const { failures } = JSON.parse((r.stdout || '').trim().split('\n').pop()); return { ok: !failures.length, failures }; }
  catch (_) { return { ok: false, failures: [`acceptance runner crashed: ${(r.stderr || r.stdout || '').slice(0, 300)}`] }; }
}

function runGate(dir, spec, { literals } = {}) {
  const failures = [];
  const checks = {};
  if (!sandboxAvailable()) return { ok: false, failures: ['offline sandbox (unshare -rn) unavailable -- failing closed'], checks };
  const secrets = scanSecrets(dir, literals); checks.secrets = secrets;
  for (const s of secrets) failures.push(`secret-shaped content in ${s.file} (${s.kind})`);
  const manifest = checkManifest(dir, { allowedDeps: spec.allowedDeps || [] }); checks.manifest = manifest;
  failures.push(...manifest);
  const policy = checkPolicy(dir, { allowedHosts: spec.allowedHosts || [] }); checks.policy = policy;
  failures.push(...policy);
  const own = runOwnTests(dir); checks.ownTests = own;
  if (!own.ok) failures.push(`own tests: ${own.detail}`);
  const acc = runAcceptance(dir, spec); checks.acceptance = acc;
  for (const f of acc.failures) failures.push(`acceptance: ${f}`);
  return { ok: failures.length === 0, failures, checks };
}

module.exports = { runGate, scanSecrets, checkManifest, checkPolicy, runAcceptance, runOwnTests, partialMatch, sandboxAvailable, loadSecretLiterals };
