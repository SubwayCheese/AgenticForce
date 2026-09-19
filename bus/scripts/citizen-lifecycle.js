// citizen-lifecycle.js -- the three ways real money moves to create or
// grow a citizen (ARCHITECTURE.md section 19, rounds 3-4). Written and
// unit-tested here, but DELIBERATELY NOT called from
// survive-supervisor.js's live wake for bank-funded spawning/topups until
// a real leader with real surplus exists -- premature before that, since
// nothing about it can be proven against real data until then.
// executeCloneAndPromote() IS wired into city-leadership.js's promotion
// flow, since that's inseparable from promotion itself.
//
// ZERO APPROVAL GATES on these money moves, direct user instruction
// (round 6): "Once they have their money I want 0 approval gates they
// are their own entity." Round 4's one-time human-confirmation-on-first-
// spawn gate is REMOVED entirely -- once a citizen is funded, every
// money move it or its leader makes (clone-and-promote, bank-funded
// spawn, topup) executes with no human step. The real, structural safety
// limits stay exactly as they were: the hard per-citizen budget cap
// (survive-budget-envelope.js, no re-supply, ever), the bank's own
// solvency gate (city-bank.js, can never go negative), and the runaway-
// spawn guards below -- none of those were approval gates in the human
// sense, they're the actual financial rules of the system, unaffected by
// this change.
//
// THREE DISTINCT MONEY SOURCES, never conflated (round 4 correction --
// round 3's single executeSpawn() blurred "a citizen's own money" and
// "the bank's pooled money" together):
//   1. executeCloneAndPromote() -- a citizen funds its OWN clone directly
//      out of its OWN accumulated 65%-profit-share cash. Never touches
//      the shared bank pool. Happens exactly once, at the moment of
//      becoming a leader.
//   2. executeBankFundedSpawn() -- a LEADER spawns a brand-new citizen
//      funded from the shared bank's pooled balance (everyone's 15%
//      profit-share stream). Used for exploring a new avenue or
//      replacing a citizen that went bankrupt.
//   3. executeTopup() -- a LEADER redirects pooled bank surplus into an
//      EXISTING, already-performing citizen.

const cityBank = require('./city-bank.js');
const cityRegistry = require('./city-registry.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const citySecurity = require('./city-security.js');
const ntfy = require('./ntfy.js');

const PROMOTION_SURPLUS_MULTIPLE = 2; // a citizen must have at least doubled its own genesis stake to be eligible for clone-and-promote -- real proof, not just breakeven (also used by city-leadership.js's eligibility filter)
const SPAWN_ALLOCATION_FRACTION = 0.5; // half of what's available funds the new citizen -- the source (citizen or bank) keeps the other half deployed
const MIN_SPAWN_ALLOCATION_USD = 50; // a spawn isn't proposed until it would be at least as meaningful as the founder's own starting stake
const MAX_ACTIVE_MANAGED_CITIZENS_PER_SPAWN_CYCLE = 1; // a leader can't bank-fund another spawn until its most recently spawned citizen either graduates (gets promoted) or goes KIA
const MIN_DAYS_SINCE_LAST_SPAWN = 30;
const SURVIVE_NTFY_TOPIC = 'AgentVaultSurvive';

// Shared sizing formula -- used by executeCloneAndPromote() (availableUsd
// = the promoting citizen's own cash) and executeBankFundedSpawn()
// (availableUsd = the bank's pooled balance). One formula, two different
// money sources. Produces the user's own example shape (more available
// at spawn time -> a bigger starting stake than $50) without a hardcoded
// number.
function computeSpawnAllocation(availableUsd) {
  return Math.max(MIN_SPAWN_ALLOCATION_USD, Math.floor(Number(availableUsd) * SPAWN_ALLOCATION_FRACTION));
}

function daysSinceLastSpawn(leaderCitizenId) {
  const spawned = cityRegistry.listCitizens().filter((c) => c.foundedByLeaderId === leaderCitizenId);
  if (!spawned.length) return Infinity;
  const latestFoundedAt = Math.max(...spawned.map((c) => new Date(c.foundedAt).getTime()));
  return (Date.now() - latestFoundedAt) / (24 * 60 * 60 * 1000);
}

// Runaway-spawn guards for BANK-FUNDED spawns only -- leader-role-gated,
// scoped to citizens this leader has founded. Not used by
// executeCloneAndPromote() (a one-time, structurally-limited event -- a
// citizen can only be promoted once, ever).
function checkBankSpawnGuards(leaderCitizenId) {
  const reasons = [];
  const leader = cityRegistry.getCitizen(leaderCitizenId);
  if (!leader || leader.role !== 'leader') {
    citySecurity.recordGuardTrip(leaderCitizenId, 'checkBankSpawnGuards', 'not a leader');
    return { ok: false, reasons: [`${leaderCitizenId} is not a leader -- only leaders may spawn from the bank or reallocate capital`] };
  }
  if (leader.quarantined) {
    citySecurity.recordGuardTrip(leaderCitizenId, 'checkBankSpawnGuards', 'leader is quarantined');
    return { ok: false, reasons: [`${leaderCitizenId} is quarantined -- refusing to spawn or reallocate`] };
  }
  const recentlySpawnedActive = cityRegistry.listCitizens()
    .filter((c) => c.foundedByLeaderId === leaderCitizenId && c.status === 'active' && !budgetEnvelope.hasShutdownEvent(c.citizenId))
    .length;
  if (recentlySpawnedActive >= MAX_ACTIVE_MANAGED_CITIZENS_PER_SPAWN_CYCLE) {
    reasons.push(`already has ${recentlySpawnedActive} active, non-shut-down citizen(s) it founded, at or above MAX_ACTIVE_MANAGED_CITIZENS_PER_SPAWN_CYCLE=${MAX_ACTIVE_MANAGED_CITIZENS_PER_SPAWN_CYCLE} -- must wait for that citizen to go KIA or be promoted before spawning again`);
  }
  const days = daysSinceLastSpawn(leaderCitizenId);
  if (days < MIN_DAYS_SINCE_LAST_SPAWN) {
    reasons.push(`only ${days.toFixed(1)} day(s) since this leader's last spawn, need >= ${MIN_DAYS_SINCE_LAST_SPAWN}`);
  }
  if (reasons.length) citySecurity.recordGuardTrip(leaderCitizenId, 'checkBankSpawnGuards', reasons.join('; '));
  return { ok: reasons.length === 0, reasons };
}

// 1. SELF-FUNDED: a citizen funds its OWN clone directly out of its OWN
// cash, then (and only then) is promoted to leader. Re-verifies
// eligibility itself (defense in depth -- never trusts the caller's own
// check): active, not already a leader, not shut down, and has actually
// cleared PROMOTION_SURPLUS_MULTIPLE. The clone inherits the SAME
// mechanism (continuing the proven technique, not independently chosen)
// and is flagged for strong prior-context injection on its first mission
// (survive-supervisor.js's authorNewMission() reads inheritedFromCloneOf).
async function executeCloneAndPromote(citizenId) {
  const citizen = cityRegistry.getCitizen(citizenId);
  if (!citizen || citizen.status !== 'active') throw new Error(`${citizenId} is not an active citizen`);
  if (citizen.quarantined) {
    citySecurity.recordGuardTrip(citizenId, 'executeCloneAndPromote', 'citizen is quarantined');
    throw new Error(`${citizenId} is quarantined -- cannot clone-and-promote`);
  }
  if (citizen.role === 'leader') throw new Error(`${citizenId} is already a leader -- cannot clone-and-promote twice`);
  if (budgetEnvelope.hasShutdownEvent(citizenId)) throw new Error(`${citizenId} is permanently shut down -- cannot clone-and-promote`);
  const ledger = budgetEnvelope.computeLifetimeLedger(citizenId);
  const threshold = (citizen.genesisAllocationUsd || 0) * PROMOTION_SURPLUS_MULTIPLE;
  if (ledger.cashUsd < threshold) {
    throw new Error(`${citizenId} has not cleared its promotion threshold (cash $${ledger.cashUsd.toFixed(2)} < $${threshold.toFixed(2)})`);
  }

  const allocationUsd = computeSpawnAllocation(ledger.cashUsd);
  if (allocationUsd > ledger.cashUsd) throw new Error(`${citizenId}: computed clone allocation $${allocationUsd} exceeds its own cash $${ledger.cashUsd.toFixed(2)}`);

  budgetEnvelope.recordCloneFundingDeduction(citizenId, allocationUsd, { note: 'funding own clone before promotion' });

  const cloneCitizenId = cityRegistry.nextCitizenId();
  budgetEnvelope.recordGenesisFunding(cloneCitizenId, allocationUsd, { note: `cloned from ${citizenId} before promotion`, source: 'citizen-clone' });
  cityBank.recordGenesisProvenance(cloneCitizenId, allocationUsd, { note: `cloned from ${citizenId} before promotion` });

  cityRegistry.registerCitizen({
    citizenId: cloneCitizenId,
    status: 'active',
    role: 'citizen',
    foundedByLeaderId: citizenId,
    managedByLeaderId: citizenId,
    fundingSource: 'citizen-clone',
    genesisAllocationUsd: allocationUsd,
    mechanism: citizen.mechanism || null, // INHERITED, not independently chosen -- the whole point is continuing the proven technique
    inheritedFromCloneOf: citizenId, // flags this citizen for strong (not just reference) prior-context injection
  });

  cityRegistry.updateCitizenRole(citizenId, 'leader', { note: `promoted after funding clone ${cloneCitizenId}` });

  return { cloneCitizenId, promotedCitizenId: citizenId, allocationUsd };
}

// 2. BANK-FUNDED: a leader spawns a brand-new citizen funded from the
// shared bank's pooled balance -- for exploring a new avenue, or
// replacing a citizen that went bankrupt ("if the bank has the funds,
// the board of directors will publish a new agent"). Gated by
// checkBankSolvency() (via recordBankAllocation()) and the runaway-spawn
// guards above; leader-role-gated.
async function executeBankFundedSpawn({ leaderCitizenId, allocationUsd, mechanism } = {}) {
  const guards = checkBankSpawnGuards(leaderCitizenId);
  if (!guards.ok) throw new Error(`Bank-funded spawn refused for ${leaderCitizenId}: ${guards.reasons.join('; ')}`);

  const finalAllocationUsd = allocationUsd != null ? Number(allocationUsd) : computeSpawnAllocation(cityBank.getBankBalanceUsd());
  if (finalAllocationUsd < MIN_SPAWN_ALLOCATION_USD) {
    throw new Error(`Computed allocation $${finalAllocationUsd} is below MIN_SPAWN_ALLOCATION_USD=$${MIN_SPAWN_ALLOCATION_USD} -- the bank doesn't have enough pooled surplus for a meaningful spawn yet`);
  }

  const newCitizenId = cityRegistry.nextCitizenId();
  cityBank.recordBankAllocation({ citizenId: newCitizenId, amountUsd: finalAllocationUsd, allocationKind: 'spawn', fundedByCitizenId: leaderCitizenId, note: `bank-funded spawn by leader ${leaderCitizenId}` });
  budgetEnvelope.recordGenesisFunding(newCitizenId, finalAllocationUsd, { note: `bank-funded spawn by leader ${leaderCitizenId}`, source: 'bank' });
  cityBank.recordGenesisProvenance(newCitizenId, finalAllocationUsd, { note: `bank-funded spawn by leader ${leaderCitizenId}` });

  cityRegistry.registerCitizen({
    citizenId: newCitizenId,
    status: 'active',
    role: 'citizen',
    foundedByLeaderId: leaderCitizenId,
    managedByLeaderId: leaderCitizenId,
    fundingSource: 'bank-allocation',
    genesisAllocationUsd: finalAllocationUsd,
    mechanism: mechanism || null, // NOT inherited -- a bank-funded spawn picks its own mechanism independently, same as the founder did
  });

  try {
    await ntfy.sendNtfy({
      topic: SURVIVE_NTFY_TOPIC,
      title: `New citizen founded from the bank: ${newCitizenId}`,
      message: `Leader ${leaderCitizenId} spawned ${newCitizenId} with $${finalAllocationUsd.toFixed(2)} from the shared bank pool.`,
      priority: 3,
    });
  } catch (_) { /* best-effort */ }

  return { newCitizenId, leaderCitizenId, allocationUsd: finalAllocationUsd };
}

// 3. BANK-FUNDED: directs more pooled bank surplus into an EXISTING,
// already-performing citizen -- "direct more funding to those [avenues]
// so they can compound their growth."
async function executeTopup({ leaderCitizenId, targetCitizenId, amountUsd } = {}) {
  const leader = cityRegistry.getCitizen(leaderCitizenId);
  if (!leader || leader.role !== 'leader') throw new Error(`${leaderCitizenId} is not a leader -- only leaders may reallocate capital`);
  if (leader.quarantined) {
    citySecurity.recordGuardTrip(leaderCitizenId, 'executeTopup', 'leader is quarantined');
    throw new Error(`${leaderCitizenId} is quarantined -- refusing to reallocate capital`);
  }
  const target = cityRegistry.getCitizen(targetCitizenId);
  if (!target || target.status !== 'active') throw new Error(`${targetCitizenId} is not an active citizen -- refusing to top up`);
  if (target.quarantined) throw new Error(`${targetCitizenId} is quarantined -- refusing to top up a frozen citizen`);
  if (budgetEnvelope.hasShutdownEvent(targetCitizenId)) throw new Error(`${targetCitizenId} is permanently shut down -- refusing to top up (no re-supply to a busted citizen, ever)`);
  if (!(Number(amountUsd) > 0)) throw new Error(`amountUsd must be positive, got ${amountUsd}`);

  cityBank.recordBankAllocation({ citizenId: targetCitizenId, amountUsd, allocationKind: 'topup', fundedByCitizenId: leaderCitizenId, note: `reallocated by leader ${leaderCitizenId}` });
  budgetEnvelope.recordBankTopup(targetCitizenId, amountUsd, { note: `reallocated by leader ${leaderCitizenId} from pooled city bank surplus` });

  try {
    await ntfy.sendNtfy({
      topic: SURVIVE_NTFY_TOPIC,
      title: `Citizen ${targetCitizenId} topped up`,
      message: `Leader ${leaderCitizenId} directed $${Number(amountUsd).toFixed(2)} of pooled city bank surplus to ${targetCitizenId}.`,
      priority: 3,
    });
  } catch (_) { /* best-effort */ }

  return { targetCitizenId, leaderCitizenId, amountUsd };
}

module.exports = {
  PROMOTION_SURPLUS_MULTIPLE,
  SPAWN_ALLOCATION_FRACTION,
  MIN_SPAWN_ALLOCATION_USD,
  MAX_ACTIVE_MANAGED_CITIZENS_PER_SPAWN_CYCLE,
  MIN_DAYS_SINCE_LAST_SPAWN,
  computeSpawnAllocation,
  checkBankSpawnGuards,
  executeCloneAndPromote,
  executeBankFundedSpawn,
  executeTopup,
};
