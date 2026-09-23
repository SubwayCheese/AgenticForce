// city-bank.js -- the shared city-bank ledger for the "survive" branch
// (ARCHITECTURE.md section 19). Sits ABOVE every citizen's own budget
// envelope (survive-budget-envelope.js) -- this file never reads or writes
// per-citizen ledger internals directly, and that file never reads or
// writes this one. A citizen depositing surplus is two separate writes,
// one into each ledger (not transactional -- see the drift-monitoring note
// below); city-bank.js only ever owns bus/survive-city-bank.jsonl.
//
// Direct user rule, exact: "only resupply if we have a real surplus of
// money" -- the invariant this file exists to enforce in code: the running
// balance after every single line in bus/survive-city-bank.jsonl, replayed
// in order, must be >= 0, always. checkBankSolvency() enforces this
// prospectively before any write; auditBankLedgerIntegrity() re-verifies
// it retrospectively on every status read.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const VAULT_ROOT = avPaths.ROOT;
let LEDGER_PATH = path.join(VAULT_ROOT, 'bus', 'survive-city-bank.jsonl');

function nowIso() {
  return new Date().toISOString();
}

// Test-only hook, same pattern as survive-budget-envelope.js's.
function _setLedgerPathForTesting(p) {
  LEDGER_PATH = p;
}

function readAllEvents() {
  if (!fs.existsSync(LEDGER_PATH)) return [];
  return fs.readFileSync(LEDGER_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

function appendEvent(record) {
  const entry = { ts: nowIso(), ...record };
  fs.appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

// sum(citizen-deposit) - sum(bank-allocation) -- the single source of
// truth for "how much does the bank actually have to give out right now."
// genesis-funding events are provenance-only (see recordGenesisProvenance)
// and never counted here -- a citizen's genesis stake funds THEIR OWN
// envelope directly, it never passes through the shared pool.
function getBankBalanceUsd() {
  let balance = 0;
  for (const e of readAllEvents()) {
    if (e.type === 'citizen-deposit' || e.type === 'human-injection') balance += Number(e.amountUsd) || 0;
    else if (e.type === 'bank-allocation') balance -= Number(e.amountUsd) || 0;
  }
  return balance;
}

// The fail-closed gate: must pass before every bank-allocation write. An
// allocation can NEVER push the balance negative, full stop -- this is the
// literal "only resupply from real surplus" rule.
function checkBankSolvency({ amountUsd } = {}) {
  const currentBalanceUsd = getBankBalanceUsd();
  const addUsd = Number(amountUsd) || 0;
  const projectedBalanceUsd = currentBalanceUsd - addUsd;
  const ok = projectedBalanceUsd >= 0;
  return {
    ok,
    currentBalanceUsd,
    projectedBalanceUsd,
    reasons: ok ? [] : [`allocation of $${addUsd.toFixed(2)} would take the bank balance to $${projectedBalanceUsd.toFixed(2)} -- refusing, speculative/negative allocations are never allowed`],
  };
}

// Provenance only -- records that a citizen's genesis stake came from a
// real human deposit (or, for a spawned child, from a bank allocation --
// see recordBankAllocation below, which is the actual money-moving event
// for that case). Never affects getBankBalanceUsd()'s math.
function recordGenesisProvenance(citizenId, amountUsd, { note } = {}) {
  return appendEvent({ type: 'genesis-funding', citizenId, amountUsd: Number(amountUsd), note: note || null });
}

// The ONLY way money enters the bank -- a citizen's 15%-of-realized-profit
// share (see survive-budget-envelope.js's recordRealizedProfitSplit(),
// round 4 -- the ONLY caller of this function). A pure, undivided credit:
// the 65/20/15 split already happened upstream, at the profit source, so
// this never does any splitting of its own. No solvency gate needed: a
// deposit can never make the balance negative.
function recordCitizenDeposit(citizenId, amountUsd, { note } = {}) {
  if (!(Number(amountUsd) > 0)) throw new Error(`deposit amount must be positive, got ${amountUsd}`);
  return appendEvent({ type: 'citizen-deposit', citizenId, amountUsd: Number(amountUsd), note: note || null });
}

// HUMAN-CLI-ONLY (documented, not code-enforced beyond this file's own
// discipline -- same category as recordReserveWithdrawal() in
// city-reserve.js). The second, deliberate way real money enters the bank
// pool: a direct human capital injection, independent of any citizen ever
// realizing trading profit -- lets the board fund non-trading work (see
// city-spending.js) before mechanism #1 (Alpaca) even exists yet, or at
// any point later. Not a re-supply mechanism for a busted citizen (that
// stays absolute -- see survive-budget-envelope.js's permanent-shutdown
// marker); this only ever adds to the SHARED pool, never a specific
// citizen's own envelope. Repeatable, unlike genesis-funding's
// once-per-citizen rule -- the human may inject capital into the bank as
// many times as they choose.
function recordHumanCapitalInjection(amountUsd, { note } = {}) {
  if (!(Number(amountUsd) > 0)) throw new Error(`injection amount must be positive, got ${amountUsd}`);
  return appendEvent({ type: 'human-injection', amountUsd: Number(amountUsd), note: note || null });
}

// The ONLY way money leaves the bank -- funding a brand-new citizen
// (spawn) or topping up an existing struggling one. Gated by
// checkBankSolvency() FIRST; refuses (writes nothing) if not ok.
function recordBankAllocation({ citizenId, amountUsd, allocationKind, fundedByCitizenId, note } = {}) {
  if (allocationKind !== 'spawn' && allocationKind !== 'topup' && allocationKind !== 'spend-card') {
    throw new Error(`allocationKind must be 'spawn', 'topup', or 'spend-card', got ${allocationKind}`);
  }
  const gate = checkBankSolvency({ amountUsd });
  if (!gate.ok) {
    throw new Error(`recordBankAllocation refused for citizen ${citizenId}: ${gate.reasons.join('; ')}`);
  }
  return appendEvent({ type: 'bank-allocation', citizenId, amountUsd: Number(amountUsd), allocationKind, fundedByCitizenId: fundedByCitizenId || null, note: note || null });
}

// Defense in depth, not just trusting the gate above: replays the whole
// file in order and asserts the running balance was never negative at any
// point in history. Called from the status/reporting layer on every read.
function auditBankLedgerIntegrity() {
  let balance = 0;
  let firstNegativeAt = null;
  const events = readAllEvents();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'citizen-deposit' || e.type === 'human-injection') balance += Number(e.amountUsd) || 0;
    else if (e.type === 'bank-allocation') balance -= Number(e.amountUsd) || 0;
    if (balance < 0 && firstNegativeAt === null) firstNegativeAt = { index: i, event: e, balanceAtPoint: balance };
  }
  return { ok: firstNegativeAt === null, finalBalanceUsd: balance, firstNegativeAt };
}

module.exports = {
  LEDGER_PATH,
  readAllEvents,
  getBankBalanceUsd,
  checkBankSolvency,
  recordGenesisProvenance,
  recordCitizenDeposit,
  recordHumanCapitalInjection,
  recordBankAllocation,
  auditBankLedgerIntegrity,
  _setLedgerPathForTesting,
};

// CLI: node city-bank.js status | fund <amountUsd> ["note"]
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'status') {
    console.log(JSON.stringify({ balanceUsd: getBankBalanceUsd(), audit: auditBankLedgerIntegrity() }, null, 2));
  } else if (cmd === 'fund' && process.argv[3]) {
    const result = recordHumanCapitalInjection(Number(process.argv[3]), { note: process.argv[4] || null });
    console.log(JSON.stringify(result, null, 2));
    console.log(`Recorded. Bank balance is now $${getBankBalanceUsd().toFixed(2)}.`);
  } else {
    console.error('Usage: node city-bank.js status | fund <amountUsd> ["note"]');
    process.exit(1);
  }
}
