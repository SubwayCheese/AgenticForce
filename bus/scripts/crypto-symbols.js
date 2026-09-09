// crypto-symbols.js -- the single place that knows both symbol
// conventions in play for the 3 crypto assets this pipeline trades
// (BTC/ETH/XRP only -- a flat hardcoded table, not a general
// asset-class registry, matching the deliberately narrow scope).
// Alpaca's order-placement format is slash-delimited ("BTC/USD");
// FMP's crypto research/quote format is not ("BTCUSD"). Every other
// file should call through here rather than re-deriving the format
// inline, so the mismatch stays a one-place fact.

const CRYPTO_ASSETS = [
  { coin: 'BTC', alpacaSymbol: 'BTC/USD', fmpSymbol: 'BTCUSD' },
  { coin: 'ETH', alpacaSymbol: 'ETH/USD', fmpSymbol: 'ETHUSD' },
  { coin: 'XRP', alpacaSymbol: 'XRP/USD', fmpSymbol: 'XRPUSD' },
];

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
