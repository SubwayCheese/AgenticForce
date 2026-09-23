// Plan 1 AT#2: "submit the same event twice; only one state transition and one external action occur."
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fresh() {
  const store = require('../../org/store.js');
  const events = require('../../org/events.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-events-'));
  store._setStoreDirForTesting(dir);
  return { store, events };
}

test('append() with the same id is idempotent -- appended once, not twice', () => {
  const { events } = fresh();
  const e1 = events.append({ id: 'evt-1', type: 'x' });
  const e2 = events.append({ id: 'evt-1', type: 'x' });
  assert.equal(e1.id, e2.id);
  assert.equal(events.readAll().filter((e) => e.id === 'evt-1').length, 1);
});

test('processEvents(): a duplicated event produces exactly one handler call and one state transition (AT#2)', () => {
  const { events } = fresh();
  events.append({ id: 'evt-1', type: 'increment' });
  events.append({ id: 'evt-1', type: 'increment' }); // duplicate submission
  let calls = 0;
  events.processEvents(() => { calls++; });
  assert.equal(calls, 1, 'the duplicate never reached the handler a second time');
  assert.equal(events.unprocessedCount(), 0);
});

test('processEvents() is itself idempotent across calls -- already-processed events are not replayed', () => {
  const { events } = fresh();
  events.append({ type: 'a' });
  events.append({ type: 'b' });
  let calls = 0;
  events.processEvents(() => { calls++; });
  events.processEvents(() => { calls++; }); // second call, nothing new to process
  assert.equal(calls, 2);
});

test('a throwing handler stops at that event and leaves it (and later ones) unprocessed for retry -- not silently dropped', () => {
  const { events } = fresh();
  events.append({ id: 'ok-1', type: 'a' });
  events.append({ id: 'bad', type: 'b' });
  events.append({ id: 'ok-2', type: 'c' });
  let processedIds = [];
  const outcomes = events.processEvents((e) => { if (e.id === 'bad') throw new Error('boom'); processedIds.push(e.id); return 'done'; });
  assert.deepEqual(processedIds, ['ok-1']);
  assert.equal(outcomes[outcomes.length - 1].ok, false);
  assert.equal(events.unprocessedCount(), 2, 'the failed event and everything after it remain pending');
});
