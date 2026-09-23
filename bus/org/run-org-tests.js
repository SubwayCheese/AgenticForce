// run-org-tests.js -- own test runner for bus/org/, mirroring bus/platform/run-survive-tests.js's shape
// exactly WITHOUT touching that protected file. Credit-free, network-free (bus/org has no network calls in
// this phase at all -- DI'd fake workers only). Usage: node bus/org/run-org-tests.js [--dir <repo root>] [--verbose]

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const avPaths = require('../lib/paths.js');

function runOrgTests({ root = avPaths.ROOT, verbose = false } = {}) {
  const testDir = path.join(root, 'bus', 'tests', 'org');
  if (!fs.existsSync(testDir)) return { ok: false, pass: 0, fail: 0, reason: `no test dir at ${testDir}` };
  const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.js')).map((f) => path.join(testDir, f));
  if (!files.length) return { ok: false, pass: 0, fail: 0, reason: 'no test files' };
  const res = spawnSync(process.execPath, ['--test', ...files], { cwd: root, encoding: 'utf8', timeout: 5 * 60 * 1000 });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (verbose) process.stdout.write(out);
  const num = (k) => { const m = new RegExp(`^# ${k} (\\d+)`, 'm').exec(out); return m ? Number(m[1]) : 0; };
  const pass = num('pass'), fail = num('fail');
  const ok = res.status === 0 && fail === 0 && pass > 0;
  return { ok, pass, fail, exitStatus: res.status, failures: ok ? [] : (out.match(/^not ok .*$/gm) || []).slice(0, 10) };
}

module.exports = { runOrgTests };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const di = argv.indexOf('--dir');
  const r = runOrgTests({ root: di >= 0 ? path.resolve(argv[di + 1]) : undefined, verbose: argv.includes('--verbose') });
  console.log(`org tests: ${r.ok ? 'PASS' : 'FAIL'} (${r.pass} passed, ${r.fail} failed)${r.reason ? ' -- ' + r.reason : ''}`);
  for (const f of r.failures || []) console.log('  ' + f);
  process.exit(r.ok ? 0 : 1);
}
