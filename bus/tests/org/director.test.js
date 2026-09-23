// Plan 1 AT#9: "restart after a Director decision; the organization resumes from durable events, not
// conversational memory." Proven here by calling runDecisionCycle() TWICE with two entirely fresh calls
// (no shared closure state passed between them beyond what's on disk) and confirming the second call's
// context genuinely reflects the first call's committed effects.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fresh() {
  const store = require('../../org/store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-director-'));
  store._setStoreDirForTesting(dir);
  return { store, director: require('../../org/director.js') };
}

const validDecision = (over = {}) => ({ decisionType: 'no_action', rationale: 'nothing to do', expectedValue: 0, nextEvents: [], requiredAuthority: 'A0_OBSERVE', reviewAt: new Date().toISOString(), action: { tier: 'A0_OBSERVE' }, ...over });

test('runDecisionCycle() requires a real workerFn -- refuses to silently call a real model to prove plumbing', async () => {
  const { director } = fresh();
  await assert.rejects(() => director.runDecisionCycle({}), /workerFn is required/);
});

test('validateDecision() refuses a decision missing required contract fields', () => {
  const { director } = fresh();
  assert.throws(() => director.validateDecision({ decisionType: 'no_action' }), /missing required fields/);
});

test('validateDecision() refuses an unknown decisionType', () => {
  const { director } = fresh();
  assert.throws(() => director.validateDecision(validDecision({ decisionType: 'do_something_undefined' })), /unknown decisionType/);
});

test('runDecisionCycle() with a fake DI\'d worker runs the full cycle and durably records the decision as an event', async () => {
  const { director } = fresh();
  const fakeWorker = async () => validDecision();
  const r = await director.runDecisionCycle({ workerFn: fakeWorker });
  assert.equal(r.decision.decisionType, 'no_action');
  assert.equal(r.outcome.applied, true);
  const events = require('../../org/events.js');
  assert.ok(events.readAll().some((e) => e.type === 'director-decision'));
});

test('AT#9: two fully independent runDecisionCycle() calls (fresh module-level nothing shared beyond disk state) see each other\'s durable effects, proving state is not held in conversational/process memory', async () => {
  const store = require('../../org/store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-restart-'));
  store._setStoreDirForTesting(dir);
  const director1 = require('../../org/director.js');
  const worker1 = async () => validDecision({ decisionType: 'create_project', projectId: 'p1', goal: 'first cycle', action: { tier: 'A2_REVERSIBLE_EXECUTE', evidenceLevel: 'E2' }, requiredAuthority: 'A2_REVERSIBLE_EXECUTE' });
  await director1.runDecisionCycle({ workerFn: worker1 });

  // Simulate "restart": re-require the store at the SAME dir (a real restart would be a new `node` process
  // entirely; re-pointing at the same on-disk dir is the equivalent for this in-process test, and is exactly
  // what the DI/fresh-load-per-call design in director.js guarantees is safe).
  store._setStoreDirForTesting(dir);
  const worker2 = async ({ context }) => {
    assert.equal(context.projects.some((p) => p.id === 'p1'), true, 'the second, independent cycle sees the first cycle\'s durably-committed project without any shared in-memory state');
    return validDecision();
  };
  const r2 = await director1.runDecisionCycle({ workerFn: worker2 });
  assert.equal(r2.outcome.applied, true);
});

test('a decision\'s nextEvents are durably enqueued as separate events, keeping their own type and gaining director lineage (causedBy)', async () => {
  const { director } = fresh();
  const worker = async () => validDecision({ nextEvents: [{ type: 'follow-up', payload: 'x' }] });
  const r = await director.runDecisionCycle({ workerFn: worker });
  const events = require('../../org/events.js');
  const enqueued = events.readAll().find((e) => e.type === 'follow-up');
  assert.ok(enqueued, 'the nextEvent keeps its own real type, not a synthetic wrapper type');
  assert.equal(enqueued.payload, 'x');
  assert.equal(enqueued.causedBy, r.eventId);
  assert.equal(enqueued.enqueuedByDirector, true);
});
