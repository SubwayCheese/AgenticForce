// survive-leader-council.js -- how leaders "communicate between each
// other to find the most profitable avenues and direct more funding to
// those" (ARCHITECTURE.md section 19, round 3, the user's direct words).
//
// HONEST ARCHITECTURAL NOTE: this codebase has no live, persistent
// inter-agent chat channel -- every agent interaction is task-file
// dispatch in, output relay out (see run-queue-daemon.js/run-task.js).
// "Leaders communicate with each other" is therefore built the same way
// this project already synthesizes multiple independent perspectives
// elsewhere (the existing trading-fleet round-3 portfolio synthesis
// pattern: several independent theses -> one synthesis dispatch that
// weighs all of them). This is ONE dispatch given the whole city's real
// performance data and asked to decide city-wide capital allocation --
// not N separate leader agents literally messaging each other in real
// time, which does not exist as infrastructure here. Named explicitly
// rather than overclaiming.

const fs = require('fs');
const path = require('path');
const memoryStore = require('./memory-store.js');
const cityRegistry = require('./city-registry.js');
const cityBank = require('./city-bank.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const citizenLifecycle = require('./citizen-lifecycle.js');
const cityLeadership = require('./city-leadership.js');
const mechanismRegistry = require('./mechanism-registry.js');
const ntfy = require('./ntfy.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const COUNCIL_CADENCE_DAYS = 7; // matches survive-mechanism-research.js's cadence
const SURVIVE_NTFY_TOPIC = 'AgentVaultSurvive';

function nowIso() {
  return new Date().toISOString();
}

function writeTaskFile(taskId, opts) {
  const taskPath = path.join(VAULT_ROOT, 'tasks', `${taskId}.md`);
  if (fs.existsSync(taskPath)) throw new Error(`Refusing to overwrite existing task file: ${taskId}.md`);
  const lines = [
    `## ${taskId}`,
    `from: ${opts.from}`,
    `to: ${opts.to}`,
    `type: ${opts.type || 'request'}`,
    `status: pending`,
    `payload: ${opts.payload}`,
    `timestamp: ${nowIso()}`,
  ];
  lines.push('');
  fs.mkdirSync(path.dirname(taskPath), { recursive: true });
  fs.writeFileSync(taskPath, lines.join('\n'), 'utf8');
  return taskId;
}

function isCouncilDue() {
  const last = memoryStore.getFact('survive_leader_council_last_run');
  if (!last) return true; // never run -- due immediately once dispatchIfDue()'s own leader-count check passes
  const daysSince = (Date.now() - new Date(last.ts).getTime()) / (24 * 60 * 60 * 1000);
  return daysSince >= COUNCIL_CADENCE_DAYS;
}

// Real performance data, grouped by leader and by mechanism -- everything
// injected into the synthesis prompt is a real, already-computed number,
// never invented for the prompt.
function gatherCityPerformanceSnapshot() {
  const leaders = cityRegistry.listActiveLeaders();
  const citizens = cityRegistry.listActiveCitizens();
  const perLeader = leaders.map((leader) => {
    const managed = citizens.filter((c) => c.managedByLeaderId === leader.citizenId);
    return {
      leaderCitizenId: leader.citizenId,
      leaderLedger: budgetEnvelope.computeLifetimeLedger(leader.citizenId),
      managedCitizens: managed.map((c) => ({
        citizenId: c.citizenId,
        mechanism: c.mechanism || null,
        ledger: budgetEnvelope.computeLifetimeLedger(c.citizenId),
      })),
    };
  });

  // Citizens that went permanently bankrupt since founding -- the board
  // needs to know about these to consider "if the bank has the funds,
  // publish a replacement" (round 4, direct user requirement). Postmortem
  // may not exist yet (it requires its own LLM round-trip -- see
  // survive-journal.js's dispatchPostmortemIfNeeded()); null is a
  // legitimate, honest value here, not an error.
  const recentlyKia = cityRegistry.listCitizens()
    .filter((c) => c.status === 'kia' || budgetEnvelope.hasShutdownEvent(c.citizenId))
    .map((c) => {
      const postmortem = memoryStore.getFact(`survive_citizen_${c.citizenId}_postmortem`);
      return { citizenId: c.citizenId, mechanism: c.mechanism || null, managedByLeaderId: c.managedByLeaderId || null, diagnosis: postmortem ? postmortem.value.diagnosis : null };
    });

  return { perLeader, recentlyKia, bankBalanceUsd: cityBank.getBankBalanceUsd() };
}

function authorCouncilMission(snapshot) {
  const n = memoryStore.listKeys().filter((k) => k.key.startsWith('survive_leader_council_run_')).length + 1;
  const taskId = `survive/survive_council${String(n).padStart(3, '0')}_reallocation`;

  const leaderLines = snapshot.perLeader.map((s) => {
    const managedLines = s.managedCitizens.map((m) => `    - ${m.citizenId} (${m.mechanism || 'no mechanism yet'}): cash $${m.ledger.cashUsd.toFixed(2)}, realized P&L $${m.ledger.realizedPnlUsd.toFixed(2)}`).join('\n') || '    (manages no citizens currently)';
    return `  Leader ${s.leaderCitizenId} (own cash $${s.leaderLedger.cashUsd.toFixed(2)}, own realized P&L $${s.leaderLedger.realizedPnlUsd.toFixed(2)}):\n${managedLines}`;
  }).join('\n');

  const kiaLines = snapshot.recentlyKia.length
    ? snapshot.recentlyKia.map((k) => `  - ${k.citizenId} (mechanism: ${k.mechanism || 'unknown'}, managed by ${k.managedByLeaderId || 'unknown'})${k.diagnosis ? `: ${k.diagnosis}` : ' (postmortem not published yet)'}`).join('\n')
    : '  (none)';

  const availableMechanisms = mechanismRegistry.listAvailableMechanisms().map((m) => m.displayName).join(', ') || '(none provisioned)';

  const payload = [
    `You are the collective leader council of a real-money, multi-citizen autonomous city-bank system (ARCHITECTURE.md section 19) -- the board of directors, capped at ${cityLeadership.MAX_LEADERS} leaders (currently ${snapshot.perLeader.length}). Every leader's real, current performance data is below -- decide, city-wide, which avenue is actually compounding and deserves more capital, and whether the bank should fund a new citizen into a new avenue.`,
    '',
    'Real city-wide performance data:',
    leaderLines,
    '',
    `Bank's pooled, spendable balance right now: $${snapshot.bankBalanceUsd.toFixed(2)}.`,
    '',
    'Citizens that went permanently bankrupt (status: kia):',
    kiaLines,
    '',
    `Available mechanisms right now: ${availableMechanisms}`,
    '',
    'This is real money. Be honest and rigorous, not optimistic -- a recommendation to do nothing this cycle is a legitimate, correct output if nothing clearly stands out. Only recommend a reallocation into a citizen that is ACTIVE and not permanently shut down. Only recommend a bank-funded spawn if the bank\'s pooled balance above can actually support it -- if a citizen recently went bankrupt and a diagnosis is available, consider whether it\'s worth funding a replacement (same avenue or a different one, informed by what went wrong) as one of your newAvenueRecommendations.',
    '',
    'Respond with ONLY a fenced ```json block matching exactly this shape:',
    '{"reallocations": [{"targetCitizenId": "...", "leaderCitizenId": "...", "amountUsd": 0, "rationale": "..."}], "newAvenueRecommendations": [{"mechanismId": "..."|null, "leaderCitizenId": "...", "spawnRecommended": true|false, "replacingCitizenId": "..."|null, "rationale": "..."}]}',
    'Both arrays may legitimately be empty.',
  ].join('\n');

  memoryStore.recordFact(`survive_leader_council_run_${n}`, taskId, {});
  return writeTaskFile(taskId, { from: 'survive-leader-council', to: 'codex', payload });
}

function dispatchIfDue() {
  const leaders = cityRegistry.listActiveLeaders();
  if (leaders.length < 1) return null; // nothing to convene
  if (!isCouncilDue()) return null;
  const snapshot = gatherCityPerformanceSnapshot();
  const taskId = authorCouncilMission(snapshot);
  memoryStore.recordFact('survive_leader_council_pending_task', taskId, {});
  console.log(`[survive-leader-council] Dispatched ${taskId}`);
  return taskId;
}

// Checks the dispatched council task, parses the recommendations, and
// EXECUTES them via citizen-lifecycle.js's guarded functions -- the
// "LLM decides via structured output, code executes" separation preserved
// for capital moves here too, exactly as for individual trading decisions.
async function checkResults(runTask) {
  const pending = memoryStore.getFact('survive_leader_council_pending_task');
  if (!pending) return { actedOn: [] };
  const task = runTask.readTaskFile(pending.value);
  if (!task || task.status !== 'done' || !task.output) return { actedOn: [] };

  const fenceRe = /```json\s*([\s\S]*?)```/;
  const m = fenceRe.exec(task.output);
  let parsed = null;
  if (m) { try { parsed = JSON.parse(m[1]); } catch (_) { parsed = null; } }
  if (!parsed) {
    console.log(`[survive-leader-council] ${pending.value}: completed but no parseable recommendations -- leaving unrecorded, not guessing.`);
    return { actedOn: [] };
  }

  memoryStore.recordFact('survive_leader_council_last_run', nowIso(), {});
  const actedOn = [];

  for (const r of (parsed.reallocations || [])) {
    try {
      await citizenLifecycle.executeTopup({ leaderCitizenId: r.leaderCitizenId, targetCitizenId: r.targetCitizenId, amountUsd: r.amountUsd });
      actedOn.push({ type: 'topup', ...r, ok: true });
    } catch (err) {
      console.log(`[survive-leader-council] Topup for ${r.targetCitizenId} FAILED: ${err.message}`);
      actedOn.push({ type: 'topup', ...r, ok: false, error: err.message });
    }
  }

  for (const r of (parsed.newAvenueRecommendations || [])) {
    if (!r.spawnRecommended) continue;
    try {
      const result = await citizenLifecycle.executeBankFundedSpawn({ leaderCitizenId: r.leaderCitizenId, mechanism: r.mechanismId });
      actedOn.push({ type: 'spawn', ...r, ok: true, newCitizenId: result.newCitizenId });
    } catch (err) {
      console.log(`[survive-leader-council] Spawn by ${r.leaderCitizenId} FAILED: ${err.message}`);
      actedOn.push({ type: 'spawn', ...r, ok: false, error: err.message });
    }
  }

  if (actedOn.length) {
    try {
      await ntfy.sendNtfy({
        topic: SURVIVE_NTFY_TOPIC,
        title: 'Leader council reallocation cycle complete',
        message: actedOn.map((a) => `${a.type}: ${a.ok ? 'done' : 'FAILED - ' + a.error}`).join('\n'),
        tags: 'mag',
      });
    } catch (_) { /* best-effort */ }
  }

  return { actedOn };
}

module.exports = { COUNCIL_CADENCE_DAYS, isCouncilDue, gatherCityPerformanceSnapshot, authorCouncilMission, dispatchIfDue, checkResults };
