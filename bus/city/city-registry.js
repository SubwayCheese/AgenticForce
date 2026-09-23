// city-registry.js -- citizen identity, role, and lineage for the
// "survive" branch (ARCHITECTURE.md section 19). No new database: one
// fact per citizen via the existing generic memory-store.js, exactly like
// every other durable record in this codebase.
//
// ROUND 3 CHANGE, direct user correction: "leader" used to be purely
// computed from foundedByLeaderId (any citizen that ever spawned a child
// was a leader of exactly that one child, 1:1 with spawn count). The user
// explicitly does not want that -- leader count should be a small,
// ratio-sized population (see city-leadership.js), not 1:1 with spawning.
// So `role: 'citizen'|'leader'` is now a REAL STORED FIELD, promoted by
// city-leadership.js's algorithm, not derived from who-spawned-whom.
// `foundedByLeaderId` stays as pure historical provenance (who spawned
// this citizen -- never reassigned); the new `managedByLeaderId` is the
// mutable field for "who currently has delegation authority over me"
// (may be reassigned if the original leader goes KIA -- see
// city-leadership.js's reassignOrphanedCitizens()).

const memoryStore = require('../platform/memory-store.js');

const CITIZEN_FACT_PREFIX = 'survive_citizen_';
const CITIZEN_FACT_SUFFIX = '_profile';

function factKeyFor(citizenId) {
  return `${CITIZEN_FACT_PREFIX}${citizenId}${CITIZEN_FACT_SUFFIX}`;
}

// profile: { citizenId, status: 'active'|'kia', role: 'citizen'|'leader',
//            foundedByLeaderId, managedByLeaderId,
//            fundingSource: 'human-genesis'|'bank-allocation',
//            genesisAllocationUsd, mechanism, foundedAt }
function registerCitizen(profile) {
  if (!profile || !profile.citizenId) throw new Error('registerCitizen requires a citizenId');
  const key = factKeyFor(profile.citizenId);
  if (memoryStore.getFact(key)) {
    throw new Error(`citizen ${profile.citizenId} is already registered -- refusing to overwrite via registerCitizen (use updateCitizenStatus for status changes)`);
  }
  const full = {
    status: 'active',
    role: 'citizen',
    foundedByLeaderId: null,
    managedByLeaderId: profile.foundedByLeaderId || null, // defaults to the founder; may diverge later via reassignment
    foundedAt: new Date().toISOString(),
    quarantined: false, // round 7 -- see quarantineCitizen()/unquarantineCitizen() below
    ...profile,
  };
  memoryStore.recordFact(key, full, { sourceTaskId: 'city-registry', taskTo: 'claude' });
  return full;
}

// Re-records the SAME fact key with an updated profile -- history is
// preserved via memory-store's getFactHistory(), "current" is always the
// latest entry via getFact().
function updateCitizenStatus(citizenId, status, { note } = {}) {
  const existing = getCitizen(citizenId);
  if (!existing) throw new Error(`citizen ${citizenId} is not registered -- cannot update status`);
  const updated = { ...existing, status, statusNote: note || null, statusUpdatedAt: new Date().toISOString() };
  memoryStore.recordFact(factKeyFor(citizenId), updated, { sourceTaskId: 'city-registry', taskTo: 'claude' });
  return updated;
}

// Records which mechanism a citizen actually used, the FIRST time it
// actually acts -- a citizen registers with mechanism:null (a founder
// picks freely on its first mission; a bank-funded spawn is told one by
// the leader council; a clone inherits its parent's at registration
// already) and this is a no-op once already set, so it's safe to call on
// every entry without overwriting an established choice. Needed for two
// real downstream consumers: executeCloneAndPromote() inherits THIS
// field, and survive-journal.js's getPostmortemsForMechanism() looks
// dead citizens up by it.
function recordCitizenMechanismIfUnset(citizenId, mechanism) {
  const existing = getCitizen(citizenId);
  if (!existing) throw new Error(`citizen ${citizenId} is not registered -- cannot record mechanism`);
  if (existing.mechanism) return existing; // already set -- never overwritten
  const updated = { ...existing, mechanism };
  memoryStore.recordFact(factKeyFor(citizenId), updated, { sourceTaskId: 'city-registry', taskTo: 'claude' });
  return updated;
}

// Promotion/demotion -- the ONLY thing that changes `role`. Called by
// city-leadership.js's ratio-driven promotion algorithm, never by a
// citizen or leader deciding its own role.
function updateCitizenRole(citizenId, role, { note } = {}) {
  if (role !== 'citizen' && role !== 'leader') throw new Error(`role must be 'citizen' or 'leader', got ${role}`);
  const existing = getCitizen(citizenId);
  if (!existing) throw new Error(`citizen ${citizenId} is not registered -- cannot update role`);
  const updated = { ...existing, role, roleNote: note || null, roleUpdatedAt: new Date().toISOString() };
  memoryStore.recordFact(factKeyFor(citizenId), updated, { sourceTaskId: 'city-registry', taskTo: 'claude' });
  return updated;
}

// Reassigns which leader currently oversees a citizen -- used by
// city-leadership.js's reassignOrphanedCitizens() when a citizen's
// current leader has gone KIA or been demoted.
function reassignManagedByLeader(citizenId, newLeaderCitizenId) {
  const existing = getCitizen(citizenId);
  if (!existing) throw new Error(`citizen ${citizenId} is not registered -- cannot reassign`);
  const updated = { ...existing, managedByLeaderId: newLeaderCitizenId };
  memoryStore.recordFact(factKeyFor(citizenId), updated, { sourceTaskId: 'city-registry', taskTo: 'claude' });
  return updated;
}

// ROUND 7 -- city-security.js's one write power over a citizen's record.
// A freeze, not a deletion: preserves all ledger/mission/email history
// untouched, structural (every money-moving/email-sending function checks
// this as its first line -- see survive-executor.js/citizen-lifecycle.js/
// survive-email.js), reversible only via unquarantineCitizen() below.
// Idempotent -- quarantining an already-quarantined citizen is a no-op,
// not an error (a second rule firing on the same citizen shouldn't throw).
function quarantineCitizen(citizenId, reason) {
  const existing = getCitizen(citizenId);
  if (!existing) throw new Error(`citizen ${citizenId} is not registered -- cannot quarantine`);
  if (existing.quarantined) return existing;
  const updated = { ...existing, quarantined: true, quarantineReason: reason || null, quarantinedAt: new Date().toISOString() };
  memoryStore.recordFact(factKeyFor(citizenId), updated, { sourceTaskId: 'city-security', taskTo: 'claude' });
  return updated;
}

// HUMAN-CLI-ONLY, same asymmetry as every other "easy to trip, hard to
// release" gate in this codebase (city-reserve.js's recordReserveWithdrawal(),
// the first-spawn confirmation removed in round 6 while it still existed).
// Freezing a suspicious citizen should be cheap and automatic; releasing one
// should require a human who actually looked at why. No code path other
// than city-security.js's own CLI block may call this -- verified by grep,
// same discipline already used for city-reserve.js's withdrawal function.
function unquarantineCitizen(citizenId, note) {
  const existing = getCitizen(citizenId);
  if (!existing) throw new Error(`citizen ${citizenId} is not registered -- cannot unquarantine`);
  const updated = { ...existing, quarantined: false, quarantineReason: null, quarantineReleaseNote: note || null, quarantineReleasedAt: new Date().toISOString() };
  memoryStore.recordFact(factKeyFor(citizenId), updated, { sourceTaskId: 'city-security-human-cli', taskTo: 'claude' });
  return updated;
}

function getCitizen(citizenId) {
  const fact = memoryStore.getFact(factKeyFor(citizenId));
  return fact ? fact.value : null;
}

function listCitizens() {
  return memoryStore.listKeys()
    .filter((k) => k.key.startsWith(CITIZEN_FACT_PREFIX) && k.key.endsWith(CITIZEN_FACT_SUFFIX))
    .map((k) => k.latest.value)
    .filter(Boolean);
}

// Next id: scan existing citizen ids ("C1", "C2", ...), take the max
// numeric suffix + 1 -- never reused even if a citizen is later archived.
function nextCitizenId() {
  const citizens = listCitizens();
  let max = 0;
  for (const c of citizens) {
    const m = /^C(\d+)$/.exec(c.citizenId || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `C${max + 1}`;
}

// Builds the PROVENANCE graph purely from raw foundedByLeaderId links --
// still real, useful data (who spawned whom, historically), but as of
// round 3 this is no longer the definition of leadership (see isLeader()
// below) -- a citizen can appear here as a "founder" of someone without
// currently holding the leader role (e.g. if it was later demoted or
// never promoted in the first place, since promotion is ratio-gated, not
// automatic on spawning). Returns { nodes: [citizen...], byId: Map,
// childrenOf: Map, depthOf: Map, maxDepth }.
function buildLineageTree() {
  const citizens = listCitizens();
  const byId = new Map(citizens.map((c) => [c.citizenId, c]));
  const childrenOf = new Map();
  for (const c of citizens) {
    if (!c.foundedByLeaderId) continue;
    const list = childrenOf.get(c.foundedByLeaderId) || [];
    list.push(c.citizenId);
    childrenOf.set(c.foundedByLeaderId, list);
  }
  const roots = citizens.filter((c) => !c.foundedByLeaderId).map((c) => c.citizenId);
  const depthOf = new Map();
  function walk(id, depth) {
    depthOf.set(id, depth);
    for (const childId of (childrenOf.get(id) || [])) walk(childId, depth + 1);
  }
  for (const rootId of roots) walk(rootId, 1);
  const maxDepth = depthOf.size ? Math.max(...depthOf.values()) : 0;
  return { nodes: citizens, byId, childrenOf, roots, depthOf, maxDepth };
}

// Round 3: leadership is the STORED role field, not a computed
// spawning-relationship. A citizen with children in buildLineageTree()
// who was never promoted (or was later demoted) is NOT a leader by this
// check -- matches the user's explicit "not every citizen should have a
// [distinct 1:1] leader" correction.
function isLeader(citizenId) {
  const c = getCitizen(citizenId);
  return !!(c && c.role === 'leader');
}

function listLeaders() {
  return listCitizens().filter((c) => c.role === 'leader');
}

function listActiveLeaders() {
  return listCitizens().filter((c) => c.role === 'leader' && c.status === 'active');
}

function listActiveCitizens() {
  return listCitizens().filter((c) => c.status === 'active');
}

// Citizens managed by a leader that is no longer active (KIA or demoted)
// -- the input city-leadership.js's reassignOrphanedCitizens() acts on.
// Leaders themselves are excluded -- a leader manages, it doesn't need to
// BE managed (a leader with managedByLeaderId:null, like the founder
// before its first promotion, is a normal, expected state, not an orphan).
function listOrphanedCitizens() {
  const byId = new Map(listCitizens().map((c) => [c.citizenId, c]));
  return listActiveCitizens().filter((c) => {
    if (c.role === 'leader') return false;
    if (!c.managedByLeaderId) return true; // a plain citizen with no leader at all needs one
    const leader = byId.get(c.managedByLeaderId);
    return !leader || leader.role !== 'leader' || leader.status !== 'active';
  });
}

module.exports = {
  registerCitizen,
  updateCitizenStatus,
  updateCitizenRole,
  recordCitizenMechanismIfUnset,
  reassignManagedByLeader,
  quarantineCitizen,
  unquarantineCitizen,
  getCitizen,
  listCitizens,
  listLeaders,
  listActiveLeaders,
  listActiveCitizens,
  listOrphanedCitizens,
  nextCitizenId,
  buildLineageTree,
  isLeader,
  factKeyFor,
};

// CLI: node city-registry.js list | tree
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'list') {
    console.log(JSON.stringify(listCitizens(), null, 2));
  } else if (cmd === 'tree') {
    const tree = buildLineageTree();
    console.log(JSON.stringify({ roots: tree.roots, childrenOf: Object.fromEntries(tree.childrenOf), maxDepth: tree.maxDepth }, null, 2));
  } else {
    console.error('Usage: node city-registry.js list|tree');
    process.exit(1);
  }
}
