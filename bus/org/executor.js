// bus/org/executor.js -- Round 26. The SOLE orchestration point that turns a Director decision (a proposal)
// into real state mutations -- mirrors this codebase's established, proven precedent exactly:
// bus/city/survive-executor.js is the one caller of the live Alpaca client and checks the budget envelope
// first; this file is that same shape for the org runtime. It is named as a standalone file (not folded into
// director.js) specifically so it can be listed in bus/protected-paths.json the same way survive-executor.js
// is -- a review of the first draft flagged that authority.js's A3/A4-deny alone doesn't guarantee anything
// if some future caller mutates treasury.js/store.js directly; this file is the documented single path, and
// treasury.js's own mutators independently re-check authority as a second, structural backstop (belt AND
// suspenders -- neither alone is trusted).
//
// A decision (Plan 1's Director output contract: decision_type, rationale, expected_value, next_events,
// required_authority, review_at) is applied here ONLY after authority.checkAuthority(decision.action) returns
// allowed:true. Nothing here ever constructs an AuthorityResult itself -- it always calls authority.js for a
// real one, so this file cannot forge its own permission.

const store = require('./store.js');
const events = require('./events.js');
const authority = require('./authority.js');
const treasury = require('./treasury.js');
const blockerClassifier = require('./blocker-classifier.js');

// applyDecision(): the one function that turns a proposed decision into store/treasury mutations. Returns a
// structured outcome; NEVER throws for a denial (a denial is a normal, expected outcome, not an exceptional
// one) -- it only throws for a malformed decision object, so a caller can't silently ignore a real bug.
function applyDecision(decision) {
  if (!decision || !decision.decisionType) throw new Error('executor: decision.decisionType is required');
  const action = decision.action || { tier: decision.requiredAuthority };
  const authResult = authority.checkAuthority(action);
  const outcome = { decisionType: decision.decisionType, authority: authResult, applied: false };

  if (!authResult.allowed) {
    events.append({ type: 'decision-denied', decisionType: decision.decisionType, reason: authResult.reason });
    return outcome;
  }

  switch (decision.decisionType) {
    case 'create_project': {
      const p = store.create('projects', decision.projectId, { state: 'DISCOVERY', goal: decision.goal, ownerRole: decision.ownerRole || 'director', ...decision.projectFields });
      outcome.applied = true; outcome.result = p; break;
    }
    case 'continue':
    case 'pause':
    case 'terminate': {
      const proj = store.get('projects', decision.projectId);
      if (!proj) { outcome.applied = false; outcome.reason = 'project not found'; break; }
      const nextState = decision.decisionType === 'terminate' ? 'TERMINATED' : decision.decisionType === 'pause' ? 'PAUSED' : proj.state;
      const r = store.put('projects', decision.projectId, proj.version, { state: nextState, lastDecisionAt: new Date().toISOString() });
      outcome.applied = r.ok; outcome.result = r; break;
    }
    case 'recover': {
      const cls = blockerClassifier.classify(decision.blockerText, { attemptsSoFar: decision.attemptsSoFar || 0 });
      outcome.applied = true; outcome.result = { ...cls, exhaust: blockerClassifier.shouldExhaust(cls.attemptsSoFar) };
      break;
    }
    case 'allocate': {
      // Money-moving: this is exactly the A3/A4-gated path -- authority.checkAuthority already ran above
      // and, in this phase, an 'allocate' action tagged A2 or below can proceed through the reversible-only
      // treasury flow; anything requiring A3/A4 was already denied before reaching here.
      const req = treasury.requestTransaction(decision.transaction);
      const auth = treasury.authorizeTransaction(req.transactionId, authResult);
      outcome.applied = !!auth.ok; outcome.result = auth; break;
    }
    case 'no_action':
      outcome.applied = true; outcome.result = 'no-op by design'; break;
    default:
      outcome.applied = false; outcome.reason = `unhandled decisionType "${decision.decisionType}"`;
  }
  events.append({ type: 'decision-applied', decisionType: decision.decisionType, applied: outcome.applied });
  return outcome;
}

module.exports = { applyDecision };
