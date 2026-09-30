// c1-execution-lock.test.js -- the OS-backed lock shared by survive-stop-guard.js and survive-supervisor.js. Every test
// uses its own random lock name so nothing here can ever contend with the live supervisor's real lock.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const { makeSandbox } = require('./_sandbox.js');

function uniqueName() {
  return `av-test-lock-${process.pid}-${Math.random().toString(36).slice(2)}`;
}

function setup() {
  const sbx = makeSandbox();
  return { sbx, lock: sbx.load('c1-execution-lock') };
}

test('a second acquire of a held lock fails; after release it succeeds', async () => {
  const { sbx, lock } = setup();
  const name = uniqueName();
  const a = await lock.acquire({ name });
  assert.ok(a, 'first acquire succeeds');
  assert.equal(await lock.acquire({ name }), null, 'second acquire is refused while held');
  a.release();
  const b = await lock.acquire({ name });
  assert.ok(b, 'acquire succeeds after release');
  b.release();
  sbx.cleanup();
});

test('wait_ms: waits for a release inside the window, gives up after it', async () => {
  const { sbx, lock } = setup();
  const name = uniqueName();
  const a = await lock.acquire({ name });
  setTimeout(() => a.release(), 300);
  const t0 = Date.now();
  const b = await lock.acquire({ name, wait_ms: 3000 });
  assert.ok(b, 'acquired once the holder released');
  assert.ok(Date.now() - t0 >= 250, 'actually waited');
  const t1 = Date.now();
  assert.equal(await lock.acquire({ name, wait_ms: 400 }), null, 'gives up while still held');
  assert.ok(Date.now() - t1 >= 350, 'waited out the window first');
  b.release();
  sbx.cleanup();
});

test('release is idempotent', async () => {
  const { sbx, lock } = setup();
  const name = uniqueName();
  const a = await lock.acquire({ name });
  a.release();
  a.release();
  const b = await lock.acquire({ name });
  assert.ok(b);
  b.release();
  sbx.cleanup();
});

test('held by another process: refused; freed by the kernel when that process is SIGKILLed', async () => {
  const { sbx, lock } = setup();
  const name = uniqueName();
  const lockFile = sbx.dir('city', 'c1-execution-lock.js');
  const child = spawn(process.execPath, ['-e',
    `require(${JSON.stringify(lockFile)}).acquire({ name: ${JSON.stringify(name)} }).then((h) => {` +
    ` console.log(h ? 'HELD' : 'NOT'); setInterval(() => {}, 1000); });`,
  ], { stdio: ['ignore', 'pipe', 'inherit'] });
  const first = await new Promise((resolve) => child.stdout.once('data', (d) => resolve(String(d).trim())));
  assert.equal(first, 'HELD');
  assert.equal(await lock.acquire({ name }), null, 'refused while the other process holds it');
  child.kill('SIGKILL');
  await new Promise((resolve) => child.once('exit', resolve));
  const h = await lock.acquire({ name, wait_ms: 2000 });
  assert.ok(h, 'freed without any cleanup by the dead holder');
  h.release();
  sbx.cleanup();
});
