const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { makeSandbox } = require('./_sandbox.js');

const REAL_PRODUCTS = path.resolve(__dirname, '..', '..', 'products');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('worker: args disable Bash/web/MCP; stream parser reads rate-limit windows structurally', () => {
  const sbx = makeSandbox();
  const w = sbx.load('claude-worker');
  const a = w.buildArgs({ sessionId: 'sid' }).join(' ');
  assert.match(a, /--restricted/);
  assert.match(a, /--tools Read,Write,Edit,Glob,Grep/);
  assert.match(a, /--strict-mcp-config --mcp-config {"mcpServers":{}}/);
  assert.match(a, /--permission-prompts none/);
  assert.match(a, /--session-id sid/);
  assert.match(w.buildArgs({ resume: 'r' }).join(' '), /--resume r/);
  const stream = [
    '{"type":"system","subtype":"init","session_id":"s1"}',
    '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed_warning","resetsAt":1790031600,"rateLimitType":"seven_day","utilization":0.86,"unifiedWindows":{"five_hour":{"utilization":0.5,"resetsAt":1789815000},"seven_day":{"utilization":0.86,"resetsAt":1790031600}}}}',
    'not json',
    '{"type":"result","is_error":false,"result":"done","session_id":"s1","total_cost_usd":0.05}',
  ].join('\n');
  const p = w.parseStream(stream);
  assert.equal(p.result, 'done'); assert.equal(p.sessionId, 's1'); assert.equal(p.costUsd, 0.05);
  assert.equal(p.rateLimit.status, 'allowed_warning'); assert.equal(p.rateLimit.resetsAt, 1790031600000);
  assert.equal(p.windows.seven_day.utilization, 0.86);
  sbx.cleanup();
});

test('budget: pauses until resetsAt on a limit, honours utilization thresholds and the daily cap', () => {
  const sbx = makeSandbox();
  const b = sbx.load('builder-budget');
  const d = tmp('bb-');
  b._setPathsForTesting(path.join(d, 's.json'), path.join(d, 'c.json'));
  const now = Date.now();
  assert.equal(b.canBuild({ now }).ok, true);
  b.recordRun({ windows: { seven_day: { utilization: 0.95, resetsAt: (now + 3600e3) / 1000 }, five_hour: { utilization: 0.1, resetsAt: (now + 1800e3) / 1000 } }, rateLimit: { status: 'allowed_warning' } }, { now });
  assert.equal(b.canBuild({ now, cfg: { ...b.DEFAULTS } }).ok, false, 'over the 7-day threshold');
  assert.equal(b.canBuild({ now, cfg: { ...b.DEFAULTS, maxSevenDayUtilization: 1.01 } }).ok, true, 'thresholds can be disabled');
  assert.equal(b.canBuild({ now: now + 2 * 3600e3, cfg: { ...b.DEFAULTS } }).ok, true, 'a reset window no longer blocks');
  b.recordRun({ isError: true, result: 'usage limit reached', rateLimit: { status: 'rejected', resetsAt: now + 7200e3 } }, { now });
  const denied = b.canBuild({ now, cfg: { ...b.DEFAULTS, maxSevenDayUtilization: 1.01 } });
  assert.equal(denied.ok, false); assert.equal(denied.until, now + 7200e3);
  const st = b.readState(); st.pausedUntil = 0; st.builds = {};
  for (let i = 0; i < 2; i++) b.recordRun({}, { now, countAsBuild: true });
  assert.match(b.canBuild({ now, state: { ...b.readState(), pausedUntil: 0, windows: null }, cfg: { ...b.DEFAULTS } }).reason, /daily build cap/);
  sbx.cleanup();
});

function toyProduct(dir, { good = true, extra = {} } = {}) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true }); fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'toy', version: '1.0.0', ...extra }));
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT'); fs.writeFileSync(path.join(dir, 'README.md'), '# toy');
  fs.writeFileSync(path.join(dir, 'src', 'core.js'), `exports.add = (i) => i.a + i.b${good ? '' : ' + 1'};\n`);
  fs.writeFileSync(path.join(dir, 'tests', 'core.test.js'), "const t=require('node:test'),a=require('node:assert');t('add',()=>a.equal(require('../src/core.js').add({a:1,b:2}),3));\n");
}
const toySpec = { slug: 'toy', title: 'Toy', entry: 'add', description: 'd', pricing: 'p', disclaimer: 'x', allowedHosts: ['sec.gov'], allowedDeps: [], requirements: 'add a and b', acceptance: [{ name: 'adds', input: { a: 2, b: 5 }, expect: 7 }] };

test('gate: secrets, banned code, foreign hosts, unpinned/unlisted deps, failing acceptance; clean product passes offline', () => {
  const sbx = makeSandbox();
  const g = sbx.load('product-gate');
  assert.equal(g.sandboxAvailable(), true);
  const ok = tmp('toy-'); toyProduct(ok);
  const clean = g.runGate(ok, toySpec, { literals: [] });
  assert.equal(clean.ok, true, JSON.stringify(clean.failures));
  const bad = tmp('bad-'); toyProduct(bad, { good: false, extra: { dependencies: { lodash: '^4.0.0' }, scripts: { postinstall: 'x' } } });
  fs.appendFileSync(path.join(bad, 'src', 'core.js'), "const cp=require('child_process');fetch('https://evil.example.com/x');const k='sk_live_" + 'a'.repeat(20) + "';\n");
  const r = g.runGate(bad, toySpec, { literals: [] });
  const text = r.failures.join('\n');
  assert.equal(r.ok, false);
  for (const re of [/secret-shaped/, /banned construct child_process/, /evil\.example\.com/, /postinstall/, /"lodash" is not in the allowlist/, /exact-pinned/, /acceptance: adds: \$: expected 7, got 8/]) assert.match(text, re);
  const lit = tmp('lit-'); toyProduct(lit); fs.writeFileSync(path.join(lit, 'notes.txt'), 'token=SUPERSECRETVALUE123');
  assert.ok(g.scanSecrets(lit, ['SUPERSECRETVALUE123']).some((h) => h.kind === 'secret-literal'));
  assert.equal(g.partialMatch({ a: [1, { b: 2 }] }, { a: [1, { b: 2, c: 3 }], z: 1 }), null);
  assert.match(g.partialMatch([1, 2], [1]), /expected array of 2/);
  sbx.cleanup();
});

// A fake `claude`: round 1 writes a BROKEN product, a --resume round writes the fixed one.
function fakeClaude(dir) {
  const bin = path.join(dir, 'fake-claude.sh');
  fs.writeFileSync(bin, `#!/bin/sh
cat >/dev/null
mkdir -p src tests
case "$*" in *--resume*) ADD='exports.add = (i) => i.a + i.b;';; *) ADD='exports.add = (i) => i.a + i.b + 1;';; esac
echo "$ADD" > src/core.js
echo '{"name":"toy","version":"1.0.0"}' > package.json
echo MIT > LICENSE; echo '# toy' > README.md
echo "const t=require('node:test'),a=require('node:assert');t('add',()=>a.equal(require('../src/core.js').add({a:1,b:2}),3));" > tests/core.test.js
echo '{"type":"system","subtype":"init","session_id":"fake-session"}'
echo '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":4102444800,"rateLimitType":"five_hour","utilization":0.1,"unifiedWindows":{"five_hour":{"utilization":0.1,"resetsAt":4102444800},"seven_day":{"utilization":0.2,"resetsAt":4102444800}}}}'
echo '{"type":"result","is_error":false,"result":"done","session_id":"fake-session","total_cost_usd":0.01}'
`, { mode: 0o755 });
  return bin;
}

test('builder loop: broken first round is fed back via --resume, fixed, gated, committed; budget deferral never calls claude', async () => {
  const sbx = makeSandbox();
  const builder = sbx.load('revenue-builder');
  const budget = sbx.load('builder-budget');
  const d = tmp('rb-');
  budget._setPathsForTesting(path.join(d, 's.json'), path.join(d, 'c.json'));
  process.env.CLAUDE_BIN = fakeClaude(d);
  const root = path.join(d, 'products');
  const res = await builder.buildProduct(toySpec, { productsRoot: root, literals: [] });
  delete process.env.CLAUDE_BIN;
  assert.equal(res.status, 'built', JSON.stringify(res));
  assert.equal(res.rounds, 2);
  assert.ok(fs.existsSync(path.join(root, 'toy', 'RELEASE.md')));
  assert.match(spawnSync('git', ['-C', root, 'log', '--oneline'], { encoding: 'utf8' }).stdout, /Add toy \(gate passed, round 2\)/);
  assert.equal(budget.readState().builds[new Date().toISOString().slice(0, 10)], 1);
  // Budget deferral: a pause means the worker is never invoked.
  const st = budget.readState(); st.pausedUntil = Date.now() + 3600e3; fs.writeFileSync(path.join(d, 's.json'), JSON.stringify(st));
  let called = 0;
  const deferred = await builder.buildProduct(toySpec, { productsRoot: root, claudeFn: async () => { called++; return {}; } });
  assert.equal(deferred.status, 'deferred'); assert.equal(called, 0);
  assert.ok(Array.isArray(builder.publishStatus({ hasSecret: () => false }).needs));
  sbx.cleanup();
});

// Reference implementation, test-only: proves the real spec's acceptance cases are satisfiable
// (an unsatisfiable spec would waste real Claude runs).
const tag = (x, t) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(x); return m ? m[1] : null; };
const val = (x, t) => { const s = tag(x, t); return s === null ? null : tag(s, 'value'); };
const refCore = {
  parseForm4Xml(xml) {
    const issuer = tag(xml, 'issuer') || '';
    const owners = [...xml.matchAll(/<reportingOwner>([\s\S]*?)<\/reportingOwner>/g)].map((m) => ({ name: tag(m[1], 'rptOwnerName'), cik: tag(m[1], 'rptOwnerCik'), isDirector: tag(m[1], 'isDirector') === '1', isOfficer: tag(m[1], 'isOfficer') === '1', isTenPercentOwner: tag(m[1], 'isTenPercentOwner') === '1', officerTitle: tag(m[1], 'officerTitle') }));
    const transactions = [...xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)].map((m) => {
      const t = m[1]; const shares = Number(val(t, 'transactionShares') || 0); const price = Number(val(t, 'transactionPricePerShare') || 0);
      return { securityTitle: val(t, 'securityTitle'), date: val(t, 'transactionDate'), code: tag(t, 'transactionCode'), shares, pricePerShare: price, valueUsd: Math.round(shares * price * 100) / 100, acquiredDisposed: val(t, 'transactionAcquiredDisposedCode'), sharesOwnedAfter: Number(val(t, 'sharesOwnedFollowingTransaction') || 0) };
    });
    return { issuer: { cik: tag(issuer, 'issuerCik'), name: tag(issuer, 'issuerName'), ticker: tag(issuer, 'issuerTradingSymbol') }, owners, transactions };
  },
  summarizeByTicker(filings) {
    const by = {};
    for (const f of filings) {
      const s = (by[f.issuer.ticker] = by[f.issuer.ticker] || { ticker: f.issuer.ticker, buyValueUsd: 0, sellValueUsd: 0, buyers: new Set(), transactionCount: 0 });
      for (const t of f.transactions) { s.transactionCount++; if (t.code === 'P') { s.buyValueUsd += t.valueUsd; f.owners.forEach((o) => s.buyers.add(o.name)); } if (t.code === 'S') s.sellValueUsd += t.valueUsd; }
    }
    return Object.values(by).map((s) => ({ ticker: s.ticker, buyValueUsd: s.buyValueUsd, sellValueUsd: s.sellValueUsd, netValueUsd: s.buyValueUsd - s.sellValueUsd, distinctBuyers: s.buyers.size, transactionCount: s.transactionCount })).sort((a, b) => b.netValueUsd - a.netValueUsd);
  },
};

test('product #1 spec: acceptance cases are satisfiable by a reference implementation', () => {
  const sbx = makeSandbox();
  const g = sbx.load('product-gate'); const builder = sbx.load('revenue-builder');
  const spec = JSON.parse(fs.readFileSync(path.join(REAL_PRODUCTS, 'sec-form4-insiders.spec.json'), 'utf8'));
  const cases = builder.resolveAcceptance(spec, REAL_PRODUCTS);
  for (const c of cases) assert.equal(g.partialMatch(c.expect, refCore[c.entry](c.input)), null, c.name);
  assert.match(builder.buildPrompt(spec, cases), /parseForm4Xml/);
  sbx.cleanup();
});

test('acceptance: spread cases call multi-argument entries with separate arguments', () => {
  const sbx = makeSandbox();
  const g = sbx.load('product-gate');
  const dir = tmp('spread-'); toyProduct(dir);
  fs.appendFileSync(path.join(dir, 'src', 'core.js'), 'exports.sub = (a, b) => a - b;\n');
  const spec = { ...toySpec, entry: 'sub', acceptance: [{ name: 'two args', entry: 'sub', spread: true, input: [9, 4], expect: 5 }] };
  assert.deepEqual(g.runAcceptance(dir, spec), { ok: true, failures: [] });
  spec.acceptance[0].expect = 6;
  assert.equal(g.runAcceptance(dir, spec).ok, false);
  sbx.cleanup();
});
