// Architecture test: the structure documented in docs/SYSTEM-MAP.md is checked, not trusted.
// Reads the REAL repo (read-only). Fails when: a script is unregistered or in the wrong domain directory; a module imports across a
// forbidden domain boundary; live code depends on legacy code; bus/scripts holds anything but allowlisted, resolvable compat
// symlinks (or real code requires through them); a protected path no longer exists; a script derives its own root; the generated
// system map or bus/lib/locations.json is stale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const BUS = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(BUS, '..');
const { scan, render, locations } = require(path.join(BUS, 'platform', 'build-system-map.js'));
const S = scan();
const registry = S.reg;

test('every script is registered once, lives in the directory of its domain, and has a valid domain and status', () => {
  const onDisk = [];
  for (const d of Object.keys(registry.domains)) for (const e of fs.readdirSync(path.join(BUS, d), { withFileTypes: true })) if (e.isFile() && e.name.endsWith('.js')) onDisk.push({ name: e.name, domain: d });
  assert.deepEqual(onDisk.filter((f) => !registry.components[f.name]).map((f) => `${f.domain}/${f.name}`), [], 'scripts missing from bus/components.json');
  assert.deepEqual(onDisk.filter((f) => registry.components[f.name] && registry.components[f.name].domain !== f.domain).map((f) => `${f.name} is in ${f.domain}/ but registered as ${registry.components[f.name].domain}`), []);
  assert.deepEqual(S.files.filter((f) => !fs.existsSync(S.abs[f])), [], 'registry entries with no file at bus/<domain>/<name>');
  for (const [f, c] of Object.entries(registry.components)) { assert.ok(registry.domains[c.domain], `${f}: unknown domain ${c.domain}`); assert.ok(registry.statuses[c.status], `${f}: unknown status ${c.status}`); }
});

test('modules only import across domains that are allowed (plus explicit, documented exceptions)', () => {
  const dom = (f) => registry.components[f].domain;
  const bad = S.edges.filter(([f, t]) => !registry.allowedDependencies[dom(f)].includes(dom(t)) && !registry.allowedExceptions.some(([x, y]) => x === f && y === t)).map(([f, t]) => `${f} (${dom(f)}) -> ${t} (${dom(t)})`);
  assert.deepEqual(bad, [], 'forbidden cross-domain imports');
  for (const [f, t] of registry.allowedExceptions) assert.ok(S.edges.some(([x, y]) => x === f && y === t), `stale exception ${f} -> ${t} (remove it)`);
});

test('live/paused/manual/library code never depends on legacy files', () => {
  assert.deepEqual(S.edges.filter(([f, t]) => registry.components[t].status === 'legacy' && registry.components[f].status !== 'legacy').map(([f, t]) => `${f} -> ${t}`), []);
});

test('bus/scripts holds only allowlisted compat symlinks that resolve, and no real code requires through it', () => {
  const dir = path.join(BUS, 'scripts');
  const allow = Object.keys(registry.compatSymlinks).filter((k) => k !== '_doc');
  const problems = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (!e.isSymbolicLink()) { problems.push(`${e.name} is not a symlink (real files belong in bus/<domain>/)`); continue; }
    if (!allow.includes(e.name)) problems.push(`${e.name} is a symlink but not in compatSymlinks`);
    let real; try { real = fs.realpathSync(p); } catch (_) { problems.push(`${e.name} is a dangling symlink`); continue; }
    if (!real.startsWith(BUS + path.sep) || real.startsWith(dir + path.sep)) problems.push(`${e.name} resolves to ${real}`);
    const want = registry.components[e.name] ? S.abs[e.name] : null;
    if (want && real !== want) problems.push(`${e.name} points to ${real}, expected ${want}`);
  }
  assert.deepEqual(problems, []);
  assert.deepEqual(S.viaScripts, [], 'real code must require the real file, not bus/scripts/ compat links');
});

test('protected-paths.json literal entries still point at real files or at their moved location', () => {
  const { patterns } = JSON.parse(fs.readFileSync(path.join(BUS, 'protected-paths.json'), 'utf8'));
  const has = (p) => fs.existsSync(path.join(REPO, p));
  const missing = patterns.filter((p) => !/[*]/.test(p) && !p.startsWith('**')).filter((p) => !has(p) && !/secrets\.local|^\.github|^package/.test(p)).filter((p) => {
    const m = /^bus\/scripts\/([\w.-]+)$/.exec(p);
    if (m && registry.components[m[1]] && patterns.includes(`bus/${registry.components[m[1]].domain}/${m[1]}`)) return false;
    const mech = /^bus\/scripts\/mechanisms\/([\w.-]+)$/.exec(p);   // plugin dir moved to bus/city/mechanisms
    return !(mech && patterns.includes(`bus/city/mechanisms/${mech[1]}`));
  });
  assert.deepEqual(missing, [], 'protected path no longer exists and has no protected replacement: update protected-paths.json with the move');
  for (const f of ['run-task.js', 'survive-executor.js', 'survive-budget-envelope.js', 'secrets-broker.js']) assert.ok(patterns.some((p) => new RegExp(`^bus/${registry.components[f].domain}/`).test(p) && (p.includes(f) || p.includes('*'))), `${f} lost its protection at the new location`);
});

test('domain rules match the documented layering (platform imports only platform)', () => {
  assert.deepEqual(registry.allowedDependencies.platform, ['platform']);
  for (const d of ['fleet', 'city', 'swarm', 'revenue', 'org']) assert.ok(!registry.allowedDependencies[d].some((x) => !['platform', d].includes(x)), `${d} may only import itself and platform`);
});

test('docs/SYSTEM-MAP.md and bus/lib/locations.json are up to date (regenerate with build-system-map.js --write)', () => {
  assert.equal(fs.readFileSync(path.join(REPO, 'docs', 'SYSTEM-MAP.md'), 'utf8'), render() + '\n', 'docs/SYSTEM-MAP.md is stale');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(BUS, 'lib', 'locations.json'), 'utf8')), locations(registry), 'bus/lib/locations.json is stale');
});

test('no script derives its own repo root; everything goes through bus/lib/paths.js', () => {
  const dirs = [...Object.keys(registry.domains).map((d) => path.join(BUS, d)), path.join(BUS, 'city', 'mechanisms')];
  const offenders = [];
  for (const d of dirs) for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.js'))) {
    fs.readFileSync(path.join(d, f), 'utf8').split('\n').forEach((l, i) => { if (/(__dirname|SCRIPTS_DIR)[^;]*'\.\.',\s*'\.\.'/.test(l) && !/avPaths/.test(l)) offenders.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(offenders, [], 'derive paths from bus/lib/paths.js (avPaths), not from __dirname');
  const lib = fs.readFileSync(path.join(BUS, 'lib', 'paths.js'), 'utf8');
  assert.doesNotMatch(lib, /require\((?!['"](path|\.\/locations\.json)['"])/, 'bus/lib/paths.js may only require path and ./locations.json (no cycles)');
});
