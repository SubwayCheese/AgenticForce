// dispatch-budget.js -- Round 19. MEASURES real codex dispatch volume and
// gates the NEW discretionary dispatchers we own (research swarm now,
// improver agents later). Advisory by design: the shared queue daemon is
// FIFO/single-threaded and the paper fleet feeds it directly, so this
// module cannot stop the fleet or reorder the queue. Throttling the fleet
// is a human decision; this module reports the numbers for it.
//
// Known misses (printed by `status`, not hidden): swarm spawns and health
// probes bypass the daemon log (swarm is added back from its own event
// log); direct codex callers (run-continuous.js, run-research-crew.js,
// run-backlog.js, watch-inbox.js) and Claude-side usage are invisible here.

const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const QUEUE_LOG = path.join(VAULT_ROOT, 'bus', 'queue-daemon.log');
const SWARM_EVENTS = path.join(VAULT_ROOT, 'bus', 'research-swarm-events.jsonl');
const CONFIG_PATH = path.join(VAULT_ROOT, 'bus', 'dispatch-budget.json');
const CALIBRATION_PATH = path.join(VAULT_ROOT, 'bus', 'dispatch-calibration.jsonl');

const HOUR = 3600 * 1000;
const WINDOWS = { '5h': 5 * HOUR, '24h': 24 * HOUR, '7d': 7 * 24 * HOUR };
const FLEET_RE = /^(fleet_pilot|crypto_pilot|continuous_backtest|strategy_backtest|backtest)/;

function basename(id) { return String(id).split('/').pop(); }

// City tasks live under tasks/survive/ and are named survive_c<citizen>_...;
// queue ids carry the directory prefix ("survive/survive_cC1_mission005_x").
function classify(taskId) {
  const b = basename(taskId);
  if (/^survive_c/.test(b)) return 'city';
  if (FLEET_RE.test(b)) return 'fleet';
  return 'other';
}

// Only tasks that reached DONE cost usage; QUEUED/BLOCKED/ERROR are free or
// unknowable. The agent comes from the QUEUED line's "(to: X)"; only codex
// counts here (claude-agent work is Claude-side). Unknown agent -> codex.
function parseQueueLog(text) {
  const agentOf = new Map();
  const dones = [];
  let firstTs = null;
  for (const line of text.split('\n')) {
    const m = /^\[(\d{4}-\d\d-\d\dT[\d:.]+Z)\] (.*)$/.exec(line);
    if (!m) continue;
    const ts = Date.parse(m[1]);
    if (firstTs === null) firstTs = ts;
    const rest = m[2];
    const q = /^QUEUED: (\S+) \(to: ([^)]+)\)/.exec(rest);
    if (q) { agentOf.set(q[1], q[2]); continue; }
    const d = /^(\S+): DONE\b/.exec(rest);
    if (d) dones.push({ ts, id: d[1] });
  }
  return { firstTs, dones: dones.map((e) => ({ ...e, agent: agentOf.get(e.id) || 'codex' })).filter((e) => e.agent === 'codex') };
}

function readSwarmDispatches(eventsPath) {
  let text = '';
  try { text = fs.readFileSync(eventsPath, 'utf8'); } catch (_) { return []; }
  return text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
    .filter((e) => e && e.type === 'specialist-resolved' && e.exitCode === 0)
    .map((e) => ({ ts: Date.parse(e.ts), id: e.taskId, cls: 'swarm' }));
}

function summarize({ now = Date.now(), queueLog = QUEUE_LOG, swarmEvents = SWARM_EVENTS } = {}) {
  let text = null;
  try { text = fs.readFileSync(queueLog, 'utf8'); } catch (_) { /* fail closed below */ }
  const parsed = text === null ? { firstTs: null, dones: [] } : parseQueueLog(text);
  const events = [...parsed.dones.map((e) => ({ ts: e.ts, id: e.id, cls: classify(e.id) })), ...readSwarmDispatches(swarmEvents)];
  const windows = {};
  for (const [name, span] of Object.entries(WINDOWS)) {
    const c = { city: 0, fleet: 0, swarm: 0, improver: 0, other: 0, total: 0 };
    for (const e of events) if (now - e.ts <= span && e.ts <= now) { c[e.cls] = (c[e.cls] || 0) + 1; c.total++; }
    windows[name] = c;
  }
  return {
    logReadable: text !== null,
    coverageHours: parsed.firstTs === null ? 0 : (now - parsed.firstTs) / HOUR,
    windows,
  };
}

function readConfig(configPath = CONFIG_PATH) {
  const defaults = { caps: { swarm: { daily: 30 }, improver: { daily: 10 } }, discretionaryCeiling24h: 160, healthMaxAgeHours: 6, minLogCoverageHours: 24 };
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }; } catch (_) { return defaults; }
}

// allow(cls): may a discretionary dispatcher of this class spend a codex
// call right now? Async because a missing/stale/non-ok health state is
// resolved by a probe (free when codex is out of credits, one tiny call
// otherwise) -- a stale "ok" must not license spending, and a stale "down"
// must not block forever just because no city mission is wedged to probe.
async function allow(cls, { probe = true, probeFn, recordFn, now = Date.now(), summary, config } = {}) {
  if (cls === 'city') return { allow: true, reason: 'city decisions are P0, never gated here' };
  const cfg = config || readConfig();
  const health = require('./codex-health.js');
  let state = health.readState();
  const ageH = state && state.lastChecked ? (now - Date.parse(state.lastChecked)) / HOUR : Infinity;
  if (!state || state.status !== 'ok' || ageH > cfg.healthMaxAgeHours) {
    if (!probe) return { allow: false, reason: `codex health ${state ? state.status : 'unknown'} (stale/unverified) and probing disabled for this check` };
    const p = await (probeFn || health.probeCodex)();
    state = await (recordFn || health.recordProbe)(p);
    if (state.status !== 'ok') return { allow: false, reason: `codex unavailable: ${state.status}` };
  }
  const s = summary || summarize({ now });
  if (!s.logReadable) return { allow: false, reason: 'queue-daemon.log unreadable -- failing closed' };
  if (s.coverageHours < cfg.minLogCoverageHours) return { allow: false, reason: `queue-daemon.log covers only ${s.coverageHours.toFixed(1)}h (<${cfg.minLogCoverageHours}h) -- failing closed` };
  const day = s.windows['24h'];
  const cap = cfg.caps && cfg.caps[cls] && cfg.caps[cls].daily;
  if (cap !== undefined && day[cls] >= cap) return { allow: false, reason: `${cls} daily cap reached (${day[cls]}/${cap})` };
  if (day.total >= cfg.discretionaryCeiling24h) return { allow: false, reason: `24h total ${day.total} >= discretionary ceiling ${cfg.discretionaryCeiling24h}` };
  return { allow: true, reason: 'ok' };
}

// Called by codex-health on an ok -> out-of-credits transition. Records the
// real volume in each window at the moment the limit was hit, so a ceiling
// can be suggested per window type (5h window vs weekly cap) from data.
function recordExhaustion({ detail = null, now = Date.now(), calibrationPath = CALIBRATION_PATH, summary } = {}) {
  const s = summary || summarize({ now });
  const row = { ts: new Date(now).toISOString(), detail, counts5h: s.windows['5h'], counts24h: s.windows['24h'], counts7d: s.windows['7d'] };
  fs.appendFileSync(calibrationPath, JSON.stringify(row) + '\n', 'utf8');
  return row;
}

// Suggestions only; never auto-applied. 80% of the smallest observed volume
// at exhaustion, computed separately per window type.
function suggestCeilings(calibrationPath = CALIBRATION_PATH) {
  let rows = [];
  try { rows = fs.readFileSync(calibrationPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_) { /* none yet */ }
  if (!rows.length) return { observations: 0 };
  const min = (k) => Math.min(...rows.map((r) => r[k].total));
  return { observations: rows.length, suggested5h: Math.floor(min('counts5h') * 0.8), suggested7d: Math.floor(min('counts7d') * 0.8) };
}

function formatStatus(s, cfg, suggestions) {
  const lines = [];
  lines.push(`queue-daemon.log: ${s.logReadable ? `readable, covers ${s.coverageHours.toFixed(0)}h` : 'UNREADABLE (discretionary dispatch fails closed)'}`);
  for (const [name, c] of Object.entries(s.windows)) {
    const share = c.total ? ` | fleet ${(100 * c.fleet / c.total).toFixed(0)}% city ${(100 * c.city / c.total).toFixed(0)}%` : '';
    lines.push(`${name.padEnd(4)} total ${String(c.total).padStart(4)} | city ${c.city} fleet ${c.fleet} swarm ${c.swarm} other ${c.other}${share}`);
  }
  lines.push(`caps: ${JSON.stringify(cfg.caps)} ceiling24h=${cfg.discretionaryCeiling24h}`);
  lines.push(`calibration: ${JSON.stringify(suggestions)}`);
  lines.push('Counts = completed codex tasks in the queue-daemon log + research-swarm resolutions. NOT included: health probes, direct codex callers (run-continuous/run-research-crew/run-backlog/watch-inbox), Claude-side usage.');
  return lines.join('\n');
}

module.exports = { classify, parseQueueLog, summarize, readConfig, allow, recordExhaustion, suggestCeilings, formatStatus, QUEUE_LOG, CONFIG_PATH, CALIBRATION_PATH };

if (require.main === module) {
  if ((process.argv[2] || 'status') === 'status') console.log(formatStatus(summarize(), readConfig(), suggestCeilings()));
  else { console.error('usage: node dispatch-budget.js status'); process.exit(2); }
}
