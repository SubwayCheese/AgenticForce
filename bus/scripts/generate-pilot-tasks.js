// generate-pilot-tasks.js -- authors the day's fleet_pilot_*/crypto_pilot_*
// task files so pilot-supervisor.js never has to. Everything downstream
// (dispatch, dependency chaining, retries) is already real and working via
// run-queue-daemon.js -- this module's only job is to write status:pending
// .md files that match the exact shape it already knows how to read.
//
// Every generated task is `to: codex`, never `to: claude-agent` -- see
// ARCHITECTURE.md section 9 for why (claude-agent shares the interactive
// session's own rate-limit pool; codex does not).
//
// Naming is load-bearing: filenames must match discoverShortlist()/
// discoverRound3Versions()'s regexes in fleet-status.js/crypto-status.js
// exactly (unsuffixed = version 1), or the existing dashboards silently
// stop finding what this script wrote.

const fs = require('fs');
const path = require('path');
const runTask = require('./run-task.js');
const fleetStatus = require('./fleet-status.js');
const cryptoStatus = require('./crypto-status.js');
const cryptoSymbols = require('./crypto-symbols.js');
const alpaca = require('./alpaca-client.js');
const finnhub = require('./finnhub-client.js');
const ntfy = require('./ntfy.js');
const journal = require('./trading-journal.js');

const TASKS_DIR = runTask.TASKS_DIR;
const FLEET_UNIVERSE_PATH = path.join(__dirname, 'fleet-universe.json');
const SHORTLIST_SIZE = 15;

function nowIso() {
  return new Date().toISOString();
}

function taskFilePath(taskId) {
  return path.join(TASKS_DIR, `${taskId}.md`);
}

function taskExists(taskId) {
  return fs.existsSync(taskFilePath(taskId));
}

function listTaskFilenames() {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.md'));
}

function writeTaskFile(taskId, opts) {
  if (taskExists(taskId)) {
    throw new Error(`Refusing to overwrite existing task file: ${taskId}.md`);
  }
  const lines = [
    `## ${taskId}`,
    `from: ${opts.from}`,
    `to: ${opts.to}`,
    `type: ${opts.type || 'request'}`,
    `status: pending`,
    `payload: ${opts.payload}`,
    `timestamp: ${nowIso()}`,
  ];
  if (opts.dependsOnTaskIds && opts.dependsOnTaskIds.length) {
    lines.push(`dependsOnTaskIds: ${opts.dependsOnTaskIds.join(', ')}`);
  } else if (opts.dependsOnTaskId) {
    lines.push(`dependsOnTaskId: ${opts.dependsOnTaskId}`);
  }
  lines.push('');
  fs.writeFileSync(taskFilePath(taskId), lines.join('\n'), 'utf8');
  return taskId;
}

function todayDatePrefix(d) {
  const date = d || new Date();
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

// ---------- Self-improvement: prior-cycle keyLearnings ----------

function pilotPrefix(pilot) {
  return pilot === 'crypto' ? 'crypto_pilot_' : 'fleet_pilot_';
}

// Latest <prefix><YYYYMMDD>_ date strictly before `beforeDatePrefix`, or
// null if there isn't one (first-ever automated cycle for this pilot).
// Excludes rescan files -- same rescan-date-collision class of bug fixed
// in pilot-supervisor.js's todayCycleExists() and fleet-status.js/
// crypto-status.js's findLatestPipelineDate(): a rescan is named with the
// date it FIRES on, not its original cycle's date, so it can register a
// date here that never had a real cycle (and thus no real keyLearnings).
function findPriorDate(pilot, beforeDatePrefix, filenames) {
  const files = filenames || listTaskFilenames();
  const re = new RegExp(`^${pilotPrefix(pilot)}(\\d{8})_`);
  const dates = new Set();
  for (const f of files) {
    if (f.includes('_rescan_')) continue;
    const m = re.exec(f);
    if (m && m[1] < beforeDatePrefix) dates.add(m[1]);
  }
  if (dates.size === 0) return null;
  return Array.from(dates).sort().pop();
}

// Reuses parseRound3Output()/discoverRound3Versions() verbatim -- no
// re-parsing of round-3 output, same trust tier as the dashboards.
function getPriorLearnings(pilot, beforeDatePrefix) {
  const filenames = listTaskFilenames();
  const priorDate = findPriorDate(pilot, beforeDatePrefix, filenames);
  if (!priorDate) return [];

  const versions = pilot === 'crypto'
    ? cryptoStatus.discoverRound3Versions(priorDate, filenames)
    : fleetStatus.discoverRound3Versions(priorDate, filenames);
  if (!versions.length) return [];

  const latest = versions[versions.length - 1];
  const task = runTask.readTaskFile(latest.taskId);
  if (!task || task.status !== 'done' || !task.output) return [];

  const parsed = fleetStatus.parseRound3Output(task.output);
  return (parsed && Array.isArray(parsed.keyLearnings)) ? parsed.keyLearnings : [];
}

function formatPriorLearningsSection(learnings, priorTaskId, priorDate) {
  if (!learnings || !learnings.length) {
    return '## Prior learnings\nNo prior-cycle learnings available yet.';
  }
  const bullets = learnings.map((l) => `- ${l}`).join('\n');
  return [
    `## Prior learnings (auto-injected from ${priorTaskId}'s keyLearnings, cycle ${priorDate})`,
    bullets,
    '',
    'Use these as methodological discipline for THIS thesis -- they are lessons about',
    'how this pipeline tends to over/understate evidence, not facts about this specific',
    'symbol unless stated as such.',
  ].join('\n');
}

function getPriorLearningsSection(pilot, datePrefix) {
  const priorDate = findPriorDate(pilot, datePrefix);
  if (!priorDate) return formatPriorLearningsSection([], null, null);
  const learnings = getPriorLearnings(pilot, datePrefix);
  const versions = pilot === 'crypto'
    ? cryptoStatus.discoverRound3Versions(priorDate)
    : fleetStatus.discoverRound3Versions(priorDate);
  const priorTaskId = versions.length ? versions[versions.length - 1].taskId : null;
  return formatPriorLearningsSection(learnings, priorTaskId, priorDate);
}

// ---------- Round 1 / round 2 templates ----------

// "The stock is the teacher" (added 2026-09-10): a symbol's own real
// trading history -- not pipeline-methodology critique, actual thesis-vs-
// outcome lessons from trading-journal.js -- injected directly into its
// next thesis. Distinct from priorLearningsSection (which is cycle-wide
// keyLearnings); this is per-symbol and only appears once that symbol has
// actually been traded and closed at least once.
function formatSymbolHistorySection(symbol) {
  const history = journal.getSymbolHistory(symbol, 3);
  if (!history.length) return '';
  const rows = history.map((h) => `- ${h.exitTs.slice(0, 10)}: ${h.direction} @ $${h.entryPrice} -> $${h.exitPrice} (${h.outcome}${h.pnlPct !== null ? `, ${h.pnlPct.toFixed(2)}%` : ''}). Lesson: ${h.lesson}`).join('\n');
  return [
    `## Real trading history for ${symbol} (${history.length} closed trade(s), most recent first)`,
    rows,
    '',
    'This is actual past performance on this exact symbol, not general market commentary -- weigh it accordingly, but a past loss does not automatically mean reject; a past win does not automatically mean approve. Judge THIS thesis on today\'s evidence, informed by what actually happened before.',
  ].join('\n');
}

function generateThesisTask(pilot, symbol, datePrefix, priorLearningsSection, dataSnapshotTaskId) {
  const prefix = pilotPrefix(pilot);
  const taskId = `${prefix}${datePrefix}_thesis_r1_${symbol.toLowerCase()}`;
  const isCrypto = pilot === 'crypto';
  const symbolHistorySection = formatSymbolHistorySection(symbol);
  const payloadLines = [
    `ROUND-1 INDEPENDENT THESIS for ${symbol}, generated unattended by generate-pilot-tasks.js for the ${datePrefix} ${pilot} cycle (see ${dataSnapshotTaskId}, auto-injected below, for the full data).`,
    '',
    isCrypto
      ? 'Standing constraints for crypto theses: no fundamentals data exists for this asset class -- do not invent one. This symbol is confirmed spot/long-only on this account; a bear case means "stay out," never "short." Tag any macro/narrative claim as INTERPRETATION, never FACT.'
      : 'Build a fresh, independent thesis using the full injected dataset -- price/volume/momentum data plus fundamentals where available. Tag every claim FACT (cite the specific field) or INTERPRETATION.',
    '',
    priorLearningsSection,
    ...(symbolHistorySection ? ['', symbolHistorySection] : []),
  ];
  return writeTaskFile(taskId, {
    from: 'claude',
    to: 'codex',
    type: 'request',
    payload: payloadLines.join('\n'),
    dependsOnTaskId: dataSnapshotTaskId,
  });
}

function generateChallengeTask(pilot, symbol, datePrefix, thesisTaskId) {
  const prefix = pilotPrefix(pilot);
  const taskId = `${prefix}${datePrefix}_challenge_r2_${symbol.toLowerCase()}`;
  const payload = [
    `ROUND-2 ADVERSARIAL CHALLENGE for the round-1 thesis on ${symbol} (dependency, auto-injected below). Pressure-test it using the full injected dataset -- written by a different specialist, who is not told what you conclude. Do NOT just restate or endorse it; show real work trying to break it first.`,
    '',
    'Challenge every FACT-tagged claim, every INTERPRETATION-tagged claim, identify data gaps and internal inconsistencies, then build the strongest genuine counterargument using only the same injected data. Conclude with a verdict: "thesis holds up," "thesis has material weaknesses, stance should be downgraded," or "thesis has material weaknesses, stance should be reversed."',
  ].join('\n');
  return writeTaskFile(taskId, {
    from: 'claude',
    to: 'codex',
    type: 'request',
    payload,
    dependsOnTaskId: thesisTaskId,
  });
}

// ---------- Round 3 template ----------

function generateSynthesisTask(pilot, datePrefix, symbols, r1Ids, r2Ids, priorLearningsSection, versionSuffix) {
  const prefix = pilotPrefix(pilot);
  const isCrypto = pilot === 'crypto';
  // versionSuffix (e.g. "v2") lets round-3 be re-run against the SAME
  // already-completed round-1/round-2 ledger without re-dispatching it --
  // e.g. after a decision-rule bug fix, matching the established
  // _v2/_v3 re-run convention from fleet_pilot_20260908's history.
  const taskId = `${prefix}${datePrefix}_synthesis_r3_portfolio${versionSuffix ? '_' + versionSuffix : ''}`;
  const payload = [
    `ROUND-3 PORTFOLIO SYNTHESIS for the ${pilot} pilot (${symbols.join(', ')}). You are receiving the COMPLETE ledger: every round-1 thesis and round-2 challenge for this cycle, auto-injected below via multi-parent dependency.`,
    '',
    'Independently sort EACH candidate into exactly one of THREE outcomes -- not a forced single winner, and not a forced binary:',
    '',
    '1. **approvedCandidates** -- actionable TODAY at current price, no future-dated gates. Use when the evidence genuinely supports acting right now.',
    '2. **conditionalCandidates** -- the thesis itself is sound and the evidence quality clears the bar, but the CURRENT price is not the right entry -- a specific, checkable price level would confirm it (a pullback to support, a breakout above resistance, a rebound off a stated level). This is a real third outcome, not a consolation prize: only use it when round 2 did NOT find unresolved evidence-quality problems (a real logic/arithmetic error, an undefined/non-comparable metric, a data gap material enough to undermine the conclusion) -- if round 2 found problems like that, the candidate is REJECTED, not conditional, because a price trigger cannot fix bad evidence.',
    '3. **rejectedCandidates** -- round 2 found a genuine, CANDIDATE-SPECIFIC disqualifying issue, or there is no real edge at any price for this name specifically.',
    '',
    '**Critical distinction, read this before sorting anyone -- this is the single most common mistake in this decision**: round 2 was instructed to challenge EVERY thesis hard, so it will almost always surface something. Before treating a round-2 finding as grounds to reject, ask: does this finding apply ONLY to this candidate, or does the SAME limitation appear in round 2\'s critique of most/all of the other candidates too (e.g. "no forward growth estimates," "no peer-relative benchmarking," an undefined valuation-metric label, "cannot independently verify the raw daily series")? If it\'s a limitation of the INJECTED DATASET ITSELF -- true equally for every symbol in this batch because they were all built from the same enrichment pass -- it is NOT valid grounds to reject one candidate and not another. Rejecting every candidate for the same generic data-completeness caveat is not 15 independent judgments, it is one structural bias wearing 15 different names -- catch this actively, do not let it happen by default. A real disqualifier is something that differentiates THIS candidate from the others: an unexplained price event specific to this symbol, an actual arithmetic/logic error in THIS thesis, a fact this specific stance contradicts. Reserve rejectedCandidates for that.',
    '',
    'Do NOT default everything into conditionalCandidates just to avoid an empty approvedCandidates/rejectedCandidates list -- sort honestly. A day where every candidate genuinely belongs in rejectedCandidates for real, candidate-specific reasons is a correct outcome. A day where every candidate gets the same generic-data-limitation reasoning is very likely the bias above, not a real finding -- if you notice that pattern forming, stop and re-sort using the distinction above before finalizing.',
    '',
    isCrypto
      ? 'All symbols here are confirmed spot/long-only -- any approved or conditional conditionalSetup.direction MUST be "long". Time-based exit must be phrased in HOURS, not trading sessions -- crypto trades 24/7. Use the Alpaca order-format symbol with a slash (e.g. BTC/USD) in conditionalSetup.symbol.'
      : 'Time-based exit must be phrased as "...or exit after N trading sessions if not triggered," or "exit at today\'s close"/"exit at the close" for an explicit same-day exit.',
    '',
    'Deterministic decision rule: (1) reject a candidate ONLY where round 2 found a genuine candidate-specific disqualifying issue (see the distinction above -- not a generic data-completeness caveat shared across the batch); (2) among survivors, assess genuine conviction; (3) if current price already supports entry, approve; (4) if the thesis is sound but needs a specific price confirmation first, mark conditional with an exact triggerPrice; (5) for each approved OR conditional candidate produce a conditionalSetup (symbol, direction, entryCondition, invalidationCondition, timeHorizon); (6) preserve material dissent per-symbol.',
    '',
    'conditionalCandidates entries need TWO fields the other categories do not: **triggerPrice** (a single number, the exact price that confirms entry) and **triggerType** (`"at_or_below"` if you are waiting for a pullback/breakdown-confirmed entry, `"at_or_above"` if you are waiting for a breakout/strength-confirmed entry). These are checked automatically against live price, so they must be exact numbers, not a range or a prose description. When triggerType fires, an automated re-verification (a brief rescan, not full re-research) checks whether the thesis still holds before anything is executed -- so state the ORIGINAL reasoning clearly enough that a future check against it makes sense.',
    '',
    'Output MUST include a single fenced json code block containing: runTimestamp, frozenDataTimestamp, approvedCandidates[] (symbol/stance/conditionalSetup/bullCase/bearCase/oneLineRationale), conditionalCandidates[] (symbol/stance/triggerPrice/triggerType/conditionalSetup/bullCase/bearCase/oneLineRationale), rejectedCandidates[] (symbol/reason), materialDissent{}, evidenceLedgerSummary{}, riskWarnings[], keyLearnings[], comparisonToPriorRuns, disclaimer.',
    '',
    priorLearningsSection,
  ].join('\n');
  return writeTaskFile(taskId, {
    from: 'claude',
    to: 'codex',
    type: 'request',
    payload,
    dependsOnTaskIds: [...r1Ids, ...r2Ids],
  });
}

// ---------- Rescan (conditional-trigger confirmation) ----------

// Fired by conditional-triggers.js the moment a conditionalCandidate's
// triggerPrice is actually touched -- NOT a full re-run of rounds 1-2, a
// brief re-verification against the original thesis plus the one new fact
// (live price now at/through the trigger). Codex has no live FMP access,
// so this is a reasoning re-check against already-injected context, not a
// fresh data pull -- honest about that constraint, not pretending
// otherwise. Codex's own hosted web-search tool IS real and available
// (confirmed working under --sandbox read-only) if a quick current-events
// check would change the verdict.
function generateRescanTask(pilot, symbol, datePrefix, sourceSynthesisTaskId, livePrice, triggerPrice, triggerType) {
  const prefix = pilotPrefix(pilot);
  const taskId = `${prefix}${datePrefix}_rescan_${symbol.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
  const payload = [
    `RESCAN for ${symbol}: this candidate's conditional trigger has just fired. Original conditional thesis (with its bull/bear case and triggerPrice/triggerType) is auto-injected below via dependency.`,
    '',
    `Live price is now $${livePrice}, which has crossed the stated trigger ($${triggerPrice}, ${triggerType}).`,
    '',
    'Do a BRIEF re-verification, not a full re-research pass: does the original thesis still hold up given this price action, or does the move itself look like it undermines the thesis (e.g. a "buy the pullback" thesis where the pullback kept accelerating past support, or unexplained volume/news you can check via your own hosted web-search tool if available)? You do not have live fundamental/valuation data access -- reason from the injected thesis plus this one new price fact, and a quick web-search check if it would change your answer.',
    '',
    'Reply with a single clear verdict line, exactly one of: "VERDICT: STILL VALID" or "VERDICT: NO LONGER VALID", followed by one short paragraph of reasoning.',
  ].join('\n');
  return writeTaskFile(taskId, {
    from: 'claude',
    to: 'codex',
    type: 'request',
    payload,
    dependsOnTaskId: sourceSynthesisTaskId,
  });
}

// ---------- Trading-journal reflection ("the stock is the teacher") ----------

// Dispatched by trading-journal.js once enough newly-closed trades have
// accumulated -- a real agent reflection pass over ACTUAL outcomes (thesis
// vs. what really happened), not the round-3 keyLearnings field (which is
// pipeline-methodology critique, not per-symbol trading experience). The
// whole batch is injected directly in the payload as raw JSON -- these are
// journal rows, not other task files, so there's no dependsOnTaskId chain
// here.
function generateReflectionTask(datePrefix, batch) {
  const taskId = `trading_journal_reflection_${datePrefix}_${Date.now()}`;
  const batchText = batch.map((entry, i) => {
    const t = entry.entryThesis;
    return [
      `### Trade ${i + 1}: ${entry.symbol} (${entry.direction}, ${entry.assetClass})`,
      `- Original stance: ${t ? t.stance : 'unknown'}`,
      `- Bull case: ${t ? t.bullCase : 'not recorded'}`,
      `- Bear case: ${t ? t.bearCase : 'not recorded'}`,
      `- Rationale: ${t ? t.oneLineRationale : 'not recorded'}`,
      `- ACTUAL OUTCOME: ${entry.outcome.toUpperCase()}, ${entry.pnlPct === null ? 'P&L unknown' : entry.pnlPct.toFixed(2) + '%'} (entry $${entry.entryPrice}, exit $${entry.exitPrice}, reason: ${entry.exitReason})`,
    ].join('\n');
  }).join('\n\n');

  const payload = [
    `TRADING JOURNAL REFLECTION: ${batch.length} real, closed micro-trade(s), each with its original thesis and its ACTUAL outcome. Write a genuine lesson for EACH trade -- what the thesis got right or wrong given what actually happened -- and note any pattern that spans more than one trade in this batch.`,
    '',
    batchText,
    '',
    'For EACH trade, write 1-3 sentences: did the stated bull/bear reasoning predict the real outcome, and specifically why or why not (cite the actual entry/exit prices, not just win/loss)? This is a real trading record, not a hypothetical -- be concrete, not generic ("the market is unpredictable" is not a lesson).',
    '',
    'Output a fenced ```json``` block: `{ "lessons": [ { "symbol": "...", "lesson": "..." }, ... ], "crossTradePattern": "... or null if none" }`. One lessons[] entry per trade, in the same order given above.',
  ].join('\n');

  return writeTaskFile(taskId, {
    from: 'claude',
    to: 'codex',
    type: 'request',
    payload,
  });
}

// ---------- Screening (equity only) ----------

// screenScore = 50*norm(Chg%) + 30*norm(AvgVolume) + 20*norm(MarketCap),
// min-max normalized per field across the whole candidate set -- the
// exact, confirmed formula from fleet_pilot_20260908_universe50_consolidation.md,
// ported into a real deterministic function so an unattended run reproduces
// it identically every day instead of a human re-deriving it by hand.
function computeScreenScore(candidates) {
  const fields = ['chgPct', 'avgVolume', 'marketCap'];
  const ranges = {};
  for (const f of fields) {
    const vals = candidates.map((c) => c[f]);
    ranges[f] = { min: Math.min(...vals), max: Math.max(...vals) };
  }
  const norm = (v, f) => {
    const { min, max } = ranges[f];
    return max === min ? 0 : (v - min) / (max - min);
  };
  return candidates
    .map((c) => ({
      ...c,
      screenScore: 50 * norm(c.chgPct, 'chgPct') + 30 * norm(c.avgVolume, 'avgVolume') + 20 * norm(c.marketCap, 'marketCap'),
    }))
    .sort((a, b) => b.screenScore - a.screenScore);
}

// ---------- Data snapshot ----------
//
// UPDATED 2026-09-11: switched off FMP (paid to cover this call volume)
// after the user pushed back ("There has to be a free alternative" --
// see project memory feedback_explore_alternatives). Price/volume now
// comes from alpaca-client.js's getDailyBars() -- free with the existing
// paper account, already keyed, batched (one call per universe instead of
// one per symbol, which is also just strictly better than the old
// per-symbol FMP loop). Equity market cap comes from finnhub-client.js's
// free tier (optional -- degrades to 0/no-cap-weight if FINNHUB_API_KEY
// isn't configured, same graceful-skip posture FMP had). Crypto market
// cap has no free, ID-unambiguous source wired up yet -- documented
// honestly below, not silently fabricated.

// avg50/avg200 close, computed locally from the fetched bar window --
// null if fewer bars than that window exist yet (e.g. a recently-listed
// asset), same "don't fabricate" posture as everything else here.
function priceAverages(bars) {
  const closes = bars.map((b) => b.c);
  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  return { priceAvg50: avg(closes.slice(-50)), priceAvg200: avg(closes.slice(-200)) };
}

// Landed directly as status:done, source-tagged and self-resolved -- same
// trust tier as a hand-typed orchestrator-sourced task, just script-authored.
function landAsDone(taskId, sourceLine, payload) {
  const filePath = taskFilePath(taskId);
  const resultBlock = [
    '',
    '## Result (auto)',
    `resolved_at: ${nowIso()}`,
    'output:',
    '```',
    sourceLine,
    `As of: ${nowIso()}`,
    '',
    payload,
    '```',
  ].join('\n');
  fs.writeFileSync(filePath, fs.readFileSync(filePath, 'utf8') + resultBlock + '\n', 'utf8');
  const text = fs.readFileSync(filePath, 'utf8').replace(/^status:\s*.*$/m, 'status: done');
  fs.writeFileSync(filePath, text, 'utf8');
}

async function generateFleetDataSnapshot(datePrefix) {
  const universe = JSON.parse(fs.readFileSync(FLEET_UNIVERSE_PATH, 'utf8')).symbols;
  const barsBySymbol = await alpaca.getDailyBars(universe, { limit: 210 });
  const finnhubAvailable = finnhub.hasCredentials();
  const profiles = finnhubAvailable
    ? await Promise.all(universe.map(async (s) => {
        try { return [s, await finnhub.getProfile2(s)]; } catch (err) {
          console.log(`[generate-pilot-tasks] finnhub profile failed for ${s}: ${err.message}`);
          return [s, null];
        }
      }))
    : [];
  const profileBySymbol = new Map(profiles);

  const candidates = universe
    .map((symbol) => {
      const entry = barsBySymbol[symbol];
      if (!entry) return null;
      const profile = profileBySymbol.get(symbol);
      // Finnhub's marketCapitalization is in MILLIONS of USD -- see finnhub-client.js.
      const marketCap = profile && profile.marketCapitalization ? profile.marketCapitalization * 1e6 : 0;
      const { priceAvg50, priceAvg200 } = priceAverages(entry.bars);
      return { symbol, price: entry.lastClose, chgPct: entry.chgPct, avgVolume: entry.avgVolume, marketCap, priceAvg50, priceAvg200 };
    })
    .filter(Boolean);
  const ranked = computeScreenScore(candidates);
  const shortlist = ranked.slice(0, SHORTLIST_SIZE);

  const taskId = `fleet_pilot_${datePrefix}_universe50_consolidation`;
  const table = ranked
    .map((c, i) => `| ${i + 1} | ${c.symbol} | ${c.chgPct.toFixed(2)}% | ${Math.round(c.avgVolume).toLocaleString()} | ${c.marketCap ? '$' + (c.marketCap / 1e9).toFixed(1) + 'B' : 'n/a'} | ${c.screenScore.toFixed(1)} |`)
    .join('\n');
  const capNote = finnhubAvailable
    ? ''
    : '\n\nFINNHUB_API_KEY not configured -- market cap is n/a for every symbol this cycle, and screenScore is effectively 50 x norm(Chg%) + 30 x norm(AvgVolume) only (the 20% cap weight contributes nothing when every value is equal). Add FINNHUB_API_KEY to bus/secrets.local.json (free tier, finnhub.io) to restore it.';
  const payload = [
    `Unattended screen, ${universe.length}-symbol fixed universe (bus/scripts/fleet-universe.json), price/volume from Alpaca's free market-data API (batched daily bars, same paper-account key already configured -- no new credential), market cap from Finnhub's free tier. Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) + 20 x norm(MarketCap), min-max normalized. Top ${SHORTLIST_SIZE} become this cycle's shortlist.${capNote}`,
    '',
    '| Rank | Symbol | Chg% | Avg Volume (20d) | Market Cap | screenScore |',
    '|---|---|---|---|---|---|',
    table,
  ].join('\n');

  writeTaskFile(taskId, { from: 'claude', to: 'claude', type: 'response', payload: '(orchestrator-sourced, unattended -- see generate-pilot-tasks.js)' });
  landAsDone(taskId, 'SOURCE: verified live (Alpaca market-data API + Finnhub free tier, fetched by generate-pilot-tasks.js -- unattended)', payload);

  return { taskId, symbols: shortlist.map((c) => c.symbol) };
}

// Crypto universe expanded 2026-09-11, direct user request ("expand the
// crypto market exponentially but still have the huge number of
// currencies scanned"): from a fixed 3-coin table to the full real,
// tradable-on-Alpaca universe (32 coins, see crypto-universe.json), with
// the SAME screen -> shortlist funnel already proven for equity
// (computeScreenScore(), reused verbatim -- crypto's chgPct/volume/
// marketCap fields map onto the identical formula). Matches
// generateFleetDataSnapshot()'s current automation DEPTH deliberately --
// a single-day screen, not the deep 20-day-trend/valuation enrichment
// that's only ever been done by hand so far for either pilot (a real,
// separate, not-yet-automated gap for both pilots equally, not something
// this change tries to also solve).
const CRYPTO_SHORTLIST_SIZE = 10;

async function generateCryptoDataSnapshot(datePrefix) {
  const allAssets = cryptoSymbols.CRYPTO_ASSETS; // full 32-coin universe
  const coinList = allAssets.map((a) => a.coin);
  const barsByCoin = await alpaca.getDailyBars(coinList, { limit: 210 });

  const candidates = allAssets
    .map((a) => {
      const entry = barsByCoin[a.coin];
      if (!entry) return null;
      const { priceAvg50, priceAvg200 } = priceAverages(entry.bars);
      // No free, ID-unambiguous crypto market-cap source is wired up yet
      // (see finnhub-client.js header -- Finnhub's free tier is equity-
      // only). marketCap: 0 for every coin makes norm() return 0 for that
      // field (max === min), so screenScore degrades to Chg%/Volume only
      // rather than fabricating a number -- an honest, documented gap,
      // not a silent one.
      return { symbol: a.coin, alpacaSymbol: a.alpacaSymbol, price: entry.lastClose, chgPct: entry.chgPct, avgVolume: entry.avgVolume, marketCap: 0, priceAvg50, priceAvg200 };
    })
    .filter(Boolean);
  const ranked = computeScreenScore(candidates);
  const shortlist = ranked.slice(0, CRYPTO_SHORTLIST_SIZE);

  const taskId = `crypto_pilot_${datePrefix}_universe_consolidation`;
  const table = ranked
    .map((c, i) => `| ${i + 1} | ${c.symbol} | $${c.price} | ${c.chgPct.toFixed(2)}% | ${Math.round(c.avgVolume).toLocaleString()} | ${c.screenScore.toFixed(1)} |`)
    .join('\n');
  const shortlistDetail = shortlist.map((c) => [
    `### ${c.symbol} (${c.alpacaSymbol})`,
    `- Live quote: $${c.price}, change ${c.chgPct.toFixed(2)}%, 50-day avg $${c.priceAvg50 ? c.priceAvg50.toFixed(2) : 'n/a'}, 200-day avg $${c.priceAvg200 ? c.priceAvg200.toFixed(2) : 'n/a'}.`,
    '- No earnings, no valuation multiples, no analyst targets, and no free market-cap source exist for this asset -- structural, not a data gap.',
  ].join('\n')).join('\n\n');

  const payload = [
    `Unattended screen, ${allAssets.length}-coin real tradable-on-Alpaca universe (bus/scripts/crypto-universe.json), price/volume from Alpaca's free market-data API (batched daily bars, same paper-account key already configured -- no new credential). Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) (market-cap term omitted -- no free crypto market-cap source wired up, see generate-pilot-tasks.js). Top ${CRYPTO_SHORTLIST_SIZE} become this cycle's shortlist.`,
    '',
    '| Rank | Coin | Price | Chg% | Volume (20d avg) | screenScore |',
    '|---|---|---|---|---|---|',
    table,
    '',
    '## Shortlist detail',
    shortlistDetail,
  ].join('\n');

  writeTaskFile(taskId, { from: 'claude', to: 'claude', type: 'response', payload: '(orchestrator-sourced, unattended -- see generate-pilot-tasks.js)' });
  landAsDone(taskId, 'SOURCE: verified live (Alpaca market-data API, fetched by generate-pilot-tasks.js -- unattended)', payload);

  return { taskId, symbols: shortlist.map((c) => c.symbol) };
}

// Returns null (and sends an ntfy alert) only if the underlying data
// source actually fails -- unlike the old FMP-gated version, this no
// longer needs a "credentials missing" pre-check: Alpaca's market-data
// API uses the same key/secret every other Alpaca call already requires,
// so there's no separate credential to be missing. Finnhub is optional
// and degrades gracefully inside generateFleetDataSnapshot() itself.
async function generateDataSnapshotTasks(pilot, datePrefix) {
  try {
    return pilot === 'crypto' ? await generateCryptoDataSnapshot(datePrefix) : await generateFleetDataSnapshot(datePrefix);
  } catch (err) {
    await ntfy.sendNtfy({
      title: `${pilot} pilot: data snapshot failed`,
      message: `${pilot}_pilot_${datePrefix} cycle's unattended data snapshot failed: ${err.message}`,
      priority: 4,
    }).catch(() => {});
    console.log(`[generate-pilot-tasks] ${pilot} data snapshot failed for ${datePrefix}: ${err.message}`);
    return null;
  }
}

module.exports = {
  taskExists,
  writeTaskFile,
  todayDatePrefix,
  listTaskFilenames,
  taskFilePath,
  getPriorLearnings,
  getPriorLearningsSection,
  generateThesisTask,
  generateChallengeTask,
  generateSynthesisTask,
  generateRescanTask,
  generateReflectionTask,
  computeScreenScore,
  generateFleetDataSnapshot,
  generateCryptoDataSnapshot,
  generateDataSnapshotTasks,
  FLEET_UNIVERSE_PATH,
  SHORTLIST_SIZE,
};
