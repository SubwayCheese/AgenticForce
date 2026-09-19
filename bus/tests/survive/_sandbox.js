// _sandbox.js -- credit-free, network-free, live-state-free test harness.
//
// Every survive/city module resolves its paths from __dirname (VAULT_ROOT =
// two levels up), so copying bus/scripts/ into a throwaway directory
// re-roots EVERY path (bus/*.jsonl, tasks/, agents/, mechanisms/) with zero
// changes to the modules under test. Nothing here can touch the live
// ledgers, the real tasks/ tree the shared queue daemon watches, or
// secrets (bus/secrets.local.json is never copied). ntfy.js is replaced
// with a recording stub and any outbound network attempt throws.

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const REAL_SCRIPTS = path.resolve(__dirname, '..', '..', 'scripts');

const NTFY_STUB = `
globalThis.__ntfyCalls = globalThis.__ntfyCalls || [];
module.exports = {
  sendNtfy: async (m) => { globalThis.__ntfyCalls.push(m); return { ok: true, stub: true }; },
  sanitizeForNtfy: (t) => String(t == null ? '' : t),
};
`;

function blockNetwork() {
  globalThis.fetch = () => { throw new Error('TEST NETWORK BLOCKED: fetch called'); };
  net.Socket.prototype.connect = function () { throw new Error('TEST NETWORK BLOCKED: socket connect'); };
}

function makeSandbox() {
  blockNetwork();
  globalThis.__ntfyCalls = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'survive-sbx-'));
  const scripts = path.join(root, 'bus', 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  fs.cpSync(REAL_SCRIPTS, scripts, { recursive: true, filter: (src) => !/\.proposed(\.meta)?\.(js|json)$/.test(src) });
  fs.writeFileSync(path.join(scripts, 'ntfy.js'), NTFY_STUB);
  fs.mkdirSync(path.join(root, 'tasks', 'survive'), { recursive: true });
  return {
    root,
    scripts,
    load: (name) => require(path.join(scripts, name.endsWith('.js') ? name : `${name}.js`)),
    file: (...p) => path.join(root, ...p),
    ntfyCalls: () => globalThis.__ntfyCalls,
    // Point the sandboxed codex agent config at a fake executable so the
    // real dispatch code path runs end to end without real codex.
    useFakeCodex(scriptBody) {
      const bin = path.join(root, 'fake-codex.sh');
      fs.writeFileSync(bin, `#!/bin/sh\n${scriptBody}\n`, { mode: 0o755 });
      const cfgPath = path.join(scripts, 'agents', 'codex.json');
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      cfg.binary = bin;
      fs.writeFileSync(cfgPath, JSON.stringify(cfg));
      return bin;
    },
    cleanup() { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {} },
  };
}

// Minimal citizen setup shared by several tests.
function seedCitizen(sbx, citizenId, { genesis = 50 } = {}) {
  const registry = sbx.load('city-registry');
  const envelope = sbx.load('survive-budget-envelope');
  registry.registerCitizen({ citizenId, role: 'citizen', genesisAllocationUsd: genesis, mechanism: 'alpaca-live-equity' });
  envelope.recordGenesisFunding(citizenId, genesis);
  return { registry, envelope };
}

module.exports = { makeSandbox, seedCitizen, REAL_SCRIPTS };
