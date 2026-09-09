// Alpaca paper-trading REST client -- the execution layer for the trading-fleet
// pilot's paper phase (fleet_pilot_20260903, see tasks/trading_fleet_scoping_plan.md
// and ARCHITECTURE.md for the fuller design). Credentials come from
// bus/secrets.local.json via secrets-broker.js -- same discipline as every other
// secret in this vault: never logged, never written into a task file's Result
// block, only read directly into memory here.
//
// This is PAPER-ONLY by construction: the endpoint is loaded from
// ALPACA_ENDPOINT (currently https://paper-api.alpaca.markets/v2) and nothing in
// this file accepts or constructs a different host. There is deliberately no
// "live mode" flag or switch anywhere in this module -- per the standing
// decision (see project memory / ARCHITECTURE.md): real-money execution is a
// separate, deliberate future decision, not a flag flip on this code.

const secretsBroker = require('./secrets-broker.js');
const cryptoSymbols = require('./crypto-symbols.js');

function loadConfig() {
  const key = secretsBroker.loadSecret('ALPACA_API_KEY');
  const secret = secretsBroker.loadSecret('ALPACA_API_SECRET');
  const endpoint = secretsBroker.loadSecret('ALPACA_ENDPOINT');
  if (!key || !secret || !endpoint) {
    throw new Error('Alpaca credentials not fully configured in bus/secrets.local.json (need ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_ENDPOINT)');
  }
  if (!endpoint.includes('paper-api.alpaca.markets')) {
    // Hard guard, not just a convention: refuse to run against anything that
    // isn't Alpaca's documented paper host, so a mistyped/edited endpoint in
    // secrets.local.json can never silently point this at a live account.
    throw new Error(`ALPACA_ENDPOINT does not look like Alpaca's paper API host: ${endpoint}`);
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
    throw new Error(`Alpaca API ${method} ${urlPath} -> ${res.status}: ${msg}`);
  }
  return parsed;
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

// Crypto on this account is confirmed live as spot/cash-settled/long-only
// (every crypto asset returned shortable:false, margin_requirement_long:100
// -- no short side exists at all). Guarding on orderType alone is NOT
// enough to distinguish "opening a new short" from "a plain market sell
// that closes an existing long" -- both are side:"sell", orderType:"market"
// (found live: monitor-paper-trades.js's time-based exit is exactly this
// case, and got wrongly blocked before intent was added). The caller must
// say which one it is via `intent`; the guard only blocks an actual open.
// Exported (pure, no network) so it can be unit-tested directly without
// ever reaching submitOrder()'s real HTTP call -- see run-verification-suite.js's
// testCryptoNoShortGuardFast().
function assertNotCryptoShortEntry({ symbol, side, intent }) {
  if (side === 'sell' && intent !== 'close' && cryptoSymbols.isCryptoSymbol(symbol)) {
    throw new Error(`Cannot open a short position in ${symbol}: crypto is spot/long-only on this account (shortable:false, confirmed live) -- no short side exists for BTC/ETH/XRP.`);
  }
}

// setup: { symbol, direction: "long"|"short", qty?, notional?, orderType?:
//          "market"|"limit"|"stop", limitPrice?, stopPrice?, timeInForce?: "day"|"gtc",
//          intent?: "open"|"close" }
// Deliberately takes an explicit qty/notional -- this module has no
// position-sizing logic of its own (that's a separate, later decision per
// the approved plan; see ARCHITECTURE.md). Callers must supply exactly one
// of qty (share/coin count) or notional (dollar amount) -- notional exists
// because crypto trades in fractional/continuous sizes (Alpaca confirmed
// live: BTC min order ~0.0000126, ~$1) where a share-count is the wrong unit;
// equity callers should keep using qty.
// NOTE on "direction" for orders that CLOSE an existing position (e.g. a
// buy-stop that closes a short, or a market sell that closes a long): pass
// the side you want the order to transact, not the position's original
// direction, AND pass intent:"close" (matters for crypto's no-short guard
// above; harmless no-op for equities, which have no such guard). direction:
// "long" -> side "buy" (closes a short, or opens/adds a long). direction:
// "short" -> side "sell" (closes a long, or opens/adds a short).
function submitOrder({ symbol, direction, qty, notional, orderType = 'market', limitPrice, stopPrice, timeInForce = 'day', intent = 'open' }) {
  if (!symbol || !direction) {
    throw new Error('submitOrder requires symbol and direction');
  }
  if ((qty == null) === (notional == null)) {
    throw new Error('submitOrder requires exactly one of qty or notional, not both/neither');
  }
  const side = direction === 'long' ? 'buy' : direction === 'short' ? 'sell' : null;
  if (!side) throw new Error(`direction must be "long" or "short", got: ${direction}`);
  assertNotCryptoShortEntry({ symbol, side, intent });
  const body = {
    symbol,
    side,
    type: orderType,
    time_in_force: timeInForce,
  };
  if (qty != null) body.qty = String(qty);
  if (notional != null) body.notional = String(notional);
  if (orderType === 'limit') {
    if (!limitPrice) throw new Error('limitPrice required for a limit order');
    body.limit_price = String(limitPrice);
  }
  if (orderType === 'stop') {
    if (!stopPrice) throw new Error('stopPrice required for a stop order');
    body.stop_price = String(stopPrice);
  }
  if (orderType === 'stop_limit') {
    if (!stopPrice || !limitPrice) throw new Error('stopPrice and limitPrice both required for a stop_limit order');
    body.stop_price = String(stopPrice);
    body.limit_price = String(limitPrice);
  }
  return apiRequest('POST', '/orders', body);
}

function cancelOrder(orderId) {
  return apiRequest('DELETE', `/orders/${encodeURIComponent(orderId)}`);
}

module.exports = { loadConfig, apiRequest, getAccount, getPositions, getOrders, getOrder, submitOrder, cancelOrder, assertNotCryptoShortEntry };

// CLI: node alpaca-client.js account|positions|orders
if (require.main === module) {
  const cmd = process.argv[2];
  const run = {
    account: getAccount,
    positions: getPositions,
    orders: () => getOrders(),
  }[cmd];
  if (!run) {
    console.error('Usage: node alpaca-client.js account|positions|orders');
    process.exit(1);
  }
  run().then((r) => console.log(JSON.stringify(r, null, 2))).catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
