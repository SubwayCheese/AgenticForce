// city-reserve.js -- the protected profit reserve (ARCHITECTURE.md
// section 19, round 4). Direct user rule, exact: "There should be a set
// money that doesnt get touched regardless so that if all else fails and
// the city burns down I have profit to take and create it again."
//
// A fixed 20% of every citizen's REALIZED PROFIT (never principal, never
// genesis funding) lands here instead of the spendable bank pool -- see
// survive-budget-envelope.js's recordRealizedProfitSplit(), the ONLY
// caller of recordReserveContribution() below. This money is NEVER
// available to any citizen, leader, or the leader council's reallocation
// logic. The ONLY way money leaves this ledger is a human-run CLI
// withdrawal record -- no code path may write a withdrawal.
//
// HONEST SCOPE BOUNDARY: this is an internal bookkeeping wall marking
// money as "spoken for, never reinvested." It does NOT and cannot execute
// an actual bank withdrawal from Alpaca -- physically moving cash into a
// personal bank account happens through Alpaca's own ACH withdrawal flow,
// outside anything this codebase touches (same category of irreducible
// human step as the KYC/account-opening handoff documented for mechanism
// #1). recordReserveWithdrawal() is how you record that you did that,
// not how you do it.

const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
let LEDGER_PATH = path.join(VAULT_ROOT, 'bus', 'survive-city-reserve.jsonl');

function nowIso() {
  return new Date().toISOString();
}

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

function getReserveBalanceUsd() {
  let balance = 0;
  for (const e of readAllEvents()) {
    if (e.type === 'reserve-contribution') balance += Number(e.amountUsd) || 0;
    else if (e.type === 'reserve-withdrawal') balance -= Number(e.amountUsd) || 0;
  }
  return balance;
}

// Called from exactly one place: survive-budget-envelope.js's
// recordRealizedProfitSplit(). Never called by a citizen, a leader, or
// the leader council directly.
function recordReserveContribution(sourceCitizenId, amountUsd, { note } = {}) {
  if (!(Number(amountUsd) > 0)) throw new Error(`contribution amount must be positive, got ${amountUsd}`);
  return appendEvent({ type: 'reserve-contribution', sourceCitizenId, amountUsd: Number(amountUsd), note: note || null });
}

// HUMAN-CLI-ONLY. No code path in this codebase may call this function --
// it exists so the CLI block at the bottom of this file can record that
// you actually withdrew real cash via Alpaca's own ACH flow. Refuses to
// record a withdrawal that would take the ledger negative (a bookkeeping
// sanity check, not a real-money gate -- the real gate is whatever Alpaca
// itself allows you to withdraw).
function recordReserveWithdrawal(amountUsd, { note } = {}) {
  if (!(Number(amountUsd) > 0)) throw new Error(`withdrawal amount must be positive, got ${amountUsd}`);
  if (Number(amountUsd) > getReserveBalanceUsd()) {
    throw new Error(`withdrawal of $${Number(amountUsd).toFixed(2)} exceeds the recorded reserve balance ($${getReserveBalanceUsd().toFixed(2)}) -- refusing to record a withdrawal larger than what's on the books`);
  }
  return appendEvent({ type: 'reserve-withdrawal', amountUsd: Number(amountUsd), note: note || null });
}

// Same replay-and-assert-never-negative pattern as city-bank.js's own
// audit function -- defense in depth, not just trusting the gate above.
function auditReserveLedgerIntegrity() {
  let balance = 0;
  let firstNegativeAt = null;
  const events = readAllEvents();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'reserve-contribution') balance += Number(e.amountUsd) || 0;
    else if (e.type === 'reserve-withdrawal') balance -= Number(e.amountUsd) || 0;
    if (balance < 0 && firstNegativeAt === null) firstNegativeAt = { index: i, event: e, balanceAtPoint: balance };
  }
  return { ok: firstNegativeAt === null, finalBalanceUsd: balance, firstNegativeAt };
}

module.exports = {
  LEDGER_PATH,
  readAllEvents,
  getReserveBalanceUsd,
  recordReserveContribution,
  recordReserveWithdrawal,
  auditReserveLedgerIntegrity,
  _setLedgerPathForTesting,
};

// CLI: node city-reserve.js status | withdraw <amountUsd> ["note"]
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'status') {
    console.log(JSON.stringify({ balanceUsd: getReserveBalanceUsd(), audit: auditReserveLedgerIntegrity() }, null, 2));
  } else if (cmd === 'withdraw' && process.argv[3]) {
    const result = recordReserveWithdrawal(Number(process.argv[3]), { note: process.argv[4] || null });
    console.log(JSON.stringify(result, null, 2));
    console.log('Recorded. This does NOT move real money -- withdraw the actual cash from Alpaca via its own ACH flow first, then run this to keep the books honest.');
  } else {
    console.error('Usage: node city-reserve.js status | withdraw <amountUsd> ["note"]');
    process.exit(1);
  }
}
