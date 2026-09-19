// city-leadership.js -- the capped leader tier ("the board of directors")
// and its promotion algorithm (ARCHITECTURE.md section 19, rounds 3-4).
//
// ROUND 4 CHANGE: promotion is now THRESHOLD-based (a citizen proves
// itself against its OWN bar), not a ranked tournament against siblings,
// and leader count is HARD-CAPPED at MAX_LEADERS -- direct user words:
// "3-5 managers... theres no real benefit to more than that." Promotion
// also now goes through citizen-lifecycle.js's executeCloneAndPromote(),
// which spawns the clone that keeps the proven technique running BEFORE
// the role actually flips -- this file no longer promotes directly.

const cityRegistry = require('./city-registry.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const citizenLifecycle = require('./citizen-lifecycle.js');
const ntfy = require('./ntfy.js');

const CITIZENS_PER_LEADER = 5; // ratio floor for a small/growing city -- adjustable
const MAX_LEADERS = 5; // hard cap, regardless of citizen count -- "no real benefit to more than that"
const { PROMOTION_SURPLUS_MULTIPLE } = citizenLifecycle; // single source of truth, citizen-lifecycle.js owns it (executeCloneAndPromote() re-verifies the same threshold)
const SURVIVE_NTFY_TOPIC = 'AgentVaultSurvive';

function targetLeaderCount(activeCitizenCount) {
  if (activeCitizenCount <= 0) return 0;
  return Math.min(MAX_LEADERS, Math.max(1, Math.ceil(activeCitizenCount / CITIZENS_PER_LEADER)));
}

// Finds every active, non-leader citizen that has cleared its OWN
// promotion threshold (cashUsd >= genesisAllocationUsd * PROMOTION_SURPLUS_MULTIPLE).
// Eligibility is threshold-based; only used as a tie-break (strongest
// realizedPnlUsd first) if more than one citizen qualifies in the same
// check and the cap only has room for one more.
function findPromotionEligible() {
  return cityRegistry.listActiveCitizens()
    .filter((c) => c.role !== 'leader')
    .filter((c) => !budgetEnvelope.hasShutdownEvent(c.citizenId))
    .map((c) => ({ citizen: c, ledger: budgetEnvelope.computeLifetimeLedger(c.citizenId) }))
    .filter((x) => x.ledger.cashUsd >= (x.citizen.genesisAllocationUsd || 0) * PROMOTION_SURPLUS_MULTIPLE)
    .sort((a, b) => b.ledger.realizedPnlUsd - a.ledger.realizedPnlUsd);
}

// Promotes AT MOST ONE citizen per call -- callers loop this from
// survive-supervisor.js's wake if more than one is eligible at once
// (deliberately not rushed). Clones the winner's proven technique first
// (citizenLifecycle.executeCloneAndPromote()); only flips the role if
// that succeeds, so a citizen is never promoted with nothing left running
// its business.
async function maybePromoteLeader() {
  const activeCitizens = cityRegistry.listActiveCitizens();
  const target = targetLeaderCount(activeCitizens.length);
  const currentLeaders = cityRegistry.listActiveLeaders();
  if (currentLeaders.length >= MAX_LEADERS) {
    return { promoted: false, reason: 'leader cap reached', currentLeaderCount: currentLeaders.length, maxLeaders: MAX_LEADERS };
  }
  if (currentLeaders.length >= target) {
    return { promoted: false, reason: 'ratio already satisfied', currentLeaderCount: currentLeaders.length, targetLeaderCount: target };
  }

  const eligible = findPromotionEligible();
  if (!eligible.length) {
    return { promoted: false, reason: 'no citizen has crossed its promotion threshold yet', currentLeaderCount: currentLeaders.length, targetLeaderCount: target };
  }

  const winner = eligible[0];
  let cloneResult;
  try {
    cloneResult = await citizenLifecycle.executeCloneAndPromote(winner.citizen.citizenId);
  } catch (err) {
    return { promoted: false, reason: `clone-and-promote failed: ${err.message}`, currentLeaderCount: currentLeaders.length, targetLeaderCount: target };
  }

  ntfy.sendNtfy({
    topic: SURVIVE_NTFY_TOPIC,
    title: `Citizen ${winner.citizen.citizenId} promoted to leader`,
    message: `Cash $${winner.ledger.cashUsd.toFixed(2)} (genesis was $${(winner.citizen.genesisAllocationUsd || 0).toFixed(2)}). Cloned into ${cloneResult.cloneCitizenId} to keep running the proven technique. Leader count now ${currentLeaders.length + 1} of ${target} (cap ${MAX_LEADERS}).`,
    tags: 'mag',
  }).catch(() => {});

  return { promoted: true, citizenId: winner.citizen.citizenId, cloneCitizenId: cloneResult.cloneCitizenId, currentLeaderCount: currentLeaders.length + 1, targetLeaderCount: target };
}

// Reassigns any citizen whose current leader has gone KIA or been demoted
// to the currently-most-active surviving leader -- simple round-robin/
// least-loaded assignment (count of citizens each leader currently
// manages), not a sophisticated matching algorithm (v1 scope, named as
// such).
function reassignOrphanedCitizens() {
  const orphans = cityRegistry.listOrphanedCitizens();
  if (!orphans.length) return { reassigned: [] };
  const leaders = cityRegistry.listActiveLeaders();
  if (!leaders.length) return { reassigned: [], reason: 'no active leaders to reassign to' };

  const allCitizens = cityRegistry.listCitizens();
  const loadOf = new Map(leaders.map((l) => [l.citizenId, allCitizens.filter((c) => c.managedByLeaderId === l.citizenId && c.status === 'active').length]));

  const reassigned = [];
  for (const orphan of orphans) {
    // Least-loaded leader, recomputed each iteration so a burst of
    // reassignments spreads out rather than piling onto one leader.
    const sorted = leaders.slice().sort((a, b) => (loadOf.get(a.citizenId) || 0) - (loadOf.get(b.citizenId) || 0));
    const target = sorted[0];
    cityRegistry.reassignManagedByLeader(orphan.citizenId, target.citizenId);
    loadOf.set(target.citizenId, (loadOf.get(target.citizenId) || 0) + 1);
    reassigned.push({ citizenId: orphan.citizenId, newLeaderId: target.citizenId });
  }
  return { reassigned };
}

module.exports = { CITIZENS_PER_LEADER, MAX_LEADERS, PROMOTION_SURPLUS_MULTIPLE, targetLeaderCount, findPromotionEligible, maybePromoteLeader, reassignOrphanedCitizens };

// CLI: node city-leadership.js status | promote | reassign
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'status') {
    const active = cityRegistry.listActiveCitizens();
    console.log(JSON.stringify({ activeCitizens: active.length, activeLeaders: cityRegistry.listActiveLeaders().length, target: targetLeaderCount(active.length), maxLeaders: MAX_LEADERS }, null, 2));
  } else if (cmd === 'promote') {
    maybePromoteLeader().then((r) => console.log(JSON.stringify(r, null, 2)));
  } else if (cmd === 'reassign') {
    console.log(JSON.stringify(reassignOrphanedCitizens(), null, 2));
  } else {
    console.error('Usage: node city-leadership.js status|promote|reassign');
    process.exit(1);
  }
}
