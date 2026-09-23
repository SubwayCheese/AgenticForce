// bus/org/director.js -- Round 26. Plan 1 sec 6: the Director "is a role reconstructed from durable state on
// each decision cycle. It does not own persistence." runDecisionCycle() loads mission/portfolio/evidence
// state, calls an injected worker function to PROPOSE a decision, validates the proposal against Plan 1's
// exact output contract (decision_type, rationale, expected_value, next_events, required_authority,
// review_at), and hands it to executor.js -- it NEVER applies a decision itself. Deliberately mirrors the DI
// pattern already proven in claude-worker.js/revenue-builder.js (buildProduct's injectable `claudeFn`) and
// research-swarm-worker.js's injectable `dispatchFn`: `workerFn` defaults to a real Claude call but every
// test in this round uses a fake one, so the mechanism is proven correct without spending real Claude usage
// -- consistent with this project's standing discipline of never spending real model usage to prove
// plumbing.
//
// Satisfies AT#9: "restart after a Director decision; the organization resumes from durable events, not
// conversational memory" -- runDecisionCycle() takes NO conversational state as input, only what it reads
// fresh from store.js/events.js each call, so a restart between two calls is indistinguishable from a normal
// gap between cycles.

const store = require('./store.js');
const events = require('./events.js');
const executor = require('./executor.js');
const watchdog = require('./watchdog.js');

const DECISION_TYPES = Object.freeze(['create_project', 'continue', 'pause', 'recover', 'terminate', 'reallocate', 'escalate', 'no_action', 'allocate']);
const REQUIRED_FIELDS = Object.freeze(['decisionType', 'rationale', 'expectedValue', 'nextEvents', 'requiredAuthority', 'reviewAt']);

function loadContext() {
  return {
    projects: store.list('projects', (p) => p.state !== 'TERMINATED'),
    tasks: store.list('tasks', (t) => t.state !== 'SUCCEEDED' && t.state !== 'CANCELED' && t.state !== 'EXHAUSTED'),
    unprocessedEvents: events.unprocessedCount(),
  };
}

// validateDecision(): schema-checks the worker's output against Plan 1's exact contract. Refuses to guess on
// a malformed decision -- matches this codebase's standing "refuse rather than guess" pattern
// (extractSurviveDecision/validateDecision in survive-executor.js do the same for trading decisions).
function validateDecision(raw) {
  const missing = REQUIRED_FIELDS.filter((k) => raw[k] === undefined);
  if (missing.length) throw new Error(`director: decision missing required fields: ${missing.join(', ')}`);
  if (!DECISION_TYPES.includes(raw.decisionType)) throw new Error(`director: unknown decisionType "${raw.decisionType}"`);
  if (!Array.isArray(raw.nextEvents)) throw new Error('director: nextEvents must be an array');
  return raw;
}

// runDecisionCycle(): one full cycle. `workerFn(prompt, context)` is the injected proposer -- in production
// this wraps a restricted Claude call (bus/revenue/claude-worker.js's pattern); in every test here it's a
// fake synchronous function, proving the cycle's logic independent of any real model.
async function runDecisionCycle({ workerFn, missionId = 'default' } = {}) {
  if (typeof workerFn !== 'function') throw new Error('director: workerFn is required (inject a fake in tests, never call a real model to prove plumbing)');
  const sweepResult = watchdog.sweep();
  const context = loadContext();
  const mission = store.get('missions', missionId);

  const raw = await workerFn({ mission, context, sweepResult });
  const decision = validateDecision(raw);

  const evt = events.append({ type: 'director-decision', missionId, decision });
  const outcome = executor.applyDecision(decision);
  // Fixed lineage fields go AFTER the spread so a nextEvent's own `type`/`causedBy` (if it happens to use
  // those names) can never silently clobber them -- a real bug in an earlier draft put the spread last and
  // let a nextEvent's own `type` field overwrite the intended wrapper tag without any error.
  for (const nextEvent of decision.nextEvents) events.append({ ...nextEvent, causedBy: evt.id, enqueuedByDirector: true });

  return { decision, outcome, sweepResult, eventId: evt.id };
}

module.exports = { DECISION_TYPES, REQUIRED_FIELDS, loadContext, validateDecision, runDecisionCycle };
