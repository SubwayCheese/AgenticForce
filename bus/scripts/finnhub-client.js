// Finnhub REST client -- free-tier source for equity market cap, the one
// field Alpaca's market-data API doesn't carry (it has price/volume, not
// fundamentals). Added 2026-09-11 alongside alpaca-client.js's getDailyBars()
// after the user pushed back on paying for FMP ("There has to be a free
// alternative"): Finnhub's free tier (60 calls/min) comfortably covers a
// 50-symbol daily screen with real ticker-keyed profile data, no ID-mapping
// ambiguity the way a crypto market-cap source would need. See project
// memory feedback_explore_alternatives -- free options first, paid ones
// saved as a later upgrade.
//
// Same secrets-broker.js discipline as every other credential in this
// vault: FINNHUB_API_KEY lives in bus/secrets.local.json, never logged.
// This is OPTIONAL, not a hard requirement -- generate-pilot-tasks.js
// degrades gracefully (marketCap: 0, screenScore's 20% cap weight
// contributes nothing) if it's absent, same posture fmp-client.js had for
// the whole pipeline. Sign up free at finnhub.io to enable it.

const secretsBroker = require('./secrets-broker.js');

const BASE_URL = 'https://finnhub.io/api/v1';

function loadConfig() {
  const key = secretsBroker.loadSecret('FINNHUB_API_KEY');
  return { key };
}

function hasCredentials() {
  return !!loadConfig().key;
}

async function apiRequest(urlPath, params) {
  const { key } = loadConfig();
  if (!key) {
    throw new Error('FINNHUB_API_KEY not configured in bus/secrets.local.json -- optional, see finnhub-client.js header.');
  }
  const qs = new URLSearchParams({ ...(params || {}), token: key });
  const res = await fetch(`${BASE_URL}${urlPath}?${qs.toString()}`);
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
  if (!res.ok) {
    const msg = parsed && parsed.error ? parsed.error : text;
    throw new Error(`Finnhub API GET ${urlPath} -> ${res.status}: ${msg}`);
  }
  return parsed;
}

// Company profile -- marketCapitalization is in MILLIONS of USD (Finnhub's
// documented unit, not raw dollars like FMP's mktCap -- callers must
// multiply by 1e6 to normalize against the rest of this codebase's
// dollar-denominated marketCap fields).
function getProfile2(symbol) {
  return apiRequest('/stock/profile2', { symbol });
}

module.exports = { loadConfig, hasCredentials, apiRequest, getProfile2 };
