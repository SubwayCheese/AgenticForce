// bus/org/watchdog.js -- Round 26. Plan 1 sec 12 (Persistence and Anti Stall Runtime): lease-expiry sweep
// (delegates to store.js, which already makes it cross-process safe), stale-project detection, and semantic
// anti-stall -- "compares attempted plans and outputs; repeated equivalent work counts as no novelty."
//
// Semantic-equivalence check is deterministic (normalize whitespace/case, strip filler words, compare) --
// NOT a model call, matching this codebase's "cheap deterministic check first, LLM escalation only when
// truly needed" discipline (city-security.js's severe/moderate rules use the same reasoning). A real
// paraphrase-level equivalence check would need a model; this catches the common, cheap case (near-identical
// retries), which is what actually causes stalls in practice, and is honest about that limit rather than
// claiming more.

const store = require('./store.js');

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|a|an|to|of|for|and|is|will|attempt|try|retry)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

// Jaccard similarity over normalized word sets -- cheap, symmetric, no model call.
function similarity(a, b) {
  const wa = new Set(normalize(a).split(' ').filter(Boolean));
  const wb = new Set(normalize(b).split(' ').filter(Boolean));
  if (!wa.size && !wb.size) return 1;
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union ? inter / union : 0;
}

const NOVELTY_THRESHOLD = 0.75; // plans this similar count as "the same attempt again"
const NOVELTY_ATTEMPT_LIMIT = 3; // Plan 1 AT#5: "three semantically equivalent failed plans"

// checkNovelty(): given the history of prior attempt texts for a task and a new proposed attempt, returns
// whether it's novel enough, and whether the task has now hit the anti-stall trigger.
function checkNovelty(priorAttempts, proposedText) {
  const matches = priorAttempts.filter((p) => similarity(p, proposedText) >= NOVELTY_THRESHOLD);
  const trigger = matches.length >= NOVELTY_ATTEMPT_LIMIT - 1; // this attempt would be the Nth equivalent one
  return { novel: matches.length === 0, equivalentCount: matches.length, trigger, mostSimilarScore: priorAttempts.length ? Math.max(...priorAttempts.map((p) => similarity(p, proposedText))) : 0 };
}

// sweep(): one watchdog pass. Pure orchestration over store.js's already-safe primitives; safe to call from
// multiple processes (each underlying task write is still individually CAS-guarded).
function sweep({ now = Date.now() } = {}) {
  const recoveredLeases = store.sweepExpiredLeases(now);
  const staleProjects = store.list('projects', (p) => p.state !== 'TERMINATED' && p.lastDecisionAt && (now - Date.parse(p.lastDecisionAt)) > 7 * 24 * 3600e3).map((p) => p.id);
  return { recoveredLeases, staleProjects, sweptAt: new Date(now).toISOString() };
}

module.exports = { normalize, similarity, checkNovelty, sweep, NOVELTY_THRESHOLD, NOVELTY_ATTEMPT_LIMIT };
