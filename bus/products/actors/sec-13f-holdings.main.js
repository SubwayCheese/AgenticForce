'use strict';
const { Actor } = require('apify');
const { parse13FInfoTable, diffHoldings } = require('./core.js');
const { fetchLatest13F } = require('./fetch.js');

(async () => {
  await Actor.init();
  const input = (await Actor.getInput()) || {};
  const ciks = [...new Set((input.ciks || ['1067983']).map((c) => String(c).replace(/\D/g, '')).filter(Boolean))].slice(0, 10);
  const maxRows = Math.min(Math.max(Number(input.maxRowsPerFiler) || 100, 1), 2000);
  const userAgent = input.contactEmail ? `AgentVault EDGAR Tools ${input.contactEmail}` : 'AgentVault EDGAR Tools https://apify.com/subwaycheese';
  let stop = false;
  for (const cik of ciks) {
    if (stop) break;
    let xmls;
    try { xmls = await fetchLatest13F(cik, { userAgent, count: input.compareWithPreviousQuarter === false ? 1 : 2 }); }
    catch (err) { await Actor.pushData({ cik, error: err.message }); continue; }
    if (!xmls.length) { await Actor.pushData({ cik, error: 'No 13F-HR information table found' }); continue; }
    const current = parse13FInfoTable(xmls[0]);
    const rows = xmls[1] ? diffHoldings(parse13FInfoTable(xmls[1]), current) : current.map((r) => ({ ...r, status: 'current' }));
    rows.sort((a, b) => Math.abs(b.sharesDelta || b.valueUsd || 0) - Math.abs(a.sharesDelta || a.valueUsd || 0));
    for (const row of rows.slice(0, maxRows)) {
      const charge = await Actor.charge({ eventName: 'position-returned' });
      if (charge.eventChargeLimitReached) { stop = true; break; }
      await Actor.pushData({ cik, ...row });
    }
  }
  await Actor.exit();
})();
