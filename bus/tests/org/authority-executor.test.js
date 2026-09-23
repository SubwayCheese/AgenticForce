// Plan 1 AT#6: "request a disallowed spend; the policy engine denies it even if every agent recommends
// approval" -- and the structural guarantee: A3/A4 are unconditionally denied in this phase, so no code path
// through executor.js can move money above a reversible action, however confidently a decision recommends it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function fresh() {
  const store = require('../../org/store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'org-authexec-'));
  store._setStoreDirForTesting(dir);
  return {
    store,
    events: require('../../org/events.js'),
    authority: require('../../org/authority.js'),
    executor: require('../../org/executor.js'),
    treasury: require('../../org/treasury.js'),
  };
}

test('A3/A4 are always denied, with no evidence level or confidence able to change that (AT#6)', () => {
  const { authority } = fresh();
  const r1 = authority.checkAuthority({ tier: 'A3_COMMITMENT', evidenceLevel: 'E5' });
  const r2 = authority.checkAuthority({ tier: 'A4_HIGH_IMPACT', evidenceLevel: 'E5' });
  assert.equal(r1.allowed, false);
  assert.equal(r2.allowed, false);
  assert.match(r1.reason, /human approval/);
});

test('A2 requires at least E1 evidence; A0/A1 need none', () => {
  const { authority } = fresh();
  assert.equal(authority.checkAuthority({ tier: 'A0_OBSERVE' }).allowed, true);
  assert.equal(authority.checkAuthority({ tier: 'A1_PREPARE' }).allowed, true);
  assert.equal(authority.checkAuthority({ tier: 'A2_REVERSIBLE_EXECUTE' }).allowed, false, 'no evidence cited');
  assert.equal(authority.checkAuthority({ tier: 'A2_REVERSIBLE_EXECUTE', evidenceLevel: 'E0' }).allowed, false, 'E0 speculation is not enough');
  assert.equal(authority.checkAuthority({ tier: 'A2_REVERSIBLE_EXECUTE', evidenceLevel: 'E1' }).allowed, true);
});

test('requireAuthority() throws on a missing or denied AuthorityResult -- no mutator can proceed without one', () => {
  const { authority } = fresh();
  assert.throws(() => authority.requireAuthority(null), /no authority check performed/);
  assert.throws(() => authority.requireAuthority({ allowed: false, reason: 'x' }), /denied/);
  assert.doesNotThrow(() => authority.requireAuthority({ allowed: true, tier: 'A1_PREPARE' }));
});

test("treasury's own mutators independently re-check authority -- calling them with a forged/denied result is refused, not just discouraged by convention", () => {
  const { treasury } = fresh();
  const req = treasury.requestTransaction({ accountFrom: 'operating', accountTo: 'reserve', amountUsd: 5, purpose: 'test', idempotencyKey: 'k1' });
  assert.throws(() => treasury.authorizeTransaction(req.transactionId, { allowed: false, reason: 'denied' }), /denied/);
  assert.throws(() => treasury.authorizeTransaction(req.transactionId, null), /no authority check performed/);
});

test('executor.applyDecision(): a create_project decision with insufficient authority evidence is denied end to end, and nothing is created', () => {
  const { executor, store } = fresh();
  const decision = { decisionType: 'create_project', rationale: 'r', expectedValue: 1, nextEvents: [], requiredAuthority: 'A2_REVERSIBLE_EXECUTE', reviewAt: 'x', projectId: 'p1', goal: 'g', action: { tier: 'A2_REVERSIBLE_EXECUTE' } };
  const outcome = executor.applyDecision(decision);
  assert.equal(outcome.applied, false);
  assert.equal(outcome.authority.allowed, false);
  assert.equal(store.get('projects', 'p1'), null);
});

test('executor.applyDecision(): the same decision WITH cited evidence at A2 succeeds and is idempotent-safe on replay via create() refusing a duplicate id', () => {
  const { executor, store } = fresh();
  const decision = { decisionType: 'create_project', rationale: 'r', expectedValue: 1, nextEvents: [], requiredAuthority: 'A2_REVERSIBLE_EXECUTE', reviewAt: 'x', projectId: 'p1', goal: 'g', action: { tier: 'A2_REVERSIBLE_EXECUTE', evidenceLevel: 'E2' } };
  const outcome = executor.applyDecision(decision);
  assert.equal(outcome.applied, true);
  assert.equal(store.get('projects', 'p1').goal, 'g');
});

test('an A3 "allocate" decision (a real spend) is refused by the executor even though the decision itself claims it is justified', () => {
  const { executor, treasury } = fresh();
  const decision = {
    decisionType: 'allocate', rationale: 'spend $40 on a new cell', expectedValue: 100, nextEvents: [], requiredAuthority: 'A3_COMMITMENT', reviewAt: 'x',
    action: { tier: 'A3_COMMITMENT', evidenceLevel: 'E5' },
    transaction: { accountFrom: 'reserve', accountTo: 'exploration_pool', amountUsd: 40, purpose: 'spawn', idempotencyKey: 'spend-1' },
  };
  const outcome = executor.applyDecision(decision);
  assert.equal(outcome.applied, false);
  assert.equal(outcome.authority.allowed, false);
  assert.equal(treasury.getAccountBalanceUsd('exploration_pool'), 0, 'no money moved anywhere');
});
