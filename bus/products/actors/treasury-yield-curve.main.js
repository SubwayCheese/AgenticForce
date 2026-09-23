'use strict';
const { Actor } = require('apify');
const { parseYieldCurveXml, curveSignals } = require('./core.js');
const { fetchYieldCurveXml } = require('./fetch.js');

(async () => {
  await Actor.init();
  const input = (await Actor.getInput()) || {};
  const year = Number(input.year) || new Date().getUTCFullYear();
  const maxDays = Math.min(Math.max(Number(input.maxDays) || 30, 1), 400);
  const userAgent = input.contactEmail ? `AgentVault Treasury Tools ${input.contactEmail}` : 'AgentVault Treasury Tools https://apify.com/subwaycheese';
  const rows = parseYieldCurveXml(await fetchYieldCurveXml(year, { userAgent })).slice(-maxDays);
  if (!rows.length) { await Actor.pushData({ year, error: 'No yield-curve rows returned for that year' }); await Actor.exit(); return; }
  for (let i = 0; i < rows.length; i++) {
    const charge = await Actor.charge({ eventName: 'day-returned' });
    if (charge.eventChargeLimitReached) break;
    await Actor.pushData({ date: rows[i].date, ...rows[i].rates, signals: curveSignals(rows.slice(0, i + 1)) });
  }
  await Actor.setValue('SUMMARY', { generatedAt: new Date().toISOString(), latest: curveSignals(rows), note: 'Public U.S. Treasury data as-is. Not investment advice.' });
  await Actor.exit();
})();
