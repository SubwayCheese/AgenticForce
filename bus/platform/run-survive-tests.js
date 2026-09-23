// run-survive-tests.js -- credit-free, network-free gate for the survive/
// city code. Wraps `node --test` over bus/tests/survive/*.test.js and prints
// one verdict line. Exit code 0 = green, 1 = red. Each test runs against a
// sandboxed COPY of bus/scripts (see bus/tests/survive/_sandbox.js), so it
// cannot touch live ledgers, the shared task queue, or secrets.
//
// Usage: node bus/platform/run-survive-tests.js [--dir <repo root>] [--verbose]
// --dir lets the change gate run the suite inside a candidate worktree.

const avPaths = require('../lib/paths.js');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runSurviveTests({ root = avPaths.ROOT, verbose = false } = {}) {
  const testDir = path.join(root, 'bus', 'tests', 'survive');
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

module.exports = { runSurviveTests };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const di = argv.indexOf('--dir');
  const r = runSurviveTests({ root: di >= 0 ? path.resolve(argv[di + 1]) : undefined, verbose: argv.includes('--verbose') });
  console.log(`survive tests: ${r.ok ? 'PASS' : 'FAIL'} (${r.pass} passed, ${r.fail} failed)${r.reason ? ' -- ' + r.reason : ''}`);
  for (const f of r.failures || []) console.log('  ' + f);
  process.exit(r.ok ? 0 : 1);
}
