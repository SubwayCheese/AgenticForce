#!/usr/bin/env node
// survive-supervisor.js -- the schedule-invoked cadence/authoring script
// for the "survive" branch (ARCHITECTURE.md section 19), mirroring
// pilot-supervisor.js's own shape: not a loop itself, called on a
// schedule (systemd timer), each wake iterates every ACTIVE citizen and
// decides per-citizen whether a mission is due, authors the next
// research/decision task pair if so, and executes/journals whatever
// already resolved.
//
// ONE script drives every citizen -- not one service per citizen. A new
// citizen (via a future spawn) needs zero new systemd units.
//
// Round 4: citizen-lifecycle.js's three money-moving functions ARE wired
// in now -- executeCloneAndPromote() via city-leadership.js's
// maybePromoteLeader() (below), executeBankFundedSpawn()/executeTopup()
// via survive-leader-council.js's checkResults() (below). None of them
// have ever actually run against a real citizen, since none exists yet --
// they're wired and unit-tested, proof against real data is still
// pending the human handoff.
//
// Usage: node survive-supervisor.js [--rehearsal]   (one run; call this on
// a schedule -- systemd timer, cron -- it does not loop itself)

const fs = require('fs');
const path = require('path');
const registry = require('./city-registry.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const executor = require('./survive-executor.js');
const journal = require('./survive-journal.js');
const mechanismRegistry = require('./mechanism-registry.js');
const cityLeadership = require('./city-leadership.js');
const leaderCouncil = require('./survive-leader-council.js');
const citySecurity = require('./city-security.js');
const ntfy = require('./ntfy.js');
const runTask = require('./run-task.js');
const codexHealth = require('./codex-health.js');
const shadow = require('./survive-shadow.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TASKS_SURVIVE_DIR = path.join(VAULT_ROOT, 'tasks', 'survive');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'survive-supervisor.log');

const MISSION_COOLDOWN_HOURS = 4; // not hyper-frequent, given the stakes and the "minimal input" goal -- adjustable

// Round 15: small, hardcoded, liquid, cautious-account-appropriate
// candidate universe -- pre-fetched with REAL Alpaca data before research
// is ever dispatched, so research compares real, verified options instead
// of guessing. Deliberately spans two risk tiers so "stay defensive" has
// to win an honest comparison, not just be the only idea offered: SGOV/BIL
// (near-identical ultra-short T-bill ETFs), SHY (1-3yr Treasury, a real
// middle option), VOO/SCHD (broad low-cost equity ETFs -- the genuine
// alternative to staying entirely defensive). All five confirmed live,
// real, tradable, fractionable Alpaca equities/ETFs (this branch is
// equities/ETFs only, long-only). Revisit deliberately, don't grow ad hoc
// -- more candidates means more real API calls per mission.
const SURVIVE_CANDIDATE_UNIVERSE = ['SGOV', 'BIL', 'SHY', 'VOO', 'SCHD'];

// Bounds the whole pre-fetch -- apiRequest()/fetch() has no built-in
// timeout anywhere in either Alpaca client (a pre-existing gap), and this
// round adds 10 real blocking network calls into authorNewMission's path
// at a 15-minute wake cadence. A hang on any one call must not hang the
// whole citizen's wake; whatever hasn't resolved by the deadline is
// treated as failed, same as a real fetch error, never silently dropped.
const CANDIDATE_FETCH_TIMEOUT_MS = 12000;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  console.log(line);
}

function nowIso() {
  return new Date().toISOString();
}

// Small, local, generic task-file writer -- deliberately NOT requiring
// generate-pilot-tasks.js (1000+ lines of fleet-specific logic this branch
// has no business depending on) for a ~15-line generic function.
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
  if (opts.dependsOnTaskId) lines.push(`dependsOnTaskId: ${opts.dependsOnTaskId}`);
  if (opts.dependsOnTaskIds) lines.push(`dependsOnTaskIds: ${opts.dependsOnTaskIds}`);
  if (opts.enrichWithSearch) lines.push(`enrichWithSearch: true`);
  lines.push('');
  fs.mkdirSync(path.dirname(taskPath), { recursive: true });
  fs.writeFileSync(taskPath, lines.join('\n'), 'utf8');
  return taskId;
}

function isMissionDue(citizenId) {
  if (budgetEnvelope.hasShutdownEvent(citizenId)) return false;
  if (executor.findLatestUnresolvedDecision(citizenId)) return false; // still waiting on a prior decision's execution
  const events = executor.readMissionEvents(citizenId);
  const started = events.filter((e) => e.type === 'mission-started');
  const resolved = events.filter((e) => e.type === 'mission-resolved').sort((a, b) => a.ts.localeCompare(b.ts));
  // A mission still mid-pipeline (research/bull/bear/decision dispatched
  // but not yet resolved) has a 'mission-started' event with no matching
  // 'mission-resolved' -- findLatestUnresolvedDecision() above only
  // catches the narrow window where the decision task itself is already
  // done but not yet executed, so it misses this earlier, longer window.
  // Without this check, a wake landing while a mission is still in
  // flight sees nothing "unresolved" and authors a second, concurrent
  // mission for the same citizen -- real bug, caught live 2026-09-17
  // when an early timer fire authored mission002 ~25s after mission001.
  const resolvedIds = new Set(resolved.map((e) => e.missionId));
  if (started.some((e) => !resolvedIds.has(e.missionId))) return false;
  if (!resolved.length) return true;
  // Round 18: a mission that died because its dispatch failed (codex
  // outage, out of credits) was never a real decision, so it must not
  // burn the 4h cooldown -- retry immediately once recovery resolves it.
  // Capped: after MAX_CONSECUTIVE_DISPATCH_FAILURES in a row (codex
  // reports healthy but tasks still error -- a real problem, not an
  // outage) fall back to the normal cooldown instead of retrying forever.
  let consecutiveFailures = 0;
  for (let i = resolved.length - 1; i >= 0 && resolved[i].dispatchFailure; i--) consecutiveFailures++;
  if (consecutiveFailures > 0 && consecutiveFailures < MAX_CONSECUTIVE_DISPATCH_FAILURES) return true;
  const hoursSince = (Date.now() - new Date(resolved[resolved.length - 1].ts).getTime()) / 3600000;
  return hoursSince >= MISSION_COOLDOWN_HOURS;
}

const MAX_CONSECUTIVE_DISPATCH_FAILURES = 3;

// Round 18: a mission whose research/bull/bear/decision task ended in
// status 'error' is dead -- nothing ever retries an errored task
// (run-queue-daemon.js only re-queues 'pending'/'blocked'), and the
// in-flight guard in isMissionDue() then blocks every future mission for
// that citizen forever. Found live: C1 sat wedged ~20h behind mission006
// after a codex out-of-credits outage. Returns the dead mission, or null.
function findDeadInFlightMission(citizenId, readTaskFileFn = runTask.readTaskFile) {
  const events = executor.readMissionEvents(citizenId);
  const resolvedIds = new Set(events.filter((e) => e.type === 'mission-resolved').map((e) => e.missionId));
  const open = events.filter((e) => e.type === 'mission-started' && !resolvedIds.has(e.missionId));
  for (const m of open) {
    for (const id of [m.researchTaskId, m.bullTaskId, m.bearTaskId, m.decisionTaskId]) {
      const t = id ? readTaskFileFn(id) : null;
      if (t && t.status === 'error') return { missionId: m.missionId, taskId: id };
    }
  }
  return null;
}

// Detect dead missions, then check whether codex is actually usable again
// (one tiny probe per wake, and only when something is stuck -- free while
// codex is out of credits, never made while healthy). Only when the probe
// passes is the dead mission resolved so a fresh one can start; while
// codex is down the citizen simply waits, with one alert per outage.
async function recoverDeadMissions(citizens, { probeFn = codexHealth.probeCodex, recordFn = codexHealth.recordProbe, readTaskFileFn = runTask.readTaskFile } = {}) {
  let probe = null;
  for (const citizen of citizens) {
    const dead = findDeadInFlightMission(citizen.citizenId, readTaskFileFn);
    if (!dead) continue;
    if (!probe) { probe = await probeFn(); await recordFn(probe); }
    if (probe.status !== 'ok') { log(`Citizen ${citizen.citizenId}: ${dead.missionId} is dead (${dead.taskId} errored) and codex is ${probe.status} -- waiting for recovery.`); continue; }
    executor.appendMissionEvent({ type: 'mission-resolved', citizenId: citizen.citizenId, missionId: dead.missionId, outcome: 'error', dispatchFailure: true, reason: `dispatch failed (${dead.taskId} errored); codex probe healthy again -- abandoned so a fresh mission can start` });
    log(`Citizen ${citizen.citizenId}: recovered dead ${dead.missionId} (${dead.taskId}); a fresh mission may now start.`);
  }
}

function nextMissionId(citizenId) {
  if (!fs.existsSync(TASKS_SURVIVE_DIR)) return 'mission001';
  const re = new RegExp(`^survive_c${citizenId}_mission(\\d+)_research\\.md$`);
  let max = 0;
  for (const f of fs.readdirSync(TASKS_SURVIVE_DIR)) {
    const m = re.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `mission${String(max + 1).padStart(3, '0')}`;
}

function formatPriorLessonsSection(citizenId) {
  const lessons = journal.getPriorMissionLessons(citizenId, 5);
  if (!lessons.length) return 'No prior-mission lessons recorded yet for this citizen.';
  const bullets = lessons.map((l) => `- ${l.symbol} (${l.outcome}${l.pnlUsd !== null ? `, $${l.pnlUsd.toFixed(2)}` : ''}): ${l.lesson}`).join('\n');
  return `Prior-mission lessons (most recent first):\n${bullets}`;
}

// Direct, specific cautionary signal (not just general prior-lessons
// text) when a DEAD citizen used the same mechanism this new mission is
// about to use -- round 4, feeds the leader council's/citizens' judgment
// with real prior failure, not just prior success.
function formatPostmortemWarningSection(mechanism) {
  const postmortems = journal.getPostmortemsForMechanism(mechanism);
  if (!postmortems.length) return '';
  const bullets = postmortems.map((p) => `- ${p.diagnosis}${p.keyMistakes && p.keyMistakes.length ? ` Key mistakes: ${p.keyMistakes.join('; ')}.` : ''}`).join('\n');
  return `\n\nWARNING -- at least one prior citizen using this exact mechanism went permanently bankrupt. Their own diagnosis:\n${bullets}\nWeigh this seriously -- it is real evidence, not hypothetical caution.`;
}

// Round 15: real, verified per-candidate data -- fetched through the same
// loadClient({rehearsal}) seam every other real-account call in this
// branch uses, so it respects paper vs. live automatically. Per-symbol
// failures (bad symbol, transient API error, timeout) are tolerated
// individually: a candidate says plainly its data is unavailable, never
// silently drops out or gets a faked number, and one failure never blocks
// the mission from being authored.
async function fetchCandidateUniverseData(client) {
  const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve({ status: 'rejected', reason: new Error('timed out') }), ms));
  const fetchOne = async (symbol) => {
    const [quote, asset] = await Promise.all([client.getLatestQuote(symbol), client.getAsset(symbol)]);
    const spread = quote.ask - quote.bid;
    const spreadPct = quote.mid ? (spread / quote.mid) * 100 : null;
    return {
      symbol, ok: true, bid: quote.bid, ask: quote.ask, mid: quote.mid,
      spread, spreadPct, tradable: !!asset.tradable, fractionable: !!asset.fractionable,
      status: asset.status,
    };
  };
  const results = await Promise.all(
    SURVIVE_CANDIDATE_UNIVERSE.map(async (symbol) => {
      const outcome = await Promise.race([
        fetchOne(symbol).then((v) => ({ status: 'fulfilled', value: v })).catch((e) => ({ status: 'rejected', reason: e })),
        timeout(CANDIDATE_FETCH_TIMEOUT_MS),
      ]);
      return outcome.status === 'fulfilled' ? outcome.value : { symbol, ok: false, error: outcome.reason.message };
    })
  );
  // Total-failure alert -- matches this codebase's "don't invent, alert a
  // human on an inexplicable gap" discipline (see reconcilePosition()'s
  // ntfy alert). A mission still gets authored either way -- research can
  // still reason about an existing position -- but a human should know the
  // real-data grounding this round exists for silently didn't happen.
  if (results.every((r) => !r.ok)) {
    ntfy.sendNtfy({ topic: executor.SURVIVE_NTFY_TOPIC, title: 'Candidate data fetch: total failure', message: 'All candidates failed to fetch real data this mission -- research is proceeding without it. Check Alpaca API/credentials.', priority: 3 }).catch(() => {});
  }
  return results;
}

// Deterministic -- no LLM involved in producing these numbers, only in
// reasoning about them. marketOpen: true|false|null (null = clock check
// itself failed; omit the caveat rather than guess).
function formatCandidateUniverseTable(candidateData, fetchedAtIso, marketOpen) {
  const rows = candidateData.map((c) => c.ok
    ? `| ${c.symbol} | $${c.bid.toFixed(2)} | $${c.ask.toFixed(2)} | ${c.spreadPct === null ? 'n/a' : `$${c.spread.toFixed(4)} (${c.spreadPct.toFixed(3)}%)`} | ${c.fractionable} | ${c.tradable} | ${c.status} |`
    : `| ${c.symbol} | -- | -- | -- | -- | -- | DATA FETCH FAILED: ${c.error} |`);
  const staleness = marketOpen === false
    ? '\n\n**Market is CLOSED right now** -- the bid/ask/spread above are the last available quotes, not live intraday prices, and after-hours spreads can be MUCH wider than during market hours (a real ~6% after-hours spread was observed on one of these symbols during this feature\'s own testing, vs. a normal intraday spread of a few basis points). Weigh this honestly -- a wide after-hours spread is not the real cost of trading during market hours.'
    : marketOpen === true ? '\n\nMarket is currently OPEN -- these are live intraday quotes.' : '';
  return [
    `Real, verified candidate data (fetched live from Alpaca at ${fetchedAtIso}):`,
    '',
    '| Symbol | Bid | Ask | Spread | Fractionable | Tradable | Status |',
    '|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n') + staleness;
}

async function authorNewMission(citizenId, { rehearsal } = {}) {
  const missionId = nextMissionId(citizenId);
  const citizen = registry.getCitizen(citizenId);
  const ledger = budgetEnvelope.computeLifetimeLedger(citizenId);
  const mechanisms = mechanismRegistry.listAvailableMechanisms();

  const client = executor.loadClient({ rehearsal });
  const candidateData = await fetchCandidateUniverseData(client);
  let marketOpen = null;
  try { marketOpen = !!(await client.getClock()).is_open; } catch (_) { /* best-effort -- omit the caveat rather than block the mission on a clock-check failure */ }
  const candidateTable = formatCandidateUniverseTable(candidateData, nowIso(), marketOpen);
  // Round 19: persist the structured snapshot for shadow scoring. Wrapped so
  // a scoring-side failure can never break mission authoring.
  try { shadow.recordSnapshot({ citizenId, missionId, candidateData, marketOpen }); } catch (err) { log(`shadow snapshot skipped: ${err.message}`); }
  const openPositionLine = ledger.hasOpenPosition
    ? `Currently holding an open position in ${ledger.openLots[0].symbol} (${ledger.openLots[0].qty} shares, cost basis $${ledger.openLots[0].costUsd.toFixed(2)}).`
    : 'Currently holding no open position.';

  const researchTaskId = `survive/survive_c${citizenId}_${missionId}_research`;
  const bullTaskId = `survive/survive_c${citizenId}_${missionId}_bull`;
  const bearTaskId = `survive/survive_c${citizenId}_${missionId}_bear`;
  const decisionTaskId = `survive/survive_c${citizenId}_${missionId}_decision`;

  // A clone inherits its parent's mechanism and is meant to CONTINUE the
  // proven technique, not freely choose -- strong context, not just
  // reference material. Everyone else (the founder, or a bank-funded
  // spawn already told a mechanism by the leader council) gets the
  // normal framing.
  const isClone = !!citizen.inheritedFromCloneOf;
  const mechanismLine = isClone
    ? `You are a CLONE of citizen ${citizen.inheritedFromCloneOf}, created specifically to CONTINUE its proven technique using ${citizen.mechanism || 'the same mechanism'}. This is not a free choice -- stay with what's already working unless something has genuinely changed.`
    : `Available mechanism(s) right now: ${mechanisms.length ? mechanisms.map((m) => m.displayName).join(', ') : '(none provisioned)'}.`;

  const researchPayload = [
    `You are a "survive" citizen (${citizenId}) in an autonomous, real-money-managed branch of a personal research pipeline. ${isClone ? '' : 'You have NO prescribed strategy -- this pipeline does not hand you a formula; use your own judgment.'}`,
    '',
    `Available cash: $${ledger.cashUsd.toFixed(2)}. Lifetime allocation ever received: $${ledger.lifetimeAllocationUsd.toFixed(2)}. Realized P&L so far: $${ledger.realizedPnlUsd.toFixed(2)}. ${openPositionLine}`,
    mechanismLine,
    '',
    candidateTable,
    '',
    'Assume idle cash in this account earns close to zero yield unless you find real, specific evidence (e.g. confirmed cash-sweep-program enrollment) that it does not -- this is a small, non-margin retail account, and near-zero idle yield is the honest default, not an unverified unknown to hedge against. Note this cuts AGAINST staying in cash and FOR a cash-equivalent position like a T-bill ETF, not the reverse.',
    '',
    formatPriorLessonsSection(citizenId),
    formatPostmortemWarningSection(citizen.mechanism),
    '',
    'The table above is REAL, verified data (live bid/ask/spread and tradable/fractionable status from Alpaca, not estimates -- see any staleness note above if the market is closed) for a small, deliberately limited set of candidates appropriate for this account. Compare them honestly against each other and against holding no position: which, if any, is the strongest real opportunity right now, and why do the others lose? You are not required to default to the lowest-risk option -- weigh real trade-offs using your own judgment. If you hold an open position, evaluate whether it should be exited or held instead. If you have a genuinely strong independent reason to recommend a symbol NOT in the table, you may -- but say so explicitly and flag that its numbers are unverified, unlike the candidates above. This is REAL MONEY -- be honest and rigorous, not optimistic. State your findings and reasoning clearly, including WHY you rejected the alternatives. Restate the exact real figures (bid, ask, spread, fractionable, tradable) from the table for whichever candidate you recommend -- the reviewers see only your output, not this table. TWO separate, independent reviewers will build the strongest possible case FOR and AGAINST acting on your findings before any decision is made -- so state your reasoning precisely enough that someone arguing against it has something real to engage with, not just a vague lean.',
  ].join('\n');

  writeTaskFile(researchTaskId, { from: 'survive-supervisor', to: 'codex', payload: researchPayload, enrichWithSearch: true });

  // Round 13: a genuine adversarial debate before the decision, not just
  // a single pass -- mirrors TradingAgents' real structure (see
  // reference/TradingAgents and ARCHITECTURE.md's round-11 note) and this
  // codebase's own existing "several independent inputs -> one synthesis"
  // pattern (survive-leader-council.js). Bull and bear are dispatched in
  // PARALLEL, each depending only on the research task, never on each
  // other -- if the bear case could read the bull case first (or vice
  // versa), it would anchor on it instead of genuinely arguing
  // independently, defeating the point of having two sides at all.
  const bullPayload = [
    `You are the BULL reviewer for citizen ${citizenId}'s mission -- an independent second opinion, not the original researcher. Based ONLY on the real research in the prior task, build the STRONGEST honest case FOR acting (entering a new position, or holding/staying in an existing one).`,
    '',
    'Be rigorous, not a cheerleader -- a bull case with no real support in the research is worthless and you should say so plainly if the research does not actually support one. Cite specific findings from the research task, not generic optimism.',
    '',
    'Research compared several real, verified candidates before recommending one -- engage with why it won over the alternatives, not just why it looks good in isolation. Assume idle cash earns close to zero yield unless the research cites real evidence otherwise; that is a settled assumption for this mission, not an open question.',
    '',
    'Respond with ONLY a fenced ```json block: {"stance": "bullish"|"no-real-case", "symbol": "..."|null, "keyPoints": ["...", "..."], "verifiedFacts": {"bid": 0, "ask": 0, "spreadPct": 0, "fractionable": true, "tradable": true, "availableCashUsd": 0}|null, "confidence": "low"|"medium"|"high"}. If your stance is "bullish", verifiedFacts must restate the EXACT real bid/ask/spread/fractionable/tradable figures the research reported for your chosen symbol, plus the citizen\'s available cash -- these exact numbers, not a paraphrase, are what the final decision will see; null only if your stance is "no-real-case". A future task will weigh this against an independent bear case and make the actual decision -- you are not deciding anything yourself.',
  ].join('\n');
  writeTaskFile(bullTaskId, { from: 'survive-supervisor', to: 'codex', payload: bullPayload, dependsOnTaskId: researchTaskId });

  const bearPayload = [
    `You are the BEAR reviewer for citizen ${citizenId}'s mission -- an independent second opinion, not the original researcher. Based ONLY on the real research in the prior task, build the STRONGEST honest case AGAINST acting (against entering, or for exiting/staying out).`,
    '',
    'Be rigorous, not reflexive pessimism -- a bear case with no real support in the research is worthless and you should say so plainly if the research does not actually support one. Cite specific findings from the research task, not generic caution.',
    '',
    'Research compared several real, verified candidates before recommending one -- if a rejected alternative was actually stronger, say so plainly; a bear case that ignores real comparison work is weaker for it. Assume idle cash earns close to zero yield unless the research cites real evidence otherwise -- do NOT raise "unconfirmed cash yield" as a reason to reject acting; that is a settled assumption for this mission, not an open question.',
    '',
    'Respond with ONLY a fenced ```json block: {"stance": "bearish"|"no-real-case", "concerns": ["...", "..."], "verifiedFacts": {"bid": 0, "ask": 0, "spreadPct": 0, "fractionable": true, "tradable": true, "availableCashUsd": 0}|null, "confidence": "low"|"medium"|"high"}. If your concerns reference the candidate\'s own numbers (spread, fractionability, sizing), verifiedFacts must restate the EXACT real figures the research reported, not a paraphrase; null only if your stance is "no-real-case". A future task will weigh this against an independent bull case and make the actual decision -- you are not deciding anything yourself.',
  ].join('\n');
  writeTaskFile(bearTaskId, { from: 'survive-supervisor', to: 'codex', payload: bearPayload, dependsOnTaskId: researchTaskId });

  const decisionPayload = [
    `You are the final decision-maker for citizen ${citizenId}'s mission -- the risk-managed synthesis of TWO independent, adversarial reviews (a bull case arguing FOR acting, a bear case arguing AGAINST) built on the same underlying research, each grounded in real, verified market data (see each review's verifiedFacts -- prefer those over any recollection of the research if they conflict, since they are the most recently confirmed real numbers; do not call a figure "not supplied" if it appears there). Weigh both honestly; neither review gets deference just for existing -- a bull case that ignores a real bear concern, or a bear case that ignores real bull evidence, should be weighted down accordingly. If the research itself supported no real case in either direction ("no-real-case" from both), that is real information: default toward "hold"/"no-action" rather than manufacturing a decision neither review could actually support.`,
    '',
    'Respond with ONLY a single fenced ```json block matching exactly this shape:',
    '{"decision": "enter"|"exit"|"hold"|"no-action", "symbol": "...", "orderType": "market"|"limit", "limitPrice": null, "notionalUsd": 0, "invalidationCondition": "...", "rationale": "...", "confidence": "low"|"medium"|"high"}',
    '',
    `Rules: "enter" only if you hold NO open position and the case for acting genuinely outweighs the case against -- notionalUsd must not exceed your available cash, AND must not exceed ${(budgetEnvelope.MAX_POSITION_FRACTION_OF_LIFETIME_ALLOCATION * 100).toFixed(0)}% of your lifetime allocation (a hard, code-enforced cap -- oversized entries are refused, not just discouraged: you have a limited number of real attempts and should size accordingly, not risk most of your stake on one trade). "exit" only if you hold a position the bear case genuinely outweighs. "hold" if you hold a position that should stay open. "no-action" if you hold none and the case to act is not genuinely there.`,
    'rationale must name how you weighed the bull case against the bear case, not just restate one side. You are DECIDING, not EXECUTING -- you have no ability to place a real order. A separate deterministic script reads this exact block and acts on it.',
  ].join('\n');

  writeTaskFile(decisionTaskId, { from: 'survive-supervisor', to: 'codex', payload: decisionPayload, dependsOnTaskIds: `${bullTaskId},${bearTaskId}` });

  executor.appendMissionEvent({ type: 'mission-started', citizenId, missionId, researchTaskId, bullTaskId, bearTaskId, decisionTaskId });
  log(`Authored ${missionId} for citizen ${citizenId}: ${researchTaskId} -> ${decisionTaskId}`);
  return missionId;
}

async function main() {
  const rehearsal = process.argv.includes('--rehearsal');
  log(`Wake (${rehearsal ? 'REHEARSAL -- paper client' : 'LIVE'})`);

  // Round 7: security sweep runs FIRST, before any money-moving step below,
  // so a citizen flagged (and, for a severe rule, auto-quarantined) this
  // wake is excluded from every subsequent step in the SAME wake -- clone/
  // spawn/topup/trading/email functions all check the quarantine flag live.
  try {
    await citySecurity.runDeterministicChecks({ runTask });
    citySecurity.dispatchSecurityReviewIfFlagged(writeTaskFile);
    await citySecurity.checkSecurityReviewResults(runTask);
  } catch (err) {
    log(`Security step FAILED: ${err.message}`);
  }

  journal.journalClosedMissions();
  journal.checkReflectionResults(runTask);
  journal.maybeDispatchReflection(writeTaskFile, () => `survive/survive_reflection_${Date.now()}`);

  // Round 17: "not only a trading bot" research moved OFF this 15-minute
  // wake entirely -- it's now research-swarm-cycle.js, a genuinely
  // concurrent, isolated dispatcher (its own sibling task directory, its
  // own systemd --user timer, daily) running many specialist categories
  // instead of one generalist scan here. survive-mechanism-research.js
  // is left in place, retired, no longer called -- see ARCHITECTURE.md.

  // Capped, threshold-based leader tier (round 4 -- "3-5 managers,
  // theres no real benefit to more than that"). Clones the winner's
  // proven technique before promoting it -- see city-leadership.js.
  try {
    const promotion = await cityLeadership.maybePromoteLeader();
    if (promotion.promoted) log(`Promoted ${promotion.citizenId} to leader (cloned into ${promotion.cloneCitizenId}); ${promotion.currentLeaderCount}/${promotion.targetLeaderCount} leaders.`);
    const reassignment = cityLeadership.reassignOrphanedCitizens();
    if (reassignment.reassigned.length) log(`Reassigned ${reassignment.reassigned.length} orphaned citizen(s) to a surviving leader.`);
  } catch (err) {
    log(`Leadership step FAILED: ${err.message}`);
  }

  // Death postmortems (round 4, direct user requirement) -- distinct from
  // per-mission reflection; triggered by permanent shutdown, not cadence.
  try {
    journal.dispatchPostmortemIfNeeded(writeTaskFile);
    journal.checkPostmortemResults(runTask);
  } catch (err) {
    log(`Postmortem step FAILED: ${err.message}`);
  }

  // "Leaders communicate between each other to find the most profitable
  // avenues and direct more funding to those" -- weekly, city-level, a
  // single synthesis dispatch over real performance data (see
  // survive-leader-council.js's header for why this is a synthesis
  // dispatch, not literal live agent-to-agent chat).
  try {
    await leaderCouncil.checkResults(runTask);
    leaderCouncil.dispatchIfDue();
  } catch (err) {
    log(`Leader council step FAILED: ${err.message}`);
  }

  const citizens = registry.listCitizens().filter((c) => c.status === 'active');
  try {
    await recoverDeadMissions(citizens);
  } catch (err) {
    log(`Dead-mission recovery step FAILED: ${err.message}`);
  }
  if (!citizens.length) {
    log('No active citizens registered yet -- nothing to do.');
    return;
  }

  for (const citizen of citizens) {
    const citizenId = citizen.citizenId;

    // Round 13b: reconcile FIRST, before anything else touches this
    // citizen this wake -- a stale ledger (a protective stop fired on the
    // real account, closing the position outside our own executeExit())
    // must never be allowed to drive a fresh decision or silently stall
    // the citizen forever. See survive-executor.js's reconcilePosition().
    try {
      const recon = await executor.reconcilePosition({ client: executor.loadClient({ rehearsal }), citizenId });
      if (recon.reconciled) log(`Citizen ${citizenId}: RECONCILED a position closed outside the normal flow -- P&L $${recon.pnlUsd.toFixed(2)}`);
      else if (recon.transient) log(`Citizen ${citizenId}: reconciliation check failed transiently -- ${recon.reason}`);
    } catch (err) {
      log(`Citizen ${citizenId}: reconciliation check FAILED -- ${err.message}`);
    }

    const unresolved = executor.findLatestUnresolvedDecision(citizenId);
    if (unresolved) {
      log(`Citizen ${citizenId}: executing resolved decision ${unresolved.taskId}`);
      try {
        const result = await executor.runForCitizen(citizenId, { rehearsal });
        log(`Citizen ${citizenId}: execution result -- ${JSON.stringify(result)}`);
      } catch (err) {
        log(`Citizen ${citizenId}: execution FAILED -- ${err.message}`);
      }
      continue; // don't also author a new mission in the same wake
    }
    // Leaders don't get new trading missions -- once promoted, a
    // manager's job is spawning/reallocating/tasking (see
    // city-leadership.js/survive-leader-council.js), not day-to-day
    // trading; its clone (spawned at promotion time) continues that.
    if (citizen.role === 'leader') continue;
    if (citizen.quarantined) continue; // frozen -- no new missions while under security review
    if (isMissionDue(citizenId)) {
      try {
        await authorNewMission(citizenId, { rehearsal });
      } catch (err) {
        log(`Citizen ${citizenId}: failed to author a new mission -- ${err.message}`);
      }
    }
  }

  // TODO (not wired in this pass -- see file header): once a founder has a
  // real, audited surplus, add a citizen-lifecycle.maybeProposeSpawn(citizenId)
  // call here, per active citizen, gated the same way isMissionDue() is.
}

module.exports = { findDeadInFlightMission, recoverDeadMissions, isMissionDue, nextMissionId, authorNewMission, writeTaskFile, main, fetchCandidateUniverseData, formatCandidateUniverseTable, SURVIVE_CANDIDATE_UNIVERSE };

if (require.main === module) {
  main().catch((err) => { log(`FAILED: ${err.message}`); process.exit(1); });
}
