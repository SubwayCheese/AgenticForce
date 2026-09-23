const test = require('node:test');
const assert = require('node:assert/strict');
const { makeSandbox } = require('./_sandbox.js');

test('check-schedules flags a unit or cron line whose script path no longer exists', () => {
  const sbx = makeSandbox(); const { evaluate } = sbx.load('check-schedules');
  const expected = { systemUnits: [{ name: 'q.service', expect: 'active' }], userUnits: [], cron: [{ match: 'pilot.js', expect: 'paused' }], processes: [] };
  const run = (cmd, args) => {
    if (cmd === 'systemctl' && args.includes('cat')) return { status: 0, stdout: 'ExecStart=/usr/bin/node bus/scripts/run-queue-daemon.js', stderr: '' };
    if (cmd === 'systemctl') return { status: 0, stdout: args.includes('is-enabled') ? 'enabled' : 'active', stderr: '' };
    if (cmd === 'crontab') return { status: 0, stdout: '# PAUSED -- */30 * * * * node bus/scripts/pilot.js', stderr: '' };
  };
  const rows = evaluate(expected, run, (rel) => rel === 'bus/scripts/run-queue-daemon.js');
  assert.deepEqual(rows.filter((r) => !r.ok).map((r) => r.name), ['pilot.js -> bus/scripts/pilot.js']);
  assert.ok(rows.some((r) => r.kind === 'system-unit-path' && r.ok));
  sbx.cleanup();
});

test('check-schedules flags drift and accepts matching reality (fake systemctl/crontab/pgrep)', () => {
  const sbx = makeSandbox(); const { evaluate } = sbx.load('check-schedules');
  const expected = {
    systemUnits: [{ name: 'q.service', expect: 'active' }],
    userUnits: [{ name: 'a.timer', expect: 'disabled' }, { name: 'b.timer', expect: 'absent' }],
    cron: [{ match: 'pilot.js', expect: 'paused' }, { match: 'gone.js', expect: 'absent' }],
    processes: [{ match: 'dash.js', expect: 'running' }],
  };
  const world = { 'q.service': ['enabled', 'active'], 'a.timer': ['disabled', 'inactive'], 'b.timer': null };
  const run = (cmd, args) => {
    if (cmd === 'systemctl') { const name = args[args.length - 1]; const w = world[name]; const isEn = args.includes('is-enabled');
      if (!w) return { status: 1, stdout: isEn ? 'not-found' : 'inactive', stderr: '' }; return { status: 0, stdout: isEn ? w[0] : w[1], stderr: '' }; }
    if (cmd === 'crontab') return { status: 0, stdout: '# PAUSED -- */30 * * * * node pilot.js', stderr: '' };
    if (cmd === 'pgrep') return { status: 0, stdout: '4242', stderr: '' };
  };
  assert.ok(evaluate(expected, run).every((r) => r.ok), JSON.stringify(evaluate(expected, run).filter((r) => !r.ok)));
  world['a.timer'] = ['enabled', 'active'];
  const drift = evaluate(expected, run).filter((r) => !r.ok);
  assert.deepEqual(drift.map((r) => r.name), ['a.timer']);
  sbx.cleanup();
});
