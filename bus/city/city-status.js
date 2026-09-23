// city-status.js -- the city-level "situation room" readout for the
// "survive" branch (ARCHITECTURE.md section 19). Same plain-English-first
// shape discipline as dashboard-status.js's getPlainSummary().

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const cityBank = require('./city-bank.js');
const cityRegistry = require('./city-registry.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const executor = require('./survive-executor.js');
const mechanismRegistry = require('./mechanism-registry.js');
const journal = require('./survive-journal.js');
const runTask = require('../platform/run-task.js');

const VAULT_ROOT = avPaths.ROOT;
const SUPERVISOR_LOG_PATH = path.join(VAULT_ROOT, 'bus', 'survive-supervisor.log');

// Same tail-read technique as dashboard-status.js's lastLogTimestamp() --
// avoids reading a potentially large log in full just for its last line.
function lastLogTimestamp(logPath) {
  if (!fs.existsSync(logPath)) return null;
  const stat = fs.statSync(logPath);
  const readFrom = Math.max(0, stat.size - 8000);
  const fd = fs.openSync(logPath, 'r');
  const buf = Buffer.alloc(stat.size - readFrom);
  fs.readSync(fd, buf, 0, buf.length, readFrom);
  fs.closeSync(fd);
  const lines = buf.toString('utf8').split('\n').filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^\[([^\]]+)\]/);
    if (m) {
      const ts = new Date(m[1]);
      if (!Number.isNaN(ts.getTime())) return ts.toISOString();
    }
  }
  return null;
}

function getCityPlainSummary() {
  const citizens = cityRegistry.listCitizens();
  const tree = cityRegistry.buildLineageTree();
  const bankAudit = cityBank.auditBankLedgerIntegrity();

  let totalCityPnlSinceGenesisUsd = 0;
  const citizenSummaries = citizens.map((c) => {
    const ledger = budgetEnvelope.computeLifetimeLedger(c.citizenId);
    totalCityPnlSinceGenesisUsd += ledger.realizedPnlUsd;
    return {
      citizenId: c.citizenId,
      status: c.status,
      foundedByLeaderId: c.foundedByLeaderId,
      isLeader: (tree.childrenOf.get(c.citizenId) || []).length > 0,
      mechanism: c.mechanism || null,
      cashUsd: ledger.cashUsd,
      realizedPnlUsd: ledger.realizedPnlUsd,
      hasOpenPosition: ledger.hasOpenPosition,
      shutDown: budgetEnvelope.hasShutdownEvent(c.citizenId),
      quarantined: !!c.quarantined,
      quarantineReason: c.quarantineReason || null,
    };
  });

  const missions = executor.readMissionEvents().filter((e) => e.type === 'mission-resolved');
  const activeCount = citizens.filter((c) => c.status === 'active').length;
  const kiaCount = citizens.filter((c) => c.status === 'kia').length;

  let state = 'not-yet-funded';
  if (citizens.length) state = activeCount > 0 ? 'in-the-field' : 'permanently-shut-down';

  return {
    generatedAt: new Date().toISOString(),
    state, // 'not-yet-funded' | 'in-the-field' | 'permanently-shut-down'
    totalBankBalanceUsd: cityBank.getBankBalanceUsd(),
    bankLedgerHealthy: bankAudit.ok,
    citizenCounts: { active: activeCount, kia: kiaCount, total: citizens.length },
    lineageDepth: tree.maxDepth,
    totalCityPnlSinceGenesisUsd,
    missionCount: missions.length,
    lastCheckInAt: lastLogTimestamp(SUPERVISOR_LOG_PATH),
    citizens: citizenSummaries,
  };
}

// Round 8 -- the feed for bus/survive-city-3d.html. Separate from
// getCityPlainSummary() (which stays exactly as it is for economy.html):
// this one is shaped around "which building is each citizen in, and what
// is it doing right now," not plain-English cards.
//
// activityState is derived deterministically from a citizen's most recent
// mission events -- a string label, never a guess:
//   'kia'          status === 'kia' (overrides everything)
//   'quarantined'  registry quarantined flag (overrides everything below)
//   'in-position'  latest mission-entered has no matching mission-exited
//   'researching'  latest mission-started has no mission-resolved yet
//   'blocked'      latest mission-resolved outcome was 'blocked'
//   'idle'         anything else, or no missions ever
function deriveActivityState(citizen, events) {
  if (citizen.status === 'kia') return 'kia';
  if (citizen.quarantined) return 'quarantined';
  const sorted = events.slice().sort((a, b) => a.ts.localeCompare(b.ts));
  const openLots = new Set();
  let lastStartedMission = null;
  let lastResolved = null;
  for (const e of sorted) {
    if (e.type === 'mission-entered') openLots.add(e.lotId);
    else if (e.type === 'mission-exited') openLots.delete(e.lotId);
    else if (e.type === 'mission-started') lastStartedMission = e.missionId;
    else if (e.type === 'mission-resolved') { lastResolved = e; if (e.missionId === lastStartedMission) lastStartedMission = null; }
  }
  if (openLots.size > 0) return 'in-position';
  if (lastStartedMission) return 'researching';
  if (lastResolved && lastResolved.outcome === 'blocked') return 'blocked';
  return 'idle';
}

function extractFirstJsonBlock(text) {
  if (!text) return null;
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try { return JSON.parse(match[1]); } catch (_) { /* try the next fence */ }
  }
  return null;
}

// Round 16: a short, REAL status line for the city-3D page's thought
// bubble -- built only from the same real mission-event/task-file data
// the rest of this module reads, never invented. Stage is derived from
// which of the mission's 4 real task files is actually done yet, in
// pipeline order (research -> bull+bear in parallel -> decision).
// readTaskFileFn is injectable purely so tests can fixture task files
// without touching tasks/survive/ (same DI shape as executor.loadClient).
function deriveWorkStatusText(activityState, events, ledger, readTaskFileFn = runTask.readTaskFile) {
  if (activityState === 'in-position') {
    const symbol = ledger.hasOpenPosition ? ledger.openLots[0].symbol : null;
    return symbol ? `Holding ${symbol}` : 'Holding a position';
  }
  if (activityState !== 'researching') return null;

  const sorted = events.slice().sort((a, b) => a.ts.localeCompare(b.ts));
  const resolvedMissionIds = new Set();
  let started = null;
  for (const e of sorted) {
    if (e.type === 'mission-resolved') resolvedMissionIds.add(e.missionId);
    if (e.type === 'mission-started') started = e;
  }
  if (!started || resolvedMissionIds.has(started.missionId)) return 'Researching...';

  const research = readTaskFileFn(started.researchTaskId);
  if (!research || research.status !== 'done') return 'Researching options...';

  const bull = readTaskFileFn(started.bullTaskId);
  const bear = readTaskFileFn(started.bearTaskId);
  const bullDone = bull && bull.status === 'done' && bull.output;
  const bearDone = bear && bear.status === 'done' && bear.output;
  if (!bullDone || !bearDone) return 'Weighing the case...';

  const decision = readTaskFileFn(started.decisionTaskId);
  if (decision && decision.status === 'done' && decision.output) {
    // Branch on the decision's REAL `decision` field, not just its
    // symbol -- a resolved-but-not-yet-logged no-action sits here as
    // "done" for real minutes (caught by cross-review against citizen
    // C1's actual mission005 timestamps), and "Ready to act on X" would
    // be a false claim the same JSON already contradicts.
    const parsed = extractFirstJsonBlock(decision.output);
    const d = parsed && parsed.decision;
    if (d === 'enter') return parsed.symbol ? `Ready to enter ${parsed.symbol}...` : 'Ready to enter...';
    if (d === 'exit') return parsed.symbol ? `Ready to exit ${parsed.symbol}...` : 'Ready to exit...';
    if (d === 'hold' || d === 'no-action') return 'Wrapping up -- staying put for now';
    return 'Finalizing...';
  }

  // Both reviews resolved, decision still pending -- only bull's schema
  // carries a symbol; if bull found no real case there is no honest one to cite.
  const bullParsed = extractFirstJsonBlock(bull.output);
  const symbol = bullParsed && bullParsed.stance === 'bullish' ? bullParsed.symbol : null;
  return symbol ? `Deciding on ${symbol}...` : 'Deciding...';
}

function getCity3DStatus() {
  const citizens = cityRegistry.listCitizens();
  const tree = cityRegistry.buildLineageTree();
  const allMissionEvents = executor.readMissionEvents();

  const citizenEntries = citizens.map((c) => {
    const events = allMissionEvents.filter((e) => e.citizenId === c.citizenId);
    const ledger = budgetEnvelope.computeLifetimeLedger(c.citizenId);
    const last = events.length ? events[events.length - 1] : null;
    const activityState = deriveActivityState(c, events);
    const entry = {
      citizenId: c.citizenId,
      role: c.role || 'citizen',
      mechanism: c.mechanism || null,
      status: c.status,
      quarantined: !!c.quarantined,
      shutDown: budgetEnvelope.hasShutdownEvent(c.citizenId),
      managedByLeaderId: c.managedByLeaderId || null,
      foundedByLeaderId: c.foundedByLeaderId || null,
      cashUsd: ledger.cashUsd,
      realizedPnlUsd: ledger.realizedPnlUsd,
      activityState,
      currentSymbol: ledger.hasOpenPosition ? ledger.openLots[0].symbol : null,
      lastEventAt: last ? last.ts : null,
      lastEventType: last ? last.type : null,
      // Round 14: how many times this citizen has really consulted the
      // journal -- authorNewMission() (survive-supervisor.js) reads prior
      // lessons/postmortems and writes mission-started in the same
      // synchronous call, so this count is fully real, not synthetic.
      vaultConsultCount: events.filter((e) => e.type === 'mission-started').length,
      statusText: null,
    };
    if (activityState === 'researching' || activityState === 'in-position') {
      entry.statusText = deriveWorkStatusText(activityState, events, ledger);
    }
    return entry;
  });

  // One building per mechanism: every provisioned mechanism module (lit
  // if its credentials exist, dark if not -- an honest capacity view, not
  // just current occupancy) plus any mechanism a citizen is recorded
  // using that no longer has a module (still needs a building to stand in).
  const buildingsById = new Map();
  for (const m of mechanismRegistry.listMechanismModules()) {
    buildingsById.set(m.id, { mechanismId: m.id, displayName: m.displayName, available: !!m.isAvailable(), citizenCount: 0, activeCount: 0 });
  }
  for (const c of citizenEntries) {
    if (!c.mechanism) continue;
    if (!buildingsById.has(c.mechanism)) buildingsById.set(c.mechanism, { mechanismId: c.mechanism, displayName: c.mechanism, available: false, citizenCount: 0, activeCount: 0 });
    const b = buildingsById.get(c.mechanism);
    b.citizenCount += 1;
    if (c.status === 'active' && !c.quarantined) b.activeCount += 1;
  }

  const lineageEdges = [];
  for (const [leaderId, children] of tree.childrenOf.entries()) {
    for (const childId of children) lineageEdges.push({ fromLeaderId: leaderId, toCitizenId: childId });
  }

  const activeCount = citizens.filter((c) => c.status === 'active').length;
  let state = 'not-yet-funded';
  if (citizens.length) state = activeCount > 0 ? 'in-the-field' : 'permanently-shut-down';

  return {
    generatedAt: new Date().toISOString(),
    state,
    bankBalanceUsd: cityBank.getBankBalanceUsd(),
    totalCityPnlSinceGenesisUsd: citizenEntries.reduce((s, c) => s + c.realizedPnlUsd, 0),
    buildings: Array.from(buildingsById.values()),
    vault: getVaultStats(),
    citizens: citizenEntries,
    lineageEdges,
    lastCheckInAt: lastLogTimestamp(SUPERVISOR_LOG_PATH),
  };
}

// Round 14: the Knowledge Vault's real data feed -- every recorded lesson
// (mission-closed rows with a non-null .lesson, across every citizen) plus
// every recorded postmortem. Exported separately so it's testable against
// a fixture journal/memory file without needing getCity3DStatus()'s other
// dependencies (executor, cityBank, mechanismRegistry, budgetEnvelope).
function getVaultStats() {
  const lessons = journal.getJournalEntriesWithLessons().filter((e) => e.lesson);
  const postmortems = journal.getAllPostmortems();
  const lessonTimes = lessons.map((l) => l.exitTs).filter(Boolean).sort();
  const postmortemTimes = postmortems.map((p) => p.recordedAt).filter(Boolean).sort();
  return {
    lessonCount: lessons.length,
    postmortemCount: postmortems.length,
    latestLessonAt: lessonTimes.length ? lessonTimes[lessonTimes.length - 1] : null,
    latestPostmortemAt: postmortemTimes.length ? postmortemTimes[postmortemTimes.length - 1] : null,
  };
}

module.exports = { getCityPlainSummary, getCity3DStatus, deriveActivityState, getVaultStats, deriveWorkStatusText };

if (require.main === module) {
  const which = process.argv[2] === '3d' ? getCity3DStatus() : getCityPlainSummary();
  console.log(JSON.stringify(which, null, 2));
}
