#!/usr/bin/env node
// fleet-status.js -- the live snapshot for bus/fleet.html, the
// trading-fleet pilot's own dashboard (added 2026-09-08). Same
// "computed fresh per request, no caching" contract as
// dashboard-status.js's buildSnapshot(), with one structural
// difference worth stating up front: buildFleetSnapshot() is ASYNC,
// because it calls alpaca-client.js (real HTTP via fetch) for live
// account/position data. dashboard-status.js is fully synchronous;
// this one is not, and serve-dashboard.js's route handles that
// difference explicitly with .then()/.catch().
//
// Everything here is READ-ONLY and observational. This file places no
// orders, cancels nothing, and does not touch execute-portfolio-setup.js
// or monitor-paper-trades.js -- it only reads what those already wrote.
//
// Nothing is hardcoded to a specific pipeline run: the date prefix, the
// shortlist membership, and the "latest round 3" version are all
// DISCOVERED from tasks/ filenames, so a future run on a different date
// with a different version suffix renders without a code change.

const fs = require('fs');
const path = require('path');
const runTask = require('./run-task.js');
const engine = require('./agent-engine.js');
const alpaca = require('./alpaca-client.js');
const cycleDateUtils = require('./cycle-date-utils.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');
const TRADES_PATH = path.join(VAULT_ROOT, 'bus', 'paper-trades.jsonl');

function listTaskFilenames() {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.md'));
}

// The largest fleet_pilot_<YYYYMMDD>_ prefix present in tasks/.
// Real bug, found and fixed 2026-09-11: conditional-triggers.js's rescan
// tasks are named `fleet_pilot_<TODAY>_rescan_<symbol>_<ts>.md` -- TODAY's
// date, not the ORIGINAL cycle's date, since a trigger can fire days after
// its cycle ran. That collided with this function's simple prefix match:
// a rescan firing on 2026-09-11 for a 2026-09-10 cycle made this return
// "20260911" (no real cycle exists there), which made discoverShortlist()
// correctly find nothing and silently emptied the ENTIRE dashboard for a
// day that actually had real, live candidates. Rescan/reflection files
// are follow-up actions on an existing cycle, not a new cycle themselves
// -- excluded here explicitly. Delegates to cycle-date-utils.js, which now
// holds this exact fix once instead of once per dashboard (see its
// header -- the same bug was independently written and independently
// fixed four separate times).
function findLatestPipelineDate(filenames) {
  const files = filenames || listTaskFilenames();
  return cycleDateUtils.latestCycleDate(files, 'fleet_pilot_');
}

// Round-1 and round-2 task files for one run date, grouped by symbol.
// Handles the versioned re-run convention seen in the 2026-09-03 run
// (thesis_r1v3_aapl, challenge_r2v4_msft) by keeping only the highest
// version per symbol per round -- an un-suffixed file is version 1.
function discoverShortlist(datePrefix, filenames) {
  const files = filenames || listTaskFilenames();
  const bySymbol = new Map();

  function collect(round, stagePattern) {
    for (const f of files) {
      const re = new RegExp(`^fleet_pilot_${datePrefix}_${stagePattern}(?:v(\\d+))?_([a-z0-9.\\-]+)\\.md$`);
      const m = re.exec(f);
      if (!m) continue;
      const version = m[1] ? Number(m[1]) : 1;
      const symbol = m[2].toUpperCase();
      if (!bySymbol.has(symbol)) bySymbol.set(symbol, { symbol, round1: null, round2: null });
      const entry = bySymbol.get(symbol);
      const current = entry[round];
      if (!current || version > current.version) {
        entry[round] = { taskId: f.replace(/\.md$/, ''), version };
      }
    }
  }

  collect('round1', 'thesis_r1');
  collect('round2', 'challenge_r2');

  // Symbols are keyed off round 1 -- a symbol with only a round-2 file
  // would be malformed, but is still surfaced rather than silently
  // dropped, so a real inconsistency stays visible.
  return Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

// Every round-3 variant for a run date, newest-design-first. When any
// _portfolio variant exists it supersedes the legacy single-winner
// design outright (both coexist for 2026-09-08: _synthesis_r3.md is the
// old single-winner run, _synthesis_r3_portfolio*.md are the real ones).
function discoverRound3Versions(datePrefix, filenames) {
  const files = filenames || listTaskFilenames();
  const found = [];
  for (const f of files) {
    const re = new RegExp(`^fleet_pilot_${datePrefix}_synthesis_r3(_portfolio)?(?:_v(\\d+))?\\.md$`);
    const m = re.exec(f);
    if (!m) continue;
    found.push({
      taskId: f.replace(/\.md$/, ''),
      isPortfolioStyle: !!m[1],
      version: m[2] ? Number(m[2]) : 1,
    });
  }
  const portfolio = found.filter((v) => v.isPortfolioStyle);
  const pool = portfolio.length > 0 ? portfolio : found;
  pool.sort((a, b) => a.version - b.version);
  return pool;
}

// ---------- Round-3 output parsing ----------
// Two real formats exist in production today and a third outcome must
// be survivable:
//   v2 -> a single ```json fence with an approvedCandidates array
//   v3 -> pure prose/Markdown, NO json fence anywhere
//   anything else -> show the human the raw text rather than a blank panel
// Each stage is independent; a failure falls through to the next rather
// than throwing. Pure function (text in, object out) so the verification
// suite can test it directly against real task output.
function parseRound3Output(outputText) {
  const text = String(outputText || '');
  const empty = {
    format: 'raw',
    approvedCandidates: [],
    conditionalCandidates: [],
    rejectedCandidates: [],
    materialDissent: null,
    riskWarnings: [],
    keyLearnings: [],
    comparisonToPriorRuns: null,
    disclaimer: null,
    rawText: text,
  };
  if (!text.trim()) return empty;

  const fromJson = tryParseJsonFormat(text);
  if (fromJson) return fromJson;

  const fromMarkdown = tryParseMarkdownFormat(text);
  if (fromMarkdown) return fromMarkdown;

  return empty;
}

// Same fence-scan approach execute-portfolio-setup.js already uses:
// take the first ```json block that parses AND carries approvedCandidates.
function tryParseJsonFormat(text) {
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch (e) {
      continue;
    }
    if (!parsed || !Array.isArray(parsed.approvedCandidates)) continue;
    return {
      format: 'json',
      approvedCandidates: parsed.approvedCandidates.map(normalizeJsonCandidate).filter(Boolean),
      // conditionalCandidates (added 2026-09-10, round-3's third outcome)
      // was missing here entirely until 2026-09-11 -- silently dropped by
      // every dashboard even though it was really in the JSON. Reuses
      // normalizeJsonCandidate() for the shared fields, adds the two
      // conditional-only ones (triggerPrice/triggerType) on top.
      conditionalCandidates: (parsed.conditionalCandidates || []).map((c) => {
        const base = normalizeJsonCandidate(c);
        return base ? { ...base, triggerPrice: c.triggerPrice != null ? Number(c.triggerPrice) : null, triggerType: c.triggerType || null } : null;
      }).filter(Boolean),
      rejectedCandidates: (parsed.rejectedCandidates || []).map((r) => ({
        symbol: r.symbol || null,
        reason: r.reason || null,
      })).filter((r) => r.symbol),
      materialDissent: parsed.materialDissent || null,
      riskWarnings: toArray(parsed.riskWarnings),
      keyLearnings: toArray(parsed.keyLearnings),
      comparisonToPriorRuns: parsed.comparisonToPriorRuns || null,
      disclaimer: parsed.disclaimer || null,
      rawText: text,
    };
  }
  return null;
}

function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
  if (typeof v === 'string') return [v];
  return [JSON.stringify(v)];
}

function normalizeJsonCandidate(c) {
  if (!c || !c.symbol) return null;
  const setup = c.conditionalSetup || {};
  return {
    symbol: String(c.symbol).toUpperCase(),
    screenScore: c.screenScore != null ? String(c.screenScore) : null,
    stance: c.stance || setup.direction || null,
    // holdType only exists from v3 onward -- absent in v2's schema, which
    // predates the same-day/multi-day constraint. null, not invented.
    holdType: c.holdType || null,
    direction: setup.direction || null,
    entryCondition: setup.entryCondition || null,
    invalidationCondition: setup.invalidationCondition || null,
    timeHorizon: setup.timeHorizon || null,
    bullCase: c.bullCase || null,
    bearCase: c.bearCase || null,
    oneLineRationale: c.oneLineRationale || null,
  };
}

// Prose/Markdown fallback -- the v3 shape. Sections are "## <name>";
// approved candidates are a numbered list whose items start with a bold
// symbol; each candidate's fields are bold-labelled sub-bullets. Every
// field is best-effort: a candidate survives as long as its symbol was
// found, so one malformed field (or one malformed candidate) never drops
// the rest.
function tryParseMarkdownFormat(text) {
  const sections = splitMarkdownSections(text);
  const approvedRaw = sections['approved candidates'];
  if (!approvedRaw) return null;

  const approvedCandidates = [];
  // Split on numbered list items that lead with a bold ticker.
  const blocks = approvedRaw.split(/\n(?=\s*\d+\.\s+\*\*[A-Z][A-Z.\-]*\*\*)/);
  for (const block of blocks) {
    try {
      const symbolMatch = /\d+\.\s+\*\*([A-Z][A-Z.\-]*)\*\*/.exec(block);
      if (!symbolMatch) continue;
      approvedCandidates.push({
        symbol: symbolMatch[1].toUpperCase(),
        screenScore: cleanValue(fieldFromBlock(block, 'screenScore')),
        stance: cleanValue(fieldFromBlock(block, 'stance')),
        holdType: cleanValue(fieldFromBlock(block, 'holdType')),
        direction: cleanValue(subFieldFromBlock(block, 'direction')),
        entryCondition: cleanValue(subFieldFromBlock(block, 'entryCondition')),
        invalidationCondition: cleanValue(subFieldFromBlock(block, 'invalidationCondition')),
        timeHorizon: cleanValue(subFieldFromBlock(block, 'timeHorizon')),
        bullCase: cleanValue(fieldFromBlock(block, 'bullCase')),
        bearCase: cleanValue(fieldFromBlock(block, 'bearCase')),
        oneLineRationale: cleanValue(fieldFromBlock(block, 'oneLineRationale')),
      });
    } catch (e) {
      // One unparseable candidate must not drop the others.
      continue;
    }
  }
  if (approvedCandidates.length === 0) return null;

  const rejectedCandidates = [];
  const rejectedRaw = sections['rejected candidates'] || '';
  for (const line of rejectedRaw.split('\n')) {
    const m = /^\s*[-*]\s+\*\*([A-Z][A-Z.\-]*)[:*]*\*\*:?\s*(.+)$/.exec(line);
    if (m) rejectedCandidates.push({ symbol: m[1].toUpperCase(), reason: m[2].trim() });
  }

  return {
    format: 'markdown',
    approvedCandidates,
    rejectedCandidates,
    materialDissent: sections['material dissent'] || null,
    riskWarnings: bulletList(sections['risk warnings']),
    keyLearnings: bulletList(sections['key learnings']),
    comparisonToPriorRuns: sections['comparison to prior runs'] || null,
    disclaimer: extractDisclaimer(text),
    rawText: text,
  };
}

function splitMarkdownSections(text) {
  const out = {};
  const parts = text.split(/\n(?=##+\s)/);
  for (const part of parts) {
    const m = /^##+\s+(.+?)\s*\n([\s\S]*)$/.exec(part);
    if (!m) continue;
    out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return out;
}

// "- **holdType:** multi-day" / "**bullCase:** ..." -- bold-labelled,
// value runs to end of line (or to the next bullet for wrapped prose).
function fieldFromBlock(block, name) {
  const re = new RegExp(`\\*\\*${name}\\*?\\*?:?\\*?\\*?[:\\s]*([^\\n]*)`, 'i');
  const m = re.exec(block);
  return m ? m[1] : null;
}

// "     - direction: short" -- plain sub-bullets nested under
// **conditionalSetup:**, no bold on the key itself.
function subFieldFromBlock(block, name) {
  const re = new RegExp(`^\\s*[-*]\\s*${name}\\s*:\\s*(.+)$`, 'im');
  const m = re.exec(block);
  return m ? m[1] : null;
}

function cleanValue(v) {
  if (v == null) return null;
  const cleaned = String(v).replace(/^\**\s*/, '').replace(/\s*\**$/, '').trim();
  return cleaned || null;
}

function bulletList(sectionText) {
  if (!sectionText) return [];
  const items = [];
  for (const line of sectionText.split('\n')) {
    const m = /^\s*[-*]\s+(.+)$/.exec(line);
    if (m) items.push(m[1].trim());
  }
  return items;
}

function extractDisclaimer(text) {
  const m = /Research decision-support only\.[^\n]*/.exec(text);
  return m ? m[0].trim() : null;
}

// ---------- Grid, stages, trades, live account ----------

function buildSymbolGrid(shortlist, round3Parsed) {
  const approved = new Map((round3Parsed ? round3Parsed.approvedCandidates : []).map((c) => [c.symbol, c]));
  const rejected = new Map((round3Parsed ? round3Parsed.rejectedCandidates : []).map((c) => [c.symbol, c]));
  // conditionalCandidates added 2026-09-10 (round-3's third outcome, see
  // ARCHITECTURE.md section 9's conditional-trigger design) -- this map
  // was missing until 2026-09-11, so every conditional candidate silently
  // showed as "pending" (implying round-3 hadn't run) instead of the real
  // "watching for a price trigger" state.
  const conditional = new Map((round3Parsed && round3Parsed.conditionalCandidates || []).map((c) => [c.symbol, c]));
  const agentCache = new Map();
  function displayNameFor(agentId) {
    if (!agentId) return null;
    if (!agentCache.has(agentId)) {
      let config = null;
      try { config = engine.loadAgentConfig(agentId); } catch (e) { config = null; }
      agentCache.set(agentId, (config && config.displayName) || agentId);
    }
    return agentCache.get(agentId);
  }
  function roundInfo(round) {
    if (!round) return null;
    const task = runTask.readTaskFile(round.taskId);
    if (!task) return { taskId: round.taskId, status: '(missing)', agentId: null, agent: null };
    return {
      taskId: round.taskId,
      status: task.status || '(unknown)',
      agentId: task.to || null,
      agent: displayNameFor(task.to),
    };
  }

  return shortlist.map((entry) => {
    const r1 = roundInfo(entry.round1);
    const r2 = roundInfo(entry.round2);
    const approvedCandidate = approved.get(entry.symbol) || null;
    const conditionalCandidate = conditional.get(entry.symbol) || null;
    let verdict = 'pending';
    if (approvedCandidate) verdict = 'approved';
    else if (conditionalCandidate) verdict = 'conditional';
    else if (rejected.has(entry.symbol)) verdict = 'rejected';
    const activeCandidate = approvedCandidate || conditionalCandidate;
    return {
      symbol: entry.symbol,
      round1: r1,
      round2: r2,
      // Round 2 is meant to go to a different specialist than round 1
      // "where practical" -- it genuinely did not always (CSCO drew
      // Codex twice on 2026-09-08). Surfaced, not smoothed over.
      sameSpecialistBothRounds: !!(r1 && r2 && r1.agentId && r1.agentId === r2.agentId),
      verdict,
      holdType: activeCandidate ? activeCandidate.holdType : null,
      direction: activeCandidate ? activeCandidate.direction : null,
      triggerPrice: conditionalCandidate ? conditionalCandidate.triggerPrice : null,
      triggerType: conditionalCandidate ? conditionalCandidate.triggerType : null,
      rejectionReason: rejected.has(entry.symbol) ? rejected.get(entry.symbol).reason : null,
    };
  });
}

function buildPipelineStages(datePrefix, filenames, shortlist, symbolGrid, activeRound3, round3Task) {
  const files = filenames || [];
  const hasUniverse = files.some((f) => new RegExp(`^fleet_pilot_${datePrefix}_universe`).test(f));
  const hasEnrichment = files.some((f) => new RegExp(`^fleet_pilot_${datePrefix}_shortlist`).test(f));
  const r1Done = symbolGrid.filter((s) => s.round1 && s.round1.status === 'done').length;
  const r2Done = symbolGrid.filter((s) => s.round2 && s.round2.status === 'done').length;
  const total = symbolGrid.length;
  const r3Status = round3Task ? round3Task.status : null;

  function stage(label, detail, done, active) {
    return { label, detail, status: done ? 'done' : (active ? 'active' : 'pending') };
  }

  return [
    stage('Universe scan', hasUniverse ? '50 symbols screened' : 'not found', hasUniverse, false),
    stage('Shortlist', hasEnrichment ? `${total} symbols enriched` : `${total} symbols`, hasEnrichment || total > 0, false),
    stage('Round 1 -- thesis', `${r1Done}/${total} complete`, total > 0 && r1Done === total, r1Done > 0 && r1Done < total),
    stage('Round 2 -- challenge', `${r2Done}/${total} complete`, total > 0 && r2Done === total, r2Done > 0 && r2Done < total),
    stage(
      'Round 3 -- portfolio approval',
      activeRound3 ? `v${activeRound3.version} -- ${r3Status || 'unknown'}` : 'not run',
      r3Status === 'done',
      !!activeRound3 && r3Status !== 'done'
    ),
  ];
}

// Live Alpaca account + positions. Never throws: a missing/misconfigured
// credential file, an unreachable API, or an HTTP error all degrade to
// { available:false, error } so one flaky network call can't take down
// the whole snapshot (same contract getBacklogRunStatus() honours).
async function getLivePositionsAndAccount() {
  try {
    const [account, positions] = await Promise.all([alpaca.getAccount(), alpaca.getPositions()]);
    return {
      available: true,
      account: {
        equity: account.equity,
        cash: account.cash,
        buyingPower: account.buying_power,
        status: account.status,
      },
      positions: (positions || []).map((p) => ({
        symbol: p.symbol,
        qty: Number(p.qty),
        side: p.side,
        avgEntryPrice: Number(p.avg_entry_price),
        currentPrice: Number(p.current_price),
        unrealizedPl: Number(p.unrealized_pl),
        marketValue: Number(p.market_value),
      })),
    };
  } catch (err) {
    return { available: false, error: String((err && err.message) || err), positions: [] };
  }
}

// Equity market open/closed, for the fleet dashboard's KPI strip. Same
// never-throw contract as getLivePositionsAndAccount() -- a clock-fetch
// failure degrades to `available:false`, never crashes the snapshot.
async function getMarketClock() {
  try {
    const clock = await alpaca.apiRequest('GET', '/clock');
    return { available: true, isOpen: !!clock.is_open, nextOpen: clock.next_open, nextClose: clock.next_close };
  } catch (err) {
    return { available: false, error: String((err && err.message) || err) };
  }
}

// bus/paper-trades.jsonl, newest last. Each line is parsed in isolation:
// the file is append-only and could be read mid-write, so a single bad
// line is skipped rather than failing the whole read.
function getTradeLog(activeRound3) {
  const records = [];
  if (fs.existsSync(TRADES_PATH)) {
    for (const line of fs.readFileSync(TRADES_PATH, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { records.push(JSON.parse(line)); } catch (e) { /* skip malformed line */ }
    }
  }
  // Which of the ACTIVE round-3's approved symbols have actually been
  // entered. "The current recommendation" and "what is live in the
  // account" are genuinely different things -- on 2026-09-08 v3 was the
  // active recommendation while the only executed trades came from v2.
  const activeTaskId = activeRound3 ? activeRound3.taskId : null;
  const executedApprovedSymbols = activeTaskId
    ? Array.from(new Set(records
        .filter((r) => r.type === 'research-driven-entry' && r.sourceTask === activeTaskId)
        .map((r) => r.symbol)))
    : [];
  return { records, executedApprovedSymbols };
}

// A standalone fleet_pilot_<date>_learnings.md wins if present; else the
// active round 3's own keyLearnings; else null (the panel hides itself).
function getLearnings(datePrefix, round3Parsed) {
  const p = path.join(VAULT_ROOT, `fleet_pilot_${datePrefix}_learnings.md`);
  if (fs.existsSync(p)) {
    return { source: `fleet_pilot_${datePrefix}_learnings.md`, text: fs.readFileSync(p, 'utf8') };
  }
  if (round3Parsed && round3Parsed.keyLearnings && round3Parsed.keyLearnings.length) {
    return { source: 'round-3 keyLearnings', items: round3Parsed.keyLearnings };
  }
  return null;
}

async function buildFleetSnapshot() {
  const filenames = listTaskFilenames();
  const pipelineDate = findLatestPipelineDate(filenames);
  if (!pipelineDate) {
    return {
      generatedAt: new Date().toISOString(),
      pipelineDate: null,
      empty: true,
      message: 'No fleet_pilot_* pipeline run found in tasks/.',
      stages: [],
      symbolGrid: [],
      round3: null,
      priorRound3Versions: [],
      positions: await getLivePositionsAndAccount(),
      marketClock: await getMarketClock(),
      tradeLog: getTradeLog(null),
      learnings: null,
    };
  }

  const shortlist = discoverShortlist(pipelineDate, filenames);
  const round3Versions = discoverRound3Versions(pipelineDate, filenames);
  const activeRound3 = round3Versions.length ? round3Versions[round3Versions.length - 1] : null;
  const round3Task = activeRound3 ? runTask.readTaskFile(activeRound3.taskId) : null;
  const round3Parsed = round3Task && round3Task.output ? parseRound3Output(round3Task.output) : null;
  const symbolGrid = buildSymbolGrid(shortlist, round3Parsed);

  return {
    generatedAt: new Date().toISOString(),
    pipelineDate,
    empty: false,
    stages: buildPipelineStages(pipelineDate, filenames, shortlist, symbolGrid, activeRound3, round3Task),
    symbolGrid,
    round3: activeRound3 ? {
      taskId: activeRound3.taskId,
      version: activeRound3.version,
      status: round3Task ? round3Task.status : null,
      ...(round3Parsed || { format: 'raw', approvedCandidates: [], conditionalCandidates: [], rejectedCandidates: [], riskWarnings: [], keyLearnings: [] }),
    } : null,
    priorRound3Versions: round3Versions.map((v) => ({ taskId: v.taskId, version: v.version })),
    positions: await getLivePositionsAndAccount(),
    marketClock: await getMarketClock(),
    tradeLog: getTradeLog(activeRound3),
    learnings: getLearnings(pipelineDate, round3Parsed),
  };
}

module.exports = {
  buildFleetSnapshot,
  findLatestPipelineDate,
  discoverShortlist,
  discoverRound3Versions,
  parseRound3Output,
  buildSymbolGrid,
  getTradeLog,
  getLearnings,
};

if (require.main === module) {
  buildFleetSnapshot()
    .then((s) => console.log(JSON.stringify(s, null, 2)))
    .catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}
