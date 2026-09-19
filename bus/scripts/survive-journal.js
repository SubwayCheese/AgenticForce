// survive-journal.js -- "the stock is the teacher," for citizens. Two
// layers, same split as trading-journal.js (which this mirrors, not
// extends -- that file is keyed to the existing fleet's own event shapes):
//   1. journalClosedMissions() -- mechanical, cheap, every wake: matches
//      each citizen's closed mission (mission-entered -> mission-exited),
//      writes one row to bus/survive-journal.jsonl. No agent dispatch.
//   2. maybeDispatchReflection() -- a real agent reflection pass, batch
//      size 1 (unlike trading-journal.js's batch of 3) given survive's
//      expected much lower mission volume -- reflect after every closed
//      mission, not once several accumulate.

const fs = require('fs');
const path = require('path');
const executor = require('./survive-executor.js');
const memoryStore = require('./memory-store.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const cityRegistry = require('./city-registry.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
let JOURNAL_PATH = path.join(VAULT_ROOT, 'bus', 'survive-journal.jsonl');
const TASKS_SURVIVE_DIR = path.join(VAULT_ROOT, 'tasks', 'survive');

function nowIso() {
  return new Date().toISOString();
}

// Test-only hook, same pattern as memory-store.js's _setMemoryPathForTesting
// -- lets a test point this module at a throwaway file instead of the real
// bus/survive-journal.jsonl. Never called outside a test.
function _setJournalPathForTesting(p) {
  JOURNAL_PATH = p;
}

function readJournal() {
  if (!fs.existsSync(JOURNAL_PATH)) return [];
  return fs.readFileSync(JOURNAL_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

function appendJournalEntry(entry) {
  fs.appendFileSync(JOURNAL_PATH, JSON.stringify({ ts: nowIso(), ...entry }) + '\n', 'utf8');
}

// Pulls the decision block's own rationale/confidence back out of its
// source decision task -- same JSON-fence extraction already proven in
// survive-executor.js/execute-portfolio-setup.js.
function extractDecisionThesis(citizenId, missionId) {
  const taskId = `survive/survive_c${citizenId}_${missionId}_decision`;
  try {
    const decision = executor.extractSurviveDecision(taskId);
    return { rationale: decision.rationale || null, confidence: decision.confidence || null, symbol: decision.symbol || null };
  } catch (_) {
    return null;
  }
}

// Mechanical, cheap, idempotent -- safe to call every supervisor wake.
// Matches each citizen's mission-entered/mission-exited pair (via missionId,
// unambiguous -- unlike trading-journal.js's legacy symbol-fallback, every
// survive mission has always had a missionId, so no fallback pairing is
// needed) that hasn't been journaled yet.
function journalClosedMissions() {
  const missions = executor.readMissionEvents();
  const journal = readJournal();
  const journaledKeys = new Set(journal.filter((j) => j.type === 'mission-closed').map((j) => `${j.citizenId}::${j.missionId}`));

  const entries = missions.filter((m) => m.type === 'mission-entered');
  const exits = missions.filter((m) => m.type === 'mission-exited');
  const newEntries = [];

  for (const entry of entries) {
    const key = `${entry.citizenId}::${entry.missionId}`;
    if (journaledKeys.has(key)) continue;
    const exit = exits.find((e) => e.citizenId === entry.citizenId && e.missionId === entry.missionId);
    if (!exit) continue; // still open -- nothing to journal yet, not an error

    const pnlUsd = typeof exit.pnlUsd === 'number' ? exit.pnlUsd : null;
    const outcome = pnlUsd === null ? 'unknown' : (pnlUsd > 0 ? 'win' : (pnlUsd < 0 ? 'loss' : 'flat'));
    const thesis = extractDecisionThesis(entry.citizenId, entry.missionId);

    const record = {
      type: 'mission-closed',
      citizenId: entry.citizenId,
      missionId: entry.missionId,
      symbol: entry.symbol,
      lotId: entry.lotId,
      entryTs: entry.ts,
      exitTs: exit.ts,
      notionalUsd: entry.notionalUsd,
      pnlUsd,
      outcome,
      entryThesis: thesis,
      lesson: null,
      reflectionTaskId: null,
    };
    appendJournalEntry(record);
    newEntries.push(record);
  }
  if (newEntries.length) {
    console.log(`[survive-journal] Journaled ${newEntries.length} newly-closed mission(s): ${newEntries.map((e) => `${e.citizenId}/${e.symbol} (${e.outcome})`).join(', ')}`);
  }
  return newEntries;
}

// Merges each 'mission-closed' row with the latest 'lesson-added' row (if
// any) sharing the same citizenId::missionId key.
function getJournalEntriesWithLessons() {
  const rows = readJournal();
  const base = new Map();
  const dispatched = new Map();
  const lessons = new Map();
  for (const r of rows) {
    const key = `${r.citizenId}::${r.missionId}`;
    if (r.type === 'mission-closed') base.set(key, r);
    if (r.type === 'reflection-dispatched') dispatched.set(key, r);
    if (r.type === 'lesson-added') lessons.set(key, r);
  }
  return Array.from(base.entries()).map(([key, record]) => {
    const lessonRow = lessons.get(key);
    if (lessonRow) return { ...record, lesson: lessonRow.lesson, reflectionTaskId: lessonRow.reflectionTaskId };
    const dispatchRow = dispatched.get(key);
    if (dispatchRow) return { ...record, reflectionTaskId: dispatchRow.reflectionTaskId };
    return record;
  });
}

// Batch size 1: reflect after every closed mission, not once several
// accumulate -- survive's expected mission volume is far lower than the
// fleet's micro-trades, so batching would mean waiting a long time between
// real lessons feeding the next mission.
function maybeDispatchReflection(writeTaskFile, nextTaskId) {
  const all = getJournalEntriesWithLessons();
  const pending = all.filter((e) => !e.lesson && !e.reflectionTaskId);
  if (!pending.length) return null;

  const entry = pending[0];
  const taskId = nextTaskId();
  const payload = [
    `A "survive" citizen (${entry.citizenId}) just closed a real-money mission -- reflect honestly on what happened, the same discipline this vault already applies to the existing trading fleet's journal.`,
    '',
    `Symbol: ${entry.symbol}`,
    `Outcome: ${entry.outcome}${entry.pnlUsd !== null ? ` ($${entry.pnlUsd.toFixed(2)})` : ''}`,
    entry.entryThesis ? `Original rationale: ${entry.entryThesis.rationale || '(none recorded)'}` : 'No original rationale was recorded for this mission.',
    '',
    'Respond with ONLY a fenced ```json block: {"lessons":[{"missionId":"' + entry.missionId + '","lesson":"..."}]}. One honest, specific, methodological lesson -- not generic advice, not a restatement of the outcome.',
  ].join('\n');
  writeTaskFile(taskId, { from: 'survive-journal', to: 'codex', payload });
  appendJournalEntry({ type: 'reflection-dispatched', citizenId: entry.citizenId, missionId: entry.missionId, reflectionTaskId: taskId });
  console.log(`[survive-journal] Dispatched reflection ${taskId} for ${entry.citizenId}/${entry.symbol}`);
  return taskId;
}

function checkReflectionResults(runTask) {
  const all = getJournalEntriesWithLessons();
  const pendingTaskIds = new Set(all.filter((e) => e.reflectionTaskId && !e.lesson).map((e) => e.reflectionTaskId));
  const resolved = [];

  for (const taskId of pendingTaskIds) {
    const task = runTask.readTaskFile(taskId);
    if (!task || task.status !== 'done' || !task.output) continue;
    const fenceRe = /```json\s*([\s\S]*?)```/;
    const m = fenceRe.exec(task.output);
    let parsed = null;
    if (m) { try { parsed = JSON.parse(m[1]); } catch (_) { parsed = null; } }
    if (!parsed || !Array.isArray(parsed.lessons)) {
      console.log(`[survive-journal] ${taskId}: completed but no parseable lessons[] -- leaving pending, not guessing.`);
      continue;
    }
    const batchEntries = all.filter((e) => e.reflectionTaskId === taskId && !e.lesson);
    for (const entry of batchEntries) {
      const lessonRow = parsed.lessons.find((l) => l.missionId === entry.missionId);
      const lesson = lessonRow ? lessonRow.lesson : 'No lesson returned for this mission.';
      appendJournalEntry({ type: 'lesson-added', citizenId: entry.citizenId, missionId: entry.missionId, reflectionTaskId: taskId, lesson });
      resolved.push({ citizenId: entry.citizenId, missionId: entry.missionId, lesson });
    }
  }
  return resolved;
}

// Feeds a mission's injected prior-lessons context -- and, on a spawn, the
// new child's inherited-but-not-forced context too.
function getPriorMissionLessons(citizenId, limit = 5) {
  return getJournalEntriesWithLessons()
    .filter((e) => e.citizenId === citizenId && e.lesson)
    .sort((a, b) => b.exitTs.localeCompare(a.exitTs))
    .slice(0, limit);
}

// Round 4, direct user requirement: "when a citizen loses its money it
// needs to document where it believed it went wrong" -- distinct from
// journalClosedMissions()'s per-mission reflection above (which runs on
// every closed mission, win or loss): this is ONE deeper retrospective
// over a citizen's ENTIRE run, triggered specifically by permanent
// shutdown, not by cadence.
function dispatchPostmortemIfNeeded(writeTaskFile) {
  const shutdownEvents = budgetEnvelope.readAllEvents().filter((e) => e.type === 'cap-breach-shutdown');
  const journal = readJournal();
  const alreadyDispatched = new Set(journal.filter((j) => j.type === 'postmortem-dispatched').map((j) => j.citizenId));
  const dispatched = [];

  for (const shutdown of shutdownEvents) {
    if (alreadyDispatched.has(shutdown.citizenId)) continue;
    const citizenId = shutdown.citizenId;
    const citizen = cityRegistry.getCitizen(citizenId);
    const missions = executor.readMissionEvents(citizenId).filter((e) => e.type === 'mission-resolved');
    const lessons = getJournalEntriesWithLessons().filter((e) => e.citizenId === citizenId);

    const missionLines = missions.map((m) => `- ${m.missionId}: ${m.outcome}${m.reason ? ` (${m.reason})` : ''}`).join('\n') || '(no resolved missions recorded)';
    const lessonLines = lessons.map((l) => `- ${l.symbol} (${l.outcome}${l.pnlUsd !== null ? `, $${l.pnlUsd.toFixed(2)}` : ''}): ${l.lesson || '(no lesson recorded)'}`).join('\n') || '(no closed-mission lessons recorded)';

    const taskId = `survive/survive_postmortem_${citizenId}`;
    const payload = [
      `Citizen ${citizenId} (mechanism: ${(citizen && citizen.mechanism) || 'unknown'}) is now permanently out of funds -- $0 cash, no open position, no recovery possible. Its full history is below. Be honest and specific: where do you believe this citizen went wrong?`,
      '',
      'Mission history:',
      missionLines,
      '',
      'Per-mission lessons already recorded:',
      lessonLines,
      '',
      'Respond with ONLY a fenced ```json block: {"diagnosis": "...", "keyMistakes": ["...", "..."], "recommendationForFutureCitizens": "..."}. Be honest -- if the mechanism itself looks structurally weak (not just bad luck), say so plainly.',
    ].join('\n');

    try {
      writeTaskFile(taskId, { from: 'survive-journal', to: 'codex', payload });
      appendJournalEntry({ type: 'postmortem-dispatched', citizenId, taskId });
      dispatched.push(taskId);
    } catch (err) {
      console.log(`[survive-journal] Failed to dispatch postmortem for ${citizenId}: ${err.message}`);
    }
  }
  return dispatched;
}

// Checks every dispatched-but-unresolved postmortem, and if done, records
// it as a durable fact (memory-store, same discipline as every other
// durable record in this codebase) plus a journal event.
function checkPostmortemResults(runTask) {
  const journal = readJournal();
  const dispatched = journal.filter((j) => j.type === 'postmortem-dispatched');
  const alreadyAdded = new Set(journal.filter((j) => j.type === 'postmortem-added').map((j) => j.citizenId));
  const resolved = [];

  for (const d of dispatched) {
    if (alreadyAdded.has(d.citizenId)) continue;
    const task = runTask.readTaskFile(d.taskId);
    if (!task || task.status !== 'done' || !task.output) continue;

    const fenceRe = /```json\s*([\s\S]*?)```/;
    const m = fenceRe.exec(task.output);
    let parsed = null;
    if (m) { try { parsed = JSON.parse(m[1]); } catch (_) { parsed = null; } }
    if (!parsed || !parsed.diagnosis) {
      console.log(`[survive-journal] ${d.taskId}: completed but no parseable postmortem -- leaving pending, not guessing.`);
      continue;
    }

    memoryStore.recordFact(`survive_citizen_${d.citizenId}_postmortem`, parsed, { sourceTaskId: d.taskId, taskTo: 'codex' });
    appendJournalEntry({ type: 'postmortem-added', citizenId: d.citizenId, taskId: d.taskId });
    resolved.push({ citizenId: d.citizenId, diagnosis: parsed.diagnosis });
  }
  return resolved;
}

// Injected into a new mission's authored prompt (survive-supervisor.js)
// as a direct, specific cautionary signal -- not just general
// prior-lessons text -- when a dead citizen used the SAME mechanism this
// new mission is about to use.
function getPostmortemsForMechanism(mechanism) {
  if (!mechanism) return [];
  return cityRegistry.listCitizens()
    .filter((c) => c.status === 'kia' && c.mechanism === mechanism)
    .map((c) => memoryStore.getFact(`survive_citizen_${c.citizenId}_postmortem`))
    .filter(Boolean)
    .map((fact) => fact.value);
}

// Every recorded postmortem across every KIA citizen, regardless of
// mechanism -- the Knowledge Vault's total count. Distinct from
// getPostmortemsForMechanism() (deliberately filtered, for the
// cautionary-warning use case at mission-authoring time).
function getAllPostmortems() {
  return cityRegistry.listCitizens()
    .filter((c) => c.status === 'kia')
    .map((c) => {
      const fact = memoryStore.getFact(`survive_citizen_${c.citizenId}_postmortem`);
      if (!fact) return null;
      return { citizenId: c.citizenId, mechanism: c.mechanism || null, recordedAt: fact.ts, ...fact.value };
    })
    .filter(Boolean);
}

module.exports = {
  JOURNAL_PATH,
  readJournal,
  appendJournalEntry,
  journalClosedMissions,
  getJournalEntriesWithLessons,
  maybeDispatchReflection,
  checkReflectionResults,
  getPriorMissionLessons,
  dispatchPostmortemIfNeeded,
  checkPostmortemResults,
  getAllPostmortems,
  _setJournalPathForTesting,
  getPostmortemsForMechanism,
};
