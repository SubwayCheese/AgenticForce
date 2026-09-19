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

// Market-data API lives on a different host than the trading API
// (data.alpaca.markets vs paper-api.alpaca.markets) but uses the SAME
// key/secret -- added for conditional-triggers.js's price-trigger checking,
// which needs a live quote independent of the FMP connector (FMP_API_KEY
// isn't configured yet -- see fmp-client.js -- and Alpaca is the execution
// venue anyway, the more honest source of truth for "would this order fill
// near this price right now"). No new credential, no new paper-only guard
// needed: this is a read-only quote lookup, not an order-placement path,
// and the same paper-account key that already can't touch a live account.
async function getLatestQuote(symbol) {
  const { key, secret } = loadConfig();
  const isCrypto = cryptoSymbols.isCryptoSymbol(symbol);
  const url = isCrypto
    ? `https://data.alpaca.markets/v1beta3/crypto/us/latest/quotes?symbols=${encodeURIComponent(cryptoSymbols.toAlpacaSymbol(symbol))}`
    : `https://data.alpaca.markets/v2/stocks/quotes/latest?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret },
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
  if (!res.ok) {
    const msg = parsed && parsed.message ? parsed.message : text;
    throw new Error(`Alpaca market-data GET ${url} -> ${res.status}: ${msg}`);
  }
  const bucket = parsed.quotes; // same response field either way -- only the lookup key differs by asset class
  const key2 = isCrypto ? cryptoSymbols.toAlpacaSymbol(symbol) : symbol;
  const quote = bucket && bucket[key2];
  if (!quote) throw new Error(`No live quote returned for ${symbol} (${url})`);
  // Midpoint of bid/ask -- a real, checkable proxy for "current price," not
  // last-trade (which can be stale during low-volume moments).
  const bid = Number(quote.bp), ask = Number(quote.ap);
  const mid = (bid && ask) ? (bid + ask) / 2 : (ask || bid);
  return { symbol, bid, ask, mid, raw: quote };
}

// Historical daily bars, batched (one call for the whole universe, not one
// per symbol) -- the free substitute for FMP's historical-price-eod. Same
// data.alpaca.markets host/auth as getLatestQuote(), same paper-account
// key, no new credential. Added 2026-09-11 after the user pushed back on
// paying for FMP ("There has to be a free alternative") -- Alpaca's market
// data API is free with the existing paper account and was already half-
// wired via getLatestQuote(), so this closes the historical-data gap
// without any new signup. `feed: 'iex'` is required for equities on
// Alpaca's free data plan (the SIP feed needs a paid subscription; IEX is
// free and sufficient for daily bars, which aren't time-sensitive the way
// a live quote is). Crypto has no feed restriction.
// Returns { [symbol]: { bars, lastClose, chgPct, avgVolume } | null },
// keyed by the ORIGINAL symbols passed in (not the Alpaca-format string),
// so equity tickers and crypto coin names both round-trip unchanged.
async function getDailyBars(symbols, { limit = 25 } = {}) {
  if (!symbols || !symbols.length) return {};
  const { key, secret } = loadConfig();
  const isCrypto = cryptoSymbols.isCryptoSymbol(symbols[0]);
  const alpacaSymbols = isCrypto ? symbols.map((s) => cryptoSymbols.toAlpacaSymbol(s)) : symbols;
  const base = isCrypto
    ? 'https://data.alpaca.markets/v1beta3/crypto/us/bars'
    : 'https://data.alpaca.markets/v2/stocks/bars';
  // `start` is NOT optional in practice: confirmed live 2026-09-11 that
  // omitting it makes the endpoint default to "today only" (empty result
  // before today's bar has formed) rather than "the last `limit` bars" --
  // so compute one explicitly. Factor of 1.6 calendar days per trading
  // day comfortably covers weekends/holidays for both asset classes (the
  // extra bars beyond `limit` for crypto, which trades every day, are
  // harmless -- the response is still sliced to what's actually needed
  // by the caller).
  const startDate = new Date(Date.now() - Math.ceil(limit * 1.6) * 24 * 60 * 60 * 1000);
  const baseParams = { symbols: alpacaSymbols.join(','), timeframe: '1Day', start: startDate.toISOString().slice(0, 10), limit: String(Math.max(limit, 1000)), sort: 'asc' };
  if (!isCrypto) baseParams.feed = 'iex';

  // This endpoint paginates by total bars across ALL requested symbols,
  // not per-symbol -- confirmed live 2026-09-11: a 50-symbol/210-day
  // request came back with only 5 symbols and a next_page_token on page
  // 1, silently dropping the other 45 when that token wasn't followed.
  // Page through until exhausted rather than trusting one page to cover
  // the whole universe.
  const bucket = {};
  let pageToken = null;
  do {
    const params = new URLSearchParams(baseParams);
    if (pageToken) params.set('page_token', pageToken);
    const url = `${base}?${params.toString()}`;
    const res = await fetch(url, { headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret } });
    const text = await res.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
    if (!res.ok) {
      const msg = parsed && parsed.message ? parsed.message : text;
      throw new Error(`Alpaca market-data GET ${url} -> ${res.status}: ${msg}`);
    }
    for (const [sym, bars] of Object.entries((parsed && parsed.bars) || {})) {
      bucket[sym] = (bucket[sym] || []).concat(bars);
    }
    pageToken = parsed && parsed.next_page_token;
  } while (pageToken);
  const out = {};
  for (let i = 0; i < symbols.length; i++) {
    const bars = bucket[alpacaSymbols[i]] || [];
    if (!bars.length) { out[symbols[i]] = null; continue; }
    const last = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2] : last;
    const chgPct = prev.c ? ((last.c - prev.c) / prev.c) * 100 : 0;
    // Always a ~20-trading-day window regardless of how many bars were
    // requested -- callers fetching a longer window (e.g. for 50/200-day
    // price averages) shouldn't silently dilute this into a multi-month
    // average.
    const recent = bars.slice(-20);
    const avgVolume = recent.reduce((s, b) => s + (b.v || 0), 0) / recent.length;
    out[symbols[i]] = { bars, lastClose: last.c, chgPct, avgVolume };
  }
  return out;
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
// real market clock -- read-only. Mirrored independently in
// survive-alpaca-live-client.js (deliberately never shared).
function getAsset(symbol) {
  return apiRequest('GET', `/assets/${encodeURIComponent(symbol)}`);
}

function getClock() {
  return apiRequest('GET', '/clock');
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

// Alpaca's client_order_id is the broker's OWN idempotency key: it must be
// unique per account, and a second POST /orders carrying an id that already
// exists is rejected (422) rather than filled a second time. Added
// 2026-09-11 as the second layer under execute-portfolio-setup.js's
// app-level duplicate-position check -- the real VZ incident (two entries
// ~2h apart from two different round-3 cycles) got past the app layer
// because nothing keyed on the position itself, and there was no broker
// layer at all to stop it. Alpaca documents a 128-character limit and
// accepts a plain ASCII string, so this normalizes to that: anything
// outside [A-Za-z0-9._-] becomes '-', and an over-long id keeps its TAIL
// rather than its head. Tail, because execute-portfolio-setup.js's derived
// ids put the discriminating part last (the symbol on an entry id, the lot
// uuid on a stop id) behind a long, low-entropy sourceTask prefix -- head
// truncation is the direction that would manufacture collisions. Today's
// real ids run ~60 chars, so this path is a guard, not a routine one.
const CLIENT_ORDER_ID_MAX = 128;
function normalizeClientOrderId(raw) {
  const cleaned = String(raw).replace(/[^A-Za-z0-9._-]/g, '-');
  return cleaned.length <= CLIENT_ORDER_ID_MAX ? cleaned : cleaned.slice(-CLIENT_ORDER_ID_MAX);
}

// setup: { symbol, direction: "long"|"short", qty?, notional?, orderType?:
//          "market"|"limit"|"stop", limitPrice?, stopPrice?, timeInForce?: "day"|"gtc",
//          intent?: "open"|"close", clientOrderId?: string }
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
function submitOrder({ symbol, direction, qty, notional, orderType = 'market', limitPrice, stopPrice, timeInForce = 'day', intent = 'open', clientOrderId }) {
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
  // Optional and additive: every existing caller that doesn't pass one keeps
  // its current behavior exactly (Alpaca generates its own id server-side).
  if (clientOrderId) body.client_order_id = normalizeClientOrderId(clientOrderId);
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

module.exports = { loadConfig, apiRequest, getLatestQuote, getDailyBars, getAccount, getPositions, getOrders, getOrder, getAsset, getClock, submitOrder, cancelOrder, assertNotCryptoShortEntry, normalizeClientOrderId, CLIENT_ORDER_ID_MAX };

// CLI: node alpaca-client.js account|positions|orders|asset <SYM>|clock
if (require.main === module) {
  const cmd = process.argv[2];
  const run = {
    account: getAccount,
    positions: getPositions,
    orders: () => getOrders(),
    asset: () => getAsset(process.argv[3]),
    clock: getClock,
  }[cmd];
  if (!run || (cmd === 'asset' && !process.argv[3])) {
    console.error('Usage: node alpaca-client.js account|positions|orders|asset <SYM>|clock');
    process.exit(1);
  }
  run().then((r) => console.log(JSON.stringify(r, null, 2))).catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
