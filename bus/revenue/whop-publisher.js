// whop-publisher.js -- publishes a course from the products repo as a Whop product through Whop's REST API
// (api/v1): Courses experience -> course -> one chapter per module with a markdown text lesson -> an inline
// "starter code" lesson -> a product with a one-time plan. Everything is created HIDDEN; `--visible` is a separate,
// explicit step. Idempotent: ids of everything created are kept in bus/whop-publish-state.json, so a re-run
// resumes instead of duplicating. Credentials come only from the secrets broker (WHOP_API_KEY, plus optional per-resource
// WHOP_EXPERIENCES_API_KEY / WHOP_COURSES_API_KEY / WHOP_PRODUCTS_API_KEY).
// Usage: node whop-publisher.js <course-dir-name> plan              (offline: print what would be created)
//        node whop-publisher.js <course-dir-name> check             (read-only: key scopes, account, experiences)
//        node whop-publisher.js <course-dir-name> publish --price 19 (create/resume, all hidden)
//        node whop-publisher.js <course-dir-name> visible           (make course + product visible)

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const API = 'https://api.whop.com/api/v1';
const API_VERSION = '2026-07-01';
const COURSES_APP_ID = 'app_0vPZThfBpAwLo'; // Whop's own "Courses" app (GET /apps?query=courses, 2026-09-23)
let STATE_PATH = avPaths.bus('whop-publish-state.json');

// Whop scopes keys per resource, so an owner may create one key per scope. `keys` maps a path prefix to the key for
// it; anything unmatched uses `key`.
function keyFor(p, key, keys = {}) {
  const hit = Object.keys(keys).find((prefix) => p.startsWith(prefix) && keys[prefix]);
  return hit ? keys[hit] : key;
}

function makeApi({ key, keys, fetchFn = fetch }) {
  return async function api(method, p, body) {
    const res = await fetchFn(`${API}${p}`, {
      method,
      headers: { Authorization: `Bearer ${keyFor(p, key, keys)}`, 'Api-Version-Date': API_VERSION, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch (_) { json = null; }
    if (!res.ok) throw new Error(`${method} ${p.split('?')[0]} -> ${res.status}: ${json && json.error ? json.error.message : text.slice(0, 300)}`);
    return json;
  };
}

// Pull one "## Heading" section out of listing.md.
function section(md, heading) {
  const m = md.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
}

function starterLesson(dir) {
  const starter = path.join(dir, 'starter');
  const files = ['README.md', 'package.json', 'agent-loop.js', 'model.js', 'offline-model.js', 'test/agent-loop.test.js']
    .filter((f) => fs.existsSync(path.join(starter, f)));
  const fence = (f) => (f.endsWith('.md') ? 'markdown' : f.endsWith('.json') ? 'json' : 'javascript');
  const body = files.map((f) => `### \`${f}\`\n\n\`\`\`${fence(f)}\n${fs.readFileSync(path.join(starter, f), 'utf8').trimEnd()}\n\`\`\``).join('\n\n');
  return `Create a folder with these ${files.length} files (paths as shown), then run \`npm test\` (Node 18+, no dependencies, no API key).\n\n${body}`;
}

function buildPlan(courseDirName, { price, productsRoot = avPaths.PRODUCTS_REPO } = {}) {
  const dir = path.join(productsRoot, 'courses', courseDirName);
  const course = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
  const listing = fs.readFileSync(path.join(dir, 'whop', 'listing.md'), 'utf8');
  const chapters = course.modules.map((m) => ({
    key: `m${m.n}`,
    title: `Module ${m.n}: ${m.title}`.slice(0, 120),
    lessons: [{ key: `m${m.n}-l1`, title: m.title.slice(0, 120), content: fs.readFileSync(path.join(dir, m.file), 'utf8') }],
  }));
  if (course.starter && fs.existsSync(path.join(dir, course.starter))) {
    chapters[chapters.length - 1].lessons.push({ key: 'starter', title: 'Starter code (copy these files)', content: starterLesson(dir) });
  }
  // Whop limits (400 otherwise): headline <= 80 chars, product description <= 1500. Drop optional parts to fit.
  const parts = [section(listing, 'Description'), `**What it is NOT**\n${section(listing, 'What it is NOT')}`,
    `**What you'll learn**\n${section(listing, "What you'll learn")}`];
  // Product descriptions may render as plain text: join hard-wrapped lines, keep list items on their own lines.
  const unwrap = (t) => t.split(/\n{2,}/).map((para) => para.replace(/\n(?!\s*[-*] )/g, ' ')).join('\n\n');
  for (let i = 0; i < parts.length; i++) parts[i] = unwrap(parts[i]);
  let description = parts.join('\n\n');
  while (description.length > 1500 && parts.length > 1) { parts.pop(); description = parts.join('\n\n'); }
  const headline = section(listing, 'Headline') || section(listing, 'One-line pitch');
  if (headline.length > 80) throw new Error(`listing headline is ${headline.length} chars; Whop allows 80 (add a "## Headline" section)`);
  if (description.length > 1500) throw new Error(`listing description is ${description.length} chars; Whop allows 1500`);
  return {
    course: { title: course.title, tagline: section(listing, 'One-line pitch').slice(0, 200) },
    chapters,
    product: { title: course.title.slice(0, 80), headline, description, route: course.slug },
    plan: price == null ? null : { plan_type: 'one_time', base_currency: 'usd', initial_price: Number(price), release_method: 'buy_now' },
  };
}

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (_) { return {}; } }
function saveState(all) { fs.writeFileSync(STATE_PATH, `${JSON.stringify(all, null, 2)}\n`); }

// The business a key belongs to is GET /accounts/me. (GET /companies/me answers with the signed-in user's own business,
// which can be a different one -- that mismatch produced 403s on every course/product call, 2026-09-23.)
async function check({ api }) {
  const out = {};
  const acct = await api('GET', '/accounts/me');
  out.account = { id: acct.id, title: acct.title, verified: acct.verified };
  const probe = async (name, p) => { try { await api('GET', p); out[name] = 'ok'; } catch (e) { out[name] = e.message; } };
  await probe('experiences:read', `/experiences?account_id=${acct.id}&first=1`);
  await probe('courses:read', `/courses?account_id=${acct.id}&first=1`);
  await probe('products:read', `/products?account_id=${acct.id}&first=1`);
  return out;
}

// Create-or-resume. `state` is this course's entry in the state file; `persist()` is called after every create so
// a crash mid-way never loses an id (and therefore never duplicates on the re-run).
async function publish(plan, { api, state, persist }) {
  if (!plan.plan) throw new Error('publish needs --price <usd>');
  if (!state.accountId) { const a = await api('GET', '/accounts/me'); state.accountId = a.id; state.accountRoute = a.route || a.id; persist(); }
  if (!state.experienceId) {
    const exp = await api('POST', '/experiences', { app_id: COURSES_APP_ID, account_id: state.accountId, name: plan.course.title, is_public: false });
    state.experienceId = exp.id; persist();
  }
  if (!state.courseId) {
    const c = await api('POST', '/courses', { experience_id: state.experienceId, title: plan.course.title, tagline: plan.course.tagline, visibility: 'hidden', require_completing_lessons_in_order: false });
    state.courseId = c.id; persist();
  }
  state.chapters = state.chapters || {}; state.lessons = state.lessons || {};
  for (const ch of plan.chapters) {
    if (!state.chapters[ch.key]) { state.chapters[ch.key] = (await api('POST', '/course_chapters', { course_id: state.courseId, title: ch.title })).id; persist(); }
    for (const l of ch.lessons) {
      if (state.lessons[l.key]) continue;
      state.lessons[l.key] = (await api('POST', '/course_lessons', { chapter_id: state.chapters[ch.key], lesson_type: 'text', title: l.title, content: l.content })).id; persist();
    }
  }
  if (!state.productId) {
    // POST /products silently ignores experience_ids and plan_options (verified 2026-09-23), so the course is attached
    // and the price is created with their own endpoints below.
    const p = await api('POST', '/products', { account_id: state.accountId, ...plan.product, visibility: 'hidden', custom_cta: 'get_access' });
    state.productId = p.id; state.productRoute = p.route || plan.product.route; persist();
  }
  if (!state.attached) {
    await api('POST', `/experiences/${state.experienceId}/attach`, { product_id: state.productId });
    state.attached = true; persist();
  }
  if (!state.planId) {
    const pl = await api('POST', '/plans', { account_id: state.accountId, product_id: state.productId, plan_type: plan.plan.plan_type,
      currency: plan.plan.base_currency, initial_price: plan.plan.initial_price, release_method: plan.plan.release_method, visibility: 'visible' });
    state.planId = pl.id; state.purchaseUrl = pl.purchase_url || null; persist();
  }
  if (!state.defaultsRemoved) { await removeDefaultChapters({ api, state }); state.defaultsRemoved = true; persist(); }
  return state;
}

// Whop seeds a new course with an empty "Chapter 1" / "Lesson 1". Delete only chapters we did not create that still
// look exactly like that seed, so nothing the owner added by hand is ever touched.
async function removeDefaultChapters({ api, state }) {
  const course = await api('GET', `/courses/${state.courseId}`);
  const ours = new Set(Object.values(state.chapters || {}));
  const seeds = (course.chapters || []).filter((ch) => !ours.has(ch.id) && /^Chapter \d+$/.test(ch.title || '')
    && (ch.lessons || []).every((l) => /^Lesson \d+$/.test(l.title || '')) && (ch.lessons || []).length <= 1);
  for (const ch of seeds) await api('DELETE', `/course_chapters/${ch.id}`);
  return seeds.map((ch) => ch.id);
}

async function makeVisible({ api, state, persist }) {
  if (!state.courseId || !state.productId) throw new Error('nothing published yet; run publish first');
  await api('PATCH', `/courses/${state.courseId}`, { visibility: 'visible' });
  await api('PATCH', `/products/${state.productId}`, { visibility: 'visible' });
  state.visibleAt = new Date().toISOString(); persist();
  return state;
}

function summarize(plan) {
  return {
    course: plan.course,
    chapters: plan.chapters.map((c) => ({ title: c.title, lessons: c.lessons.map((l) => `${l.title} (${l.content.length} chars)`) })),
    product: { ...plan.product, description: `${plan.product.description.length} chars` },
    plan: plan.plan,
  };
}

module.exports = { buildPlan, publish, makeVisible, removeDefaultChapters, check, makeApi, keyFor, section, COURSES_APP_ID, _setStatePathForTesting: (p) => { STATE_PATH = p; } };

if (require.main === module) {
  const [courseDir, cmd = 'plan'] = process.argv.slice(2);
  const priceIdx = process.argv.indexOf('--price');
  const price = priceIdx > 0 ? process.argv[priceIdx + 1] : null;
  if (!courseDir) { console.error('usage: node whop-publisher.js <course-dir-name> plan|check|publish --price N|visible'); process.exit(1); }
  (async () => {
    const plan = buildPlan(courseDir, { price });
    if (cmd === 'plan') return console.log(JSON.stringify(summarize(plan), null, 2));
    const load = (n) => { try { return require('../platform/secrets-broker.js').loadSecret(n); } catch (_) { return null; } };
    const api = makeApi({ key: load('WHOP_API_KEY'), keys: {
      '/experiences': load('WHOP_EXPERIENCES_API_KEY'),
      '/course': load('WHOP_COURSES_API_KEY'), // /courses, /course_chapters, /course_lessons
      '/products': load('WHOP_PRODUCTS_API_KEY'),
    } });
    if (cmd === 'check') return console.log(JSON.stringify(await check({ api }), null, 2));
    const all = loadState(); all[courseDir] = all[courseDir] || {};
    const persist = () => saveState(all);
    const opts = { api, state: all[courseDir], persist };
    const result = cmd === 'publish' ? await publish(plan, opts) : cmd === 'visible' ? await makeVisible(opts) : null;
    if (!result) throw new Error(`unknown command ${cmd}`);
    console.log(JSON.stringify({ ...result, storeUrl: result.productRoute ? `https://whop.com/${result.accountRoute || result.accountId}/${result.productRoute}/` : null }, null, 2));
  })().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
}
