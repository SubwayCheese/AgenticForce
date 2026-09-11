#!/usr/bin/env node
// refresh-crypto-universe.js -- re-derives crypto-universe.json from
// Alpaca's live tradable-crypto-assets list. Manual/periodic, like
// fleet-universe.json's own "edit by hand" convention -- NOT fetched live
// on every symbol check (crypto-symbols.js's isCryptoSymbol()/etc. run
// synchronously in hot paths across execute-portfolio-setup.js/
// monitor-paper-trades.js/conditional-triggers.js; an async live fetch
// there would need a much bigger refactor for a listing-change cadence
// that doesn't actually need it -- crypto listings change over
// days/weeks, not per-check).
//
// Usage: node refresh-crypto-universe.js [--apply]
//   No flag: prints the diff against the current file, changes nothing.
//   --apply: writes the new list for real.

const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');

const UNIVERSE_PATH = path.join(__dirname, 'crypto-universe.json');

// Pegged/stablecoin instruments -- near-zero volatility by design, not
// real candidates for a momentum/trend screening formula. Reviewed by a
// human each time this list changes, not auto-derived from any API flag
// (Alpaca doesn't expose a "is this a stablecoin" field).
const EXCLUDE_COINS = new Set(['USDC', 'USDT', 'USDG', 'PAXG']);

async function main() {
  const assets = await alpaca.apiRequest('GET', '/assets?asset_class=crypto&status=active');
  const coins = Array.from(new Set(
    assets
      .filter((a) => a.tradable && a.symbol.endsWith('/USD'))
      .map((a) => a.symbol.replace('/USD', ''))
      .filter((c) => !EXCLUDE_COINS.has(c))
  )).sort();

  const current = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8')).coins;
  const added = coins.filter((c) => !current.includes(c));
  const removed = current.filter((c) => !coins.includes(c));

  console.log(`Live Alpaca universe: ${coins.length} coins.`);
  if (added.length) console.log(`Would ADD: ${added.join(', ')}`);
  if (removed.length) console.log(`Would REMOVE: ${removed.join(', ')}`);
  if (!added.length && !removed.length) console.log('No changes.');

  if (process.argv.includes('--apply')) {
    const data = {
      _comment: `Real, tradable-on-Alpaca USD-quoted crypto coins, refreshed ${new Date().toISOString().slice(0, 10)} via refresh-crypto-universe.js. Excluded pegged/stablecoin instruments: ${Array.from(EXCLUDE_COINS).join(', ')}.`,
      coins,
    };
    fs.writeFileSync(UNIVERSE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log('Applied.');
  } else if (added.length || removed.length) {
    console.log('(dry run -- pass --apply to write this)');
  }
}

if (require.main === module) {
  main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}

module.exports = { main, EXCLUDE_COINS };
