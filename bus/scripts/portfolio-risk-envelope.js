// portfolio-risk-envelope.js -- portfolio-level risk envelope, added
// 2026-09-11 per the approved risk-management-lens roadmap item (self-review
// finding: every trade today is sized and approved in complete isolation --
// no check anywhere for total capital at risk, no correlation awareness
// across simultaneously-armed/open crypto longs, and no circuit breaker).
//
// This is a NEW, standalone, ADDITIVE module -- deliberately not folded
// into conditional-triggers.js's existing arm/fire logic, and deliberately
// not touching alpaca-client.js, execute-portfolio-setup.js, or any other
// file another agent owns in this same roadmap round. conditional-triggers.js
// calls the single combined entry point below (checkPortfolioRiskEnvelope)
// from its own arm/fire functions as the practical integration point --
// see the comment there for why (this module doesn't own the actual
// execution call site, execute-portfolio-setup.js does).
//
// Three checks, each independently callable and independently loggable:
//   1. checkCapitalAtRiskEnvelope -- total notional at risk vs. a ceiling.
//   2. checkCryptoCorrelationEnvelope -- simultaneous crypto-long count vs.
//      a ceiling (crypto on this account is confirmed spot/long-only
//      system-wide -- see alpaca-client.js's assertNotCryptoShortEntry --
//      so "simultaneous crypto longs" IS "simultaneous correlated altcoin
//      beta exposure").
//   3. checkDailyCircuitBreaker -- today's realized P&L and today's open
//      position count vs. thresholds; trips for the rest of the day.

const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');
const cryptoSymbols = require('./crypto-symbols.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TRIGGERS_LOG_PATH = path.join(VAULT_ROOT, 'bus', 'pending-triggers.jsonl');
const TRADES_LOG_PATH = path.join(VAULT_ROOT, 'bus', 'paper-trades.jsonl');

// ---------------------------------------------------------------------------
// Thresholds -- all configurable constants, chosen against this system's
// real current shape (confirmed live 2026-09-11: $99,986 paper equity, 3
// open positions totaling ~$95 notional, $15/leg auto-micro-sizing per
// execute-portfolio-setup.js's AUTO_MICRO_NOTIONAL_PER_LEG).
//
// Deliberately NOT expressed as a % of the paper account's equity: at
// ~$100k paper equity, any %-of-equity ceiling loose enough to matter would
// be in the thousands of dollars and would never bind at $15/leg scale --
// it would look like a control but never actually constrain anything. The
// whole point of this envelope is to make it safe to scale up FROM $15/leg
// later, so the ceiling anchors to that micro-sizing philosophy (a small
// multiple of one leg) rather than to the size of the (arbitrarily large)
// paper account.

// No more than this many simultaneous open positions across the whole
// account (fleet + crypto combined) -- an operational-complexity cap as
// much as a capital one: one supervisor loop with no per-position risk
// budgeting can't meaningfully track more than this at once. At $15/leg
// this also caps notional at roughly MAX_SIMULTANEOUS_POSITIONS * $15.
const MAX_SIMULTANEOUS_POSITIONS = 12;

// No more than this much total notional (sum of |market_value| across all
// open positions) at risk at once, INCLUDING the position about to be
// opened. ~16-17 legs worth at $15/leg, or a smaller number of legs mixed
// with occasional larger manually-sized entries (e.g. the $50 ETH/USD
// entry seen live in paper-trades.jsonl) -- enough headroom for real
// mixed sizing without ever approaching a real fraction of the account.
const MAX_TOTAL_NOTIONAL_AT_RISK_USD = 250;

// No more than this many simultaneous crypto longs (open positions +
// armed/fired-but-unresolved conditional triggers, deduped by symbol) at
// once. Crypto on this account is spot/long-only system-wide, so every
// crypto position is effectively "long altcoin beta" -- 4 simultaneous
// crypto longs (the self-review's own example: DOT/POL/SKY/YFI, all
// correlated altcoin longs, checked completely independently of each
// other) is exactly the failure mode this closes. 3 leaves room for a
// real diversified crypto book (e.g. BTC + ETH + one alt) without letting
// the correlated-altcoin-pile-on happen unchecked.
const MAX_SIMULTANEOUS_CRYPTO_LONGS = 3;

// Daily circuit breaker: if today's REALIZED (closed) P&L across the whole
// account falls to or below -$30, stop opening new positions for the rest
// of the day. At $15/leg, a single leg realizing a full, complete loss is
// -$15; two such losses in one day (-$30) is a real, above-noise signal
// that something is systematically wrong today (bad data, a broken
// rescan, a genuinely bad market day) rather than routine per-trade
// variance -- real losses observed in paper-trades.jsonl so far are
// fractions of a dollar to low single dollars, so $30 is a deliberate
// multiple above routine noise, not a hair-trigger.
const MAX_DAILY_REALIZED_LOSS_USD = 30;

function log(msg) {
  console.log(`[portfolio-risk-envelope] ${msg}`);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

// --- pending-triggers.jsonl reading -----------------------------------
// Deliberately a small, self-contained reader rather than requiring
// conditional-triggers.js's own readEvents()/latestStateByKey() -- that
// module will require THIS one (to call checkPortfolioRiskEnvelope from
// its arm/fire functions), so requiring it back here would be a circular
// dependency. A few duplicated lines of append-only-log parsing is a much
// smaller risk than that.
function readTriggerEvents() {
  if (!fs.existsSync(TRIGGERS_LOG_PATH)) return [];
  return fs.readFileSync(TRIGGERS_LOG_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

function latestTriggerStateByKey() {
  const byKey = new Map();
  for (const e of readTriggerEvents()) {
    const key = `${e.sourceTask}::${e.symbol}`;
    byKey.set(key, e); // latest-per-key wins, same discipline as conditional-triggers.js
  }
  return byKey;
}

// --- paper-trades.jsonl reading (read-only) -----------------------------
function readTradeEvents() {
  if (!fs.existsSync(TRADES_LOG_PATH)) return [];
  return fs.readFileSync(TRADES_LOG_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

// FIFO-pairs research-driven-entry/-exit records per symbol to compute a
// realized dollar P&L per closed leg, then sums whatever closed on
// `dateIso` (default: today, UTC calendar date -- matches every other
// ts in this codebase, which is ISO/UTC throughout).
//
// Known real limitation, confirmed live 2026-09-11: not every open
// position in this account has a matching research-driven-entry record
// in paper-trades.jsonl (e.g. the live VZ and MSFT positions have no
// entry record in the file at all as of this writing -- entered via a
// path that didn't log one). An exit with no tracked open entry for that
// symbol is skipped rather than guessed at, so this is a conservative
// (never-overstates-losses) lower-bound read of today's realized P&L,
// not a guaranteed-complete one. Good enough for a circuit breaker, whose
// job is to catch a clearly bad day, not to be a penny-accurate ledger
// (that's trading-journal.js's job, a file this package doesn't own).
function computeTodayRealizedPnlUsd(dateIso) {
  const targetDate = dateIso || todayIsoDate();
  const events = readTradeEvents(); // append-only, already chronological
  const openBySymbol = new Map(); // symbol -> FIFO queue of {qty, fillPrice, direction}
  let total = 0;

  for (const e of events) {
    const day = String(e.ts || '').slice(0, 10);

    if (e.type === 'mechanism-test') {
      if (day === targetDate && typeof e.realizedPnl === 'number') total += e.realizedPnl;
      continue;
    }

    if (e.type === 'research-driven-entry') {
      const qty = Number(e.qty);
      const fillPrice = Number(e.actualFillPrice);
      if (!qty || !fillPrice) continue; // malformed record, nothing to pair later -- skip rather than guess
      const q = openBySymbol.get(e.symbol) || [];
      q.push({ qty, fillPrice, direction: e.direction || 'long' });
      openBySymbol.set(e.symbol, q);
      continue;
    }

    if (e.type === 'research-driven-exit') {
      const q = openBySymbol.get(e.symbol);
      const exitPrice = Number(e.exitFillPrice);
      if (!q || !q.length || !exitPrice) continue; // no tracked open leg to pair against -- see limitation note above
      const openLeg = q.shift();
      const pnl = openLeg.direction === 'short'
        ? (openLeg.fillPrice - exitPrice) * openLeg.qty
        : (exitPrice - openLeg.fillPrice) * openLeg.qty;
      if (day === targetDate) total += pnl;
      continue;
    }
  }
  return total;
}

// --- Check 1: capital-at-risk ------------------------------------------
// Computes total notional currently at risk across ALL open positions
// (live, from Alpaca) vs. account equity, and refuses a new entry whose
// addition would push total notional or open position count past the
// configured ceilings above.
async function checkCapitalAtRiskEnvelope({ newLegNotionalUsd } = {}) {
  const [account, positions] = await Promise.all([alpaca.getAccount(), alpaca.getPositions()]);
  const equity = Number(account.equity);
  const currentNotional = positions.reduce((sum, p) => sum + Math.abs(Number(p.market_value) || 0), 0);
  const addNotional = Number(newLegNotionalUsd) || 0;
  const projectedNotional = currentNotional + addNotional;
  const projectedCount = positions.length + 1;

  const reasons = [];
  if (projectedCount > MAX_SIMULTANEOUS_POSITIONS) {
    reasons.push(`would open position #${projectedCount}, exceeding MAX_SIMULTANEOUS_POSITIONS=${MAX_SIMULTANEOUS_POSITIONS}`);
  }
  if (projectedNotional > MAX_TOTAL_NOTIONAL_AT_RISK_USD) {
    reasons.push(`projected total notional at risk $${projectedNotional.toFixed(2)} (current $${currentNotional.toFixed(2)} + new $${addNotional.toFixed(2)}) exceeds MAX_TOTAL_NOTIONAL_AT_RISK_USD=$${MAX_TOTAL_NOTIONAL_AT_RISK_USD}`);
  }

  const ok = reasons.length === 0;
  if (!ok) log(`CAPITAL-AT-RISK BLOCK: ${reasons.join('; ')} (equity $${equity.toFixed(2)})`);
  return { ok, reasons, equity, currentNotional, projectedNotional, currentPositionCount: positions.length, projectedCount };
}

// --- Check 2: crypto correlation ----------------------------------------
// "How many OTHER simultaneous crypto longs already exist" -- counts
// live open crypto positions (asset_class === 'crypto', side === 'long',
// confirmed the only side that exists for crypto on this account) plus
// currently armed/fired-but-unresolved crypto conditional triggers, deduped
// by symbol, EXCLUDING the symbol being checked (re-arming/re-firing the
// SAME symbol isn't adding a new correlated bet). Only meaningful for
// crypto symbols -- a no-op (always ok) for equities.
async function checkCryptoCorrelationEnvelope({ symbol } = {}) {
  if (!symbol || !cryptoSymbols.isCryptoSymbol(symbol)) {
    return { ok: true, reasons: [], applicable: false, symbols: [] };
  }

  const positions = await alpaca.getPositions();
  const openCryptoLongSymbols = positions
    .filter((p) => p.asset_class === 'crypto' && p.side === 'long')
    .map((p) => p.symbol); // Alpaca returns e.g. "ETHUSD" for positions

  const byKey = latestTriggerStateByKey();
  const activeCryptoTriggerSymbols = Array.from(byKey.values())
    .filter((e) => (e.type === 'trigger-armed' || e.type === 'trigger-fired') && e.pilot === 'crypto')
    .map((e) => e.symbol); // e.g. "BTC/USD"

  const normalizedTarget = cryptoSymbols.toAlpacaSymbol(symbol);
  const distinctOther = new Set(
    [...openCryptoLongSymbols, ...activeCryptoTriggerSymbols]
      .filter((s) => cryptoSymbols.isCryptoSymbol(s))
      .map((s) => cryptoSymbols.toAlpacaSymbol(s))
      .filter((s) => s !== normalizedTarget)
  );

  const reasons = [];
  if (distinctOther.size >= MAX_SIMULTANEOUS_CRYPTO_LONGS) {
    reasons.push(`${distinctOther.size} other simultaneous crypto long(s)/armed-trigger(s) already exist (${Array.from(distinctOther).join(', ')}), at or above MAX_SIMULTANEOUS_CRYPTO_LONGS=${MAX_SIMULTANEOUS_CRYPTO_LONGS} -- refusing to add a correlated altcoin-beta bet`);
  }

  const ok = reasons.length === 0;
  if (!ok) log(`CRYPTO-CORRELATION BLOCK (${symbol}): ${reasons.join('; ')}`);
  return { ok, reasons, applicable: true, symbols: Array.from(distinctOther) };
}

// --- Check 3: daily circuit breaker --------------------------------------
// Trips for the rest of the (UTC calendar) day once today's realized
// losses or today's open-position count cross their thresholds. Position
// count reuses MAX_SIMULTANEOUS_POSITIONS (same real cap, viewed through
// the "for the rest of today" lens rather than "for this one attempt").
async function checkDailyCircuitBreaker() {
  const positions = await alpaca.getPositions();
  const realizedPnlToday = computeTodayRealizedPnlUsd();

  const reasons = [];
  if (realizedPnlToday <= -MAX_DAILY_REALIZED_LOSS_USD) {
    reasons.push(`today's realized P&L is $${realizedPnlToday.toFixed(2)}, at or below -MAX_DAILY_REALIZED_LOSS_USD=-$${MAX_DAILY_REALIZED_LOSS_USD} -- circuit breaker tripped for the rest of today`);
  }
  if (positions.length >= MAX_SIMULTANEOUS_POSITIONS) {
    reasons.push(`${positions.length} open position(s), at or above MAX_SIMULTANEOUS_POSITIONS=${MAX_SIMULTANEOUS_POSITIONS} -- no more new entries today`);
  }

  const ok = reasons.length === 0;
  if (!ok) log(`DAILY CIRCUIT BREAKER TRIPPED: ${reasons.join('; ')}`);
  return { ok, reasons, realizedPnlToday, openPositionCount: positions.length };
}

// --- Combined entry point -------------------------------------------------
// The single function conditional-triggers.js's arm/fire functions call.
// Runs all three checks (crypto-correlation is a no-op for non-crypto
// symbols) and returns ok:false with every reason if any one of them
// blocks -- callers log a summary and skip/refuse, they don't need to
// call the three checks individually.
async function checkPortfolioRiskEnvelope({ symbol, newLegNotionalUsd, stage } = {}) {
  const [capital, correlation, circuitBreaker] = await Promise.all([
    checkCapitalAtRiskEnvelope({ newLegNotionalUsd }),
    checkCryptoCorrelationEnvelope({ symbol }),
    checkDailyCircuitBreaker(),
  ]);

  const reasons = [...capital.reasons, ...correlation.reasons, ...circuitBreaker.reasons];
  const ok = reasons.length === 0;
  return {
    ok,
    reasons,
    stage: stage || null,
    symbol: symbol || null,
    details: { capital, correlation, circuitBreaker },
  };
}

module.exports = {
  MAX_SIMULTANEOUS_POSITIONS,
  MAX_TOTAL_NOTIONAL_AT_RISK_USD,
  MAX_SIMULTANEOUS_CRYPTO_LONGS,
  MAX_DAILY_REALIZED_LOSS_USD,
  computeTodayRealizedPnlUsd,
  checkCapitalAtRiskEnvelope,
  checkCryptoCorrelationEnvelope,
  checkDailyCircuitBreaker,
  checkPortfolioRiskEnvelope,
};

// CLI: node portfolio-risk-envelope.js [symbol]
// Prints all three checks against REAL live account/position data (and
// real pending-triggers.jsonl / paper-trades.jsonl state) -- no mocks.
if (require.main === module) {
  const symbol = process.argv[2] || null;
  checkPortfolioRiskEnvelope({ symbol, newLegNotionalUsd: 15, stage: 'cli-test' })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}
