// bus/org/authority.js -- Round 26. Plan 1 sec 16: authority tiers A0-A4, and the "immutable control
// boundary" -- the AI may propose but "cannot unilaterally expand root permissions... or raise its own
// budget". This is the ONE real structural gate: checkAuthority() is the ONLY function in this domain that
// can return { allowed: true } for an action, and every mutating function elsewhere in bus/org/ (treasury.js,
// capital-allocator.js's spawn/scale execution) REQUIRES a real, passed-through AuthorityResult with
// allowed===true before it will act -- not as a convention (the way survive-executor.js is "the only
// intended caller" of the live Alpaca client, enforced by code review and protected-paths.json), but as a
// hard runtime check every mutator performs on its own input. A3/A4 hard-code allowed:false unconditionally
// in this phase, because no human-approval workflow exists yet (Plan 2's replication gate, Phase 6+) -- so no
// code path anywhere in bus/org/, however it's called, can move money or take an A3/A4 action right now. This
// is what makes "real-money and outward actions stay the user's to execute" true by construction, not by
// discipline, for this new domain.
//
// checkAuthority() also enforces Plan 1's evidence-ladder gate (AT#8: "feed a confident but unsupported
// claim; the evidence evaluator prevents promotion to a high-impact action") -- A2 and above require a
// minimum evidence tier on the action's cited evidence.

const TIERS = Object.freeze({
  A0_OBSERVE: 'A0_OBSERVE',
  A1_PREPARE: 'A1_PREPARE',
  A2_REVERSIBLE_EXECUTE: 'A2_REVERSIBLE_EXECUTE',
  A3_COMMITMENT: 'A3_COMMITMENT',
  A4_HIGH_IMPACT: 'A4_HIGH_IMPACT',
});

const EVIDENCE_LEVELS = Object.freeze(['E0', 'E1', 'E2', 'E3', 'E4', 'E5']);
const evidenceRank = (lvl) => EVIDENCE_LEVELS.indexOf(lvl);

// Minimum evidence tier required to even be CONSIDERED at a given authority tier. A1 (drafting, no external
// commitment) needs none; A2 (a reversible real action) needs at least a documented signal; A3/A4 are denied
// outright below regardless of evidence, so their evidence floor is moot but stated for when a human-approval
// workflow is added later.
const MIN_EVIDENCE_FOR_TIER = Object.freeze({
  A0_OBSERVE: null,
  A1_PREPARE: null,
  A2_REVERSIBLE_EXECUTE: 'E1',
  A3_COMMITMENT: 'E3',
  A4_HIGH_IMPACT: 'E3',
});

// action: { tier, evidenceLevel? }  -- evidenceLevel is the STRONGEST evidence level the action's proposal
// cites (E0-E5, Plan 1 sec 9); pass null/undefined if none.
function checkAuthority(action) {
  const tier = action && action.tier;
  if (!TIERS[tier]) return { allowed: false, tier, reason: `unknown authority tier "${tier}"` };

  if (tier === 'A3_COMMITMENT' || tier === 'A4_HIGH_IMPACT') {
    return { allowed: false, tier, reason: `${tier} requires human approval -- no approval workflow exists yet in this phase; this action must be executed by the user, not this runtime` };
  }

  const minEv = MIN_EVIDENCE_FOR_TIER[tier];
  if (minEv) {
    const have = action.evidenceLevel;
    if (!have || evidenceRank(have) < evidenceRank(minEv)) {
      return { allowed: false, tier, reason: `${tier} requires at least ${minEv} evidence, got ${have || 'none'}` };
    }
  }
  return { allowed: true, tier, reason: 'ok', checkedAt: new Date().toISOString() };
}

// requireAuthority(): the guard every mutating function in this domain calls FIRST. Throws (never silently
// no-ops) so a caller that forgot to check authority gets a loud, immediate failure, not a quiet skip.
function requireAuthority(authorityResult, expectAction) {
  if (!authorityResult || authorityResult.allowed !== true) {
    throw new Error(`authority: action denied or no authority check performed (${authorityResult ? authorityResult.reason : 'no AuthorityResult passed'})`);
  }
  if (expectAction && authorityResult.tier !== expectAction.tier) {
    throw new Error(`authority: AuthorityResult tier "${authorityResult.tier}" does not match action tier "${expectAction.tier}"`);
  }
  return true;
}

module.exports = { TIERS, EVIDENCE_LEVELS, checkAuthority, requireAuthority };
