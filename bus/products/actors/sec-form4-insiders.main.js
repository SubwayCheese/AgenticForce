'use strict';
const { Actor } = require('apify');
const { parseForm4Xml, summarizeByTicker } = require('./core.js');
const { fetchRecentForm4 } = require('./fetch.js');

(async () => {
  await Actor.init();
  const input = (await Actor.getInput()) || {};
  const tickers = [...new Set((input.tickers || ['AAPL']).map((t) => String(t).trim().toUpperCase()).filter(Boolean))].slice(0, 25);
  const limit = Math.min(Math.max(Number(input.filingsPerTicker) || 5, 1), 20);
  const userAgent = input.contactEmail ? `AgentVault EDGAR Tools ${input.contactEmail}` : 'AgentVault EDGAR Tools https://apify.com/subwaycheese';
  const filings = [];
  let stop = false;
  for (const ticker of tickers) {
    if (stop) break;
    let xmls;
    try { xmls = await fetchRecentForm4(ticker, { userAgent, limit }); }
    catch (err) { await Actor.pushData({ ticker, error: err.message }); continue; }
    for (const xml of xmls) {
      const filing = parseForm4Xml(xml);
      const charge = await Actor.charge({ eventName: 'filing-parsed' });
      if (charge.eventChargeLimitReached) { stop = true; break; }
      filings.push(filing);
      for (const tx of filing.transactions) {
        await Actor.pushData({ ticker: filing.issuer.ticker || ticker, issuer: filing.issuer.name, insider: (filing.owners[0] || {}).name || null, insiderRole: (filing.owners[0] || {}).officerTitle || ((filing.owners[0] || {}).isDirector ? 'Director' : null), ...tx });
      }
    }
  }
  await Actor.setValue('SUMMARY', { generatedAt: new Date().toISOString(), byTicker: summarizeByTicker(filings), note: 'Public SEC filings as-is. Not investment advice.' });
  await Actor.exit();
})();
