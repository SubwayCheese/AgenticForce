// survive-email.js -- email capability for the "survive" branch
// (ARCHITECTURE.md section 19, rounds 2, 5, and 6).
//
// ROUND 6, direct user instruction, explicit reversal of round 2's rule:
// "None I want 0 approval gates. Once they have their money I want 0
// approval gates they are their own entity." Round 2's send-approval
// gate (requestSend() -> human approveSend() -> executeSend()) is
// REMOVED entirely. sendEmail() now drafts AND sends in one call, no
// human step, ever. The full send is still logged for audit purposes
// (every send is traceable, with its purpose/rationale) -- that's
// record-keeping, not a gate; nothing about it blocks or requires a
// human action before the send happens.
//
// ROUND 5 (unchanged by round 6): inbox creation is genuinely autonomous
// via AgentMail -- an email API provider built specifically for AI
// agents (real API shape fetched from AgentMail's own docs, not
// guessed). One human signup for a single AgentMail developer account +
// API key is the entire remaining human step, ever -- after that,
// getOrCreateInboxForCitizen() creates every future citizen's own inbox
// via a real API call, no human involvement.
//
// Real, honest constraint, not silently ignored: AgentMail's free tier
// caps at 3 inboxes total. Fine for the founder and its first couple of
// citizens; the city needs a paid AgentMail tier once it grows past that.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const secretsBroker = require('../platform/secrets-broker.js');
const cityRegistry = require('./city-registry.js');

const VAULT_ROOT = avPaths.ROOT;
let LOG_PATH = path.join(VAULT_ROOT, 'bus', 'survive-email.jsonl');
const AGENTMAIL_BASE_URL = 'https://api.agentmail.to/v0';

function nowIso() {
  return new Date().toISOString();
}

// Test-only hook, same pattern as survive-budget-envelope.js/city-bank.js.
function _setLogPathForTesting(p) {
  LOG_PATH = p;
}

function readAllEvents() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

function appendEvent(record) {
  const entry = { ts: nowIso(), ...record };
  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}

// Manual override/recovery tool -- e.g. a citizen already has a
// non-AgentMail address for some reason. Not the expected path; see
// getOrCreateInboxForCitizen() below for the normal one.
function registerEmailAccount(citizenId, address, provider, { note } = {}) {
  if (!citizenId || !address) throw new Error('registerEmailAccount requires citizenId and address');
  return appendEvent({ type: 'email-account-registered', citizenId, address, provider: provider || null, note: note || null });
}

function getRegisteredAccount(citizenId) {
  const events = readAllEvents().filter((e) => e.type === 'email-account-registered' && e.citizenId === citizenId);
  return events.length ? events[events.length - 1] : null;
}

// No human step, ever, after the one AgentMail developer account exists.
// Idempotent: returns the existing inbox if this citizen already has
// one, otherwise calls AgentMail's real POST /inboxes API and records
// the result. Omits username/domain to get an auto-assigned address on
// AgentMail's shared free-tier domain (matches the real, fetched API
// shape -- both fields are optional).
async function getOrCreateInboxForCitizen(citizenId) {
  const existing = getRegisteredAccount(citizenId);
  if (existing) return existing;

  const apiKey = secretsBroker.loadSecret('SURVIVE_AGENTMAIL_API_KEY');
  if (!apiKey) {
    throw new Error('AgentMail not configured -- need SURVIVE_AGENTMAIL_API_KEY in bus/secrets.local.json (one human signup covers every future citizen, see this file\'s header)');
  }

  const res = await fetch(`${AGENTMAIL_BASE_URL}/inboxes`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: citizenId, client_id: citizenId }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AgentMail POST /inboxes -> ${res.status}: ${text}`);
  const parsed = JSON.parse(text);

  return appendEvent({ type: 'email-account-registered', citizenId, address: parsed.email, provider: 'agentmail', inboxId: parsed.inbox_id, note: 'auto-created via AgentMail API' });
}

// The citizen-facing function -- drafts AND sends in one call, no human
// step. Ensures an inbox exists first (creating one if needed), then
// calls AgentMail's real send API. Every send is still logged in full
// (to/subject/body/purpose/messageId) for audit purposes -- record-
// keeping, not a gate.
async function sendEmail(citizenId, { to, subject, body, purpose } = {}) {
  if (!citizenId || !to || !subject || !body) throw new Error('sendEmail requires citizenId, to, subject, and body');
  const citizen = cityRegistry.getCitizen(citizenId);
  if (citizen && citizen.quarantined) {
    throw new Error(`${citizenId} is quarantined -- cannot send email (${citizen.quarantineReason || 'no reason recorded'})`);
  }
  const account = await getOrCreateInboxForCitizen(citizenId);

  const apiKey = secretsBroker.loadSecret('SURVIVE_AGENTMAIL_API_KEY');
  if (!apiKey) throw new Error('AgentMail not configured -- need SURVIVE_AGENTMAIL_API_KEY in bus/secrets.local.json');

  const res = await fetch(`${AGENTMAIL_BASE_URL}/inboxes/${encodeURIComponent(account.inboxId)}/messages/send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, text: body }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AgentMail POST /inboxes/${account.inboxId}/messages/send -> ${res.status}: ${text}`);
  const parsed = JSON.parse(text);

  appendEvent({ type: 'send-executed', citizenId, to, subject, bodySent: body, purpose: purpose || null, messageId: parsed.message_id || null, threadId: parsed.thread_id || null });
  return { sent: true, messageId: parsed.message_id || null };
}

function listSentByCitizen(citizenId, limit = 20) {
  return readAllEvents()
    .filter((e) => e.type === 'send-executed' && (!citizenId || e.citizenId === citizenId))
    .slice(-limit);
}

module.exports = {
  LOG_PATH,
  AGENTMAIL_BASE_URL,
  readAllEvents,
  registerEmailAccount,
  getRegisteredAccount,
  getOrCreateInboxForCitizen,
  sendEmail,
  listSentByCitizen,
  _setLogPathForTesting,
};

// CLI: node survive-email.js sent [citizenId] | register-account <citizenId> <address> [provider]
if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  (async () => {
    if (cmd === 'sent') {
      console.log(JSON.stringify(listSentByCitizen(rest[0]), null, 2));
    } else if (cmd === 'register-account' && rest[0] && rest[1]) {
      const result = registerEmailAccount(rest[0], rest[1], rest[2]);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('Usage: node survive-email.js sent [citizenId] | register-account <citizenId> <address> [provider]');
      process.exit(1);
    }
  })().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}
