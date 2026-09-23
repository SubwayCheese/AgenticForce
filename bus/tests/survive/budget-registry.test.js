const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSandbox, seedCitizen } = require('./_sandbox.js');

test('profit split: sub-cent profit is a safe no-op deposit, normal and asymmetric splits are exact', () => {
  const sbx = makeSandbox();
  const envelope = sbx.load('survive-budget-envelope');
  const bank = sbx.load('city-bank');
  const reserve = sbx.load('city-reserve');
  seedCitizen(sbx, 'C1');
  const tiny = envelope.recordRealizedProfitSplit('C1', 0.003913515060000705, { mechanism: 'm', sourceRef: 't1' });
  assert.equal(tiny.split, true);
  assert.equal(tiny.reserveCut, 0);
  assert.equal(tiny.bankCut, 0);
  assert.equal(reserve.getReserveBalanceUsd(), 0);
  assert.equal(bank.getBankBalanceUsd(), 0);
  const norm = envelope.recordRealizedProfitSplit('C1', 100, { mechanism: 'm', sourceRef: 't2' });
  assert.deepEqual([norm.reserveCut, norm.bankCut, norm.citizenShareUsd], [20, 15, 65]);
  assert.equal(envelope.recordRealizedProfitSplit('C1', -5, {}).split, false);
  const asym = envelope.recordRealizedProfitSplit('C1', 0.03, {});
  assert.deepEqual([asym.reserveCut, asym.bankCut], [0.01, 0]);
  assert.equal(reserve.getReserveBalanceUsd(), 20.01);
  assert.equal(bank.getBankBalanceUsd(), 15);
  sbx.cleanup();
});

test('mechanism-registry never requires *.proposed.js files', () => {
  const sbx = makeSandbox();
  const dir = sbx.dir('city', 'mechanisms');
  fs.mkdirSync(dir, { recursive: true });
  // A proposal that would throw (and could be malicious) if it were ever required.
  fs.writeFileSync(path.join(dir, 'evil.proposed.js'), "throw new Error('proposed file was required'); ");
  const reg = sbx.load('mechanism-registry');
  const ids = reg.listMechanismModules().map((m) => m.id);
  assert.ok(ids.includes('alpaca-live-equity'));
  assert.ok(!ids.some((i) => /evil/.test(i)));
  sbx.cleanup();
});
