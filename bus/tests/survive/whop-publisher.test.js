const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeSandbox } = require('./_sandbox.js');

function fixtureCourse() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whop-'));
  const dir = path.join(root, 'courses', 'demo');
  fs.mkdirSync(path.join(dir, 'lessons'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'whop'));
  fs.mkdirSync(path.join(dir, 'starter', 'test'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'course.json'), JSON.stringify({ slug: 'demo-course', title: 'Demo Course', starter: 'starter/',
    modules: [{ n: 1, file: 'lessons/01.md', title: 'One' }, { n: 2, file: 'lessons/02.md', title: 'Two' }] }));
  fs.writeFileSync(path.join(dir, 'lessons', '01.md'), '# One\nbody one');
  fs.writeFileSync(path.join(dir, 'lessons', '02.md'), '# Two\nbody two');
  fs.writeFileSync(path.join(dir, 'whop', 'listing.md'), "# L\n\n## One-line pitch\nPitch here.\n\n## Description\nDesc here.\n\n## What you'll learn\n- a\n\n## What it is NOT\n- not b\n\n## FAQ\nq\n");
  fs.writeFileSync(path.join(dir, 'starter', 'agent-loop.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(dir, 'starter', 'test', 'agent-loop.test.js'), '// t\n');
  return root;
}

function fakeApi({ failOn } = {}) {
  const calls = []; let n = 0;
  const api = async (method, p, body) => {
    calls.push({ method, p: p.split('?')[0], body });
    if (failOn && failOn(method, p, calls.length)) throw new Error('boom');
    if (p === '/accounts/me') return { id: 'biz_1', title: 'Me', verified: false };
    // A course as Whop returns it: its own seed chapter plus whatever we created.
    if (method === 'GET' && p.startsWith('/courses/')) return { chapters: [{ id: 'seed', title: 'Chapter 1', lessons: [{ title: 'Lesson 1' }] }, { id: 'id_4', title: 'Module 1: One', lessons: [] }] };
    n += 1;
    return { id: `id_${n}`, route: body && body.route };
  };
  return { api, calls };
}

test('whop-publisher: builds a plan from the course files (chapters, starter lesson, listing sections)', () => {
  const sbx = makeSandbox(); const wp = sbx.load('whop-publisher');
  const plan = wp.buildPlan('demo', { price: '19', productsRoot: fixtureCourse() });
  assert.equal(plan.chapters.length, 2);
  assert.equal(plan.chapters[0].lessons[0].content, '# One\nbody one');
  assert.deepEqual(plan.chapters[1].lessons.map((l) => l.key), ['m2-l1', 'starter']);
  assert.match(plan.chapters[1].lessons[1].content, /agent-loop\.js[\s\S]*module\.exports = 1;/);
  assert.equal(plan.product.headline, 'Pitch here.');
  assert.match(plan.product.description, /Desc here\.[\s\S]*- not b[\s\S]*- a/);
  // Whop's 80-char headline limit is enforced offline, before any API call.
  const long = fixtureCourse(); const lp = path.join(long, 'courses', 'demo', 'whop', 'listing.md');
  fs.writeFileSync(lp, fs.readFileSync(lp, 'utf8').replace('Pitch here.', 'x'.repeat(81)));
  assert.throws(() => wp.buildPlan('demo', { productsRoot: long }), /Whop allows 80/);
  assert.doesNotMatch(plan.product.description, /FAQ/);
  assert.deepEqual(plan.plan, { plan_type: 'one_time', base_currency: 'usd', initial_price: 19, release_method: 'buy_now' });
  assert.equal(wp.buildPlan('demo', { productsRoot: fixtureCourse() }).plan, null);
  sbx.cleanup();
});

test('whop-publisher: publish creates everything hidden, in order, and a re-run after a crash never duplicates', async () => {
  const sbx = makeSandbox(); const wp = sbx.load('whop-publisher');
  const plan = wp.buildPlan('demo', { price: 19, productsRoot: fixtureCourse() });
  const state = {}; let persists = 0; const persist = () => { persists += 1; };
  // Crash on the 3rd lesson create.
  const crash = fakeApi({ failOn: (m, p) => p === '/course_lessons' && crash.calls.filter((c) => c.p === '/course_lessons').length === 3 });
  await assert.rejects(wp.publish(plan, { api: crash.api, state, persist }), /boom/);
  assert.equal(Object.keys(state.lessons).length, 2, 'ids created before the crash were kept');
  const resume = fakeApi();
  await wp.publish(plan, { api: resume.api, state, persist });
  const creates = resume.calls.filter((c) => c.method === 'POST').map((c) => c.p);
  assert.deepEqual(creates, ['/course_lessons', '/products', `/experiences/${state.experienceId}/attach`, '/plans'], 'resume only creates what is missing');
  assert.deepEqual(resume.calls.filter((c) => c.method === 'DELETE').map((c) => c.p), ['/course_chapters/seed'], 'only the untouched seed chapter is deleted');
  const all = [...crash.calls, ...resume.calls];
  assert.equal(all.find((c) => c.p === '/experiences').body.app_id, wp.COURSES_APP_ID);
  assert.equal(all.find((c) => c.p === '/courses').body.visibility, 'hidden');
  const product = all.find((c) => c.p === '/products').body;
  assert.equal(product.visibility, 'hidden');
  assert.equal(all.find((c) => c.p.endsWith('/attach')).body.product_id, state.productId);
  const planBody = all.find((c) => c.p === '/plans').body;
  assert.deepEqual([planBody.product_id, planBody.plan_type, planBody.initial_price, planBody.currency], [state.productId, 'one_time', 19, 'usd']);
  assert.ok(state.attached && state.planId && state.defaultsRemoved);
  assert.ok(state.productId && persists > 0);
  // A third run is a no-op.
  const again = fakeApi();
  await wp.publish(plan, { api: again.api, state, persist });
  assert.equal(again.calls.length, 0);
  sbx.cleanup();
});

test('whop-publisher: publish refuses without a price; visible only PATCHes what was published', async () => {
  const sbx = makeSandbox(); const wp = sbx.load('whop-publisher');
  const plan = wp.buildPlan('demo', { productsRoot: fixtureCourse() });
  await assert.rejects(wp.publish(plan, { api: fakeApi().api, state: {}, persist() {} }), /--price/);
  await assert.rejects(wp.makeVisible({ api: fakeApi().api, state: {}, persist() {} }), /publish first/);
  const f = fakeApi(); const state = { courseId: 'c1', productId: 'p1' };
  await wp.makeVisible({ api: f.api, state, persist() {} });
  assert.deepEqual(f.calls.map((c) => `${c.method} ${c.p} ${c.body.visibility}`), ['PATCH /courses/c1 visible', 'PATCH /products/p1 visible']);
  assert.ok(state.visibleAt);
  sbx.cleanup();
});

test('whop-publisher: check is read-only and reports missing scopes instead of throwing', async () => {
  const sbx = makeSandbox(); const wp = sbx.load('whop-publisher');
  const methods = [];
  const fetchFn = async (url, opts) => {
    methods.push(opts.method); assert.equal(opts.headers.Authorization, 'Bearer k');
    const p = url.replace('https://api.whop.com/api/v1', '');
    if (p.startsWith('/products')) return { ok: false, status: 403, text: async () => '{"error":{"message":"not authorized for access_pass:basic:read"}}' };
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'biz_1', title: 'Me', verified: false, data: [] }) };
  };
  const out = await wp.check({ api: wp.makeApi({ key: 'k', fetchFn }) });
  assert.deepEqual(out.account, { id: 'biz_1', title: 'Me', verified: false });
  assert.equal(out['courses:read'], 'ok');
  assert.match(out['products:read'], /403.*access_pass/);
  assert.ok(methods.every((m) => m === 'GET'));
  sbx.cleanup();
});

test('whop-publisher: routes each resource to its own scoped key, falling back to the default', async () => {
  const sbx = makeSandbox(); const wp = sbx.load('whop-publisher');
  const keys = { '/experiences': 'kE', '/course': 'kC', '/products': null };
  assert.equal(wp.keyFor('/course_lessons', 'k0', keys), 'kC');
  assert.equal(wp.keyFor('/courses/c1', 'k0', keys), 'kC');
  assert.equal(wp.keyFor('/experiences', 'k0', keys), 'kE');
  assert.equal(wp.keyFor('/products', 'k0', keys), 'k0', 'a missing key falls back');
  assert.equal(wp.keyFor('/accounts/me', 'k0', keys), 'k0');
  const seen = [];
  const api = wp.makeApi({ key: 'k0', keys, fetchFn: async (url, o) => { seen.push(o.headers.Authorization); return { ok: true, status: 200, text: async () => '{}' }; } });
  await api('POST', '/course_chapters', {}); await api('GET', '/accounts/me');
  assert.deepEqual(seen, ['Bearer kC', 'Bearer k0']);
  sbx.cleanup();
});
