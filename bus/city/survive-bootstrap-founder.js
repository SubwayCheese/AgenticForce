#!/usr/bin/env node
// survive-bootstrap-founder.js -- the one-time, human-run command that
// actually founds the city (ARCHITECTURE.md section 19). Wires together
// three functions that existed separately but had no combined CLI entry
// point: cityRegistry.registerCitizen(), budgetEnvelope.recordGenesisFunding(),
// cityBank.recordGenesisProvenance().
//
// Deliberately refuses to run more than once -- this is the founder ONLY
// (citizen C1, foundedByLeaderId: null). A later citizen is always
// created by a leader's executeSpawn(), never by this script.
//
// Usage: node survive-bootstrap-founder.js <amountUsd>
//   Run this AFTER: (1) the real live Alpaca account is open, KYC'd, and
//   funded with exactly this amount, (2) ALPACA_SURVIVE_LIVE_KEY/_SECRET/
//   _ENDPOINT are in bus/secrets.local.json. This script does not touch
//   Alpaca at all -- it only records the ledger/registry entries; it
//   trusts you that the real deposit already landed.

const cityRegistry = require('./city-registry.js');
const budgetEnvelope = require('./survive-budget-envelope.js');
const cityBank = require('./city-bank.js');

function main() {
  const amountUsd = Number(process.argv[2]);
  if (!(amountUsd > 0)) {
    console.error('Usage: node survive-bootstrap-founder.js <amountUsd>');
    process.exit(1);
  }
  if (cityRegistry.listCitizens().length > 0) {
    console.error('A citizen already exists -- this city has already been founded. This script is founder-only and refuses to run twice. A new citizen after the founder is always created via a leader\'s spawn, not this script.');
    process.exit(1);
  }

  const citizenId = 'C1';
  cityRegistry.registerCitizen({
    citizenId,
    status: 'active',
    role: 'citizen', // promoted to leader automatically on the next survive-supervisor.js wake, once it's the only citizen (ratio math: 1 citizen -> target 1 leader)
    foundedByLeaderId: null,
    managedByLeaderId: null,
    fundingSource: 'human-genesis',
    genesisAllocationUsd: amountUsd,
    mechanism: null, // chosen by the citizen itself on its first mission
  });
  budgetEnvelope.recordGenesisFunding(citizenId, amountUsd, { note: 'founder, human-funded', source: 'human' });
  cityBank.recordGenesisProvenance(citizenId, amountUsd, { note: 'founder genesis' });

  console.log(`City founded. Citizen ${citizenId}, $${amountUsd.toFixed(2)}, hard cap, no re-supply.`);
  console.log('Next: run survive-supervisor.js on a schedule (or once, manually, to test) -- it will promote C1 to leader on its first wake (ratio math: 1 active citizen -> 1 target leader), then author C1\'s first research/decision mission.');
}

main();
