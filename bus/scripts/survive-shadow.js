// survive-shadow.js -- Round 19. Credit-free, real-money-free evidence for
// "was that decision good". Every mission persists a structured snapshot of
// the candidate data research saw; a daily job later scores forward returns
// and compares policies ON THE SAME MISSIONS: the citizen's actual decision
// versus static baselines (hold cash, always-SGOV, always-VOO). It never
// ranks against hindsight-best (equities drift up, which would make
// no-action look bad in any bull run).
//
// Honest limits, printed by the board: while every decision is no-action the
// actual-policy row equals "cash" and nothing can be distinguished; T-bill
// ETFs move ~0.01%/day; ~5 missions/day means weeks before n is meaningful.
// Lookahead rule: a snapshot's reference price is the last session close
// KNOWN at snapshot time (previous close if taken before 16:00 ET, that
// day's close if taken after), and horizons count complete sessions after it.

const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
let SHADOW_PATH = path.join(VAULT_ROOT, 'bus', 'survive-shadow.jsonl');
const HORIZONS = [5, 20];
const BASELINE_SYMBOLS = { 'always-SGOV': 'SGOV', 'always-VOO': 'VOO' };
const MIN_SAMPLES = 30;

function _setShadowPathForTesting(p) { SHADOW_PATH = p; }

function appendShadowEvent(evt) {
  fs.mkdirSync(path.dirname(SHADOW_PATH), { recursive: true });
  fs.appendFileSync(SHADOW_PATH, JSON.stringify({ ts: new Date().toISOString(), ...evt }) + '\n', 'utf8');
}

function readShadowEvents() {
  if (!fs.existsSync(SHADOW_PATH)) return [];
  return fs.readFileSync(SHADOW_PATH, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
}

// ET calendar date and minutes-past-midnight for a timestamp.
function etParts(ms) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

function recordSnapshot({ citizenId, missionId, candidateData, marketOpen, nowMs = Date.now() }) {
  const et = etParts(nowMs);
  const evt = {
    type: 'snapshot', citizenId, missionId, etDate: et.date, etMinutes: et.minutes, marketOpen,
    candidates: candidateData.filter((c) => c.ok).map((c) => ({ symbol: c.symbol, bid: c.bid, ask: c.ask, mid: c.mid, spreadPct: c.spreadPct })),
  };
  appendShadowEvent({ ...evt, ts: new Date(nowMs).toISOString() });
  return evt;
}

// bars: [{date, close}] ascending. Returns forward returns per horizon, or
// null for a horizon not yet elapsed / lacking data. No lookahead: the
// reference is the last session whose close was already known.
function forwardReturns(bars, snapshot) {
  const closeKnownToday = snapshot.etMinutes >= 16 * 60;
  const refIdx = (() => {
    let idx = -1;
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].date < snapshot.etDate || (closeKnownToday && bars[i].date === snapshot.etDate)) idx = i;
    }
    return idx;
  })();
  if (refIdx < 0) return null;
  const ref = bars[refIdx].close;
  const out = { refDate: bars[refIdx].date };
  for (const h of HORIZONS) out[`r${h}`] = bars[refIdx + h] ? bars[refIdx + h].close / ref - 1 : null;
  return out;
}

// Friction: the quoted spread is a real cost only when the market was open at
// snapshot time (closed-market spreads are unreliable). One spread covers the
// round trip to the horizon.
function frictionFor(candidate, marketOpen) {
  if (marketOpen !== true || candidate.spreadPct == null) return 0;
  return candidate.spreadPct / 100;
}

// One snapshot -> per-policy net return per horizon (null when not scorable).
function scoreSnapshot(snapshot, barsBySymbol, decision) {
  const fwd = {};
  for (const c of snapshot.candidates) if (barsBySymbol[c.symbol]) fwd[c.symbol] = forwardReturns(barsBySymbol[c.symbol], snapshot);
  const net = (symbol, h) => {
    const f = fwd[symbol]; const c = snapshot.candidates.find((x) => x.symbol === symbol);
    if (!f || f[`r${h}`] == null || !c) return null;
    return f[`r${h}`] - frictionFor(c, snapshot.marketOpen);
  };
  const policies = { cash: {}, actual: {}, ...Object.fromEntries(Object.keys(BASELINE_SYMBOLS).map((k) => [k, {}])) };
  for (const h of HORIZONS) {
    // Only score a horizon once at least one candidate has data for it.
    const anyData = Object.values(fwd).some((f) => f && f[`r${h}`] != null);
    if (!anyData) continue;
    policies.cash[h] = 0;
    for (const [name, sym] of Object.entries(BASELINE_SYMBOLS)) policies[name][h] = net(sym, h);
    if (!decision) policies.actual[h] = null;
    else if (decision.decision === 'enter' && decision.symbol) policies.actual[h] = net(decision.symbol, h);
    else policies.actual[h] = 0; // hold / no-action / exit -> stayed in cash
  }
  return { policies, decisionKind: decision ? decision.decision : 'unknown' };
}

function buildScoreboard(events) {
  const scores = events.filter((e) => e.type === 'score');
  const rows = {};
  for (const h of HORIZONS) {
    for (const s of scores) {
      for (const [name, byH] of Object.entries(s.policies)) {
        const v = byH[h];
        if (v == null) continue;
        const r = (rows[`${name}@${h}d`] = rows[`${name}@${h}d`] || { policy: name, horizon: h, n: 0, sum: 0 });
        r.n++; r.sum += v;
      }
    }
  }
  const table = Object.values(rows).map((r) => ({ policy: r.policy, horizon: r.horizon, n: r.n, meanReturnPct: +(100 * r.sum / r.n).toFixed(4) }));
  const decisions = scores.map((s) => s.decisionKind);
  const degenerate = scores.length > 0 && decisions.every((d) => d !== 'enter');
  const maxN = Math.max(0, ...table.map((r) => r.n));
  const notes = [];
  if (!scores.length) notes.push('No scored snapshots yet -- horizons have not elapsed or no snapshots exist.');
  if (degenerate) notes.push('Every scored decision was no-action/hold: the actual policy equals cash, so this board cannot yet distinguish anything.');
  if (scores.length && maxN < MIN_SAMPLES) notes.push(`Insufficient data (max n=${maxN} < ${MIN_SAMPLES}); differences are not meaningful yet.`);
  notes.push('T-bill ETFs move ~0.01%/day, so differences vs cash are tiny by construction.');
  return { scored: scores.length, table, notes };
}

module.exports = { recordSnapshot, appendShadowEvent, readShadowEvents, etParts, forwardReturns, scoreSnapshot, buildScoreboard, frictionFor, HORIZONS, MIN_SAMPLES, _setShadowPathForTesting };
