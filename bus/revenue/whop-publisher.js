// whop-publisher.js -- publishes a course from the products repo as a Whop product through Whop's REST API
// (api/v1): Courses experience -> course -> one chapter per module with a markdown text lesson -> an inline
// "starter code" lesson -> a product with a one-time plan. Everything is created HIDDEN; `--visible` is a separate,
// explicit step. Idempotent: ids of everything created are kept in bus/whop-publish-state.json, so a re-run
// resumes instead of duplicating. Credentials come only from the secrets broker (WHOP_API_KEY).
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

function makeApi({ key, fetchFn = fetch }) {
  return async function api(method, p, body) {
    const res = await fetchFn(`${API}${p}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Api-Version-Date': API_VERSION, ...(body ? { 'Content-Type': 'application/json' } : {}) },
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
  const description = [section(listing, 'Description'), '**What you\'ll learn**', section(listing, "What you'll learn"),
    '**What it is NOT**', section(listing, 'What it is NOT')].filter(Boolean).join('\n\n');
  return {
    course: { title: course.title, tagline: section(listing, 'One-line pitch').slice(0, 200) },
    chapters,
    product: { title: course.title.slice(0, 80), headline: section(listing, 'One-line pitch').slice(0, 200), description, route: course.slug },
    plan: price == null ? null : { plan_type: 'one_time', base_currency: 'usd', initial_price: Number(price), release_method: 'buy_now' },
  };
}

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (_) { return {}; } }
function saveState(all) { fs.writeFileSync(STATE_PATH, `${JSON.stringify(all, null, 2)}\n`); }

async function check({ api }) {
  const out = {};
  const acct = await api('GET', '/companies/me');
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
  if (!state.accountId) { state.accountId = (await api('GET', '/companies/me')).id; persist(); }
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
    const p = await api('POST', '/products', { account_id: state.accountId, ...plan.product, visibility: 'hidden', experience_ids: [state.experienceId], custom_cta: 'get_access', plan_options: { ...plan.plan, visibility: 'visible' } });
    state.productId = p.id; state.productRoute = p.route || plan.product.route; persist();
  }
  return state;
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

module.exports = { buildPlan, publish, makeVisible, check, makeApi, section, COURSES_APP_ID, _setStatePathForTesting: (p) => { STATE_PATH = p; } };

if (require.main === module) {
  const [courseDir, cmd = 'plan'] = process.argv.slice(2);
  const priceIdx = process.argv.indexOf('--price');
  const price = priceIdx > 0 ? process.argv[priceIdx + 1] : null;
  if (!courseDir) { console.error('usage: node whop-publisher.js <course-dir-name> plan|check|publish --price N|visible'); process.exit(1); }
  (async () => {
    const plan = buildPlan(courseDir, { price });
    if (cmd === 'plan') return console.log(JSON.stringify(summarize(plan), null, 2));
    const api = makeApi({ key: require('../platform/secrets-broker.js').loadSecret('WHOP_API_KEY') });
    if (cmd === 'check') return console.log(JSON.stringify(await check({ api }), null, 2));
    const all = loadState(); all[courseDir] = all[courseDir] || {};
    const persist = () => saveState(all);
    const opts = { api, state: all[courseDir], persist };
    const result = cmd === 'publish' ? await publish(plan, opts) : cmd === 'visible' ? await makeVisible(opts) : null;
    if (!result) throw new Error(`unknown command ${cmd}`);
    console.log(JSON.stringify({ ...result, storeUrl: result.productRoute ? `https://whop.com/${result.productRoute}/` : null }, null, 2));
  })().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
}
