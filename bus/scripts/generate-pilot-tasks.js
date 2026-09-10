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
const fmp = require('./fmp-client.js');
const ntfy = require('./ntfy.js');

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
function findPriorDate(pilot, beforeDatePrefix, filenames) {
  const files = filenames || listTaskFilenames();
  const re = new RegExp(`^${pilotPrefix(pilot)}(\\d{8})_`);
  const dates = new Set();
  for (const f of files) {
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

function generateThesisTask(pilot, symbol, datePrefix, priorLearningsSection, dataSnapshotTaskId) {
  const prefix = pilotPrefix(pilot);
  const taskId = `${prefix}${datePrefix}_thesis_r1_${symbol.toLowerCase()}`;
  const isCrypto = pilot === 'crypto';
  const payloadLines = [
    `ROUND-1 INDEPENDENT THESIS for ${symbol}, generated unattended by generate-pilot-tasks.js for the ${datePrefix} ${pilot} cycle (see ${dataSnapshotTaskId}, auto-injected below, for the full data).`,
    '',
    isCrypto
      ? 'Standing constraints for crypto theses: no fundamentals data exists for this asset class -- do not invent one. This symbol is confirmed spot/long-only on this account; a bear case means "stay out," never "short." Tag any macro/narrative claim as INTERPRETATION, never FACT.'
      : 'Build a fresh, independent thesis using the full injected dataset -- price/volume/momentum data plus fundamentals where available. Tag every claim FACT (cite the specific field) or INTERPRETATION.',
    '',
    priorLearningsSection,
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

function generateSynthesisTask(pilot, datePrefix, symbols, r1Ids, r2Ids, priorLearningsSection) {
  const prefix = pilotPrefix(pilot);
  const isCrypto = pilot === 'crypto';
  const taskId = `${prefix}${datePrefix}_synthesis_r3_portfolio`;
  const payload = [
    `ROUND-3 PORTFOLIO SYNTHESIS for the ${pilot} pilot (${symbols.join(', ')}). You are receiving the COMPLETE ledger: every round-1 thesis and round-2 challenge for this cycle, auto-injected below via multi-parent dependency.`,
    '',
    'Independently sort EACH candidate into exactly one of THREE outcomes -- not a forced single winner, and not a forced binary:',
    '',
    '1. **approvedCandidates** -- actionable TODAY at current price, no future-dated gates. Use when the evidence genuinely supports acting right now.',
    '2. **conditionalCandidates** -- the thesis itself is sound and the evidence quality clears the bar, but the CURRENT price is not the right entry -- a specific, checkable price level would confirm it (a pullback to support, a breakout above resistance, a rebound off a stated level). This is a real third outcome, not a consolation prize: only use it when round 2 did NOT find unresolved evidence-quality problems (a real logic/arithmetic error, an undefined/non-comparable metric, a data gap material enough to undermine the conclusion) -- if round 2 found problems like that, the candidate is REJECTED, not conditional, because a price trigger cannot fix bad evidence.',
    '3. **rejectedCandidates** -- round 2 found unresolved substantive issues, or there is no real edge at any price.',
    '',
    'Do NOT default everything into conditionalCandidates just to avoid an empty approvedCandidates/rejectedCandidates list -- sort honestly. A day where every candidate genuinely belongs in rejectedCandidates is a correct, real outcome, not a failure to fix.',
    '',
    isCrypto
      ? 'All symbols here are confirmed spot/long-only -- any approved or conditional conditionalSetup.direction MUST be "long". Time-based exit must be phrased in HOURS, not trading sessions -- crypto trades 24/7. Use the Alpaca order-format symbol with a slash (e.g. BTC/USD) in conditionalSetup.symbol.'
      : 'Time-based exit must be phrased as "...or exit after N trading sessions if not triggered," or "exit at today\'s close"/"exit at the close" for an explicit same-day exit.',
    '',
    'Deterministic decision rule: (1) reject any candidate where round 2 found unresolved substantive issues; (2) among survivors, assess genuine conviction; (3) if current price already supports entry, approve; (4) if the thesis is sound but needs a specific price confirmation first, mark conditional with an exact triggerPrice; (5) for each approved OR conditional candidate produce a conditionalSetup (symbol, direction, entryCondition, invalidationCondition, timeHorizon); (6) preserve material dissent per-symbol.',
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

// ---------- Data snapshot (the one real gap -- see fmp-client.js) ----------

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
  const symbolList = universe.join(',');
  const quotes = await fmp.getQuote(symbolList);
  const profiles = await fmp.getProfile(symbolList);
  const profileBySymbol = new Map((Array.isArray(profiles) ? profiles : []).map((p) => [p.symbol, p]));

  const candidates = (Array.isArray(quotes) ? quotes : []).map((q) => {
    const profile = profileBySymbol.get(q.symbol) || {};
    return {
      symbol: q.symbol,
      chgPct: Number(q.changePercentage ?? q.changesPercentage ?? 0),
      avgVolume: Number(q.avgVolume ?? q.volume ?? 0),
      marketCap: Number(q.marketCap ?? profile.mktCap ?? 0),
    };
  });
  const ranked = computeScreenScore(candidates);
  const shortlist = ranked.slice(0, SHORTLIST_SIZE);

  const taskId = `fleet_pilot_${datePrefix}_universe50_consolidation`;
  const table = ranked
    .map((c, i) => `| ${i + 1} | ${c.symbol} | ${c.chgPct.toFixed(2)}% | ${c.avgVolume.toLocaleString()} | $${(c.marketCap / 1e9).toFixed(1)}B | ${c.screenScore.toFixed(1)} |`)
    .join('\n');
  const payload = [
    `Unattended screen, ${universe.length}-symbol fixed universe (bus/scripts/fleet-universe.json), fetched via FMP REST API. Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) + 20 x norm(MarketCap), min-max normalized. Top ${SHORTLIST_SIZE} become this cycle's shortlist.`,
    '',
    '| Rank | Symbol | Chg% | Avg Volume | Market Cap | screenScore |',
    '|---|---|---|---|---|---|',
    table,
  ].join('\n');

  writeTaskFile(taskId, { from: 'claude', to: 'claude', type: 'response', payload: '(orchestrator-sourced, unattended -- see generate-pilot-tasks.js)' });
  landAsDone(taskId, 'SOURCE: verified live (FMP REST API, fetched by generate-pilot-tasks.js -- unattended, not the MCP connector)', payload);

  return { taskId, symbols: shortlist.map((c) => c.symbol) };
}

async function generateCryptoDataSnapshot(datePrefix) {
  const fmpSymbols = cryptoSymbols.CRYPTO_ASSETS.map((a) => a.fmpSymbol);
  const quotes = await fmp.getQuote(fmpSymbols.join(','));
  const taskId = `crypto_pilot_${datePrefix}_data_snapshot`;

  const sections = (Array.isArray(quotes) ? quotes : []).map((q) => {
    const asset = cryptoSymbols.CRYPTO_ASSETS.find((a) => a.fmpSymbol === q.symbol);
    return [
      `### ${asset ? asset.coin : q.symbol} (${q.symbol}; Alpaca order symbol: ${asset ? asset.alpacaSymbol : 'unknown'})`,
      `- Live quote: $${q.price}, change ${q.changePercentage ?? q.changesPercentage}%, market cap $${q.marketCap}, 50-day avg $${q.priceAvg50}, 200-day avg $${q.priceAvg200}.`,
      '- No earnings, no valuation multiples, no analyst targets exist for this asset.',
    ].join('\n');
  });

  const payload = [
    'Unattended crypto snapshot (BTC/ETH/XRP, fixed universe), fetched via FMP REST API. Price/volume/market-cap data ONLY -- crypto has no fundamentals-equivalent, structurally, not a today-gap.',
    '',
    ...sections,
  ].join('\n\n');

  writeTaskFile(taskId, { from: 'claude', to: 'claude', type: 'response', payload: '(orchestrator-sourced, unattended -- see generate-pilot-tasks.js)' });
  landAsDone(taskId, 'SOURCE: verified live (FMP REST API, fetched by generate-pilot-tasks.js -- unattended, not the MCP connector)', payload);

  return { taskId, symbols: cryptoSymbols.CRYPTO_ASSETS.map((a) => a.coin) };
}

// Returns null (and sends an ntfy alert) if FMP_API_KEY isn't configured --
// see fmp-client.js's header. Never fabricates data to fill the gap.
async function generateDataSnapshotTasks(pilot, datePrefix) {
  if (!fmp.hasCredentials()) {
    await ntfy.sendNtfy({
      title: `${pilot} pilot: data snapshot skipped`,
      message: `FMP_API_KEY not configured -- ${pilot}_pilot_${datePrefix} cycle cannot generate a data snapshot unattended. Add FMP_API_KEY to bus/secrets.local.json, or fetch this one manually.`,
      priority: 4,
    }).catch(() => {});
    console.log(`[generate-pilot-tasks] FMP_API_KEY missing -- skipping ${pilot} data snapshot for ${datePrefix}.`);
    return null;
  }
  return pilot === 'crypto' ? generateCryptoDataSnapshot(datePrefix) : generateFleetDataSnapshot(datePrefix);
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
  computeScreenScore,
  generateFleetDataSnapshot,
  generateCryptoDataSnapshot,
  generateDataSnapshotTasks,
  FLEET_UNIVERSE_PATH,
  SHORTLIST_SIZE,
};
