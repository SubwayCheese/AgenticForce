// survive-market-data.js -- Round 19. Small READ-ONLY market-data client for
// shadow scoring. Deliberately separate from alpaca-client.js (fleet-owned,
// protected): that client's getDailyBars() returns RAW unadjusted bars and
// has no `end`/`adjustment` params. T-bill/bond ETFs return most of their
// yield as distributions, so raw closes would score SGOV as flat-to-down.
// This client asks for adjustment=all. Data endpoint only -- no account,
// order, or position access of any kind.

const secretsBroker = require('./secrets-broker.js');

const DATA_BASE = 'https://data.alpaca.markets/v2/stocks';

// Daily bar timestamps are midnight ET expressed in UTC (04:00Z/05:00Z), so
// the UTC date part IS the ET trading date.
function toBar(b) { return { date: String(b.t).slice(0, 10), close: b.c }; }

async function getAdjustedDailyBars(symbol, { start, end, fetchFn = globalThis.fetch, keys } = {}) {
  const { key, secret } = keys || { key: secretsBroker.loadSecret('ALPACA_API_KEY'), secret: secretsBroker.loadSecret('ALPACA_API_SECRET') };
  const bars = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({ timeframe: '1Day', adjustment: 'all', feed: 'iex', limit: '10000', sort: 'asc' });
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (pageToken) params.set('page_token', pageToken);
    const res = await fetchFn(`${DATA_BASE}/${encodeURIComponent(symbol)}/bars?${params}`, { headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret } });
    if (!res.ok) throw new Error(`bars ${symbol}: HTTP ${res.status}`);
    const body = await res.json();
    for (const b of body.bars || []) bars.push(toBar(b));
    pageToken = body.next_page_token || null;
  } while (pageToken);
  return bars;
}

module.exports = { getAdjustedDailyBars, toBar };
