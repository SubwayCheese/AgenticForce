// Financial Modeling Prep REST client -- closes the one real gap in making
// the trading pilots' data-snapshot step unattended (see ARCHITECTURE.md
// section 9 and generate-pilot-tasks.js). Every prior data-snapshot task
// (fleet_pilot_*_universe50_consolidation.md, crypto_pilot_*_data_snapshot.md)
// was hand-typed by an interactive Claude session using the FMP MCP
// connector -- a headless script has no MCP client to call, so this talks
// to FMP's own REST API directly instead. Mirrors alpaca-client.js's shape
// on purpose: same loadConfig()/apiRequest() pattern, same "credential
// comes from bus/secrets.local.json via secrets-broker.js, never logged"
// discipline.
//
// IMPORTANT, stated plainly: FMP_API_KEY does not exist in this vault yet
// (confirmed by a direct secrets-broker read -- see the autonomy design
// notes in ARCHITECTURE.md section 9). Every function below is written
// against FMP's public v3 REST documentation, matching the endpoints the
// MCP connector's own tool names describe (quote, historical-price-eod,
// stock-screener), but has NOT been exercised against a live key -- that
// verification happens once you add FMP_API_KEY to bus/secrets.local.json.
// Until then, generate-pilot-tasks.js's data-snapshot step degrades
// gracefully (see hasCredentials()) rather than silently producing
// unverified numbers.

const secretsBroker = require('./secrets-broker.js');

const BASE_URL = 'https://financialmodelingprep.com/stable';

function loadConfig() {
  const key = secretsBroker.loadSecret('FMP_API_KEY');
  return { key };
}

function hasCredentials() {
  return !!loadConfig().key;
}

async function apiRequest(urlPath, params) {
  const { key } = loadConfig();
  if (!key) {
    throw new Error('FMP_API_KEY not configured in bus/secrets.local.json -- see fmp-client.js header for why this is a real, named gap, not a bug.');
  }
  const qs = new URLSearchParams({ ...(params || {}), apikey: key });
  const res = await fetch(`${BASE_URL}${urlPath}?${qs.toString()}`);
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
  if (!res.ok) {
    const msg = parsed && parsed.message ? parsed.message : text;
    throw new Error(`FMP API GET ${urlPath} -> ${res.status}: ${msg}`);
  }
  return parsed;
}

// Real-time quote for one or more equity symbols (comma-separated), or one
// crypto pair in FMP's no-slash format (e.g. BTCUSD).
function getQuote(symbols) {
  return apiRequest('/quote', { symbol: symbols });
}

// Daily close history, most-recent-first, for computeScreenScore() and for
// the 30-day trend figures every real thesis prompt cites (30-day return,
// daily stdev, max up/down day, max drawdown, up/down day count).
function getHistoricalPriceEod(symbol, from, to) {
  return apiRequest('/historical-price-eod/light', { symbol, from, to });
}

// Company profile (market cap, sector) -- used for the 20%-scale leg of
// computeScreenScore().
function getProfile(symbol) {
  return apiRequest('/profile', { symbol });
}

module.exports = { loadConfig, hasCredentials, apiRequest, getQuote, getHistoricalPriceEod, getProfile };
