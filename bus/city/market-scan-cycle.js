#!/usr/bin/env node
// market-scan-cycle.js -- Round 27. Oneshot: run the real market scan, write the cache. Mirrors
// research-swarm-cycle.js's shape exactly -- its own process, its own cadence, isolated from
// survive-supervisor.js's per-wake path. NOT scheduled/installed (see INSTALL-PENDING.md convention:
// deploy units are written but never auto-installed).
//
// Usage: node bus/city/market-scan-cycle.js

const marketScan = require('./survive-market-scan.js');
const { SURVIVE_CANDIDATE_UNIVERSE } = require('./survive-supervisor.js');

function log(msg) { console.log(`[market-scan] ${msg}`); }

async function runCycle() {
  log(`scanning for candidates beyond the baseline (${SURVIVE_CANDIDATE_UNIVERSE.join(', ')})...`);
  const result = await marketScan.runMarketScan({ existingUniverse: SURVIVE_CANDIDATE_UNIVERSE });
  if (result.error) { log(`scan failed: ${result.error} -- cache NOT updated, next mission falls back to baseline-only`); process.exit(1); }
  marketScan.writeScanCache(result);
  log(`wrote ${result.symbols.length} candidate(s): ${result.symbols.join(', ') || '(none proposed this cycle -- a legitimate result)'}`);
}

if (require.main === module) runCycle().catch((err) => { console.error('[market-scan] FAILED:', err.message); process.exit(1); });

module.exports = { runCycle };
