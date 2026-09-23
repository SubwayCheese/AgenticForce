// Financial Modeling Prep REST client -- UNUSED as of 2026-09-11.
// generate-pilot-tasks.js's data-snapshot step now runs on
// alpaca-client.js's getDailyBars() (free, same paper-account key already
// configured, no new signup) + finnhub-client.js's free tier for equity
// market cap, after the user pushed back on paying for FMP to cover this
// call volume ("There has to be a free alternative" -- see project memory
// feedback_explore_alternatives). Nothing in this codebase requires this
// file anymore.
//
// Kept, not deleted: FMP's data is genuinely deeper (forward estimates,
// peer comps, cleaner valuation multiples) than the free Alpaca+Finnhub
// combo, and this client is fully written and matches FMP's REST API
// (crypto endpoints confirmed real and separate from equity's via the FMP
// MCP connector 2026-09-10/11 -- see getCryptoQuote()/
// getCryptoHistoricalPriceEod() below). This is the natural upgrade path
// once the pilot is generating revenue and paying ~$20-30/mo for better
// data is worth it -- not before. Add FMP_API_KEY to
// bus/secrets.local.json and swap it back into generate-pilot-tasks.js
// when that day comes; nothing here has changed shape in the meantime.

const secretsBroker = require('../platform/secrets-broker.js');

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

// Real-time quote for one or more equity symbols (comma-separated). Stock
// endpoint only -- crypto uses the dedicated getCryptoQuote() below, a
// real, separate FMP endpoint family (confirmed live via the FMP MCP
// connector's own tool 2026-09-10/11: cryptocurrency-quote is distinct
// from the equity /quote endpoint, not a shared one this function's old
// comment assumed without ever having tested it).
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

// Crypto quote -- FMP's no-slash format (e.g. "BTCUSD", via
// crypto-symbols.js's toFmpSymbol()). A real, separate endpoint from
// equity's /quote, confirmed via the MCP connector's cryptocurrency-quote
// tool this session -- not exercised against fmp-client.js's own REST
// path yet (same not-yet-live-tested caveat as the rest of this file
// until FMP_API_KEY exists).
function getCryptoQuote(symbol) {
  return apiRequest('/cryptocurrency-quote', { symbol });
}

// Crypto daily close history -- same shape/purpose as getHistoricalPriceEod(),
// separate endpoint (cryptocurrency-historical-price-eod-light).
function getCryptoHistoricalPriceEod(symbol, from, to) {
  return apiRequest('/cryptocurrency-historical-price-eod-light', { symbol, from, to });
}

module.exports = { loadConfig, hasCredentials, apiRequest, getQuote, getHistoricalPriceEod, getProfile, getCryptoQuote, getCryptoHistoricalPriceEod };
