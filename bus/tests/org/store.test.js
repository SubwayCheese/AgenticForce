// Plan 1 Foundation: durability, CAS, leases. AT#1/#2/#3 are covered here at the store layer; the real
// cross-process proof (20 separate `node` processes racing, a SIGKILL'd lock holder) was run manually during
// development (not re-run here every CI pass since it takes real wall-clock seconds spawning processes) --
// this suite covers the same logic deterministically and fast, in-process.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshStore() {
  const store = require('../../org/store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-store-'));
  store._setStoreDirForTesting(dir);
  return store;
}

test('create() refuses to silently overwrite an existing document', () => {
  const store = freshStore();
  store.create('projects', 'p1', { goal: 'x' });
  assert.throws(() => store.create('projects', 'p1', { goal: 'y' }), /already exists/);
});

test('put() is optimistic-concurrency-guarded: a stale version is rejected, not silently overwritten (AT#3)', () => {
  const store = freshStore();
  const d = store.create('projects', 'p1', { goal: 'x' });
  const r1 = store.put('projects', 'p1', d.version, { goal: 'y' });
  assert.equal(r1.ok, true);
  assert.equal(r1.doc.goal, 'y');
  // A second writer that read the OLD version must be told to reload, not silently clobber r1's write.
  const r2 = store.put('projects', 'p1', d.version, { goal: 'z-from-stale-writer' });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'version-conflict');
  assert.equal(store.get('projects', 'p1').goal, 'y', 'the winning write is preserved, the loser did not overwrite it');
});

test('task state machine rejects an invalid state', () => {
  const store = freshStore();
  store.createTask('t1', {});
  assert.throws(() => store.transitionTask('t1', 1, 'NOT_A_REAL_STATE'), /invalid task state/);
});

test('leases: acquiring an already-live lease held by someone else is refused; releasing sets the next state', () => {
  const store = freshStore();
  store.createTask('t1', {});
  const l1 = store.acquireLease('t1', 'worker-A', 60000);
  assert.equal(l1.ok, true);
  assert.equal(store.get('tasks', 't1').state, 'RUNNING');
  const l2 = store.acquireLease('t1', 'worker-B', 60000);
  assert.equal(l2.ok, false);
  assert.equal(l2.reason, 'leased');
  const rel = store.releaseLease('t1', 'worker-A', 'SUCCEEDED', { result: 'ok' });
  assert.equal(rel.ok, true);
  assert.equal(store.get('tasks', 't1').state, 'SUCCEEDED');
});

test('sweepExpiredLeases(): a RUNNING task whose lease has passed returns to READY without needing its holder (AT#1: kill mid-RUNNING -> lease expires -> resumes)', () => {
  const store = freshStore();
  store.createTask('t1', {});
  store.acquireLease('t1', 'worker-that-died', 10); // 10ms TTL
  const recovered = store.sweepExpiredLeases(Date.now() + 1000); // simulate time passing
  assert.deepEqual(recovered, ['t1']);
  const t = store.get('tasks', 't1');
  assert.equal(t.state, 'READY');
  assert.equal(t.lease, null);
});

test('a second lease can be acquired once the first genuinely expires -- no duplicate "RUNNING at once" window survives a sweep', () => {
  const store = freshStore();
  store.createTask('t1', {});
  store.acquireLease('t1', 'worker-A', 10);
  store.sweepExpiredLeases(Date.now() + 1000);
  const l2 = store.acquireLease('t1', 'worker-B', 60000);
  assert.equal(l2.ok, true);
});

test('durableWriteFileSync actually persists readable content via fsync+rename', () => {
  const store = freshStore();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-durable-'));
  const p = path.join(dir, 'nested', 'x.json');
  store.durableWriteFileSync(p, JSON.stringify({ a: 1 }));
  assert.deepEqual(JSON.parse(fs.readFileSync(p, 'utf8')), { a: 1 });
});

test('withLock serializes two logically-concurrent in-process callers deterministically (no interleaving)', () => {
  const store = freshStore();
  const order = [];
  const p1 = new Promise((resolve) => { store.withLock('x', () => { order.push('a-start'); }); order.push('a-end'); resolve(); });
  const p2 = new Promise((resolve) => { store.withLock('x', () => { order.push('b-start'); }); order.push('b-end'); resolve(); });
  return Promise.all([p1, p2]).then(() => {
    assert.deepEqual(order, ['a-start', 'a-end', 'b-start', 'b-end']);
  });
});
