// bus/org/blocker-classifier.js -- Round 26. Plan 1 sec 10 "Blocked Work and Recovery": BLOCKED is a
// classified state with a routed recovery pattern, not a dead end; repeated recovery with no new information
// becomes EXHAUSTED, a real terminal state (never silently retried forever). Deterministic classification
// (regex/keyword rules over the blocker description), same "cheap, non-model, can't itself be manipulated by
// injected text" discipline this codebase already uses for city-security.js's severe/moderate rules.
//
// Satisfies Plan 1 acceptance test #4 directly: "force a missing-account blocker; the system proposes
// authorized alternatives or a targeted handoff" -- classify() returns the ACCOUNT_OR_IDENTITY class with a
// recovery pattern naming exactly that (use an authorized existing account / human handoff / choose a
// channel that doesn't require one).

const CLASSES = Object.freeze({
  MISSING_INFORMATION: { recovery: 'Research, ask a targeted question, or create a measurement.' },
  MISSING_CAPABILITY: { recovery: 'Find an existing tool, build an adapter, or redesign the task.' },
  ACCOUNT_OR_IDENTITY: { recovery: 'Use an authorized existing account, prepare a human handoff, or choose a channel that does not require one.' },
  PERMISSION_BOUNDARY: { recovery: 'Request explicit authorization or select a lower-authority alternative.' },
  ECONOMIC_INFEASIBILITY: { recovery: 'Reduce scope, test a cheaper hypothesis, or terminate.' },
  TECHNICAL_FAILURE: { recovery: 'Retry idempotently, change method, isolate the dependency, or roll back.' },
  EXTERNAL_WAIT: { recovery: 'Register a timer or observable trigger; release the worker.' },
  NO_VIABLE_PATH: { recovery: 'Mark EXHAUSTED with attempted paths and evidence.' },
});

// Ordered rules, most-specific first; first match wins. Each is [class, regex] over the blocker's free-text
// description -- intentionally simple pattern matching, not an LLM call, so a blocker's own (possibly
// attacker-influenced) text cannot manipulate which recovery path gets chosen.
const RULES = [
  ['ACCOUNT_OR_IDENTITY', /\b(account|kyc|identity verif|sign[\s-]?up|log ?in required|credential|api key|not (yet )?provisioned)\b/i],
  ['PERMISSION_BOUNDARY', /\b(permission denied|not authorized|forbidden|authority (required|exceeded)|policy (blocks|denies))\b/i],
  ['MISSING_CAPABILITY', /\b(no (tool|adapter|integration)|unsupported|not implemented|capability (missing|not found))\b/i],
  ['ECONOMIC_INFEASIBILITY', /\b(too expensive|budget exceeded|cost exceeds|not (economically )?viable|negative margin)\b/i],
  ['EXTERNAL_WAIT', /\b(waiting (for|on)|pending (approval|review|response)|scheduled|not yet due|rate limit)\b/i],
  ['TECHNICAL_FAILURE', /\b(error|exception|crash|timeout|timed out|connection (refused|reset)|5\d\d\b)\b/i],
  ['MISSING_INFORMATION', /\b(unknown|unclear|need(s)? (more )?info|insufficient (data|evidence)|not (yet )?confirmed)\b/i],
];

function classify(blockerText, { attemptsSoFar = 0 } = {}) {
  const text = String(blockerText || '');
  let cls = 'NO_VIABLE_PATH';
  for (const [name, re] of RULES) if (re.test(text)) { cls = name; break; }
  const def = CLASSES[cls];
  return { class: cls, recovery: def.recovery, attemptsSoFar, description: text };
}

// EXHAUSTED transition rule: Plan 1's own worked example uses "no new information" as the trigger, not a
// fixed count alone -- but a fixed cap is the honest, code-checkable proxy for "no new information" this
// phase can implement without an evaluator judging novelty in prose (that's watchdog.js's semantic anti-stall
// job for repeated PLANS; this is the blocker-specific cap). MAX_RECOVERY_ATTEMPTS mirrors the anti-stall
// ladder's own step count (retry -> change method -> new evidence/capability -> reduce scope -> escalate ->
// exhaust = 6 rungs, so 5 attempted recoveries before the 6th call is EXHAUSTED).
const MAX_RECOVERY_ATTEMPTS = 5;

function shouldExhaust(attemptsSoFar) { return attemptsSoFar >= MAX_RECOVERY_ATTEMPTS; }

module.exports = { CLASSES, classify, shouldExhaust, MAX_RECOVERY_ATTEMPTS };
