// survive-alpaca-live-client.js -- LIVE (real money, non-paper) Alpaca
// client for the "survive" city-bank branch (ARCHITECTURE.md section 19).
// Deliberately a SEPARATE file from alpaca-client.js, not a refactor and
// not a shared helper module between them -- the duplication is the
// safety feature. alpaca-client.js's hard paper-only guard protects the
// existing, still-paper-only fleet/crypto trading pilots; that file is
// NEVER modified, weakened, or reused for this branch.
//
// Equities/ETFs only (no crypto branch -- decided mechanism is live
// equity/ETF trading only), long-only (a ~$50-100 cash account realistically
// can't get margin approval to short anyway -- explicit policy here, not an
// accident). Reads ALPACA_SURVIVE_LIVE_KEY/ALPACA_SURVIVE_LIVE_SECRET/
// ALPACA_SURVIVE_LIVE_ENDPOINT -- three names, never the existing paper
// ones (ALPACA_API_KEY/ALPACA_API_SECRET/ALPACA_ENDPOINT).
//
// ONE shared live account serves every citizen (see ARCHITECTURE.md
// section 19 and survive-budget-envelope.js's header for why) -- this
// client has no per-citizen state of its own; submitOrder() takes a
// citizenId argument purely to run that citizen's own budget-envelope gate
// before an opening trade, nothing more.

const secretsBroker = require('./secrets-broker.js');
const budgetEnvelope = require('./survive-budget-envelope.js');

function loadConfig() {
  const key = secretsBroker.loadSecret('ALPACA_SURVIVE_LIVE_KEY');
  const secret = secretsBroker.loadSecret('ALPACA_SURVIVE_LIVE_SECRET');
  const endpoint = secretsBroker.loadSecret('ALPACA_SURVIVE_LIVE_ENDPOINT');
  if (!key || !secret || !endpoint) {
    throw new Error('Live Alpaca credentials not fully configured in bus/secrets.local.json (need ALPACA_SURVIVE_LIVE_KEY, ALPACA_SURVIVE_LIVE_SECRET, ALPACA_SURVIVE_LIVE_ENDPOINT)');
  }
  if (endpoint.includes('paper-api.alpaca.markets')) {
    throw new Error(`Refusing to run the LIVE survive client against the paper host: ${endpoint}. This client is real money by construction.`);
  }
  if (!endpoint.includes('api.alpaca.markets')) {
    throw new Error(`ALPACA_SURVIVE_LIVE_ENDPOINT does not look like a real Alpaca host: ${endpoint}`);
  }
  return { key, secret, endpoint };
}

async function apiRequest(method, urlPath, body) {
  const { key, secret, endpoint } = loadConfig();
  const res = await fetch(`${endpoint}${urlPath}`, {
    method,
    headers: {
      'APCA-API-KEY-ID': key,
      'APCA-API-SECRET-KEY': secret,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
  if (!res.ok) {
    const msg = parsed && parsed.message ? parsed.message : text;
    throw new Error(`Live Alpaca API ${method} ${urlPath} -> ${res.status}: ${msg}`);
  }
  return parsed;
}

// Market-data host is the SAME for live and paper (data.alpaca.markets),
// but this client's own key/secret authenticate against it -- a citizen's
// research/decision step should use THIS client's quote, not
// alpaca-client.js's, to avoid any accidental coupling to the paper
// account's entitlements. Empirical unknown, flagged in the plan: whether
// live-tier market-data entitlements differ from paper's -- verify once
// real keys exist, don't assume.
async function getLatestQuote(symbol) {
  const { key, secret } = loadConfig();
  const url = `https://data.alpaca.markets/v2/stocks/quotes/latest?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret } });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
  if (!res.ok) {
    const msg = parsed && parsed.message ? parsed.message : text;
    throw new Error(`Live Alpaca market-data GET ${url} -> ${res.status}: ${msg}`);
  }
  const quote = parsed.quotes && parsed.quotes[symbol];
  if (!quote) throw new Error(`No live quote returned for ${symbol} (${url})`);
  const bid = Number(quote.bp), ask = Number(quote.ap);
  const mid = (bid && ask) ? (bid + ask) / 2 : (ask || bid);
  return { symbol, bid, ask, mid, raw: quote };
}

function getAccount() {
  return apiRequest('GET', '/account');
}

function getPositions() {
  return apiRequest('GET', '/positions');
}

function getOrders(status = 'all') {
  return apiRequest('GET', `/orders?status=${encodeURIComponent(status)}`);
}

function getOrder(orderId) {
  return apiRequest('GET', `/orders/${encodeURIComponent(orderId)}`);
}

// Round 15: real asset metadata (tradable/fractionable/status) and the
// real market clock -- read-only, used to ground research in verified
// facts instead of LLM-guessed ones.
function getAsset(symbol) {
  return apiRequest('GET', `/assets/${encodeURIComponent(symbol)}`);
}

function getClock() {
  return apiRequest('GET', '/clock');
}

// Long-only, always: a "sell" is only ever valid as intent:"close" (exiting
// an existing long). Explicit policy, not an accident -- see file header.
function assertLongOnlyOrder({ side, intent }) {
  if (side === 'sell' && intent !== 'close') {
    throw new Error('survive-alpaca-live-client.js is long-only: a "sell" is only valid with intent:"close" (exiting an existing long), never to open a short.');
  }
}

const CLIENT_ORDER_ID_MAX = 128;
function normalizeClientOrderId(raw) {
  const cleaned = String(raw).replace(/[^A-Za-z0-9._-]/g, '-');
  return cleaned.length <= CLIENT_ORDER_ID_MAX ? cleaned : cleaned.slice(-CLIENT_ORDER_ID_MAX);
}

// setup: { citizenId, symbol, direction: "long"|"short" (short is always
// intent:"close", i.e. exiting a long -- see assertLongOnlyOrder), qty?,
// notional?, orderType?, limitPrice?, stopPrice?, timeInForce?, intent?:
// "open"|"close", clientOrderId? }
// THE gate: an OPENING buy (intent !== 'close', direction 'long') runs
// citizenId's own checkLifetimeBudgetEnvelope() FIRST, as the very first
// thing this function does, no exceptions -- structural, not a caller's
// responsibility to remember. A closing sell never needs the gate: it only
// ever returns cash to a citizen, never spends it.
async function submitOrder({ citizenId, symbol, direction, qty, notional, orderType = 'market', limitPrice, stopPrice, timeInForce = 'day', intent = 'open', clientOrderId }) {
  if (!citizenId) throw new Error('submitOrder requires citizenId');
  if (!symbol || !direction) throw new Error('submitOrder requires symbol and direction');
  if ((qty == null) === (notional == null)) throw new Error('submitOrder requires exactly one of qty or notional, not both/neither');
  const side = direction === 'long' ? 'buy' : direction === 'short' ? 'sell' : null;
  if (!side) throw new Error(`direction must be "long" or "short", got: ${direction}`);
  assertLongOnlyOrder({ side, intent });

  const isOpeningBuy = side === 'buy' && intent !== 'close';
  if (isOpeningBuy) {
    const notionalUsd = notional != null ? Number(notional) : null;
    const gate = await budgetEnvelope.checkLifetimeBudgetEnvelope(citizenId, { newOrderNotionalUsd: notionalUsd || 0 });
    if (!gate.ok) {
      throw new Error(`Budget envelope refused this order for citizen ${citizenId}: ${gate.reasons.join('; ')}`);
    }
  }

  const body = { symbol, side, type: orderType, time_in_force: timeInForce };
  if (clientOrderId) body.client_order_id = normalizeClientOrderId(clientOrderId);
  if (qty != null) body.qty = String(qty);
  if (notional != null) body.notional = String(notional);
  if (orderType === 'limit') {
    if (!limitPrice) throw new Error('limitPrice required for a limit order');
    body.limit_price = String(limitPrice);
  }
  if (orderType === 'stop' || orderType === 'stop_limit') {
    if (!stopPrice) throw new Error('stopPrice required for a stop/stop_limit order');
    body.stop_price = String(stopPrice);
    if (orderType === 'stop_limit') {
      if (!limitPrice) throw new Error('limitPrice required for a stop_limit order');
      body.limit_price = String(limitPrice);
    }
  }
  return apiRequest('POST', '/orders', body);
}

function cancelOrder(orderId) {
  return apiRequest('DELETE', `/orders/${encodeURIComponent(orderId)}`);
}

module.exports = {
  loadConfig, apiRequest, getLatestQuote, getAccount, getPositions, getOrders, getOrder,
  getAsset, getClock,
  submitOrder, cancelOrder, assertLongOnlyOrder, normalizeClientOrderId, CLIENT_ORDER_ID_MAX,
};

// CLI: node survive-alpaca-live-client.js account|positions|orders|asset <SYM>|clock
if (require.main === module) {
  const cmd = process.argv[2];
  const run = {
    account: getAccount, positions: getPositions, orders: () => getOrders(),
    asset: () => getAsset(process.argv[3]), clock: getClock,
  }[cmd];
  if (!run || (cmd === 'asset' && !process.argv[3])) {
    console.error('Usage: node survive-alpaca-live-client.js account|positions|orders|asset <SYM>|clock');
    process.exit(1);
  }
  run().then((r) => console.log(JSON.stringify(r, null, 2))).catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
