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

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const runTask = require('../platform/run-task.js');
const fleetStatus = require('./fleet-status.js');
const cryptoStatus = require('./crypto-status.js');
const cryptoSymbols = require('./crypto-symbols.js');
const alpaca = require('./alpaca-client.js');
const finnhub = require('./finnhub-client.js');
const ntfy = require('../platform/ntfy.js');
const journal = require('./trading-journal.js');
const edgeStatus = require('./edge-status.js');
// Layered research pipeline (macro/sector/technical/company), added
// 2026-09-13 -- direct user request to give round-1/round-2 richer real
// context while the live pipeline keeps trading/journaling real outcomes.
// Static category maps loaded once at module load, same pattern as
// FLEET_UNIVERSE_PATH/crypto-universe.json below.
const SECTOR_MAP = require(avPaths.fleetData('sector-map.json')).sectors;
const CRYPTO_CATEGORY_MAP = require(avPaths.fleetData('crypto-category-map.json')).categories;

const TASKS_DIR = runTask.TASKS_DIR;
const FLEET_UNIVERSE_PATH = avPaths.fleetData('fleet-universe.json');
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
// Delegates to cycle-date-utils.js, which now holds this exact fix once
// instead of once per dashboard/generator (see its header -- the same bug
// was independently written and independently fixed four separate times).
// require()'d locally rather than hoisted to this file's top-level
// imports: this edit is scoped strictly to this function (another agent
// owns the rest of this file in parallel, in a different worktree);
// require() is cached, so this has no real per-call cost.
function findPriorDate(pilot, beforeDatePrefix, filenames) {
  const cycleDateUtils = require('../platform/cycle-date-utils.js');
  const files = filenames || listTaskFilenames();
  return cycleDateUtils.latestCycleDateBefore(files, pilotPrefix(pilot), beforeDatePrefix);
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

// Closes a real gap found 2026-09-14: the recurring backtest layer
// (sections 12-14) was writing real findings to vault notes and the fact
// store, but nothing fed them back into a live thesis -- expensive,
// honest backtest evidence was accumulating with no effect on the
// decisions it was meant to inform. Same injection pattern as
// formatSymbolHistorySection() above: informational context, never a
// hard gate -- a thesis can disagree with this evidence, but it should
// have to reckon with it, not ignore it by omission.
function formatEdgeStatusSection(pilot, symbol) {
  const status = edgeStatus.getCurrentEdgeStatus(pilot, symbol);
  if (!status.dailyVerdict && !status.weightFact && !status.symbolFact) return '';
  const lines = ['## Systematic backtest evidence (read before setting conviction)', ''];
  if (status.dailyVerdict) {
    lines.push(`- Live screen-score ranking formula, most recent systematic backtest (${status.dailyVerdict.ts.slice(0, 10)}): ${status.dailyVerdict.value}`);
  }
  if (status.weightFact) {
    lines.push(`- Weekly parameter search for ${pilot} weights (${status.weightFact.ts.slice(0, 10)}): ${status.weightFact.value}`);
  }
  if (status.symbolFact) {
    lines.push(`- Entry/exit rule backtest specifically for ${symbol} (${status.symbolFact.ts.slice(0, 10)}): ${edgeStatus.extractVerdictSnippet(status.symbolFact.value)}`);
  }
  lines.push('', 'This is real, independently-computed evidence, not this thesis\'s own reasoning -- it does not dictate your conclusion, but strong conviction should be able to explain why it disagrees with this evidence, not ignore it.');
  return lines.join('\n');
}

// ---------- Earnings-calendar awareness (roadmap item 7) ----------
//
// A mechanical rule, not a statistical-edge claim: don't open a fresh
// position right before a scheduled binary catalyst. Fetched once per
// equity cycle inside generateFleetDataSnapshot() (the same place market
// cap already gets fetched from Finnhub, same Promise.all/best-effort-
// per-symbol posture) for the SHORTLIST only -- the only symbols that
// actually get a round-1 thesis -- and cached here in module state so
// the later, synchronous generateThesisTask() call can read it without
// itself becoming async. That constraint is real, not cosmetic:
// pilot-supervisor.js's maybeGenerateCycle() (out of this change's scope
// -- a different file this task doesn't own) fully awaits
// generateDataSnapshotTasks() first, THEN calls generateThesisTask() in
// a plain, non-awaited .map() to build r1Ids -- if generateThesisTask()
// itself returned a Promise instead of a taskId string, that .map()
// would silently collect an array of Promises instead of task IDs and
// break every downstream dependsOnTaskId wire-up. Sequencing through
// this cache (populated-then-read, same process, already-awaited by the
// time generateThesisTask() runs) avoids that entirely. Crypto has no
// earnings/fundamentals concept for this asset class (see the standing
// crypto constraints already in generateThesisTask() below) -- this
// cache is never populated for the crypto pilot, and
// formatEarningsWarningSection() returns '' immediately for it.
const EARNINGS_WINDOW_TRADING_DAYS = 7;
let earningsBySymbol = new Map();

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

// Weekday count strictly between `from` and `to` (no market-holiday
// calendar -- same order-of-magnitude approximation alpaca-client.js's
// getDailyBars() already uses for its own calendar-day/trading-day
// conversion). Good enough for a "roughly how many sessions away" flag
// in a thesis prompt, not a precise trading-calendar computation.
function tradingDaysBetween(from, to) {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// Best-effort per symbol -- one symbol's fetch failure never blocks the
// rest or the cycle, same posture as generateFleetDataSnapshot()'s
// existing profile2 Promise.all() loop. Populates earningsBySymbol with
// one of: {status:'checked_found', date, daysAway}, {status:
// 'checked_none'} (fetched OK, nothing in the window), or
// {status:'error', message} (fetch itself failed -- honestly distinct
// from "checked, nothing found").
async function refreshEarningsCache(symbols) {
  earningsBySymbol = new Map();
  if (!finnhub.hasCredentials() || !symbols.length) return;
  const today = new Date();
  const from = isoDate(today);
  // Padded a few extra calendar days beyond the trading-day window to
  // comfortably cover weekends inside it (server-side `to` filter, not
  // load-bearing for the daysAway math below).
  const to = isoDate(new Date(today.getTime() + (EARNINGS_WINDOW_TRADING_DAYS + 4) * 24 * 60 * 60 * 1000));
  await Promise.all(symbols.map(async (symbol) => {
    try {
      const resp = await finnhub.getEarningsCalendar(symbol, from, to);
      const entries = (resp && Array.isArray(resp.earningsCalendar)) ? resp.earningsCalendar : [];
      const upcoming = entries.filter((e) => e && e.date && e.date >= from).sort((a, b) => (a.date < b.date ? -1 : 1));
      if (!upcoming.length) {
        earningsBySymbol.set(symbol, { status: 'checked_none' });
        return;
      }
      const next = upcoming[0];
      earningsBySymbol.set(symbol, { status: 'checked_found', date: next.date, daysAway: tradingDaysBetween(today, new Date(next.date)) });
    } catch (err) {
      console.log(`[generate-pilot-tasks] finnhub earnings-calendar failed for ${symbol}: ${err.message}`);
      earningsBySymbol.set(symbol, { status: 'error', message: err.message });
    }
  }));
}

// Additive section for generateThesisTask()'s payload -- honest about
// all three states (real near-term catalyst found / checked and clear /
// not fetched at all), never fabricated. Matches the SOURCE-tagging
// convention used elsewhere in this file (landAsDone()'s sourceLine,
// formatSymbolHistorySection()'s framing) and the "mark unavailable
// data as unavailable, don't silently omit it" posture finnhub-client.js
// already documents for market cap.
function formatEarningsWarningSection(pilot, symbol) {
  if (pilot === 'crypto') return ''; // no earnings/fundamentals concept for this asset class
  if (!finnhub.hasCredentials()) {
    return [
      '## Earnings calendar',
      `EARNINGS CALENDAR: FINNHUB_API_KEY not configured -- NOT FETCHED this cycle. Whether ${symbol} has a near-term earnings date is UNKNOWN, not confirmed absent -- do not assume it is clear of this catalyst.`,
    ].join('\n');
  }
  const entry = earningsBySymbol.get(symbol);
  if (!entry || entry.status === 'error') {
    return [
      '## Earnings calendar',
      `EARNINGS CALENDAR: live check failed for ${symbol}${entry && entry.message ? ` (${entry.message})` : ''} -- NOT FETCHED this cycle. Whether it has a near-term earnings date is UNKNOWN, not confirmed absent.`,
    ].join('\n');
  }
  if (entry.status !== 'checked_found') return '';
  return [
    '## Earnings calendar',
    'SOURCE: verified live (Finnhub free-tier /calendar/earnings, fetched by generate-pilot-tasks.js).',
    `NOTE: ${symbol} has a scheduled earnings report on ${entry.date}, ~${entry.daysAway} trading day(s) from now -- treat any position as exposed to this binary catalyst; factor this into your bull/bear case and time horizon.`,
  ].join('\n');
}

// ---------- Layered research: macro / sector / technical (2026-09-13) ----------
//
// All three are pure computation on data already fetched by the data-
// snapshot functions -- no new API calls beyond one extra SPY bars fetch
// for equity macro (crypto macro reuses BTC's bars from the universe
// fetch, zero extra calls). Same cache-then-synchronous-read split as
// the earnings cache above: populated inside the already-async snapshot
// generators, read back synchronously inside generateThesisTask()/
// generateChallengeTask() (which must themselves stay synchronous --
// see refreshEarningsCache()'s comment for why).

// One shared snapshot per cycle (not per-symbol) -- macro regime is the
// same context for every thesis that cycle.
let macroSnapshot = null;
// Per-shortlist-symbol sector + technical fields, combined in one cache
// (mirrors earningsBySymbol's shape/lifetime -- shortlist-only, reset
// each cycle).
let researchContextBySymbol = new Map();

// close vs both moving averages -- three-state regime label. avg50/avg200
// come from the existing priceAverages() helper (defined below), reused
// verbatim rather than recomputed.
function computeMacroRegime(bars, isCrypto) {
  if (!bars || !bars.length) return null;
  const { priceAvg50, priceAvg200 } = priceAverages(bars);
  const lastClose = bars[bars.length - 1].c;
  let regime = 'mixed';
  if (priceAvg50 !== null && priceAvg200 !== null) {
    if (lastClose > priceAvg50 && priceAvg50 > priceAvg200) regime = 'uptrend';
    else if (lastClose < priceAvg50 && priceAvg50 < priceAvg200) regime = 'downtrend';
  }
  // Annualized realized volatility from the trailing 20 daily returns --
  // a rough risk-on/risk-off proxy, not a VIX-equivalent. Separate
  // thresholds for equity vs crypto: crypto's baseline realized vol is
  // structurally higher, the same "low" label would never fire for it
  // under equity-calibrated thresholds.
  const recent = bars.slice(-21);
  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1].c) returns.push((recent[i].c - recent[i - 1].c) / recent[i - 1].c);
  }
  let volRegime = null, annualizedVol = null;
  if (returns.length >= 2) {
    const meanR = returns.reduce((s, v) => s + v, 0) / returns.length;
    const variance = returns.reduce((s, v) => s + (v - meanR) ** 2, 0) / (returns.length - 1);
    annualizedVol = Math.sqrt(variance) * Math.sqrt(252) * 100; // percent
    const thresholds = isCrypto ? { low: 40, elevated: 80 } : { low: 15, elevated: 30 };
    volRegime = annualizedVol < thresholds.low ? 'low' : annualizedVol > thresholds.elevated ? 'elevated' : 'normal';
  }
  return { regime, volRegime, annualizedVol, priceAvg50, priceAvg200, lastClose, asOf: bars[bars.length - 1].t || null };
}

function formatMacroSection(pilot) {
  const isCrypto = pilot === 'crypto';
  const sourceSymbol = isCrypto ? 'BTC' : 'SPY';
  if (!macroSnapshot) {
    return [
      '## Macro regime',
      `MACRO REGIME: NOT FETCHED this cycle (${sourceSymbol} data unavailable) -- broad market regime is UNKNOWN, not confirmed neutral.`,
    ].join('\n');
  }
  const m = macroSnapshot;
  return [
    '## Macro regime',
    `SOURCE: verified live (Alpaca market-data API, ${sourceSymbol} daily bars, fetched by generate-pilot-tasks.js).`,
    `FACT: ${sourceSymbol} last close $${m.lastClose}, 50-day avg $${m.priceAvg50 ? m.priceAvg50.toFixed(2) : 'n/a'}, 200-day avg $${m.priceAvg200 ? m.priceAvg200.toFixed(2) : 'n/a'}. Trailing-20-day annualized realized volatility ~${m.annualizedVol !== null ? m.annualizedVol.toFixed(1) + '%' : 'n/a'}.`,
    `INTERPRETATION: broad ${isCrypto ? 'crypto' : 'equity'} regime reads as "${m.regime}" (close vs. 50-day vs. 200-day average), volatility regime "${m.volRegime || 'n/a'}". This is ${sourceSymbol}-wide context, not specific to this symbol -- weigh it as backdrop, not a directional call on this name.`,
  ].join('\n');
}

// Wilder's RSI(14) on trailing daily closes. Needs 15 closes for 14
// diffs -- returns null (not a fabricated number) if fewer bars exist.
function computeRSI14(bars) {
  if (!bars || bars.length < 15) return null;
  const closes = bars.slice(-15).map((b) => b.c);
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff; else lossSum += -diff;
  }
  const avgGain = gainSum / 14, avgLoss = lossSum / 14;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Deliberately reports POSTURE (current above/below ordering), not a
// precise "crossed N bars ago" claim -- the data doesn't cleanly support
// pinpointing an exact cross date without more careful lookback logic,
// and an invented-sounding precise date is worse than an honest posture.
function computeMAPosture(priceAvg50, priceAvg200) {
  if (priceAvg50 === null || priceAvg200 === null) return null;
  return priceAvg50 > priceAvg200 ? 'above' : priceAvg50 < priceAvg200 ? 'below' : 'equal';
}

// 20-day support/resistance from real intraday highs/lows, not just
// closes -- matches the existing 20-day avgVolume window elsewhere in
// this file for consistency.
function computeSupportResistance(bars) {
  if (!bars || !bars.length) return { support: null, resistance: null };
  const recent = bars.slice(-20);
  return {
    support: Math.min(...recent.map((b) => b.l)),
    resistance: Math.max(...recent.map((b) => b.h)),
  };
}

// Resolves a symbol's sector/category: live Finnhub finnhubIndustry
// (equity only, when configured) overrides the static map; the static
// map is the only source for crypto (Finnhub has no crypto coverage) and
// the fallback for equity when Finnhub isn't configured or a given
// symbol's profile call failed. Never returns null -- 'Unknown' if truly
// unresolvable, so the formatter always has something honest to say.
function resolveSector(pilot, symbol, liveIndustry) {
  if (liveIndustry) return { label: liveIndustry, source: 'live (Finnhub finnhubIndustry)' };
  const map = pilot === 'crypto' ? CRYPTO_CATEGORY_MAP : SECTOR_MAP;
  const staticLabel = map[symbol];
  return staticLabel ? { label: staticLabel, source: 'static classification (sector-map.json/crypto-category-map.json)' } : { label: 'Unknown', source: 'unresolved' };
}

function formatSectorSection(pilot, symbol) {
  const ctx = researchContextBySymbol.get(symbol);
  if (!ctx || !ctx.sector) {
    return [
      '## Sector context',
      `SECTOR CONTEXT: NOT AVAILABLE for ${symbol} this cycle.`,
    ].join('\n');
  }
  const { sector, sectorRelPerf } = ctx;
  return [
    '## Sector context',
    `FACT: ${symbol}'s sector/category is "${sector.label}" (source: ${sector.source}).`,
    sectorRelPerf !== null
      ? `FACT: ${symbol}'s change today (${sectorRelPerf >= 0 ? '+' : ''}${sectorRelPerf.toFixed(2)} percentage points relative to its own sector's average change this cycle, computed from this cycle's real screened universe -- not a broad index).`
      : 'INTERPRETATION: sector-relative performance not computable this cycle (insufficient peer data).',
  ].join('\n');
}

function formatTechnicalSection(pilot, symbol) {
  const ctx = researchContextBySymbol.get(symbol);
  if (!ctx || ctx.rsi14 === null || ctx.rsi14 === undefined) {
    return [
      '## Technical indicators',
      `TECHNICAL INDICATORS: NOT AVAILABLE for ${symbol} this cycle (insufficient bar history).`,
    ].join('\n');
  }
  const { rsi14, maPosture, support20d, resistance20d } = ctx;
  const rsiLabel = rsi14 > 70 ? 'overbought' : rsi14 < 30 ? 'oversold' : 'neutral';
  return [
    '## Technical indicators',
    `FACT: RSI(14) = ${rsi14.toFixed(1)}. INTERPRETATION: reads as "${rsiLabel}" (>70 overbought, <30 oversold, else neutral -- a real, checkable computation, not a forecast).`,
    maPosture ? `FACT: 50-day average is ${maPosture} the 200-day average (posture only -- not a claim about when any crossover occurred).` : '',
    (support20d !== null && resistance20d !== null) ? `FACT: 20-day support $${support20d.toFixed(2)}, resistance $${resistance20d.toFixed(2)} (real trailing high/low, not projected levels).` : '',
  ].filter(Boolean).join('\n');
}

function generateThesisTask(pilot, symbol, datePrefix, priorLearningsSection, dataSnapshotTaskId) {
  const prefix = pilotPrefix(pilot);
  const taskId = `${prefix}${datePrefix}_thesis_r1_${symbol.toLowerCase()}`;
  const isCrypto = pilot === 'crypto';
  const symbolHistorySection = formatSymbolHistorySection(symbol);
  const earningsSection = formatEarningsWarningSection(pilot, symbol);
  const macroSection = formatMacroSection(pilot);
  const sectorSection = formatSectorSection(pilot, symbol);
  const technicalSection = formatTechnicalSection(pilot, symbol);
  const edgeStatusSection = formatEdgeStatusSection(pilot, symbol);
  const payloadLines = [
    `ROUND-1 INDEPENDENT THESIS for ${symbol}, generated unattended by generate-pilot-tasks.js for the ${datePrefix} ${pilot} cycle (see ${dataSnapshotTaskId}, auto-injected below, for the full data).`,
    '',
    isCrypto
      ? 'Standing constraints for crypto theses: no fundamentals data exists for this asset class -- do not invent one. This symbol is confirmed spot/long-only on this account; a bear case means "stay out," never "short." Tag any macro/narrative claim as INTERPRETATION, never FACT.'
      : 'Build a fresh, independent thesis using the full injected dataset -- price/volume/momentum data plus fundamentals where available. Tag every claim FACT (cite the specific field) or INTERPRETATION.',
    '',
    priorLearningsSection,
    ...(symbolHistorySection ? ['', symbolHistorySection] : []),
    ...(earningsSection ? ['', earningsSection] : []),
    ...(macroSection ? ['', macroSection] : []),
    ...(sectorSection ? ['', sectorSection] : []),
    ...(technicalSection ? ['', technicalSection] : []),
    ...(edgeStatusSection ? ['', edgeStatusSection] : []),
  ];
  return writeTaskFile(taskId, {
    from: 'claude',
    to: 'codex',
    type: 'request',
    payload: payloadLines.join('\n'),
    dependsOnTaskId: dataSnapshotTaskId,
  });
}

// researchTaskId added 2026-09-13 (layered research pipeline, direct
// user request + explicit decision on WHERE it injects): a company-
// research task (generateCompanyResearchTask() below) runs in parallel
// with round-1 (both depend only on the data-snapshot task), so it never
// delays round-1's own dispatch. Round-2 depends on BOTH via
// dependsOnTaskIds -- the same multi-parent mechanism generateSynthesisTask()
// already uses for round-3 -- so round-2 sees round-1's thesis AND the
// independent research pass, neither of which round-1 itself saw.
function generateChallengeTask(pilot, symbol, datePrefix, thesisTaskId, researchTaskId) {
  const prefix = pilotPrefix(pilot);
  const taskId = `${prefix}${datePrefix}_challenge_r2_${symbol.toLowerCase()}`;
  const payload = [
    `ROUND-2 ADVERSARIAL CHALLENGE for the round-1 thesis on ${symbol} (two dependencies auto-injected below, each labeled by its own task_id: the round-1 thesis task is the thing being challenged; the "research_company" task is an independent, real web-search-based research pass that ran in PARALLEL with round-1 and was NOT shown to it -- treat it as supporting evidence, not as round-1's own reasoning). Pressure-test the thesis using the full injected dataset -- written by a different specialist, who is not told what you conclude. Do NOT just restate or endorse it; show real work trying to break it first.`,
    '',
    'Challenge every FACT-tagged claim, every INTERPRETATION-tagged claim, identify data gaps and internal inconsistencies, then build the strongest genuine counterargument using only the same injected data (the thesis dependency plus the independent research dependency). Conclude with a verdict: "thesis holds up," "thesis has material weaknesses, stance should be downgraded," or "thesis has material weaknesses, stance should be reversed."',
  ].join('\n');
  return writeTaskFile(taskId, {
    from: 'claude',
    to: 'codex',
    type: 'request',
    payload,
    dependsOnTaskIds: [thesisTaskId, researchTaskId],
  });
}

// Company/asset research (2026-09-13, layered research pipeline): a real
// Codex dispatch using its own hosted web-search tool (confirmed real,
// works under --sandbox read-only -- see ARCHITECTURE.md's 2026-09-03
// finding and generateRescanTask()'s identical framing below), filling
// the gap left by not having FMP/deep-Finnhub fundamentals. Depends ONLY
// on the data-snapshot task -- same parent as round-1's own thesis task
// -- so it starts in parallel with round-1 and never delays it. Its
// output is injected into round-2 (see generateChallengeTask() above)
// via the existing multi-parent dependsOnTaskIds mechanism -- no new
// formatter needed, that mechanism already attributes each dependency by
// its real task_id.
function generateCompanyResearchTask(pilot, symbol, datePrefix, dataSnapshotTaskId) {
  const prefix = pilotPrefix(pilot);
  const taskId = `${prefix}${datePrefix}_research_company_${symbol.toLowerCase()}`;
  const isCrypto = pilot === 'crypto';
  const payload = [
    `COMPANY/ASSET RESEARCH for ${symbol}, generated for the ${datePrefix} ${pilot} cycle (see ${dataSnapshotTaskId}, auto-injected below, for this cycle's price/volume/screen data). This runs in PARALLEL with round 1's own thesis dispatch -- you are not told what round 1 concludes, and round 1 does not see your output; both feed round 2 independently.`,
    '',
    `Use your own hosted web-search tool to find real, current, checkable information about ${symbol} ${isCrypto ? '(the coin/protocol)' : '(the company)'} that isn't already in the injected price/volume data: recent news, ${isCrypto ? 'protocol developments, major partnerships/listings, on-chain narrative shifts' : 'analyst sentiment, recent earnings commentary or guidance changes, major corporate actions, competitive/sector developments'}. Be honest that AI-summarized search results can contain wrong or unconfirmed claims stated as fact -- flag anything you can't corroborate as unconfirmed rather than presenting it as settled fact, and say plainly if your search tool returns nothing useful rather than inventing a finding to fill space.`,
    '',
    'Output a few real, sourced-in-your-own-words findings (2-5 bullet points). For EACH bullet, end it with the specific publisher/site and a direct URL and date in parentheses, e.g. "(Source: Reuters, https://..., published 2026-09-10)" -- these findings are persisted into a permanent, observation-only vault note afterward, so a real per-claim citation matters; if you truly cannot find a citable source for a point, say so in the bullet itself rather than omitting the parenthetical. Then add a separate final line, "Lean: bullish/bearish/neutral/mixed", summarizing whether this research leans bullish, bearish, or neutral/mixed right now -- this line is for round-2\'s internal use only and will NOT be published to the vault (this category is observation-only, no directional opinions).',
  ].join('\n');
  return writeTaskFile(taskId, {
    from: 'claude',
    to: 'codex',
    type: 'request',
    payload,
    dependsOnTaskId: dataSnapshotTaskId,
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
//
// `weights` is optional and defaults to that exact original split -- added
// 2026-09-13 for the parameter-search "learning" layer
// (bus/fleet/backtest-parameter-search.js / ARCHITECTURE.md section 13),
// so every existing caller that doesn't pass weights is byte-for-byte
// unaffected. Live callers below pass loadScreenScoreWeights(pilot)
// instead of relying on this default once a real search result exists.
const DEFAULT_SCREEN_SCORE_WEIGHTS = { chgPct: 50, avgVolume: 30, marketCap: 20 };
const SCREEN_SCORE_WEIGHTS_PATH = avPaths.fleetData('screen-score-weights.json');

// Reads this pilot's current weights from the git-committed
// screen-score-weights.json (durable, meaningful state -- same category
// as bus/memory.jsonl/bus/paper-trades.jsonl, not a disposable cursor).
// Falls back to the original hardcoded default if the file or that
// pilot's entry doesn't exist yet -- "refuse to guess, don't crash
// either" applied to config loading, same posture as every other file
// read in this codebase.
function loadScreenScoreWeights(pilot) {
  if (!fs.existsSync(SCREEN_SCORE_WEIGHTS_PATH)) return DEFAULT_SCREEN_SCORE_WEIGHTS; // legitimately not created yet -- not an error
  try {
    const doc = JSON.parse(fs.readFileSync(SCREEN_SCORE_WEIGHTS_PATH, 'utf8'));
    const w = doc[pilot];
    if (w && Number.isFinite(w.chgPct) && Number.isFinite(w.avgVolume) && Number.isFinite(w.marketCap)) return w;
    return DEFAULT_SCREEN_SCORE_WEIGHTS;
  } catch (err) {
    // Unlike a missing file (expected before the first-ever search), a
    // parse failure here means screen-score-weights.json exists but is
    // corrupt. Falling back to the safe default is still correct for this
    // live, every-cycle call site, but it should not be silent -- every
    // sibling state loader touched in today's review logs a WARNING on
    // malformed JSON, and this is the one that feeds the LIVE paper-trading
    // screen score every cycle.
    console.error(`WARNING: ${SCREEN_SCORE_WEIGHTS_PATH} malformed (${err.message}) -- falling back to default weights ${JSON.stringify(DEFAULT_SCREEN_SCORE_WEIGHTS)}`);
    return DEFAULT_SCREEN_SCORE_WEIGHTS;
  }
}

function computeScreenScore(candidates, weights) {
  const w = weights || DEFAULT_SCREEN_SCORE_WEIGHTS;
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
      screenScore: w.chgPct * norm(c.chgPct, 'chgPct') + w.avgVolume * norm(c.avgVolume, 'avgVolume') + w.marketCap * norm(c.marketCap, 'marketCap'),
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

// Deliberately decoupled from finnhub.hasCredentials(), added 2026-09-13
// (multi-agent research-stack finding, cross-checked live): setting
// FINNHUB_API_KEY unlocks several independent Finnhub-backed features at
// once (equity market cap for THIS screen, the earnings-calendar safety
// gate, company news) -- but computeScreenScore()'s 20% market-cap term
// has been silently contributing zero (norm() returns 0 when every value
// is equal) for as long as the key has been unset, and a real, freshly
// deepened backtest (bus/fleet/backtest-screen-score-v2.js) tested
// EXACTLY that zeroed-cap formula. If the key gets set for the earnings
// gate alone, the screen formula would silently change out from under a
// backtest that just returned a "no edge" verdict, without anyone
// deciding that on purpose. This flag is that decision, made explicit:
// flip it to true (and re-run the backtest with a real cap term first)
// when actually ready to let market cap back into the live score.
const ENABLE_MARKET_CAP_IN_SCREEN = false;

async function generateFleetDataSnapshot(datePrefix) {
  const universe = JSON.parse(fs.readFileSync(FLEET_UNIVERSE_PATH, 'utf8')).symbols;
  const barsBySymbol = await alpaca.getDailyBars(universe, { limit: 210 });

  // Macro layer (2026-09-13): one extra tiny getDailyBars() call for SPY
  // (not in fleet-universe.json, but getDailyBars() accepts any valid
  // symbol -- confirmed, no change needed there). One shared snapshot for
  // the whole cycle, not per-symbol.
  try {
    const spyBars = await alpaca.getDailyBars(['SPY'], { limit: 210 });
    macroSnapshot = spyBars.SPY ? computeMacroRegime(spyBars.SPY.bars, false) : null;
  } catch (err) {
    console.log(`[generate-pilot-tasks] macro (SPY) fetch failed: ${err.message}`);
    macroSnapshot = null;
  }

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
      const marketCapForDisplay = profile && profile.marketCapitalization ? profile.marketCapitalization * 1e6 : 0;
      // What actually feeds computeScreenScore() -- locked to 0 (see
      // ENABLE_MARKET_CAP_IN_SCREEN above) even when a real value was
      // just fetched for display purposes.
      const marketCap = ENABLE_MARKET_CAP_IN_SCREEN ? marketCapForDisplay : 0;
      const { priceAvg50, priceAvg200 } = priceAverages(entry.bars);
      // Sector layer: live finnhubIndustry (already fetched, previously
      // discarded) overrides the static sector-map.json fallback.
      const sector = resolveSector('fleet', symbol, profile && profile.finnhubIndustry);
      // Technical layer: pure computation on entry.bars, already in memory.
      const rsi14 = computeRSI14(entry.bars);
      const maPosture = computeMAPosture(priceAvg50, priceAvg200);
      const { support: support20d, resistance: resistance20d } = computeSupportResistance(entry.bars);
      return { symbol, price: entry.lastClose, chgPct: entry.chgPct, avgVolume: entry.avgVolume, marketCap, marketCapForDisplay, priceAvg50, priceAvg200, sector, rsi14, maPosture, support20d, resistance20d };
    })
    .filter(Boolean);

  // Sector relative performance: group the already-built candidates by
  // resolved sector, average chgPct per group (all data already on each
  // candidate -- zero extra fetches), then each symbol's deviation from
  // its own sector's average.
  const sectorTotals = new Map(); // label -> { sum, count }
  for (const c of candidates) {
    const label = c.sector.label;
    const t = sectorTotals.get(label) || { sum: 0, count: 0 };
    t.sum += c.chgPct; t.count += 1;
    sectorTotals.set(label, t);
  }
  for (const c of candidates) {
    const t = sectorTotals.get(c.sector.label);
    c.sectorRelPerf = t && t.count ? c.chgPct - (t.sum / t.count) : null;
  }

  const ranked = computeScreenScore(candidates, loadScreenScoreWeights('fleet'));
  const shortlist = ranked.slice(0, SHORTLIST_SIZE);

  // Only the shortlist actually gets a round-1 thesis, so only the
  // shortlist needs an earnings-calendar check -- see the "Earnings-
  // calendar awareness" block above generateThesisTask() for why this
  // is fetched here (already-async, already-awaited before
  // generateThesisTask() runs) instead of inside generateThesisTask()
  // itself.
  await refreshEarningsCache(shortlist.map((c) => c.symbol));

  // Sector + technical context cache, shortlist-only, same lifetime/
  // reset posture as earningsBySymbol -- populated synchronously here
  // (no await needed, everything's already computed above).
  researchContextBySymbol = new Map();
  for (const c of shortlist) {
    researchContextBySymbol.set(c.symbol, {
      sector: c.sector, sectorRelPerf: c.sectorRelPerf,
      rsi14: c.rsi14, maPosture: c.maPosture, support20d: c.support20d, resistance20d: c.resistance20d,
    });
  }

  const taskId = `fleet_pilot_${datePrefix}_universe50_consolidation`;
  // BUG FOUND LIVE 2026-09-11: price/priceAvg50/priceAvg200 were computed
  // on every candidate above but never actually made it into the table --
  // every equity thesis this cycle was built with NO current price and NO
  // trend data at all, only Chg%/AvgVolume/MarketCap/screenScore. Round-3
  // correctly flagged this itself ("No current absolute prices for most
  // names") and had to reuse a stale, non-derived trigger price for VZ
  // instead of a real one. Crypto's table never had this gap. Added price
  // + a shortlist-detail block (50/200-day averages) for the top 15,
  // matching the pattern already used for crypto.
  const table = ranked
    .map((c, i) => `| ${i + 1} | ${c.symbol} | $${c.price.toFixed(2)} | ${c.chgPct.toFixed(2)}% | ${Math.round(c.avgVolume).toLocaleString()} | ${c.marketCapForDisplay ? '$' + (c.marketCapForDisplay / 1e9).toFixed(1) + 'B' : 'n/a'} | ${c.screenScore.toFixed(1)} |`)
    .join('\n');
  const shortlistDetail = shortlist.map((c) => [
    `### ${c.symbol}`,
    `- Live quote: $${c.price.toFixed(2)}, change ${c.chgPct.toFixed(2)}%, 50-day avg $${c.priceAvg50 ? c.priceAvg50.toFixed(2) : 'n/a'}, 200-day avg $${c.priceAvg200 ? c.priceAvg200.toFixed(2) : 'n/a'}, market cap ${c.marketCapForDisplay ? '$' + (c.marketCapForDisplay / 1e9).toFixed(1) + 'B' : 'n/a'} (reference only, not scored -- see below).`,
  ].join('\n')).join('\n\n');
  const capNote = ENABLE_MARKET_CAP_IN_SCREEN
    ? ''
    : finnhubAvailable
      ? '\n\nMarket cap IS available (FINNHUB_API_KEY configured, shown above for reference) but is deliberately NOT included in screenScore -- ENABLE_MARKET_CAP_IN_SCREEN in generate-pilot-tasks.js is off until the screen is re-backtested with a real cap term (see ARCHITECTURE.md\'s 2026-09-13 note); screenScore is effectively 50 x norm(Chg%) + 30 x norm(AvgVolume) only.'
      : '\n\nFINNHUB_API_KEY not configured -- market cap is n/a for every symbol this cycle, and screenScore is effectively 50 x norm(Chg%) + 30 x norm(AvgVolume) only (the 20% cap weight contributes nothing when every value is equal). Add FINNHUB_API_KEY to bus/secrets.local.json (free tier, finnhub.io) to restore the market-cap DISPLAY -- restoring it in the actual score additionally requires flipping ENABLE_MARKET_CAP_IN_SCREEN on, deliberately, after a fresh backtest.';
  const payload = [
    `Unattended screen, ${universe.length}-symbol fixed universe (bus/fleet/data/fleet-universe.json), price/volume from Alpaca's free market-data API (batched daily bars, same paper-account key already configured -- no new credential), market cap from Finnhub's free tier (reference only -- see note). Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) + 20 x norm(MarketCap), min-max normalized -- MarketCap term currently disabled, see note. Top ${SHORTLIST_SIZE} become this cycle's shortlist.${capNote}`,
    '',
    '| Rank | Symbol | Price | Chg% | Avg Volume (20d) | Market Cap | screenScore |',
    '|---|---|---|---|---|---|---|',
    table,
    '',
    '## Shortlist detail',
    shortlistDetail,
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

  // Macro layer (2026-09-13): zero extra network calls -- BTC is already
  // one of the 32 coins fetched above, reuse its bars directly.
  macroSnapshot = barsByCoin.BTC ? computeMacroRegime(barsByCoin.BTC.bars, true) : null;

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
      // Sector/category layer: crypto has no live source (Finnhub is
      // equity-only) -- the static crypto-category-map.json is the ONLY
      // source, not a fallback.
      const sector = resolveSector('crypto', a.coin, null);
      const rsi14 = computeRSI14(entry.bars);
      const maPosture = computeMAPosture(priceAvg50, priceAvg200);
      const { support: support20d, resistance: resistance20d } = computeSupportResistance(entry.bars);
      return { symbol: a.coin, alpacaSymbol: a.alpacaSymbol, price: entry.lastClose, chgPct: entry.chgPct, avgVolume: entry.avgVolume, marketCap: 0, priceAvg50, priceAvg200, sector, rsi14, maPosture, support20d, resistance20d };
    })
    .filter(Boolean);

  const sectorTotals = new Map();
  for (const c of candidates) {
    const label = c.sector.label;
    const t = sectorTotals.get(label) || { sum: 0, count: 0 };
    t.sum += c.chgPct; t.count += 1;
    sectorTotals.set(label, t);
  }
  for (const c of candidates) {
    const t = sectorTotals.get(c.sector.label);
    c.sectorRelPerf = t && t.count ? c.chgPct - (t.sum / t.count) : null;
  }

  const ranked = computeScreenScore(candidates, loadScreenScoreWeights('crypto'));
  const shortlist = ranked.slice(0, CRYPTO_SHORTLIST_SIZE);

  researchContextBySymbol = new Map();
  for (const c of shortlist) {
    researchContextBySymbol.set(c.symbol, {
      sector: c.sector, sectorRelPerf: c.sectorRelPerf,
      rsi14: c.rsi14, maPosture: c.maPosture, support20d: c.support20d, resistance20d: c.resistance20d,
    });
  }

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
    `Unattended screen, ${allAssets.length}-coin real tradable-on-Alpaca universe (bus/fleet/data/crypto-universe.json), price/volume from Alpaca's free market-data API (batched daily bars, same paper-account key already configured -- no new credential). Formula: screenScore = 50 x norm(Chg%) + 30 x norm(AvgVolume) (market-cap term omitted -- no free crypto market-cap source wired up, see generate-pilot-tasks.js). Top ${CRYPTO_SHORTLIST_SIZE} become this cycle's shortlist.`,
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
  generateCompanyResearchTask,
  computeScreenScore,
  loadScreenScoreWeights,
  DEFAULT_SCREEN_SCORE_WEIGHTS,
  computeMacroRegime,
  computeRSI14,
  computeMAPosture,
  computeSupportResistance,
  resolveSector,
  formatMacroSection,
  formatSectorSection,
  formatTechnicalSection,
  generateFleetDataSnapshot,
  generateCryptoDataSnapshot,
  generateDataSnapshotTasks,
  FLEET_UNIVERSE_PATH,
  SHORTLIST_SIZE,
};
