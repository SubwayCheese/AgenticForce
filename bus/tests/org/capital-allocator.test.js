// Plan 2 acceptance tests: #3 (lucky $300 without repeatability blocks replication), #4 (diversity gate),
// #5 (kill-condition review lock), #8 (allocator chooses scaling over spawning when EV is higher), #9
// (trading track-record gate resists a short winning streak).
const test = require('node:test');
const assert = require('node:assert/strict');
const allocator = require('../../org/capital-allocator.js');

// AT#8
test('scoreAllocationOptions ranks the option with the highest EV-adjusted score first (AT#8: scale beats spawn)', () => {
  const ranked = allocator.scoreAllocationOptions([
    { kind: 'spawn', expectedValueUsd: 200, probabilityOfSuccess: 0.3, timeToValueDays: 60 },
    { kind: 'scale', expectedValueUsd: 300, probabilityOfSuccess: 0.7, timeToValueDays: 10 },
    { kind: 'reserve', expectedValueUsd: 0, probabilityOfSuccess: 1, timeToValueDays: 0 },
  ]);
  assert.equal(ranked[0].kind, 'scale');
});

// AT#3: reaching $300 via one lucky outcome must NOT pass the replication gate -- repeatability (parent
// proof) is the specific gate that must fail.
test('checkReplicationGate: $300 from a single lucky event fails on parent_proof even though surplus passes (AT#3)', () => {
  const r = allocator.checkReplicationGate({
    availableCashUsd: 350, reserveUsdAfterSpawn: 50, parentIndependentCycles: 1, parentPositiveAfterCosts: true,
    collectedOrProtectedUsd: 100, unresolvedIncidents: [], recurringRevenueUsd: 0, currentCellBurnUsd: 0,
    newCellExpectedValueUsd: 50, bestAlternativeExpectedValueUsd: 10, activeCellCount: 0, supervisionCapCellCount: 5,
  });
  assert.equal(r.allPass, false);
  const parentProof = r.gates.find((g) => g.name === 'parent_proof');
  assert.equal(parentProof.pass, false, 'a single cycle does not demonstrate repeatability');
});

test('checkReplicationGate passes when every gate is genuinely satisfied', () => {
  const r = allocator.checkReplicationGate({
    availableCashUsd: 350, reserveUsdAfterSpawn: 50, parentIndependentCycles: 4, parentPositiveAfterCosts: true,
    collectedOrProtectedUsd: 120, unresolvedIncidents: [], recurringRevenueUsd: 300, currentCellBurnUsd: 50,
    newCellExpectedValueUsd: 200, bestAlternativeExpectedValueUsd: 50, activeCellCount: 1, supervisionCapCellCount: 5,
  });
  assert.equal(r.allPass, true, JSON.stringify(r.gates.filter((g) => !g.pass)));
});

// AT#4
test('checkDiversityRequirement blocks a child proposal materially identical to an existing cell with no justification', () => {
  const existing = [{ cellId: 'c1', customer: 'dentists', problem: 'no-shows', offer: 'reminder texts', channel: 'sms', fulfillment: 'automated', dependency: 'twilio' }];
  const identical = { customer: 'dentists', problem: 'no-shows', offer: 'reminder texts', channel: 'sms', fulfillment: 'automated', dependency: 'twilio' };
  const r = allocator.checkDiversityRequirement(identical, existing);
  assert.equal(r.allowed, false);
  assert.equal(r.overlapWith, 'c1');
});

test('checkDiversityRequirement allows a similar proposal when it carries the required justification', () => {
  const existing = [{ cellId: 'c1', customer: 'dentists', problem: 'no-shows', offer: 'reminder texts', channel: 'sms', fulfillment: 'automated', dependency: 'twilio' }];
  const justified = { customer: 'dentists', problem: 'no-shows', offer: 'reminder texts', channel: 'sms', fulfillment: 'automated', dependency: 'twilio', unusedDemandEvidence: true, distinctMarketOrChannel: true, noHarmfulCompetitionJustification: true };
  assert.equal(allocator.checkDiversityRequirement(justified, existing).allowed, true);
});

test('checkDiversityRequirement allows a genuinely distinct proposal outright', () => {
  const existing = [{ cellId: 'c1', customer: 'dentists', problem: 'no-shows', offer: 'reminder texts', channel: 'sms', fulfillment: 'automated', dependency: 'twilio' }];
  const distinct = { customer: 'landscapers', problem: 'seasonal lead gaps', offer: 'lead-gen ads', channel: 'google ads', fulfillment: 'managed campaign', dependency: 'google api' };
  assert.equal(allocator.checkDiversityRequirement(distinct, existing).allowed, true);
});

// AT#5
test('checkKillConditions: $40 spent with no validated opportunity locks further spending (AT#5)', () => {
  const r = allocator.checkKillConditions({ spentUsd: 40, meaningfulSignal: true, validatedOpportunity: false });
  assert.equal(r.action, 'spending-lock');
});

test('checkKillConditions: $20 spent with no signal at all forces a review', () => {
  assert.equal(allocator.checkKillConditions({ spentUsd: 20, meaningfulSignal: false }).action, 'review');
});

test('checkKillConditions: $60 spent with no validated opportunity terminates', () => {
  assert.equal(allocator.checkKillConditions({ spentUsd: 60, validatedOpportunity: false }).action, 'terminate');
});

test('checkKillConditions: an immediate-termination condition fires regardless of spend', () => {
  assert.equal(allocator.checkKillConditions({ spentUsd: 5, policyViolation: true }).action, 'terminate');
});

test('checkKillConditions: within bounds and validated -> continue', () => {
  assert.equal(allocator.checkKillConditions({ spentUsd: 15, meaningfulSignal: true, validatedOpportunity: true }).action, 'continue');
});

// AT#9
test('checkTradingTrackRecordGate: a short winning streak with few resolved decisions is refused regardless of the streak (AT#9)', () => {
  const r = allocator.checkTradingTrackRecordGate({ resolvedDecisionCount: 5, calibrationErrorAbs: 0.01, recentWinStreak: 5 });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /resolved independent decisions/);
});

test('checkTradingTrackRecordGate: enough resolved decisions but poor calibration is still refused', () => {
  assert.equal(allocator.checkTradingTrackRecordGate({ resolvedDecisionCount: 25, calibrationErrorAbs: 0.3 }).allowed, false);
});

test('checkTradingTrackRecordGate: enough resolved decisions AND good calibration passes', () => {
  assert.equal(allocator.checkTradingTrackRecordGate({ resolvedDecisionCount: 25, calibrationErrorAbs: 0.05 }).allowed, true);
});
