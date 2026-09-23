// mechanisms/kalshi-event-contracts.js -- mechanism-interface descriptor for
// Kalshi event-contract trading. This only exposes availability to the
// mechanism registry; a separately reviewed client must perform API calls.

const secretsBroker = require('../../platform/secrets-broker.js');

const REQUIRED_SECRET_NAMES = [
  'KALSHI_SURVIVE_API_KEY_ID',
  'KALSHI_SURVIVE_PRIVATE_KEY_PEM',
  'KALSHI_SURVIVE_ENDPOINT',
];

module.exports = {
  id: 'kalshi-event-contracts',
  displayName: 'Kalshi event-contract prediction markets',
  requiredSecretNames: REQUIRED_SECRET_NAMES,
  // Existence-only check: secret values must never reach status output.
  isAvailable() {
    return REQUIRED_SECRET_NAMES.every((name) => secretsBroker.hasSecret(name));
  },
};
