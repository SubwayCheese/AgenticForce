#!/usr/bin/env node
// crypto-status.js -- the live snapshot for bus/crypto.html, the crypto pilot's own dashboard
// (added 2026-09-09, the deferred follow-up noted in ARCHITECTURE.md 3r). Mirrors
// fleet-status.js's shape, reuses fleet-status.js's parseRound3Output() directly rather than
// duplicating the dual-format (JSON/prose) parser.
//
// UPDATED 2026-09-11: the crypto universe expanded from a fixed 3-coin
// table to 32 real tradable coins with a genuine screen -> shortlist
// funnel (see generate-pilot-tasks.js/crypto-universe.json) -- the
// symbol grid below used to hardcode ['btc','eth','xrp'] and would have
// silently shown the wrong (or empty) grid the first day the shortlist
// picked different coins. Now discovers the real shortlist dynamically
// from tasks/ filenames, same pattern as fleet-status.js's
// discoverShortlist().

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const runTask = require('../platform/run-task.js');
const engine = require('../platform/agent-engine.js');
const alpaca = require('./alpaca-client.js');
const cryptoSymbols = require('./crypto-symbols.js');
const cycleDateUtils = require('../platform/cycle-date-utils.js');
const { parseRound3Output, getTradeLog } = require('./fleet-status.js');

const VAULT_ROOT = avPaths.ROOT;
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');

function listTaskFilenames() {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.md'));
}

// Same real bug/fix as fleet-status.js's findLatestPipelineDate() -- a
// crypto rescan firing on a later date than its cycle would otherwise
// masquerade as a newer (empty) cycle. Not yet triggered for crypto (only
// fleet's KO/VZ fired overnight), but the same collision is latent here
// the first time a crypto trigger fires on a different day than its
// cycle. Delegates to cycle-date-utils.js -- see its header for the fix,
// now defined once instead of once per dashboard.
function findLatestCryptoPipelineDate(filenames) {
  const files = filenames || listTaskFilenames();
  return cycleDateUtils.latestCycleDate(files, 'crypto_pilot_');
}

function discoverRound3Versions(datePrefix, filenames) {
  const files = filenames || listTaskFilenames();
  const found = [];
  for (const f of files) {
    const re = new RegExp(`^crypto_pilot_${datePrefix}_synthesis_r3_portfolio(?:_v(\\d+))?\\.md$`);
    const m = re.exec(f);
    if (!m) continue;
    found.push({ taskId: f.replace(/\.md$/, ''), version: m[1] ? Number(m[1]) : 1 });
  }
  found.sort((a, b) => a.version - b.version);
  return found;
}

// Real coins for this date's cycle, discovered from actual task filenames
// -- NOT the old hardcoded ['btc','eth','xrp']. Matches fleet-status.js's
// discoverShortlist() pattern: an unsuffixed file is version 1, keep only
// the highest version per coin. Falls back to the legacy fixed 3-coin
// list if no thesis files are found at all for this date (e.g. an old,
// pre-expansion run), so historical dates still render correctly.
function discoverCryptoShortlist(datePrefix, filenames) {
  const files = filenames || listTaskFilenames();
  const bySymbol = new Map();
  const re = new RegExp(`^crypto_pilot_${datePrefix}_thesis_r1(?:v(\\d+))?_([a-z0-9]+)\\.md$`);
  for (const f of files) {
    const m = re.exec(f);
    if (!m) continue;
    const version = m[1] ? Number(m[1]) : 1;
    const symbol = m[2].toUpperCase();
    const current = bySymbol.get(symbol);
    if (!current || version > current) bySymbol.set(symbol, version);
  }
  if (bySymbol.size === 0) return ['BTC', 'ETH', 'XRP']; // legacy fallback for pre-expansion dates
  return Array.from(bySymbol.keys()).sort();
}

// Pre-existing bug, found and fixed 2026-09-11 while verifying the
// universe expansion (unrelated to it, same mismatch existed with the
// old hardcoded 3-coin list too): round-3 candidates key by the Alpaca
// order symbol ("ETH/USD"), but the grid keys by the bare coin ticker
// ("ETH") -- they never matched, so verdict silently showed "pending"
// for every crypto candidate regardless of the real outcome. Normalize
// both to the bare coin ticker before building the lookup maps.
function bareCoin(symbol) {
  return String(symbol || '').split('/')[0].toUpperCase();
}

function buildSymbolGrid(datePrefix, round3Parsed, filenames) {
  const approved = new Map((round3Parsed ? round3Parsed.approvedCandidates : []).map((c) => [bareCoin(c.symbol), c]));
  const rejected = new Map((round3Parsed ? round3Parsed.rejectedCandidates : []).map((c) => [bareCoin(c.symbol), c]));
  // conditionalCandidates, same fix as fleet-status.js -- see its own comment.
  const conditional = new Map((round3Parsed && round3Parsed.conditionalCandidates || []).map((c) => [bareCoin(c.symbol), c]));
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
  function roundInfo(taskId) {
    const task = runTask.readTaskFile(taskId);
    if (!task) return null;
    return { taskId, status: task.status || '(unknown)', agentId: task.to || null, agent: displayNameFor(task.to) };
  }

  const coins = discoverCryptoShortlist(datePrefix, filenames);
  return coins.map((symbol) => {
    const coin = symbol.toLowerCase();
    const r1 = roundInfo(`crypto_pilot_${datePrefix}_thesis_r1_${coin}`);
    const r2 = roundInfo(`crypto_pilot_${datePrefix}_challenge_r2_${coin}`);
    const approvedCandidate = approved.get(symbol) || null;
    const conditionalCandidate = conditional.get(symbol) || null;
    let verdict = 'pending';
    if (approvedCandidate) verdict = 'approved';
    else if (conditionalCandidate) verdict = 'conditional';
    else if (rejected.has(symbol)) verdict = 'rejected';
    return {
      symbol,
      round1: r1,
      round2: r2,
      sameSpecialistBothRounds: !!(r1 && r2 && r1.agentId && r1.agentId === r2.agentId),
      verdict,
      triggerPrice: conditionalCandidate ? conditionalCandidate.triggerPrice : null,
      triggerType: conditionalCandidate ? conditionalCandidate.triggerType : null,
      rejectionReason: rejected.has(symbol) ? rejected.get(symbol).reason : null,
    };
  });
}

async function getLiveCryptoPositionsAndAccount() {
  try {
    const [account, positions] = await Promise.all([alpaca.getAccount(), alpaca.getPositions()]);
    const cryptoPositions = (positions || [])
      .filter((p) => cryptoSymbols.isCryptoSymbol(p.symbol))
      .map((p) => ({
        symbol: cryptoSymbols.toAlpacaSymbol(p.symbol),
        qty: Number(p.qty),
        side: p.side,
        avgEntryPrice: Number(p.avg_entry_price),
        currentPrice: Number(p.current_price),
        unrealizedPl: Number(p.unrealized_pl),
        marketValue: Number(p.market_value),
      }));
    return {
      available: true,
      account: { equity: account.equity, cash: account.cash, buyingPower: account.buying_power, status: account.status },
      positions: cryptoPositions,
    };
  } catch (err) {
    return { available: false, error: String((err && err.message) || err), positions: [] };
  }
}

async function buildCryptoSnapshot() {
  const filenames = listTaskFilenames();
  const pipelineDate = findLatestCryptoPipelineDate(filenames);
  const positions = await getLiveCryptoPositionsAndAccount();

  if (!pipelineDate) {
    return {
      generatedAt: new Date().toISOString(), pipelineDate: null, empty: true,
      message: 'No crypto_pilot_* pipeline run found in tasks/.',
      symbolGrid: [], round3: null, priorRound3Versions: [], positions,
      tradeLog: { records: [], executedApprovedSymbols: [] },
    };
  }

  const round3Versions = discoverRound3Versions(pipelineDate, filenames);
  const activeRound3 = round3Versions.length ? round3Versions[round3Versions.length - 1] : null;
  const round3Task = activeRound3 ? runTask.readTaskFile(activeRound3.taskId) : null;
  const round3Parsed = round3Task && round3Task.output ? parseRound3Output(round3Task.output) : null;

  const fullTradeLog = getTradeLog(activeRound3);
  const cryptoRecords = fullTradeLog.records.filter((r) => r.assetClass === 'crypto');
  const cryptoExecuted = activeRound3
    ? Array.from(new Set(cryptoRecords.filter((r) => r.type === 'research-driven-entry' && r.sourceTask === activeRound3.taskId).map((r) => r.symbol)))
    : [];

  return {
    generatedAt: new Date().toISOString(),
    pipelineDate,
    empty: false,
    symbolGrid: buildSymbolGrid(pipelineDate, round3Parsed, filenames),
    round3: activeRound3 ? {
      taskId: activeRound3.taskId,
      version: activeRound3.version,
      status: round3Task ? round3Task.status : null,
      ...(round3Parsed || { format: 'raw', approvedCandidates: [], conditionalCandidates: [], rejectedCandidates: [], riskWarnings: [], keyLearnings: [] }),
    } : null,
    priorRound3Versions: round3Versions.map((v) => ({ taskId: v.taskId, version: v.version })),
    positions,
    tradeLog: { records: cryptoRecords, executedApprovedSymbols: cryptoExecuted },
  };
}

module.exports = { buildCryptoSnapshot, findLatestCryptoPipelineDate, discoverRound3Versions, buildSymbolGrid, discoverCryptoShortlist };

if (require.main === module) {
  buildCryptoSnapshot().then((s) => console.log(JSON.stringify(s, null, 2))).catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}
