// survive-shadow-score.js -- Round 19. Daily, no LLM, no codex. Scores every
// snapshot whose horizons have elapsed (idempotent: one score event per
// snapshot per run key) and prints the policy scoreboard.
// Usage: node survive-shadow-score.js [run|board]

const shadow = require('./survive-shadow.js');
const marketData = require('./survive-market-data.js');
const executor = require('./survive-executor.js');
const { SURVIVE_CANDIDATE_UNIVERSE } = require('./survive-supervisor.js');

function decisionForMission(citizenId, missionId, readEvents = executor.readMissionEvents, extract = executor.extractSurviveDecision) {
  const started = readEvents(citizenId).find((e) => e.type === 'mission-started' && e.missionId === missionId);
  if (!started || !started.decisionTaskId) return null;
  try { return extract(started.decisionTaskId); } catch (_) { return null; }
}

async function runScoring({ barsFn = marketData.getAdjustedDailyBars, decisionFn = decisionForMission, symbols = SURVIVE_CANDIDATE_UNIVERSE } = {}) {
  const events = shadow.readShadowEvents();
  const snapshots = events.filter((e) => e.type === 'snapshot');
  // A snapshot is re-scored until every horizon has resolved; score events
  // are keyed on ts so the newest score for a snapshot wins in the board.
  const scored = new Map();
  for (const e of events.filter((x) => x.type === 'score')) scored.set(e.snapshotTs, e);
  const pending = snapshots.filter((s) => {
    const prev = scored.get(s.ts);
    return !prev || !shadow.HORIZONS.every((h) => prev.resolved && prev.resolved.includes(h));
  });
  if (!pending.length) return { scoredNow: 0, board: shadow.buildScoreboard(latestScores(events)) };
  const oldest = pending.map((s) => s.etDate).sort()[0];
  const startD = new Date(Date.parse(oldest) - 10 * 86400e3).toISOString().slice(0, 10);
  const barsBySymbol = {};
  for (const sym of symbols) barsBySymbol[sym] = await barsFn(sym, { start: startD });
  let scoredNow = 0;
  for (const snap of pending) {
    const result = shadow.scoreSnapshot(snap, barsBySymbol, decisionFn(snap.citizenId, snap.missionId));
    const resolved = shadow.HORIZONS.filter((h) => result.policies.cash[h] === 0);
    if (!resolved.length) continue; // nothing elapsed yet
    shadow.appendShadowEvent({ type: 'score', snapshotTs: snap.ts, citizenId: snap.citizenId, missionId: snap.missionId, decisionKind: result.decisionKind, policies: result.policies, resolved });
    scoredNow++;
  }
  return { scoredNow, board: shadow.buildScoreboard(latestScores(shadow.readShadowEvents())) };
}

function latestScores(events) {
  const bySnap = new Map();
  for (const e of events) if (e.type === 'score') bySnap.set(e.snapshotTs, e);
  return [...bySnap.values()];
}

module.exports = { runScoring, decisionForMission, latestScores };

if (require.main === module) {
  const cmd = process.argv[2] || 'run';
  const go = cmd === 'board'
    ? Promise.resolve({ scoredNow: 0, board: shadow.buildScoreboard(latestScores(shadow.readShadowEvents())) })
    : runScoring();
  go.then((r) => { console.log(JSON.stringify(r, null, 2)); }).catch((e) => { console.error('shadow score failed:', e.message); process.exit(1); });
}
