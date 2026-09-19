// mechanism-registry.js -- auto-discovery for revenue mechanisms a
// "survive" citizen can choose among (ARCHITECTURE.md section 19). Same
// config-per-file discovery pattern already proven by
// bus/scripts/agents/*.json (auto-discovered by agent-engine.js) -- a new
// mechanism under bus/scripts/mechanisms/ needs ZERO edits here.
//
// This module never touches money and never calls a mechanism's own
// trading client -- it only answers "which mechanisms currently have
// working credentials," via each module's own isAvailable() (which itself
// only checks secret EXISTENCE via secretsBroker.hasSecret(), never reads
// a value).

const fs = require('fs');
const path = require('path');

const MECHANISMS_DIR = path.join(__dirname, 'mechanisms');

function listMechanismModules() {
  if (!fs.existsSync(MECHANISMS_DIR)) return [];
  return fs.readdirSync(MECHANISMS_DIR)
    // Round 17 fix, cross-review-caught real bug: .endsWith('.js') alone
    // also matches "*.proposed.js" -- a proposal is explicitly meant to
    // stay inert until a human reviews and renames it (see
    // survive-mechanism-research.js's own header), but was already being
    // require()'d unconditionally here, kept out of the real "available"
    // list only by its secrets not existing yet -- an accident, not a
    // real safety boundary. Never scan/load a proposal file.
    .filter((f) => f.endsWith('.js') && !f.endsWith('.proposed.js'))
    .map((f) => require(path.join(MECHANISMS_DIR, f)))
    .filter((m) => m && m.id && typeof m.isAvailable === 'function');
}

// { id, displayName, requiredSecretNames } for every mechanism whose
// required secrets all currently exist -- what a citizen's mission-decision
// step actually gets to choose among right now.
function listAvailableMechanisms() {
  return listMechanismModules()
    .filter((m) => m.isAvailable())
    .map((m) => ({ id: m.id, displayName: m.displayName, requiredSecretNames: m.requiredSecretNames }));
}

module.exports = { listMechanismModules, listAvailableMechanisms };

// CLI: node mechanism-registry.js
if (require.main === module) {
  console.log(JSON.stringify({ all: listMechanismModules().map((m) => m.id), available: listAvailableMechanisms() }, null, 2));
}
