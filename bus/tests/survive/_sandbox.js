// _sandbox.js -- credit-free, network-free, live-state-free test harness.
//
// Every module resolves its paths from bus/lib/paths.js (two levels above bus/lib), so copying the code directories into a
// throwaway root re-roots EVERY path (bus/*.jsonl, tasks/, agents/, mechanisms/) with zero changes to the modules under
// test. Nothing here can touch live ledgers, the real tasks/ tree, or secrets (bus/secrets.local.json is never copied).
// ntfy.js is replaced with a recording stub and any outbound network attempt throws.
//
// SAFETY (Round 25 review): symlinks are NEVER copied (fs.cpSync would turn relative compat links into absolute links to the
// live tree, and the ntfy stub write would then go THROUGH the link and overwrite live code), and after the copy the sandbox
// is checked so no path inside it resolves outside it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const REAL_BUS = path.resolve(__dirname, '..', '..');
const CODE_DIRS = ['lib', 'platform', 'ops', 'fleet', 'city', 'swarm', 'revenue'];

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

function assertContained(root) {
  const real = fs.realpathSync(root);
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) throw new Error(`sandbox contains a symlink: ${p}`);
      if (e.isDirectory()) walk(p);
    }
  })(real);
}

function makeSandbox() {
  blockNetwork();
  globalThis.__ntfyCalls = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'survive-sbx-'));
  for (const d of CODE_DIRS) {
    fs.cpSync(path.join(REAL_BUS, d), path.join(root, 'bus', d), {
      recursive: true,
      filter: (src) => !fs.lstatSync(src).isSymbolicLink() && !/\.proposed(\.meta)?\.(js|json)$/.test(src),
    });
  }
  fs.writeFileSync(path.join(root, 'bus', 'platform', 'ntfy.js'), NTFY_STUB);
  fs.mkdirSync(path.join(root, 'tasks', 'survive'), { recursive: true });
  assertContained(root);
  const locations = JSON.parse(fs.readFileSync(path.join(root, 'bus', 'lib', 'locations.json'), 'utf8'));
  return {
    root,
    dir: (...p) => path.join(root, 'bus', ...p),
    load: (name) => {
      const file = name.endsWith('.js') ? name : `${name}.js`;
      if (!locations[file]) throw new Error(`sandbox load: ${file} is not in bus/lib/locations.json`);
      return require(path.join(root, 'bus', locations[file]));
    },
    file: (...p) => path.join(root, ...p),
    ntfyCalls: () => globalThis.__ntfyCalls,
    // Point the sandboxed codex agent config at a fake executable so the real dispatch code path runs without real codex.
    useFakeCodex(scriptBody) {
      const bin = path.join(root, 'fake-codex.sh');
      fs.writeFileSync(bin, `#!/bin/sh\n${scriptBody}\n`, { mode: 0o755 });
      const cfgPath = path.join(root, 'bus', 'platform', 'agents', 'codex.json');
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

module.exports = { makeSandbox, seedCitizen, REAL_BUS };
