#!/usr/bin/env node
// validate-agent-config.js -- checks a bus/scripts/agents/<id>.json config
// against the shape agent-engine.js actually requires, before anyone
// trusts it to dispatch a real task. Exists because the scaffold's whole
// point is that adding an agent means writing a config by hand -- and a
// hand-written config can have a typo, a missing field, or a mode this
// version of the engine doesn't support, silently, until it fails at
// dispatch time against a real task (or worse, half-succeeds in a
// confusing way). This is a fast, no-live-call check to catch that
// before the real (slow, live) dispatch tests in run-verification-suite.js.
//
// Usage:
//   node validate-agent-config.js <agent_id>     -- validate one config
//   node validate-agent-config.js --all          -- validate every config
//     found in bus/scripts/agents/
//
// Deliberately does NOT dispatch a live call or check that the binary is
// actually installed/authenticated -- that's what
// run-verification-suite.js's testEnginePerAgentDispatch is for. This
// script only checks the config's own internal shape.

const path = require('path');
const { loadAgentConfig, listAgentConfigs } = require('./agent-engine.js');

const REQUIRED_TOP_LEVEL_FIELDS = {
  id: 'string',
  displayName: 'string',
  binary: 'string',
  isWindowsCmdWrapper: 'boolean',
  outputMethod: 'string',
  promptDelivery: 'string',
  boundaryTestMethod: 'string',
  modes: 'object',
};

const VALID_OUTPUT_METHODS = new Set(['file', 'stdout']);
const VALID_PROMPT_DELIVERY = new Set(['stdin']); // only method implemented so far -- see note below if this ever grows
const VALID_BOUNDARY_TEST_METHODS = new Set(['shell', 'write-tool']); // must match run-verification-suite.js's BOUNDARY_TEST_PROMPT_BUILDERS keys
const REQUIRED_MODES = ['readOnly', 'write'];

function validate(agentId) {
  const problems = [];
  const config = loadAgentConfig(agentId);
  if (!config) {
    return { ok: false, problems: [`no config file found for "${agentId}" (looked for bus/scripts/agents/${agentId}.json)`] };
  }

  for (const [field, expectedType] of Object.entries(REQUIRED_TOP_LEVEL_FIELDS)) {
    if (!(field in config)) {
      problems.push(`missing required field "${field}"`);
      continue;
    }
    const actualType = typeof config[field];
    if (actualType !== expectedType) {
      problems.push(`field "${field}" should be ${expectedType}, got ${actualType}`);
    }
  }

  if (config.id && config.id !== agentId) {
    problems.push(`config's own "id" field ("${config.id}") does not match its filename ("${agentId}.json") -- task files' to: value must match the filename, so a mismatch here is a real footgun`);
  }

  if (config.outputMethod && !VALID_OUTPUT_METHODS.has(config.outputMethod)) {
    problems.push(`outputMethod "${config.outputMethod}" is not one agent-engine.js supports (${[...VALID_OUTPUT_METHODS].join(', ')})`);
  }

  if (config.promptDelivery && !VALID_PROMPT_DELIVERY.has(config.promptDelivery)) {
    problems.push(`promptDelivery "${config.promptDelivery}" is not one agent-engine.js supports (${[...VALID_PROMPT_DELIVERY].join(', ')}) -- note: only stdin delivery has ever been implemented/tested; a future agent needing positional-arg delivery would need real engine work, not just a config value`);
  }

  if (config.boundaryTestMethod && !VALID_BOUNDARY_TEST_METHODS.has(config.boundaryTestMethod)) {
    problems.push(`boundaryTestMethod "${config.boundaryTestMethod}" has no matching prompt builder in run-verification-suite.js (known: ${[...VALID_BOUNDARY_TEST_METHODS].join(', ')}) -- the suite's sandbox boundary test would fail loudly, but only when actually run, not at config-load time`);
  }

  if (config.modes) {
    for (const mode of REQUIRED_MODES) {
      if (!config.modes[mode]) {
        problems.push(`modes.${mode} is missing -- both readOnly and write are required even if write is never actually dispatched for this agent, since run-task-generic.js and the verification suite both assume both exist`);
        continue;
      }
      if (!Array.isArray(config.modes[mode].args)) {
        problems.push(`modes.${mode}.args must be an array of strings`);
      } else if (config.outputMethod === 'file' && !config.modes[mode].args.includes('{outputFile}')) {
        problems.push(`outputMethod is "file" but modes.${mode}.args has no "{outputFile}" placeholder -- agent-engine.js will create a temp file but nothing will tell the binary where to write it`);
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

function main() {
  const args = process.argv.slice(2);
  const targets = args.includes('--all') ? listAgentConfigs() : args.filter((a) => !a.startsWith('--'));

  if (targets.length === 0) {
    console.error('Usage: node validate-agent-config.js <agent_id> | --all');
    console.error(`Known configs: ${listAgentConfigs().join(', ') || '(none found)'}`);
    process.exit(1);
  }

  let allOk = true;
  for (const agentId of targets) {
    const result = validate(agentId);
    if (result.ok) {
      console.log(`PASS -- ${agentId}`);
    } else {
      allOk = false;
      console.log(`FAIL -- ${agentId}`);
      for (const p of result.problems) console.log(`  - ${p}`);
    }
  }

  if (!allOk) process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = { validate };
