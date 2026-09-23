'use strict';
// bus/lib/paths.js -- the single place that knows where things live. Zero dependencies except path and the generated
// locations.json (script name -> bus/<domain>/<file>, written by build-system-map.js). Phase 2/3: defaults only, no environment
// overrides yet. Later phases relocate state/logs/config by changing only this file.
const path = require('path');
const locations = require('./locations.json');

const ROOT = path.resolve(__dirname, '..', '..');
const BUS = path.join(ROOT, 'bus');

function script(name) {
  const rel = locations[name];
  if (!rel) throw new Error(`avPaths.script: unknown script "${name}" (not in bus/lib/locations.json)`);
  return path.join(BUS, rel);
}

module.exports = Object.freeze({
  ROOT,
  BUS,
  SCRIPTS: path.join(BUS, 'scripts'), // compat symlinks only; real code lives in bus/<domain>/
  TASKS: path.join(ROOT, 'tasks'),
  DEPLOY: path.join(BUS, 'deploy'),
  PRODUCTS_REPO: path.resolve(ROOT, '..', 'AgentVault-products'),
  AGENTS_CONFIG: path.join(BUS, 'platform', 'agents'),
  MECHANISMS: path.join(BUS, 'city', 'mechanisms'),
  bus: (...parts) => path.join(BUS, ...parts),
  task: (...parts) => path.join(ROOT, 'tasks', ...parts),
  script,
  fleetData: (name) => path.join(BUS, 'fleet', 'data', name),
});
