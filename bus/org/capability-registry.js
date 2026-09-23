// bus/org/capability-registry.js -- Round 26. Plan 1 sec 11: "the capability registry is the organization's
// map of what it can actually do." Each entry: input/output schema, cost, latency, permission class,
// reliability, verification method, known failure modes. findOrPropose() implements the "build or acquire"
// decision (search the registry first; only propose a build if nothing existing covers it) -- it never
// builds anything itself (that's a human/Director-authorized job outside this phase's scope), it only makes
// the search-first decision auditable and cheap to test.

const store = require('./store.js');

function register(id, spec) {
  const required = ['inputSchema', 'outputSchema', 'costEstimate', 'permissionTier', 'verificationMethod'];
  for (const k of required) if (!(k in spec)) throw new Error(`capability-registry: "${id}" missing required field "${k}"`);
  // Stored under the 'memory' collection with kind:'capability' -- Plan 1's own memory taxonomy lists
  // "Capability memory: Tools, versions, tests, costs, permissions" as one of the 6 memory types, so this
  // is that type, not a separate ad hoc collection.
  return store.create('memory', `capability_${id}`, { kind: 'capability', capabilityId: id, reliability: null, knownFailureModes: [], ...spec });
}

function get(id) { return store.get('memory', `capability_${id}`); }
function list() { return store.list('memory', (m) => m.kind === 'capability'); }

// A simple relevance search: matches on declared `tags` overlap plus a substring check against id/description
// -- deterministic and cheap, no embedding/model call needed at this registry size (mirrors this project's
// established "grep beats a vector DB below a few thousand documents" precedent from the knowledge-layer work).
function search(query, tags = []) {
  const q = String(query || '').toLowerCase();
  return list().filter((c) => {
    const hay = `${c.capabilityId} ${c.description || ''}`.toLowerCase();
    const tagHit = tags.length && (c.tags || []).some((t) => tags.includes(t));
    return (q && hay.includes(q)) || tagHit;
  });
}

// findOrPropose(): returns either an existing capability to reuse, or a structured "propose a build" record
// -- it commits to nothing; a real build still needs a human/Director-authorized A2+ action elsewhere.
function findOrPropose(need) {
  const hits = search(need.query, need.tags || []);
  if (hits.length) return { decision: 'acquire', matches: hits.map((h) => h.capabilityId) };
  return { decision: 'propose-build', need, rationale: 'no existing capability matched the search' };
}

module.exports = { register, get, list, search, findOrPropose };
