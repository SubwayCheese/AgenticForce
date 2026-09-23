// check-schedules.js -- READ-ONLY. Compares bus/deploy/schedules.json (what SHOULD be scheduled or
// running) with systemd, crontab and the process list, and prints any drift. Changes nothing.
// Usage: node bus/platform/check-schedules.js   (exit 1 if there is drift)

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const EXPECTED_PATH = avPaths.bus('deploy', 'schedules.json');

function defaultRun(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000 });
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function unitState(run, user, name) {
  const base = user ? ['--user'] : [];
  const en = run('systemctl', [...base, 'is-enabled', name]);
  const ac = run('systemctl', [...base, 'is-active', name]);
  const enabled = en.stdout.split('\n')[0] || 'not-found';
  const active = ac.stdout.split('\n')[0] || 'inactive';
  const present = !/not-found|No such file/i.test(en.stdout + en.stderr) && en.stdout !== '';
  return { present, enabled, active };
}

// Every bus/....js path named by a unit's ExecStart or a cron line must exist (real file or compat symlink), otherwise the
// unit would crash-loop the moment it starts. Read-only.
const SCRIPT_REF = /(bus\/[\w./-]+\.js)(?![\w])/g;
function pathRows(kind, name, text, exists) {
  const rows = [];
  for (const m of text.matchAll(SCRIPT_REF)) rows.push({ kind: `${kind}-path`, name: `${name} -> ${m[1]}`, expect: 'exists', actual: exists(m[1]) ? 'exists' : 'MISSING', ok: exists(m[1]) });
  return rows;
}

function evaluate(expected, run = defaultRun, exists = (rel) => fs.existsSync(path.join(avPaths.ROOT, rel))) {
  const rows = [];
  for (const [list, user] of [[expected.systemUnits, false], [expected.userUnits, true]]) {
    for (const u of list || []) {
      const s = unitState(run, user, u.name);
      const actual = !s.present ? 'absent' : s.active === 'active' ? 'active' : s.enabled === 'enabled' ? 'enabled' : 'disabled';
      const ok = u.expect === 'active' ? actual === 'active' : u.expect === 'enabled' ? actual === 'enabled' || actual === 'active' : u.expect === actual;
      rows.push({ kind: user ? 'user-unit' : 'system-unit', name: u.name, expect: u.expect, actual, ok });
      if (s.present) rows.push(...pathRows(user ? 'user-unit' : 'system-unit', u.name, run('systemctl', [...(user ? ['--user'] : []), 'cat', u.name]).stdout, exists));
    }
  }
  const cron = run('crontab', ['-l']).stdout.split('\n');
  for (const c of expected.cron || []) {
    const line = cron.find((l) => l.includes(c.match));
    const actual = !line ? 'absent' : /^\s*#/.test(line) ? 'paused' : 'active';
    rows.push({ kind: 'cron', name: c.match, expect: c.expect, actual, ok: actual === c.expect });
    if (line) rows.push(...pathRows('cron', c.match, line, exists));
  }
  for (const p of expected.processes || []) {
    const r = run('pgrep', ['-f', `node .*${p.match}`]);
    const actual = r.status === 0 && r.stdout ? 'running' : 'stopped';
    rows.push({ kind: 'process', name: p.match, expect: p.expect, actual, ok: actual === p.expect });
  }
  return rows;
}

module.exports = { evaluate, unitState };

if (require.main === module) {
  const rows = evaluate(JSON.parse(fs.readFileSync(EXPECTED_PATH, 'utf8')));
  for (const r of rows) console.log(`${r.ok ? 'ok   ' : 'DRIFT'} ${r.kind.padEnd(11)} ${r.name.padEnd(36)} expected ${r.expect.padEnd(8)} actual ${r.actual}`);
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad ? `\n${bad} drift item(s): fix reality or update bus/deploy/schedules.json` : '\nall schedules match expectations');
  process.exit(bad ? 1 : 0);
}
