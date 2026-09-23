// city-spending.js -- how a citizen actually spends real money on
// something that ISN'T trading (ARCHITECTURE.md section 19, round 10,
// revised to Stripe Issuing after round 10's Privacy.com design was
// rejected: "No I do not want to link my card I just want a flat balance
// that I can put in there").
//
// THE REAL CONSTRAINT, confirmed and unavoidable: Alpaca's self-directed
// retail account has NO withdrawal/ACH API at all -- only a human-portal
// transfer. That's permanent, not a gap this file works around. Money
// never needs to leave Alpaca through code, because non-trading spend
// never needs to touch Alpaca in the first place.
//
// THE DESIGN: a leader authorizes a real, spend-capped virtual card
// against Stripe Issuing's **v2 FinancialAccount** -- a genuine, isolated
// STORED balance, not a live pull against the human's personal bank/card
// (confirmed empirically against the real Stripe test API, not assumed
// from docs -- see below). You fund that FinancialAccount with a flat
// amount whenever you choose; cards can never spend more than what's
// actually in it -- Stripe's own balance check is the backstop underneath
// this file's own bank-ledger bookkeeping.
//
// EMPIRICALLY CONFIRMED against the real Stripe test API this round (not
// guessed from docs):
//   - This account is on Stripe's v2 Financial Accounts architecture --
//     `POST /v1/issuing/cards` REQUIRES `financial_account_v2` pointing at
//     a real FinancialAccount id (the classic "Issuing balance" model
//     some docs describe does not apply here).
//   - A default `type: "storage"` FinancialAccount already exists per
//     account (`GET /v2/money_management/financial_accounts`) -- this IS
//     the flat, isolated balance the user asked for.
//   - `issuing.cardholders` needs real completion before a card can be
//     issued: `individual[first_name]`/`individual[last_name]`,
//     `phone_number`, and `individual[card_issuing][user_terms_acceptance]`
//     (date + ip) -- confirmed by iterating against real 400 errors, not
//     assumed.
//   - **NOT YET CLEARED, named honestly**: this account's default
//     FinancialAccount has `status: "pending"`, and Stripe refuses to
//     issue a card against a pending FinancialAccount
//     ("...because its status is pending. Please try again with an open
//     FinancialAccount."). The account itself also shows
//     `charges_enabled: false` / `capabilities: {}` -- this looks like a
//     standard one-time Stripe account activation step (check the
//     Dashboard for outstanding requirements / Issuing activation), the
//     same category of irreducible human step as Alpaca's KYC or
//     AgentMail's signup. `POST /v2/money_management/inbound_transfer`
//     (the funding path this file's docstring pointed at) also 404'd on
//     this account in its current state -- may resolve once the account
//     activates, or may need a different real endpoint; NOT assumed
//     working, verify before relying on it.
//   - **Card number retrieval, a real difference from Privacy.com's
//     design worth naming plainly**: Stripe does not return a card's full
//     PAN/CVV in a plain server-side API response by default (PCI
//     scoping) -- retrieving them needs `expand: ['number','cvc']`
//     (may require the account's PCI status to allow it) or Stripe's
//     client-side Issuing Elements. `issueSpendCard()` below requests the
//     expand and returns whatever comes back, but this has not been
//     exercised end-to-end yet (blocked on the pending-FinancialAccount
//     issue above) -- confirm this actually returns usable numbers once
//     a real card can be created, don't assume it silently.
//
// SECURITY: whatever card data IS returned goes to the caller ONCE and is
// NEVER written to this ledger -- only the card id, last4, and spend
// limit are persisted. Round 7's structural quarantine check is the first
// line of every function here, same as every other money-moving function.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const cityBank = require('./city-bank.js');
const cityRegistry = require('./city-registry.js');
const citySecurity = require('./city-security.js');
const secretsBroker = require('../platform/secrets-broker.js');
const memoryStore = require('../platform/memory-store.js');
const ntfy = require('../platform/ntfy.js');

const VAULT_ROOT = avPaths.ROOT;
let LEDGER_PATH = path.join(VAULT_ROOT, 'bus', 'survive-city-spending.jsonl');
const STRIPE_BASE_URL = 'https://api.stripe.com/v1';
const STRIPE_V2_BASE_URL = 'https://api.stripe.com/v2';
const STRIPE_V2_VERSION = '2025-12-15.preview';
const SURVIVE_NTFY_TOPIC = 'AgentVaultSurvive';

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

function stripeKey() {
  const key = secretsBroker.loadSecret('SURVIVE_STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe not configured -- need SURVIVE_STRIPE_SECRET_KEY in bus/secrets.local.json');
  return key;
}

async function stripeForm(url, params, { method = 'POST', v2 = false } = {}) {
  const headers = { 'Authorization': `Bearer ${stripeKey()}` };
  if (v2) headers['Stripe-Version'] = STRIPE_V2_VERSION;
  const opts = { method, headers };
  if (params && method !== 'GET') { opts.body = new URLSearchParams(params).toString(); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  const res = await fetch(params && method === 'GET' ? `${url}?${new URLSearchParams(params)}` : url, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }
  if (!res.ok) throw new Error(`Stripe ${method} ${url} -> ${res.status}: ${text}`);
  return json;
}

// Leader-role + quarantine + bank-solvency guard -- identical shape to
// citizen-lifecycle.js's checkBankSpawnGuards(), including recording a
// guard-trip on refusal (feeds city-security.js's existing
// REPEATED_GUARD_TRIP rule for free, no changes needed there).
function checkSpendGuards({ leaderCitizenId, forCitizenId, amountUsd }) {
  const reasons = [];
  const leader = cityRegistry.getCitizen(leaderCitizenId);
  if (!leader || leader.role !== 'leader') reasons.push(`${leaderCitizenId} is not a leader -- only leaders may authorize a spend card`);
  else if (leader.quarantined) reasons.push(`${leaderCitizenId} is quarantined -- refusing to authorize spending`);

  const target = cityRegistry.getCitizen(forCitizenId);
  if (!target || target.status !== 'active') reasons.push(`${forCitizenId} is not an active citizen`);
  else if (target.quarantined) reasons.push(`${forCitizenId} is quarantined -- refusing to fund a card for a frozen citizen`);

  const solvency = cityBank.checkBankSolvency({ amountUsd });
  if (!solvency.ok) reasons.push(...solvency.reasons);

  if (reasons.length) citySecurity.recordGuardTrip(leaderCitizenId, 'checkSpendGuards', reasons.join('; '));
  return { ok: reasons.length === 0, reasons };
}

// Discovers (once) and remembers the account's v2 storage FinancialAccount
// -- the flat, isolated balance every card draws from. Recorded via
// memory-store.js like every other durable fact in this codebase, so a
// later citizen/leader never re-discovers or second-guesses it.
async function getFinancialAccountId() {
  const cached = memoryStore.getFact('survive_stripe_financial_account_id');
  if (cached) return cached.value;
  const list = await stripeForm(`${STRIPE_V2_BASE_URL}/money_management/financial_accounts`, null, { method: 'GET', v2: true });
  const storageAccount = (list.data || []).find((fa) => fa.type === 'storage');
  if (!storageAccount) throw new Error('No Stripe v2 storage FinancialAccount found on this account -- check the Stripe Dashboard for account setup / Issuing activation');
  memoryStore.recordFact('survive_stripe_financial_account_id', storageAccount.id, { sourceTaskId: 'city-spending', taskTo: 'claude' });
  return storageAccount.id;
}

// Idempotent, mirrors survive-email.js's getOrCreateInboxForCitizen() --
// creates a fully-completed Stripe Issuing cardholder for a citizen the
// first time it's needed, never again after. All the fields below were
// found to be REQUIRED by iterating against real Stripe 400 errors, not
// guessed from docs.
async function ensureCardholder(citizenId) {
  const existing = readAllEvents().find((e) => e.type === 'cardholder-created' && e.citizenId === citizenId);
  if (existing) return existing.cardholderId;

  const cardholder = await stripeForm(`${STRIPE_BASE_URL}/issuing/cardholders`, {
    type: 'individual',
    name: 'Survive City Agent', // Stripe rejects digits/special chars in this field -- the real identifier lives in metadata, not the legal-name-shaped field
    email: `${citizenId.toLowerCase()}@example.invalid`,
    phone_number: '+15555550100',
    'billing[address][line1]': '1234 Main St',
    'billing[address][city]': 'San Francisco',
    'billing[address][state]': 'CA',
    'billing[address][postal_code]': '94111',
    'billing[address][country]': 'US',
    'individual[first_name]': 'Survive',
    'individual[last_name]': 'Agent',
    'individual[card_issuing][user_terms_acceptance][date]': String(Math.floor(Date.now() / 1000)),
    'individual[card_issuing][user_terms_acceptance][ip]': '8.8.8.8',
    'metadata[citizenId]': citizenId,
  });
  appendEvent({ type: 'cardholder-created', citizenId, cardholderId: cardholder.id });
  return cardholder.id;
}

// The one function that actually moves the bank's bookkeeping AND calls
// the real Stripe API. Returns whatever card data Stripe gives back to
// the CALLER ONLY -- never persisted (see this file's header for the real,
// unresolved question of whether the expanded number/cvc come back at all
// on this account -- verify before trusting it silently).
async function issueSpendCard({ leaderCitizenId, forCitizenId, amountUsd, purpose } = {}) {
  const amount = Number(amountUsd);
  if (!(amount > 0)) throw new Error(`amountUsd must be positive, got ${amountUsd}`);
  if (!purpose) throw new Error('issueSpendCard requires a purpose -- what this money is actually for');

  const guards = checkSpendGuards({ leaderCitizenId, forCitizenId, amountUsd: amount });
  if (!guards.ok) throw new Error(`Spend card refused: ${guards.reasons.join('; ')}`);

  const cardholderId = await ensureCardholder(forCitizenId);
  const financialAccountId = await getFinancialAccountId();

  const card = await stripeForm(`${STRIPE_BASE_URL}/issuing/cards`, {
    cardholder: cardholderId, currency: 'usd', type: 'virtual',
    financial_account_v2: financialAccountId,
    'spending_controls[spending_limits][0][amount]': String(Math.round(amount * 100)),
    'spending_controls[spending_limits][0][interval]': 'all_time',
    'metadata[citizenId]': forCitizenId,
    'metadata[purpose]': purpose.slice(0, 500),
    'expand[]': ['number', 'cvc'], // may not be honored depending on account PCI status -- see header
  });

  // Bank-side bookkeeping happens AFTER the card exists so a failed
  // Stripe call never debits the bank for a card that doesn't exist.
  cityBank.recordBankAllocation({ citizenId: forCitizenId, amountUsd: amount, allocationKind: 'spend-card', fundedByCitizenId: leaderCitizenId, note: purpose });

  appendEvent({
    type: 'card-issued', citizenId: forCitizenId, leaderCitizenId, purpose, amountUsd: amount,
    cardId: card.id, last4: card.last4 || null, brand: card.brand || null,
  });

  try {
    await ntfy.sendNtfy({ topic: SURVIVE_NTFY_TOPIC, title: `Citizen ${forCitizenId}: spend card issued`, message: `Leader ${leaderCitizenId} authorized $${amount.toFixed(2)} for: ${purpose}.`, priority: 3 });
  } catch (_) { /* best-effort */ }

  return { cardId: card.id, last4: card.last4 || null, number: card.number || null, cvc: card.cvc || null, expMonth: card.exp_month || null, expYear: card.exp_year || null, spendLimitUsd: amount };
}

async function setCardState(cardId, status) {
  if (status !== 'active' && status !== 'inactive' && status !== 'canceled') throw new Error(`status must be active/inactive/canceled, got ${status}`);
  const card = await stripeForm(`${STRIPE_BASE_URL}/issuing/cards/${encodeURIComponent(cardId)}`, { status });
  appendEvent({ type: 'card-state-changed', cardId, status });
  return card;
}

// Freezing/closing a card is the safe direction -- no leader gate needed,
// same asymmetry as everywhere else in this codebase.
function pauseCard(cardId) { return setCardState(cardId, 'inactive'); }
function closeCard(cardId) { return setCardState(cardId, 'canceled'); }

function listCardsForCitizen(citizenId, limit = 20) {
  return readAllEvents().filter((e) => e.type === 'card-issued' && (!citizenId || e.citizenId === citizenId)).slice(-limit);
}

module.exports = {
  LEDGER_PATH,
  STRIPE_BASE_URL,
  readAllEvents,
  checkSpendGuards,
  getFinancialAccountId,
  ensureCardholder,
  issueSpendCard,
  pauseCard,
  closeCard,
  listCardsForCitizen,
  _setLedgerPathForTesting,
};

// CLI: node city-spending.js list [citizenId] | pause <cardId> | close <cardId> | fa-status
if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  (async () => {
    if (cmd === 'list') {
      console.log(JSON.stringify(listCardsForCitizen(arg), null, 2));
    } else if (cmd === 'pause' && arg) {
      console.log(JSON.stringify(await pauseCard(arg), null, 2));
    } else if (cmd === 'close' && arg) {
      console.log(JSON.stringify(await closeCard(arg), null, 2));
    } else if (cmd === 'fa-status') {
      const id = await getFinancialAccountId();
      const fa = await stripeForm(`${STRIPE_V2_BASE_URL}/money_management/financial_accounts/${id}`, null, { method: 'GET', v2: true });
      console.log(JSON.stringify(fa, null, 2));
    } else {
      console.error('Usage: node city-spending.js list [citizenId] | pause <cardId> | close <cardId> | fa-status');
      process.exit(1);
    }
  })().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}
