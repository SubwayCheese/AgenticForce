// apify-publisher.js -- Round 20. Packages a gate-passed product as an Apify
// Actor (generated main.js wrapper + Dockerfile + input schema, per-event
// billing via Actor.charge) and publishes it through Apify's REST API:
// create/update -> build -> real test run -> (optional) pricing -> (optional)
// public. Credentials come only from the secrets broker (APIFY_TOKEN).
// Usage: node apify-publisher.js <slug> [--dry-run] [--pricing] [--public]
//   --dry-run  package + validate locally, print the file list, touch no network.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const API = 'https://api.apify.com/v2';
const PRODUCTS_ROOT = avPaths.PRODUCTS_REPO;
const ACTORS_DIR = avPaths.bus('products', 'actors');
const SDK_VERSION = '3.7.2';

async function api(method, p, body, { allow404 = false } = {}) {
  const token = require('../platform/secrets-broker.js').loadSecret('APIFY_TOKEN');
  const res = await fetch(`${API}${p}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(400000) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (_) { json = null; }
  if (res.status === 404 && allow404) return null;
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status}: ${json && json.error ? `${json.error.type}: ${json.error.message}` : text.slice(0, 300)}`);
  return json ? (json.data !== undefined ? json.data : json) : text;
}

function loadMeta(slug) {
  const meta = JSON.parse(fs.readFileSync(path.join(ACTORS_DIR, 'actors.json'), 'utf8'))[slug];
  if (!meta) throw new Error(`no actor meta for ${slug}`);
  return meta;
}


// Dataset schema (field docs + a table view) and output schema (links to the dataset view and the SUMMARY record).
function datasetSchema(meta) {
  const props = Object.keys(meta.dataset.fields);
  const display = Object.fromEntries(props.map((k) => [k, { label: meta.dataset.fields[k].title, format: meta.dataset.fields[k].type === 'number' ? 'number' : meta.dataset.fields[k].type === 'object' ? 'object' : 'text' }]));
  return { actorSpecification: 1, fields: { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', properties: meta.dataset.fields }, views: { overview: { title: 'Overview', description: 'All returned rows', transformation: { fields: props }, display: { component: 'table', properties: display } } } };
}

function outputSchema(meta) {
  const properties = { results: { type: 'string', title: 'Results', description: 'Structured rows (open in the Overview table view)', template: '{{links.apiDefaultDatasetUrl}}/items?view=overview' } };
  if (meta.dataset.summaryRecord) properties.summary = { type: 'string', title: 'Summary', description: 'Aggregate summary and disclaimer', template: '{{links.apiDefaultKeyValueStoreUrl}}/records/SUMMARY' };
  return { actorOutputSchemaVersion: 1, title: `${meta.title} output`, description: 'Where this Actor stores its results', properties };
}

function packageFiles(slug, meta = loadMeta(slug)) {
  const dir = path.join(PRODUCTS_ROOT, slug);
  const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  const files = {
    'package.json': JSON.stringify({ name: slug, version: '0.1.0', description: meta.description, main: 'src/main.js', scripts: { start: 'node src/main.js' }, dependencies: { apify: SDK_VERSION }, license: 'MIT' }, null, 2),
    Dockerfile: 'FROM apify/actor-node:20\nCOPY package*.json ./\nRUN npm --quiet set progress=false && npm install --omit=dev --omit=optional --no-audit --no-fund\nCOPY . ./\nCMD npm start --silent\n',
    '.actor/actor.json': JSON.stringify({ actorSpecification: 1, name: slug, title: meta.title, version: '0.1', input: './input_schema.json', dockerfile: '../Dockerfile', readme: '../README.md', output: './output_schema.json', storages: { dataset: './dataset_schema.json' } }, null, 2),
    '.actor/output_schema.json': JSON.stringify(outputSchema(meta), null, 2),
    '.actor/dataset_schema.json': JSON.stringify(datasetSchema(meta), null, 2),
    '.actor/input_schema.json': JSON.stringify(meta.input, null, 2),
    'src/core.js': read('src/core.js'),
    'src/fetch.js': read('src/fetch.js'),
    'src/main.js': fs.readFileSync(path.join(ACTORS_DIR, `${slug}.main.js`), 'utf8'),
    'README.md': fs.existsSync(path.join(ACTORS_DIR, `${slug}.README.md`)) ? fs.readFileSync(path.join(ACTORS_DIR, `${slug}.README.md`), 'utf8') : read('README.md'),
    LICENSE: read('LICENSE'),
  };
  return Object.entries(files).map(([name, content]) => ({ name, format: 'TEXT', content }));
}

async function publish(slug, { pricing = false, makePublic = false, log = console.log } = {}) {
  const meta = loadMeta(slug);
  const me = await api('GET', '/users/me');
  const sourceFiles = packageFiles(slug, meta);
  const version = { versionNumber: '0.1', sourceType: 'SOURCE_FILES', buildTag: 'latest', sourceFiles };
  let actor = await api('GET', `/acts/${me.username}~${slug}`, null, { allow404: true });
  if (!actor) {
    actor = await api('POST', '/acts', { name: slug, title: meta.title, description: meta.description, seoTitle: meta.seoTitle, seoDescription: meta.seoDescription, isPublic: false, versions: [version], defaultRunOptions: { build: 'latest', timeoutSecs: 600, memoryMbytes: 512 } });
    log(`created actor ${actor.id}`);
  } else {
    await api('PUT', `/acts/${actor.id}/versions/0.1`, { sourceType: 'SOURCE_FILES', buildTag: 'latest', sourceFiles }).catch(() => api('POST', `/acts/${actor.id}/versions`, version));
    log(`updated actor ${actor.id}`);
  }
  try { await api('PUT', `/acts/${actor.id}`, { categories: meta.categories, seoTitle: meta.seoTitle, seoDescription: meta.seoDescription, title: meta.title, description: meta.description }); } catch (e) { log(`metadata update skipped: ${e.message}`); }

  const build = await api('POST', `/acts/${actor.id}/builds?version=0.1&waitForFinish=300`);
  log(`build ${build.id}: ${build.status}`);
  if (build.status !== 'SUCCEEDED') { const l = await api('GET', `/logs/${build.id}`).catch(() => ''); return { ok: false, stage: 'build', status: build.status, log: String(l).slice(-1500) }; }

  const run = await api('POST', `/acts/${actor.id}/runs?waitForFinish=240`, meta.testInput);
  log(`test run ${run.id}: ${run.status}`);
  const runLog = String(await api('GET', `/logs/${run.id}`).catch(() => '')).slice(-1500);
  const items = run.defaultDatasetId ? await api('GET', `/datasets/${run.defaultDatasetId}/items?limit=3`).catch(() => []) : [];
  const testOk = run.status === 'SUCCEEDED' && Array.isArray(items) && items.length > 0 && !items[0].error;
  const result = { ok: testOk, stage: 'test-run', actorId: actor.id, runStatus: run.status, sampleItems: items, runLog };
  if (!testOk) return result;

  if (pricing) {
    try {
      await api('PUT', `/acts/${actor.id}`, { pricingInfos: [{ pricingModel: 'PAY_PER_EVENT', createdAt: new Date().toISOString(), pricingPerEvent: { actorChargeEvents: { [meta.event.name]: { eventTitle: meta.event.title, eventDescription: meta.event.description, eventPriceUsd: meta.event.priceUsd } } } }] });
      result.pricing = 'set';
    } catch (e) { result.pricing = `FAILED: ${e.message}`; }
  }
  if (makePublic) {
    try { await api('PUT', `/acts/${actor.id}`, { isPublic: true }); result.public = true; } catch (e) { result.public = `FAILED: ${e.message}`; }
  }
  return result;
}


// Sets pay-per-event pricing (and optionally makes the Actor public) on an EXISTING Actor, no rebuild or test run.
async function applyPricing(slug, { makePublic = false } = {}) {
  const meta = loadMeta(slug);
  const me = await api('GET', '/users/me');
  const actor = await api('GET', `/acts/${me.username}~${slug}`, null, { allow404: true });
  if (!actor) throw new Error(`actor ${slug} does not exist yet -- run the full publish first`);
  const result = { actorId: actor.id };
  try {
    await api('PUT', `/acts/${actor.id}`, { pricingInfos: [{ pricingModel: 'PAY_PER_EVENT', createdAt: new Date().toISOString(), pricingPerEvent: { actorChargeEvents: { [meta.event.name]: { eventTitle: meta.event.title, eventDescription: meta.event.description, eventPriceUsd: meta.event.priceUsd } } } }] });
    result.pricing = 'set';
  } catch (e) { result.pricing = `FAILED: ${e.message}`; }
  if (makePublic) { try { await api('PUT', `/acts/${actor.id}`, { isPublic: true }); result.public = true; } catch (e) { result.public = `FAILED: ${e.message}`; } }
  return result;
}

module.exports = { publish, applyPricing, packageFiles, loadMeta };

if (require.main === module) {
  const [slug, ...flags] = process.argv.slice(2);
  if (!slug) { console.error('usage: node apify-publisher.js <slug> [--dry-run] [--pricing] [--pricing-only] [--public]'); process.exit(2); }
  if (flags.includes('--dry-run')) {
    const files = packageFiles(slug);
    const bytes = files.reduce((n, f) => n + f.content.length, 0);
    console.log(JSON.stringify({ slug, files: files.map((f) => `${f.name} (${f.content.length}b)`), totalBytes: bytes, network: 'none' }, null, 2));
    process.exit(0);
  }
  (flags.includes('--pricing-only') ? applyPricing(slug, { makePublic: flags.includes('--public') }).then((r) => ({ ok: r.pricing === 'set', ...r })) : publish(slug, { pricing: flags.includes('--pricing'), makePublic: flags.includes('--public') }))
    .then((r) => { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); })
    .catch((e) => { console.error('publish failed:', e.message); process.exit(1); });
}
