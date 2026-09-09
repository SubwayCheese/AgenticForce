#!/usr/bin/env node
// crypto-status.js -- the live snapshot for bus/crypto.html, the crypto pilot's own dashboard
// (added 2026-09-09, the deferred follow-up noted in ARCHITECTURE.md 3r). Mirrors
// fleet-status.js's shape but simpler: no universe-scan/shortlist funnel (only 3 fixed
// symbols -- BTC/ETH/XRP), reuses fleet-status.js's parseRound3Output() directly rather than
// duplicating the dual-format (JSON/prose) parser.

const fs = require('fs');
const path = require('path');
const runTask = require('./run-task.js');
const engine = require('./agent-engine.js');
const alpaca = require('./alpaca-client.js');
const cryptoSymbols = require('./crypto-symbols.js');
const { parseRound3Output, getTradeLog } = require('./fleet-status.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');
const COINS = ['btc', 'eth', 'xrp'];

function listTaskFilenames() {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.md'));
}

function findLatestCryptoPipelineDate(filenames) {
  const files = filenames || listTaskFilenames();
  const dates = new Set();
  for (const f of files) {
    const m = /^crypto_pilot_(\d{8})_/.exec(f);
    if (m) dates.add(m[1]);
  }
  if (dates.size === 0) return null;
  return Array.from(dates).sort().pop();
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

function buildSymbolGrid(datePrefix, round3Parsed) {
  const approved = new Map((round3Parsed ? round3Parsed.approvedCandidates : []).map((c) => [c.symbol, c]));
  const rejected = new Map((round3Parsed ? round3Parsed.rejectedCandidates : []).map((c) => [c.symbol, c]));
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

  return COINS.map((coin) => {
    const symbol = coin.toUpperCase();
    const r1 = roundInfo(`crypto_pilot_${datePrefix}_thesis_r1_${coin}`);
    const r2 = roundInfo(`crypto_pilot_${datePrefix}_challenge_r2_${coin}`);
    const approvedCandidate = approved.get(symbol) || null;
    let verdict = 'pending';
    if (approvedCandidate) verdict = 'approved';
    else if (rejected.has(symbol)) verdict = 'rejected';
    return {
      symbol,
      round1: r1,
      round2: r2,
      sameSpecialistBothRounds: !!(r1 && r2 && r1.agentId && r1.agentId === r2.agentId),
      verdict,
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
    symbolGrid: buildSymbolGrid(pipelineDate, round3Parsed),
    round3: activeRound3 ? {
      taskId: activeRound3.taskId,
      version: activeRound3.version,
      status: round3Task ? round3Task.status : null,
      ...(round3Parsed || { format: 'raw', approvedCandidates: [], rejectedCandidates: [], riskWarnings: [], keyLearnings: [] }),
    } : null,
    priorRound3Versions: round3Versions.map((v) => ({ taskId: v.taskId, version: v.version })),
    positions,
    tradeLog: { records: cryptoRecords, executedApprovedSymbols: cryptoExecuted },
  };
}

module.exports = { buildCryptoSnapshot, findLatestCryptoPipelineDate, discoverRound3Versions, buildSymbolGrid };

if (require.main === module) {
  buildCryptoSnapshot().then((s) => console.log(JSON.stringify(s, null, 2))).catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}
