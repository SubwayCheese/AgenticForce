// mechanisms/alpaca-live-equity.js -- mechanism-interface descriptor for
// live Alpaca equity/ETF trading, the one mechanism built for v1 (see
// ARCHITECTURE.md section 19). This file is DELIBERATELY thin -- it's the
// discovery/availability descriptor mechanism-registry.js auto-discovers,
// not the trading client itself (that's survive-alpaca-live-client.js,
// required directly by survive-executor.js, never through this registry).

const secretsBroker = require('../secrets-broker.js');

const REQUIRED_SECRET_NAMES = ['ALPACA_SURVIVE_LIVE_KEY', 'ALPACA_SURVIVE_LIVE_SECRET', 'ALPACA_SURVIVE_LIVE_ENDPOINT'];

module.exports = {
  id: 'alpaca-live-equity',
  displayName: 'Live Alpaca equity/ETF trading',
  requiredSecretNames: REQUIRED_SECRET_NAMES,
  // Existence-only check via secretsBroker.hasSecret() -- never reads or
  // returns a secret's value, since this result ends up rendered on a
  // status page (city-status.js).
  isAvailable() {
    return REQUIRED_SECRET_NAMES.every((name) => secretsBroker.hasSecret(name));
  },
};
