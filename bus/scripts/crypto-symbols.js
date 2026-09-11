// crypto-symbols.js -- the single place that knows both symbol
// conventions for every coin this pipeline can trade. Expanded 2026-09-11
// from a fixed 3-coin table (BTC/ETH/XRP) to the full real, currently-
// tradable-on-Alpaca universe (see crypto-universe.json,
// refresh-crypto-universe.js) -- direct user request to scan a much wider
// crypto market while staying within what's actually tradable, not a
// general asset-class registry.
//
// Alpaca's order-placement format is slash-delimited ("BTC/USD"); FMP's
// crypto research/quote format is not ("BTCUSD"). Confirmed live against
// all 36 of Alpaca's real tradable USD crypto pairs 2026-09-11: this
// "<COIN>/USD" / "<COIN>USD" pattern holds for every one of them, so the
// original 3-entry hardcoded table generalizes to the full universe
// mechanically, not by adding entries one at a time. Every other file
// should call through here rather than re-deriving the format inline, so
// the mismatch stays a one-place fact.

const fs = require('fs');
const path = require('path');

const UNIVERSE_PATH = path.join(__dirname, 'crypto-universe.json');
const COINS = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8')).coins;

const CRYPTO_ASSETS = COINS.map((coin) => ({ coin, alpacaSymbol: `${coin}/USD`, fmpSymbol: `${coin}USD` }));

function normalize(s) {
  return String(s || '').toUpperCase().replace(/[\/\s]/g, '');
}

function findAsset(symbolOrCoin) {
  const n = normalize(symbolOrCoin); // "BTC/USD" -> "BTCUSD", "btc" -> "BTC"
  return CRYPTO_ASSETS.find((a) => n === a.coin || n === normalize(a.alpacaSymbol) || n === a.fmpSymbol) || null;
}

function isCryptoSymbol(symbol) {
  return !!findAsset(symbol);
}

function toAlpacaSymbol(symbolOrCoin) {
  const asset = findAsset(symbolOrCoin);
  if (!asset) throw new Error(`Not a known crypto symbol/coin: ${symbolOrCoin}`);
  return asset.alpacaSymbol;
}

function toFmpSymbol(symbolOrCoin) {
  const asset = findAsset(symbolOrCoin);
  if (!asset) throw new Error(`Not a known crypto symbol/coin: ${symbolOrCoin}`);
  return asset.fmpSymbol;
}

module.exports = { CRYPTO_ASSETS, isCryptoSymbol, toAlpacaSymbol, toFmpSymbol };
