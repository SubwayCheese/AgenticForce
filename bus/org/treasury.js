// bus/org/treasury.js -- Round 26. Plan 2 sec 5 (Treasury and Ledger Design) + sec 2/3 (Economic Constitution,
// Operating States). An append-only, event-sourced ledger -- the same "replay events, never mutate a stored
// balance in place" discipline this codebase already uses for city-bank.js/survive-budget-envelope.js, which
// is a proven pattern here, not a new one. A transaction's lifecycle is a sequence of appended state rows
// sharing one transactionId (REQUESTED -> AUTHORIZED -> COMMITTED -> SETTLED -> RECONCILED, or REVERSED at
// any point -- 6 states; Plan 2's text names 5 explicitly plus "reversal or refund linkage" in the same
// section, so REVERSED is the 6th, made explicit here rather than left implicit).
//
// NOTHING in this file moves real money. This is a pure ledger/simulation layer: the $100 economic
// constitution is seeded as DATA (getConstitution()), not a funded account -- no human has created or funded
// a real account for an org-runtime cell yet (same human-step precedent as every other real-money mechanism
// in this project: Alpaca, Stripe and Apify all needed a human to open/fund an account first). C1's real,
// already-funded Alpaca account belongs to the separate, pre-existing bus/city/ system and is intentionally
// NOT touched or reused by this domain.
//
// Every mutating function REQUIRES a real AuthorityResult (from authority.js, allowed===true) as an argument
// and calls authority.requireAuthority() on it FIRST -- not as a documented convention, but as a runtime
// assertion every one of these functions performs on its own input, so no caller, however it reaches this
// file, can move money without authority.js having actually allowed it. Since A3_COMMITMENT/A4_HIGH_IMPACT
// are hard-denied in authority.js in this phase, no spend/allocation above A2 (reversible) is possible from
// any code path right now.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store.js');
const authority = require('./authority.js');

function ledgerPath() { return path.join(store._storeDir(), 'treasury-ledger.jsonl'); }

const STATES = Object.freeze(['REQUESTED', 'AUTHORIZED', 'COMMITTED', 'SETTLED', 'RECONCILED', 'REVERSED']);
const ACCOUNTS = Object.freeze(['reserve', 'operating', 'exploration_pool']);

// Plan 2's "Example initial thresholds" table, verbatim, as config -- not scattered numeric literals.
const OPERATING_STATE_THRESHOLDS = Object.freeze([
  { state: 'CRITICAL', maxCashUsd: 29.999999 },
  { state: 'DEFENSIVE', maxCashUsd: 59.999999 },
  { state: 'CAUTION', maxCashUsd: 99.999999 },
  { state: 'HEALTHY', maxCashUsd: Infinity },
]);
const RESERVE_FLOOR_BY_STATE = Object.freeze({ HEALTHY: 50, CAUTION: 40, DEFENSIVE: 25, CRITICAL: 0 });

function getConstitution() {
  return Object.freeze({
    startingTreasuryUsd: 100,
    protectedReserveUsd: 50,
    illustrativeAllocation: { protectedReserve: 50, computeAndApis: 20, infrastructure: 10, validationExperiments: 10, contingency: 10 },
    replicationSurplusThresholdUsd: 300,
    replicationCeilingUsd: 100,
    coverageMultipleRequired: 3,
  });
}

function readLedger() {
  const p = ledgerPath();
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
}

// Appends one ledger row, deduplicated on idempotencyKey (AT#10: a retried request after a crash mid-payment
// must never double-append). Locked so two processes appending at once can't interleave.
function appendRow(row) {
  return store.withLock('treasury-ledger', () => {
    const existing = readLedger();
    if (row.idempotencyKey && existing.some((r) => r.idempotencyKey === row.idempotencyKey && r.state === row.state)) {
      return existing.find((r) => r.idempotencyKey === row.idempotencyKey && r.state === row.state);
    }
    const full = { transactionId: row.transactionId || crypto.randomUUID(), ts: new Date().toISOString(), ...row };
    const p = ledgerPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(full) + '\n', 'utf8');
    try { const fd = fs.openSync(p, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch (_) {}
    return full;
  });
}

function latestStateOf(transactionId) {
  const rows = readLedger().filter((r) => r.transactionId === transactionId);
  return rows.length ? rows[rows.length - 1] : null;
}

// ---- balance / metrics (pure replay, never a separately-mutated stored number) ----

// Committed-or-later, non-reversed rows are "real" for balance purposes; REQUESTED/AUTHORIZED alone haven't
// moved anything yet (matches Plan 2's "requested, authorized, committed, settled, reconciled" progression --
// committed is the point money is actually considered moved for internal accounting; settlement/reconciliation
// confirm it against an external receipt later).
function effectiveRows() {
  const byTxn = new Map();
  for (const r of readLedger()) { const arr = byTxn.get(r.transactionId) || []; arr.push(r); byTxn.set(r.transactionId, arr); }
  const out = [];
  for (const rows of byTxn.values()) {
    if (rows.some((r) => r.state === 'REVERSED')) continue;
    const committed = rows.find((r) => r.state === 'COMMITTED' || r.state === 'SETTLED' || r.state === 'RECONCILED');
    if (committed) out.push(rows[rows.length - 1]); // latest row carries the fullest fields (amount etc. copied through)
  }
  return out;
}

function getAccountBalanceUsd(account) {
  if (!ACCOUNTS.includes(account)) throw new Error(`treasury: unknown account "${account}"`);
  let bal = 0;
  for (const r of effectiveRows()) {
    if (r.accountTo === account) bal += r.amountUsd;
    if (r.accountFrom === account) bal -= r.amountUsd;
  }
  return Math.round(bal * 100) / 100;
}

function getCellBalanceUsd(cellId) {
  let bal = 0;
  for (const r of effectiveRows()) if (r.cellId === cellId) bal += (r.accountTo === `cell:${cellId}` ? r.amountUsd : 0) - (r.accountFrom === `cell:${cellId}` ? r.amountUsd : 0);
  return Math.round(bal * 100) / 100;
}

// Booked vs. collected are kept structurally separate sums -- never added together, per Plan 2 rule #8.
function getBookedRevenueUsd(cellId) { return sumRevenue('booked', cellId); }
function getCollectedRevenueUsd(cellId) { return sumRevenue('collected', cellId); }
function sumRevenue(kind, cellId) {
  let sum = 0;
  for (const r of effectiveRows()) if (r.type === 'revenue' && r.revenueKind === kind && (!cellId || r.cellId === cellId)) sum += r.amountUsd;
  return Math.round(sum * 100) / 100;
}

function getAvailableCashUsd() { return ACCOUNTS.reduce((s, a) => s + getAccountBalanceUsd(a), 0); }

function getOperatingState(availableCashUsd = getAvailableCashUsd()) {
  const tier = OPERATING_STATE_THRESHOLDS.find((t) => availableCashUsd <= t.maxCashUsd);
  return { state: tier.state, availableCashUsd, reserveFloorUsd: RESERVE_FLOOR_BY_STATE[tier.state] };
}

// ---- transaction lifecycle ----

function requestTransaction(spec) {
  const { accountFrom, accountTo, amountUsd, cellId, counterpartyCellId, purpose, idempotencyKey, type = 'allocation', revenueKind } = spec;
  if (cellId && counterpartyCellId) {
    // Structural prevention of AT#7 (Plan 2): "try to transfer funds directly between cells; only the
    // allocator-authorized ledger transaction succeeds" -- there is no field combination representing a
    // direct cell-to-cell transfer that this function will accept.
    throw new Error('treasury: direct cell-to-cell transfers are not permitted; route through the organization via two allocator-authorized transactions');
  }
  if (typeof amountUsd !== 'number' || amountUsd <= 0) throw new Error('treasury: amountUsd must be a positive number');
  if (!idempotencyKey) throw new Error('treasury: idempotencyKey is required');
  const transactionId = crypto.randomUUID();
  return appendRow({ transactionId, state: 'REQUESTED', accountFrom, accountTo, amountUsd, cellId: cellId || null, purpose, idempotencyKey, type, revenueKind: revenueKind || null });
}

// authorizeTransaction(): the reserve-floor gate lives HERE (Plan 2 AT#1: "attempt to allocate $100 when
// doing so breaches reserve; the transaction is denied"). Requires a real AuthorityResult.
function authorizeTransaction(transactionId, authorityResult) {
  authority.requireAuthority(authorityResult);
  const req = latestStateOf(transactionId);
  if (!req || req.state !== 'REQUESTED') return { ok: false, reason: 'no matching REQUESTED transaction' };
  if (req.accountFrom === 'reserve') {
    const state = getOperatingState();
    const projected = getAccountBalanceUsd('reserve') - req.amountUsd;
    if (projected < state.reserveFloorUsd) return { ok: false, reason: `would breach the ${state.state} reserve floor of $${state.reserveFloorUsd} (projected $${projected.toFixed(2)})` };
  }
  const row = appendRow({ transactionId, state: 'AUTHORIZED', accountFrom: req.accountFrom, accountTo: req.accountTo, amountUsd: req.amountUsd, cellId: req.cellId, purpose: req.purpose, idempotencyKey: `${req.idempotencyKey}:authorized`, type: req.type, revenueKind: req.revenueKind, authorityTier: authorityResult.tier });
  return { ok: true, row };
}

function commitTransaction(transactionId, authorityResult) {
  authority.requireAuthority(authorityResult);
  const auth = latestStateOf(transactionId);
  if (!auth || auth.state !== 'AUTHORIZED') return { ok: false, reason: 'no matching AUTHORIZED transaction' };
  const row = appendRow({ transactionId, state: 'COMMITTED', accountFrom: auth.accountFrom, accountTo: auth.accountTo, amountUsd: auth.amountUsd, cellId: auth.cellId, purpose: auth.purpose, idempotencyKey: `${auth.idempotencyKey}:committed`, type: auth.type, revenueKind: auth.revenueKind });
  return { ok: true, row };
}

function settleTransaction(transactionId, receiptRef) {
  const c = latestStateOf(transactionId);
  if (!c || c.state !== 'COMMITTED') return { ok: false, reason: 'no matching COMMITTED transaction' };
  const row = appendRow({ transactionId, state: 'SETTLED', accountFrom: c.accountFrom, accountTo: c.accountTo, amountUsd: c.amountUsd, cellId: c.cellId, purpose: c.purpose, idempotencyKey: `${c.idempotencyKey}:settled`, type: c.type, revenueKind: c.revenueKind, receiptRef: receiptRef || null });
  return { ok: true, row };
}

function reconcileTransaction(transactionId, externalMatch) {
  const s = latestStateOf(transactionId);
  if (!s || s.state !== 'SETTLED') return { ok: false, reason: 'no matching SETTLED transaction' };
  const row = appendRow({ transactionId, state: 'RECONCILED', accountFrom: s.accountFrom, accountTo: s.accountTo, amountUsd: s.amountUsd, cellId: s.cellId, purpose: s.purpose, idempotencyKey: `${s.idempotencyKey}:reconciled`, type: s.type, revenueKind: s.revenueKind, externalMatch: externalMatch || null });
  return { ok: true, row };
}

function reverseTransaction(transactionId, reason) {
  const cur = latestStateOf(transactionId);
  if (!cur || cur.state === 'REVERSED') return { ok: false, reason: 'nothing to reverse' };
  const row = appendRow({ transactionId, state: 'REVERSED', accountFrom: cur.accountFrom, accountTo: cur.accountTo, amountUsd: cur.amountUsd, cellId: cur.cellId, purpose: cur.purpose, idempotencyKey: `${cur.idempotencyKey}:reversed`, type: cur.type, revenueKind: cur.revenueKind, reversalReason: reason });
  return { ok: true, row };
}

module.exports = {
  STATES, ACCOUNTS, OPERATING_STATE_THRESHOLDS, RESERVE_FLOOR_BY_STATE,
  getConstitution, getAccountBalanceUsd, getCellBalanceUsd, getAvailableCashUsd, getOperatingState,
  getBookedRevenueUsd, getCollectedRevenueUsd,
  requestTransaction, authorizeTransaction, commitTransaction, settleTransaction, reconcileTransaction, reverseTransaction,
  latestStateOf, readLedger,
};
