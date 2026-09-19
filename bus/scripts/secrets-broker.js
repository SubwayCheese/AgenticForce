#!/usr/bin/env node
// secrets-broker.js -- Phase 3 piece 4: the credential/secrets broker
// boundary. Closes a real, demonstrated gap: today, anything in a
// task's payload ends up in plaintext forever in bus/log.md's "Sent
// (exact)" block and the task file itself. There's no way to give a
// dispatched task access to a credential without that credential
// getting logged in full. This module is the plumbing for that -- no
// real external service is wired up yet (nothing needs one today,
// confirmed with the user 2026-09-02); this is built and tested
// synthetically, ready for whenever a real one is needed.
//
// Storage: bus/secrets.local.json (gitignored, never committed), flat
// {"NAME": "value"}. See bus/secrets.local.json.example for the format.
// Missing file is NOT an error -- just means no secrets are configured
// yet, same "degrade gracefully" posture vault-search.js already has
// for its own optional dependency.
//
// Two separate concerns, both here:
//   - loadSecret()/loadAllSecrets(): read access, used by
//     run-task.js's resolveSecretRequirement() to build an env overlay
//     for a dispatched subprocess.
//   - redactSecrets(): write-side safety net, called automatically
//     inside run-task.js's appendLog()/writeTaskResult() (not by each
//     dispatch script individually) so every persisted log entry and
//     task file is scrubbed of any currently-known secret VALUE,
//     regardless of which script produced it.

const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const SECRETS_PATH = path.join(VAULT_ROOT, 'bus', 'secrets.local.json');

function loadAllSecrets() {
  if (!fs.existsSync(SECRETS_PATH)) return {};
  try {
    const raw = fs.readFileSync(SECRETS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    // Malformed file -- degrade to "no secrets configured" rather than
    // crash every dispatch. Same posture as memory-store.js skipping a
    // malformed JSONL line.
    return {};
  }
}

function loadSecret(name) {
  const secrets = loadAllSecrets();
  return Object.prototype.hasOwnProperty.call(secrets, name) ? secrets[name] : null;
}

// Existence-only check, deliberately distinct from loadSecret(name) !==
// null -- added for mechanism-registry.js's isAvailable() checks, whose
// result ends up rendered on a status page. "Does this exist" should never
// require a caller to discard a value it technically had access to.
function hasSecret(name) {
  return Object.prototype.hasOwnProperty.call(loadAllSecrets(), name);
}

// Literal substring replacement, not regex -- safe against a secret
// value containing regex-special characters (a real risk: API keys and
// tokens routinely contain +, /, [, ], etc.). A no-op, cheap, when no
// secrets are configured.
function redactSecrets(text) {
  const secrets = loadAllSecrets();
  let result = String(text == null ? '' : text);
  for (const [name, value] of Object.entries(secrets)) {
    if (!value) continue;
    result = result.split(value).join(`[REDACTED:${name}]`);
  }
  return result;
}

module.exports = { loadSecret, hasSecret, loadAllSecrets, redactSecrets, SECRETS_PATH };
