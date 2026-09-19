// survive-budget-envelope.js -- the hard, NEVER-RESET, per-citizen budget
// cap for the "survive" city-bank branch (ARCHITECTURE.md section 19).
// Real money, real consequences -- built and unit-testable before any live
// credential exists (see the CLI/test hooks below), same discipline
// portfolio-risk-envelope.js was built and proven with first.
//
// ARCHITECTURAL NOTE, decided during final planning (not assumed by either
// design pass that fed the approved plan): every survive citizen shares
// ONE real live Alpaca brokerage account -- spawning a new citizen must
// never require a second human KYC step, or the whole "city grows itself"
// premise breaks. That means this module can NEVER read the shared
// account's raw equity/cash and treat it as one citizen's number -- it has
// to be a ledger-only, per-citizen bookkeeping layer instead. A citizen's
// own "cash" is purely computed from its own tagged events in
// bus/survive-ledger.jsonl: what it started with, what it spent on buys,
// what it received from sells, what it deposited to/received from the city
// bank. This is why checkLifetimeBudgetEnvelope() below never calls the
// live Alpaca client at all -- the ledger IS the source of truth for a
// single citizen's balance. The live client's only job is to actually
// place orders; it never answers "how much does citizen C2 have."
//
// "No re-supply, ever" enforcement: once a citizen's ledger shows zero
// spendable cash AND no open position to recover from, a
// 'cap-breach-shutdown' event is written ONCE and NEVER cleared by any
// code path in this file (or anywhere else -- confirmed by grep discipline:
// this is the only writer of that event type in the whole codebase). Every
// subsequent check for that citizen returns permanently blocked, full
// stop. The only way to undo it is a human directly editing the ledger
// file out-of-band -- deliberately high-friction, not a code path.

const fs = require('fs');
const path = require('path');
const cityBank = require('./city-bank.js');
const cityReserve = require('./city-reserve.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
let LEDGER_PATH = path.join(VAULT_ROOT, 'bus', 'survive-ledger.jsonl');

// Round 4, confirmed with the user: of every dollar of REAL REALIZED
// PROFIT (never principal), 65% stays with the citizen, 20% goes to the
// permanently protected reserve, 15% goes to the shared bank pool. See
// recordRealizedProfitSplit() below.
const PROFIT_SHARE_TO_RESERVE_PCT = 0.20;
const PROFIT_SHARE_TO_BANK_PCT = 0.15;

// Round 12 -- see checkLifetimeBudgetEnvelope() below for the full
// reasoning. No single position may exceed this fraction of a citizen's
// lifetime allocation (genesis + topups, never current/shrinking cash).
const MAX_POSITION_FRACTION_OF_LIFETIME_ALLOCATION = 0.4;

// A citizen with no open position and less than this much settled cash is
// considered permanently busted -- not literally $0, since a fractional
// cent of unspendable dust shouldn't be the difference between "busted"
// and "not busted."
const LIFETIME_BUST_FLOOR_USD = 1;

function nowIso() {
  return new Date().toISOString();
}

// Test-only hook -- lets survive-budget-envelope.test.js point this module
// at a throwaway ledger file instead of the real bus/survive-ledger.jsonl,
// so unit tests never touch real records. Never called outside a test.
function _setLedgerPathForTesting(p) {
  LEDGER_PATH = p;
}

function readAllEvents() {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  return fs.readFileSync(LEDGER_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

function readCitizenEvents(citizenId) {
  return readAllEvents().filter((e) => e.citizenId === citizenId);
}

function appendEvent(record) {
  const entry = { ts: nowIso(), ...record };
  fs.appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

function hasShutdownEvent(citizenId) {
  return readCitizenEvents(citizenId).some((e) => e.type === 'cap-breach-shutdown');
}

function writeShutdownEvent(citizenId, { triggeredBy, reason } = {}) {
  return appendEvent({ type: 'cap-breach-shutdown', citizenId, triggeredBy: triggeredBy || 'unspecified', reason: reason || 'unspecified' });
}

// Written exactly once per citizen -- the founder's real human-funded
// stake, or a spawned child's initial allocation from the city bank.
// Establishes that citizen's LIFETIME allocation baseline. Throws loudly
// on a second call for the same citizenId: this is the literal code-level
// anchor for "no re-supply, ever" at the point of initial funding -- a
// human (or citizen-lifecycle.js) accidentally re-running the genesis step
// must never silently double a citizen's real allocation.
function recordGenesisFunding(citizenId, amountUsd, { note, source = 'human' } = {}) {
  if (readCitizenEvents(citizenId).some((e) => e.type === 'genesis-funding')) {
    throw new Error(`citizen ${citizenId} already has a genesis-funding event -- refusing to record a second one. This is not a re-supply mechanism.`);
  }
  if (!(Number(amountUsd) > 0)) throw new Error(`genesis amount must be a positive number, got ${amountUsd}`);
  return appendEvent({ type: 'genesis-funding', citizenId, amountUsd: Number(amountUsd), note: note || null, source });
}

// A later, additional allocation from the city bank to an ALREADY-founded
// citizen -- only ever called by citizen-lifecycle.js, and only after
// city-bank.js's own checkBankSolvency() has confirmed real, realized
// surplus covers it. Distinct from genesis-funding (which establishes the
// baseline); this ADDS to the lifetime allocation on top of that baseline.
function recordBankTopup(citizenId, amountUsd, { note } = {}) {
  if (!(Number(amountUsd) > 0)) throw new Error(`topup amount must be a positive number, got ${amountUsd}`);
  if (hasShutdownEvent(citizenId)) {
    throw new Error(`citizen ${citizenId} is permanently shut down -- refusing to record a topup. No code path may un-shut-down a citizen.`);
  }
  return appendEvent({ type: 'bank-topup', citizenId, amountUsd: Number(amountUsd), note: note || null });
}

// A citizen sending real, realized surplus TO the city bank -- reduces
// this citizen's own spendable cash. Does NOT reduce its lifetime
// allocation (that's a separate, one-way-up concept -- see
// computeLifetimeLedger()). The companion write into
// bus/survive-city-bank.jsonl (crediting the pool) is city-bank.js's job,
// not this file's -- see ARCHITECTURE.md section 19 for the two-writes,
// non-transactional note.
function recordBankDeposit(citizenId, amountUsd, { note } = {}) {
  if (!(Number(amountUsd) > 0)) throw new Error(`deposit amount must be a positive number, got ${amountUsd}`);
  return appendEvent({ type: 'bank-deposit', citizenId, amountUsd: Number(amountUsd), note: note || null });
}

// Same shape as recordBankDeposit(), for the reserve's cut instead of the
// bank's. The companion write into bus/survive-city-reserve.jsonl is
// city-reserve.js's job -- see recordRealizedProfitSplit() below, which
// calls both this and recordBankDeposit() together.
function recordReserveDeposit(citizenId, amountUsd, { note } = {}) {
  if (!(Number(amountUsd) > 0)) throw new Error(`deposit amount must be a positive number, got ${amountUsd}`);
  return appendEvent({ type: 'reserve-deposit', citizenId, amountUsd: Number(amountUsd), note: note || null });
}

// A citizen funding its OWN clone directly out of its own cash (round 4's
// executeCloneAndPromote() in citizen-lifecycle.js) -- never touches the
// shared bank pool or reserve, deliberately distinct from
// recordBankDeposit()/recordReserveDeposit() so the ledger stays honest
// about where money actually went.
function recordCloneFundingDeduction(citizenId, amountUsd, { note } = {}) {
  if (!(Number(amountUsd) > 0)) throw new Error(`amount must be a positive number, got ${amountUsd}`);
  return appendEvent({ type: 'clone-funding-deducted', citizenId, amountUsd: Number(amountUsd), note: note || null });
}

// Real order fills -- appended by survive-executor.js only, after a real
// (or --rehearsal paper) fill confirms. grossUsd/feeUsd are both always
// non-negative; direction is captured by event type, not a signed amount.
function recordOrderFill({ citizenId, type, lotId, symbol, qty, price, grossUsd, feeUsd = 0, orderId, missionId }) {
  if (type !== 'order-fill-buy' && type !== 'order-fill-sell') {
    throw new Error(`recordOrderFill: type must be 'order-fill-buy' or 'order-fill-sell', got ${type}`);
  }
  return appendEvent({ type, citizenId, lotId, symbol, qty: Number(qty), price: Number(price), grossUsd: Number(grossUsd), feeUsd: Number(feeUsd), orderId: orderId || null, missionId: missionId || null });
}

// The one function every other module trusts for "how much does this
// citizen actually have." Pure ledger replay, no network, no date filter
// -- deliberately the opposite of portfolio-risk-envelope.js's daily-reset
// checks: this sums EVERY event since genesis, forever.
//   lifetimeAllocationUsd -- genesis + every topup ever granted (one-way up,
//     never decreases -- the "how much capital has this citizen ever been
//     given, ever" figure, useful for city-wide P&L accounting).
//   cashUsd -- current settled spendable cash: starts at 0, genesis/topups
//     add, a buy's full cost (price*qty + fee) subtracts, a sell's net
//     proceeds (price*qty - fee) add back, a bank-deposit subtracts. This
//     already excludes anything tied up in an open position (subtracted at
//     buy time, not added back until a matching sell) -- so cashUsd IS
//     exactly "settled cash only, never unrealized/mark-to-market," the
//     definition the approved plan requires for surplus calculations.
//   realizedPnlUsd -- FIFO-paired (by lotId) closed round-trips only.
//   openLots -- lots bought but not yet sold, by lotId.
function computeLifetimeLedger(citizenId) {
  const events = readCitizenEvents(citizenId);
  let lifetimeAllocationUsd = 0;
  let cashUsd = 0;
  let realizedPnlUsd = 0;
  const openLotsByLotId = new Map();

  for (const e of events) {
    if (e.type === 'genesis-funding' || e.type === 'bank-topup') {
      lifetimeAllocationUsd += Number(e.amountUsd) || 0;
      cashUsd += Number(e.amountUsd) || 0;
    } else if (e.type === 'bank-deposit' || e.type === 'reserve-deposit' || e.type === 'clone-funding-deducted') {
      // bank-deposit/reserve-deposit: this citizen's 15%/20% share of a
      // realized profit, written by recordRealizedProfitSplit() below.
      // clone-funding-deducted: this citizen funding its own clone
      // directly out of its own cash (round 4's executeCloneAndPromote()
      // -- never touches the shared bank pool). All three simply leave
      // this citizen's own cash, same as any other outflow.
      cashUsd -= Number(e.amountUsd) || 0;
    } else if (e.type === 'order-fill-buy') {
      const cost = (Number(e.grossUsd) || 0) + (Number(e.feeUsd) || 0);
      cashUsd -= cost;
      openLotsByLotId.set(e.lotId, { lotId: e.lotId, symbol: e.symbol, qty: e.qty, costUsd: cost });
    } else if (e.type === 'order-fill-sell') {
      const proceeds = (Number(e.grossUsd) || 0) - (Number(e.feeUsd) || 0);
      cashUsd += proceeds;
      const openLot = openLotsByLotId.get(e.lotId);
      if (openLot) {
        realizedPnlUsd += proceeds - openLot.costUsd;
        openLotsByLotId.delete(e.lotId);
      }
      // A sell with no matching open lot (e.g. a legacy/malformed row) is
      // still reflected in cashUsd -- refuse to guess a P&L pairing rather
      // than silently invent one, same "don't guess" discipline as
      // trading-journal.js's findMatchingExit().
    }
  }

  return {
    citizenId,
    lifetimeAllocationUsd,
    cashUsd,
    realizedPnlUsd,
    openLots: Array.from(openLotsByLotId.values()),
    hasOpenPosition: openLotsByLotId.size > 0,
  };
}

// Settled cash only, never unrealized/mark-to-market -- the one number
// citizen-lifecycle.js's spawn decision is allowed to trust as "real,
// spendable surplus."
function getRealizedSurplusUsd(citizenId) {
  return computeLifetimeLedger(citizenId).cashUsd;
}

// MECHANISM-AGNOSTIC by design -- this is not only a trading ecosystem.
// Every mechanism's own executor calls this ONE shared function at its
// own "I just realized profit" moment (survive-executor.js's
// executeExit() does this for trading; a future mechanism's executor
// would call the identical function for its own kind of profit
// recognition). The split logic itself is written exactly once here.
//
// No-op (returns immediately, nothing recorded) if profitUsd <= 0 -- a
// loss triggers no split, there's nothing to share. Both cuts are
// computed directly off profitUsd, never off each other -- no
// compounding/nested percentages.
function recordRealizedProfitSplit(citizenId, profitUsd, { mechanism, sourceRef } = {}) {
  const profit = Number(profitUsd) || 0;
  if (profit <= 0) return { split: false, reason: 'no profit to split' };

  const reserveCut = Math.round(profit * PROFIT_SHARE_TO_RESERVE_PCT * 100) / 100;
  const bankCut = Math.round(profit * PROFIT_SHARE_TO_BANK_PCT * 100) / 100;

  // A profit small enough that a cut rounds to $0.00 (sub-cent P&L, e.g. a
  // tiny test-sized fill) is not an error -- there's nothing to deposit for
  // that pot. recordReserveDeposit()/recordBankDeposit() correctly refuse a
  // non-positive amount (a real, deliberate invariant: never write a $0
  // deposit event), so the caller must skip the write rather than let that
  // refusal become an uncaught exception on an otherwise-successful exit.
  if (reserveCut > 0) {
    recordReserveDeposit(citizenId, reserveCut, { note: `profit share (mechanism: ${mechanism || 'unknown'}, ref: ${sourceRef || 'n/a'})` });
    cityReserve.recordReserveContribution(citizenId, reserveCut, { note: `from citizen ${citizenId}` });
  }

  if (bankCut > 0) {
    recordBankDeposit(citizenId, bankCut, { note: `profit share (mechanism: ${mechanism || 'unknown'}, ref: ${sourceRef || 'n/a'})` });
    cityBank.recordCitizenDeposit(citizenId, bankCut, { note: `from citizen ${citizenId}` });
  }

  return { split: true, profitUsd: profit, citizenShareUsd: profit - reserveCut - bankCut, reserveCut, bankCut };
}

// The gate: called as the FIRST line of every order-submitting function in
// survive-alpaca-live-client.js, no exceptions -- structural, not a
// caller's responsibility to remember (this directly avoids the historical
// gap already found and fixed in execute-portfolio-setup.js, where the
// equivalent trading risk gate was originally missing from one real call
// site). Fail-closed: any unexpected error computing the ledger blocks the
// order rather than permitting it.
async function checkLifetimeBudgetEnvelope(citizenId, { newOrderNotionalUsd } = {}) {
  if (!citizenId) return { ok: false, permanent: false, reasons: ['no citizenId provided'] };
  if (hasShutdownEvent(citizenId)) {
    return { ok: false, permanent: true, reasons: [`citizen ${citizenId} is already permanently shut down -- no recovery path exists in code`] };
  }
  let ledger;
  try {
    ledger = computeLifetimeLedger(citizenId);
  } catch (err) {
    return { ok: false, permanent: false, transient: true, reasons: [`ledger computation failed: ${err.message}`] };
  }
  if (!ledger.lifetimeAllocationUsd) {
    return { ok: false, permanent: false, reasons: [`citizen ${citizenId} has no recorded genesis-funding event yet`] };
  }
  const addUsd = Number(newOrderNotionalUsd) || 0;
  const reasons = [];
  if (addUsd > ledger.cashUsd) {
    reasons.push(`this order ($${addUsd.toFixed(2)}) would exceed citizen ${citizenId}'s available cash ($${ledger.cashUsd.toFixed(2)})`);
  }
  // Round 12, direct user concern: "$50 is not enough for it to learn
  // from" -- with no sizing discipline, a citizen could go all-in on its
  // very first decision and burn through most of a lifetime allocation
  // before ever completing a second mission. Anchored to lifetimeAllocationUsd
  // (genesis + any topups ever -- a stable reference point), NOT current
  // cash, deliberately: a fraction-of-REMAINING-cash rule would spiral
  // into ever-smaller positions as cash depletes, and a fraction-of-
  // CURRENT-balance rule would let a lucky streak silently raise the risk
  // ceiling. This cap never moves just because the citizen won or lost.
  // Structural, not prompt-only -- the decision task is told this rule so
  // it doesn't waste a cycle proposing an oversized entry, but this is
  // what actually enforces it regardless of what the LLM proposes.
  const maxPositionUsd = ledger.lifetimeAllocationUsd * MAX_POSITION_FRACTION_OF_LIFETIME_ALLOCATION;
  if (addUsd > maxPositionUsd) {
    reasons.push(`this order ($${addUsd.toFixed(2)}) exceeds the per-position sizing cap of $${maxPositionUsd.toFixed(2)} (${(MAX_POSITION_FRACTION_OF_LIFETIME_ALLOCATION * 100).toFixed(0)}% of lifetime allocation $${ledger.lifetimeAllocationUsd.toFixed(2)}) -- one trade should never be able to spend most of a lifetime stake`);
  }
  const ok = reasons.length === 0;
  return { ok, permanent: false, reasons, ledger };
}

// Called by survive-executor.js after every mission resolution (filled,
// exited, or a no-action outcome) -- NOT pre-emptively inside the gate
// above, so a citizen's genuinely last legal trade is never blocked before
// it happens. This is what actually trips the permanent shutdown once a
// citizen's cash is confirmed gone with nothing open to recover from.
function maybeTripPermanentShutdown(citizenId, { triggeredBy, reason } = {}) {
  if (hasShutdownEvent(citizenId)) return { alreadyShutdown: true, justShutDown: false };
  const ledger = computeLifetimeLedger(citizenId);
  if (!ledger.hasOpenPosition && ledger.cashUsd < LIFETIME_BUST_FLOOR_USD) {
    writeShutdownEvent(citizenId, {
      triggeredBy: triggeredBy || 'auto-bust-floor',
      reason: reason || `cash $${ledger.cashUsd.toFixed(2)} below bust floor $${LIFETIME_BUST_FLOOR_USD}, no open position to recover from`,
    });
    return { alreadyShutdown: false, justShutDown: true, ledger };
  }
  return { alreadyShutdown: false, justShutDown: false, ledger };
}

module.exports = {
  LIFETIME_BUST_FLOOR_USD,
  PROFIT_SHARE_TO_RESERVE_PCT,
  PROFIT_SHARE_TO_BANK_PCT,
  MAX_POSITION_FRACTION_OF_LIFETIME_ALLOCATION,
  LEDGER_PATH,
  readAllEvents,
  readCitizenEvents,
  hasShutdownEvent,
  writeShutdownEvent,
  recordGenesisFunding,
  recordBankTopup,
  recordBankDeposit,
  recordReserveDeposit,
  recordCloneFundingDeduction,
  recordOrderFill,
  recordRealizedProfitSplit,
  computeLifetimeLedger,
  getRealizedSurplusUsd,
  checkLifetimeBudgetEnvelope,
  maybeTripPermanentShutdown,
  _setLedgerPathForTesting,
};

// CLI: node survive-budget-envelope.js status <citizenId>
if (require.main === module) {
  const [cmd, citizenId] = process.argv.slice(2);
  if (cmd === 'status' && citizenId) {
    console.log(JSON.stringify({ shutdown: hasShutdownEvent(citizenId), ledger: computeLifetimeLedger(citizenId) }, null, 2));
  } else {
    console.error('Usage: node survive-budget-envelope.js status <citizenId>');
    process.exit(1);
  }
}
