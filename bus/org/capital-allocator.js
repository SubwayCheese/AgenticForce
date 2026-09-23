// bus/org/capital-allocator.js -- Round 26. Plan 2 secs 9-13 + 14 (Capital Allocation, Replication Gate,
// Cell Lifecycle and Selection, Portfolio Diversification, Trading and Event Markets track-record gate).
// Pure decision functions over ledger/portfolio state -- none of them execute a spawn, scale, or trade; they
// only decide whether one WOULD be permitted, so they're fully testable without a live economy or a funded
// cell existing yet.

const treasury = require('./treasury.js');

// scoreAllocationOptions(): Plan 2 sec 9's 5 destinations (scale/spawn/capability/reserve/experiment),
// ranked by a simple expected-value-adjusted-for-uncertainty score: score = expectedValueUsd *
// probabilityOfSuccess / (1 + timeToValueDays/30) -- explicit, auditable, not a hidden weighting. Satisfies
// Plan 2 AT#8: "scale a parent whose next $100 has higher expected value than a new cell; the allocator
// chooses scaling."
function scoreAllocationOptions(options) {
  const scored = options.map((o) => {
    const p = Math.max(0, Math.min(1, o.probabilityOfSuccess ?? 0.5));
    const score = (o.expectedValueUsd || 0) * p / (1 + (o.timeToValueDays || 0) / 30);
    return { ...o, score: Math.round(score * 100) / 100 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// checkReplicationGate(): Plan 2 sec 10's 8 hard gates, verbatim, each individually reported so a failure is
// legible (not just a single boolean). ALL must pass; this function never spawns anything.
function checkReplicationGate(state) {
  const c = treasury.getConstitution();
  const gates = [
    { name: 'surplus_capital', pass: (state.availableCashUsd || 0) >= c.replicationSurplusThresholdUsd, detail: `available $${state.availableCashUsd || 0} >= $${c.replicationSurplusThresholdUsd}` },
    { name: 'reserve_after_spawn', pass: (state.reserveUsdAfterSpawn ?? 0) >= treasury.RESERVE_FLOOR_BY_STATE.HEALTHY, detail: `reserve after spawn $${state.reserveUsdAfterSpawn} >= $${treasury.RESERVE_FLOOR_BY_STATE.HEALTHY}` },
    { name: 'parent_proof', pass: (state.parentIndependentCycles || 0) >= 2 && (state.parentPositiveAfterCosts === true), detail: `${state.parentIndependentCycles || 0} independent cycles, positive after costs: ${!!state.parentPositiveAfterCosts}` },
    { name: 'original_capital_recovery', pass: (state.collectedOrProtectedUsd || 0) >= c.startingTreasuryUsd, detail: `recovered $${state.collectedOrProtectedUsd || 0} >= $${c.startingTreasuryUsd}` },
    { name: 'operational_stability', pass: !(state.unresolvedIncidents && state.unresolvedIncidents.length), detail: `unresolved incidents: ${(state.unresolvedIncidents || []).length}` },
    { name: 'coverage', pass: (state.recurringRevenueUsd || 0) >= c.coverageMultipleRequired * (state.currentCellBurnUsd || Infinity), detail: `recurring $${state.recurringRevenueUsd || 0} >= ${c.coverageMultipleRequired}x burn $${state.currentCellBurnUsd || 0}` },
    { name: 'marginal_comparison', pass: (state.newCellExpectedValueUsd || 0) > (state.bestAlternativeExpectedValueUsd ?? -Infinity), detail: `new cell EV $${state.newCellExpectedValueUsd || 0} > best alternative EV $${state.bestAlternativeExpectedValueUsd ?? 'n/a'}` },
    { name: 'population_capacity', pass: (state.activeCellCount || 0) < (state.supervisionCapCellCount ?? Infinity), detail: `active ${state.activeCellCount || 0} < cap ${state.supervisionCapCellCount ?? 'unset'}` },
  ];
  return { allPass: gates.every((g) => g.pass), gates };
}

// Plan 2's own "Diversity requirement" (sec 11): a proposed child materially similar to an existing cell
// needs unused demand, a distinct market/channel, and no harmful internal competition. Similarity is
// measured across the exact 6 dimensions the plan names.
const SIMILARITY_DIMENSIONS = Object.freeze(['customer', 'problem', 'offer', 'channel', 'fulfillment', 'dependency']);
function checkDiversityRequirement(proposed, existingCells) {
  for (const existing of existingCells) {
    const overlap = SIMILARITY_DIMENSIONS.filter((d) => proposed[d] && existing[d] && proposed[d] === existing[d]);
    const similar = overlap.length >= 4; // 4+ of 6 dimensions matching counts as materially similar
    if (similar && !(proposed.unusedDemandEvidence && proposed.distinctMarketOrChannel && proposed.noHarmfulCompetitionJustification)) {
      return { allowed: false, reason: `materially similar to cell ${existing.cellId} on [${overlap.join(', ')}] with no unused-demand/distinct-channel/no-competition justification`, overlapWith: existing.cellId, overlappingDimensions: overlap };
    }
  }
  return { allowed: true, reason: 'sufficiently distinct or justified' };
}

// Plan 2's explicit worked kill-condition thresholds for a $100 exploration cell (sec 12).
const KILL_CONDITIONS = Object.freeze([
  { spentUsd: 60, rule: 'terminate', detail: 'terminate and return remaining funds -- no validated opportunity' },
  { spentUsd: 40, rule: 'spending-lock', detail: 'prohibit further spending until the thesis changes materially' },
  { spentUsd: 20, rule: 'review', detail: 'force an independent strategy review' },
]);
function checkKillConditions(cell) {
  const spent = cell.spentUsd || 0;
  const hasSignal = !!cell.meaningfulSignal;
  const hasValidation = !!cell.validatedOpportunity;
  if (cell.policyViolation || cell.deceptivePractice || cell.unmanageableLiability || cell.brokenAcquisitionPremise) {
    return { action: 'terminate', reason: 'immediate-termination condition (policy/deceptive/liability/broken premise)' };
  }
  if (spent >= 60 && !hasValidation) return { action: 'terminate', reason: KILL_CONDITIONS[0].detail };
  if (spent >= 40 && !hasValidation) return { action: 'spending-lock', reason: KILL_CONDITIONS[1].detail };
  if (spent >= 20 && !hasSignal) return { action: 'review', reason: KILL_CONDITIONS[2].detail };
  return { action: 'continue', reason: 'within bounds' };
}

// Plan 2 sec 14: "capital rises only after enough resolved independent decisions show calibrated edge." A
// short winning streak must NOT unlock more capital (Plan 2 AT#9). MIN_RESOLVED_DECISIONS is deliberately a
// count of independent resolutions, not a win rate alone.
const MIN_RESOLVED_DECISIONS_FOR_TRACK_RECORD = 20;
function checkTradingTrackRecordGate(record) {
  const resolved = record.resolvedDecisionCount || 0;
  if (resolved < MIN_RESOLVED_DECISIONS_FOR_TRACK_RECORD) {
    return { allowed: false, reason: `only ${resolved} resolved independent decisions, need >= ${MIN_RESOLVED_DECISIONS_FOR_TRACK_RECORD} regardless of recent win rate` };
  }
  const calibrated = typeof record.calibrationErrorAbs === 'number' && record.calibrationErrorAbs <= 0.1;
  return { allowed: calibrated, reason: calibrated ? 'sufficient resolved decisions and calibrated probability estimates' : `calibration error too high (${record.calibrationErrorAbs})` };
}

module.exports = { scoreAllocationOptions, checkReplicationGate, checkDiversityRequirement, checkKillConditions, checkTradingTrackRecordGate, KILL_CONDITIONS, SIMILARITY_DIMENSIONS, MIN_RESOLVED_DECISIONS_FOR_TRACK_RECORD };
