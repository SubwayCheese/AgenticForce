// apify-stats.js -- Round 21. READ-ONLY revenue/usage tracker for the published Actors.
// Appends one snapshot per run to bus/apify-stats.jsonl and prints per-Actor deltas
// versus the previous snapshot, so we can see what is actually being used before
// building anything else. Uses only the Apify REST API with the secrets-broker token
// (GET requests only). Counts include the owner's own test runs, so the first weeks
// mostly measure our own activity; watch `users` and the delta in runs.
// Usage: node apify-stats.js [--no-write]

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const API = 'https://api.apify.com/v2';
const VAULT_ROOT = avPaths.ROOT;
let LOG_PATH = path.join(VAULT_ROOT, 'bus', 'apify-stats.jsonl');
function _setLogPathForTesting(p) { LOG_PATH = p; }

async function apiGet(p, token, fetchFn) {
  const res = await fetchFn(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}`);
  return (await res.json()).data;
}

function readSnapshots() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
}

async function collect({ token, fetchFn = globalThis.fetch } = {}) {
  const tok = token || require('../platform/secrets-broker.js').loadSecret('APIFY_TOKEN');
  const list = await apiGet('/acts?my=true&limit=100', tok, fetchFn);
  const actors = [];
  for (const a of list.items) {
    const d = await apiGet(`/acts/${a.id}`, tok, fetchFn);
    const pi = (d.pricingInfos || []).slice(-1)[0];
    const s = d.stats || {};
    actors.push({ name: d.name, public: !!d.isPublic, priced: !!(pi && pi.pricingModel === 'PAY_PER_EVENT'), runs: s.totalRuns || 0, users: s.totalUsers || 0, lastRunStartedAt: s.lastRunStartedAt || null });
  }
  return { ts: new Date().toISOString(), actors };
}

function diff(prev, cur) {
  const before = new Map(((prev && prev.actors) || []).map((a) => [a.name, a]));
  return cur.actors.map((a) => { const b = before.get(a.name); return { ...a, runsDelta: b ? a.runs - b.runs : null, usersDelta: b ? a.users - b.users : null }; });
}

module.exports = { collect, diff, readSnapshots, _setLogPathForTesting };

if (require.main === module) {
  (async () => {
    const snaps = readSnapshots();
    const cur = await collect();
    if (!process.argv.includes('--no-write')) { fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true }); fs.appendFileSync(LOG_PATH, JSON.stringify(cur) + '\n', 'utf8'); }
    for (const a of diff(snaps[snaps.length - 1], cur)) console.log(`${a.name.padEnd(24)} public=${a.public} priced=${a.priced} runs=${a.runs}${a.runsDelta === null ? '' : ` (${a.runsDelta >= 0 ? '+' : ''}${a.runsDelta})`} users=${a.users}${a.usersDelta === null ? '' : ` (${a.usersDelta >= 0 ? '+' : ''}${a.usersDelta})`}`);
  })().catch((e) => { console.error('stats failed:', e.message); process.exit(1); });
}
