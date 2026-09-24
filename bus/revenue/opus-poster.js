// opus-poster.js -- posts the finished course shorts to social accounts through the OpusClip API. Each short is uploaded
// untouched (curationPref.skipCurate: Opus does not re-cut it), then scheduled one per day per connected account with
// the caption from marketing/posts/short-captions.md. Opus holds the platform logins; the owner connects accounts once
// in the Opus dashboard. Idempotent: everything created is kept in bus/opus-post-state.json and never redone.
// Credentials come only from the secrets broker (OPUS_PRO_API_KEY).
// Usage: node opus-poster.js accounts                          (read-only: connected social accounts)
//        node opus-poster.js upload [slug...]                  (upload shorts, default: all in media/)
//        node opus-poster.js status                            (poll projects until each clip exists)
//        node opus-poster.js schedule --start <ISO> [--hours 24] [--platforms YOUTUBE,TIKTOK_BUSINESS] [--dry-run]

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const API = 'https://api.opus.pro/api';
const COURSE_DIR = path.join(avPaths.PRODUCTS_REPO, 'courses', 'agentic-systems');
let STATE_PATH = avPaths.bus('opus-post-state.json');

// Opus limits: 30 core requests/min and 4 projects processing at once (both answer 429). Retry 429s with bounded
// backoff instead of aborting a batch; `sleep` is injectable so tests don't wait.
function makeApi({ key, fetchFn = fetch, sleep = (ms) => new Promise((ok) => setTimeout(ok, ms)), maxRetries = 8 }) {
  return async function api(method, p, body) {
    for (let attempt = 0; ; attempt++) {
      const r = await once(method, p, body);
      if (r !== RETRY) return r;
      if (attempt >= maxRetries) throw new Error(`${method} ${p.split('?')[0]} -> 429 after ${maxRetries} retries`);
      await sleep(Math.min(120000, 15000 * (attempt + 1)));
    }
  };
  async function once(method, p, body) {
    const res = await fetchFn(`${API}${p}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) return RETRY;
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch (_) { json = null; }
    if (!res.ok) throw new Error(`${method} ${p.split('?')[0]} -> ${res.status}: ${json && (json.message || json.code) ? (json.message || json.code) : text.slice(0, 300)}`);
    return { json, headers: res.headers };
  }
}
const RETRY = Symbol('retry');

// Captions file: "## <slug>" sections. Title = first sentence (YouTube allows 100 chars); description = the whole caption.
function parseCaptions(md) {
  const out = {};
  for (const m of md.matchAll(/^## (\S+)\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)) {
    const body = m[2].trim().replace(/\n(?!#)/g, ' ');
    const first = (body.match(/^.*?[.!?](?=\s|$)/) || [body])[0];
    out[m[1]] = { title: first.length <= 100 ? first : `${first.slice(0, 97)}...`, description: body };
  }
  return out;
}

// Schedule plan: shorts in slug order, one slot per `hours`, every chosen account gets the same clip in the same slot.
function buildSchedule({ slugs, accounts, captions, start, hours = 24 }) {
  const t0 = new Date(start).getTime();
  if (!Number.isFinite(t0)) throw new Error(`bad --start ${start}`);
  const rows = [];
  [...slugs].sort().forEach((slug, i) => {
    const cap = captions[slug];
    if (!cap) throw new Error(`no caption for ${slug} in short-captions.md`);
    if (!/AI voice/i.test(cap.description)) throw new Error(`caption for ${slug} lacks the "AI voice" disclosure`);
    for (const a of accounts) {
      rows.push({ slug, key: `${slug}@${a.postAccountId}${a.subAccountId ? `/${a.subAccountId}` : ''}`, platform: a.platform,
        postAccountId: a.postAccountId, subAccountId: a.subAccountId || undefined,
        publishAt: new Date(t0 + i * hours * 3600000).toISOString(), title: cap.title, description: cap.description });
    }
  });
  return rows;
}

async function upload(slug, { api, fetchFn = fetch, file }) {
  const link = (await api('POST', '/upload-links', { video: { usecase: 'LocalUpload' } })).json;
  const start = await fetchFn(link.url, { method: 'POST', headers: { 'x-goog-resumable': 'start', 'Content-Length': '0' } });
  const session = start.headers.get('location');
  if (!session) throw new Error(`upload session for ${slug} returned no location (HTTP ${start.status})`);
  const put = await fetchFn(session, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: fs.readFileSync(file) });
  if (!put.ok) throw new Error(`upload of ${slug} failed: HTTP ${put.status}`);
  // Our shorts already carry captions; Opus burns in its own by default (seen 2026-09-23: "IT CHOSE TO" twice), so
  // switch them off. The TRIAL tier also forces an Opus watermark -- use a paid tier or post by hand.
  const proj = (await api('POST', '/clip-projects', { videoUrl: link.uploadId, uploadedVideoAttr: { title: slug }, curationPref: { skipCurate: true },
    renderPref: { enableCaption: false, enableEmoji: false } })).json;
  const projectId = proj && (proj.id || proj.projectId);
  if (!projectId) throw new Error(`clip-projects for ${slug} returned no project id: ${JSON.stringify(proj).slice(0, 200)}`);
  return projectId;
}

// Exportable clip ids are "{projectId}.{clipId}"; the posting endpoints want the bare clipId.
async function findClip(projectId, { api }) {
  const r = (await api('GET', `/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(projectId)}`)).json;
  const list = Array.isArray(r) ? r : (r && (r.data || r.list)) || [];
  const c = list[0];
  if (!c || !c.id) return null;
  return { clipId: String(c.id).includes('.') ? String(c.id).split('.').slice(1).join('.') : String(c.id), durationMs: c.durationMs || null, uriForExport: c.uriForExport || c.uriForPreview || null };
}

async function schedule(rows, { api, state, persist }) {
  state.posts = state.posts || {};
  for (const r of rows) {
    const prior = state.posts[r.key];
    if (prior && prior.pending) throw new Error(`${r.key}: an earlier schedule request never confirmed; check the Opus calendar, then set its entry to done or delete it in the state file`);
    if (prior) continue;
    const clip = (state.clips || {})[r.slug];
    if (!clip) throw new Error(`${r.slug} has no processed clip yet; run: status`);
    // Mark pending BEFORE sending: if the response is lost or we crash, the next run stops instead of posting twice.
    state.posts[r.key] = { pending: true, platform: r.platform, publishAt: r.publishAt }; persist();
    const res = (await api('POST', '/publish-schedules', { projectId: state.projects[r.slug], clipId: clip.clipId, postAccountId: r.postAccountId,
      subAccountId: r.subAccountId, publishAt: r.publishAt, postDetail: { title: r.title, custom: { description: r.description, privacy: 'public' }, mediaType: 'video' } })).json;
    const scheduleId = res && ((res.data && res.data.scheduleId) || res.scheduleId);
    if (!scheduleId) throw new Error(`${r.key}: schedule accepted without a scheduleId (${JSON.stringify(res).slice(0, 200)}); left pending`);
    state.posts[r.key] = { scheduleId, platform: r.platform, publishAt: r.publishAt };
    persist();
    await new Promise((ok) => setTimeout(ok, 1100)); // publish-schedules is limited to 1 req/s
  }
  return state.posts;
}

// The state file is the only record of what was posted, so: a missing file is a first run, a corrupt one is an error
// (never silently {} -- that would re-post everything); writes go to a temp file then rename, so a crash can't truncate it.
function loadState(p = STATE_PATH) {
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new Error(`${p} is corrupt (${e.message}); restore it before posting again`); }
}
function saveState(s, p = STATE_PATH) {
  const tmp = `${p}.tmp`;
  const fd = fs.openSync(tmp, 'w'); fs.writeSync(fd, `${JSON.stringify(s, null, 2)}\n`); fs.fsyncSync(fd); fs.closeSync(fd);
  fs.renameSync(tmp, p);
}
// One run at a time: two processes with the same state would both see a post as missing and both send it.
function acquireLock(p = `${STATE_PATH}.lock`) {
  try { fs.writeFileSync(p, String(process.pid), { flag: 'wx' }); } catch (_) { throw new Error(`another opus-poster run holds ${p} (delete it if no run is active)`); }
  return () => { try { fs.unlinkSync(p); } catch (_) { /* already gone */ } };
}
function mediaSlugs() { return fs.readdirSync(path.join(COURSE_DIR, 'media')).filter((f) => f.endsWith('.mp4')).map((f) => f.slice(0, -4)).sort(); }
function arg(name, dflt) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; }

module.exports = { parseCaptions, buildSchedule, upload, findClip, schedule, makeApi, loadState, saveState, acquireLock, _setStatePathForTesting: (p) => { STATE_PATH = p; } };

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    const api = makeApi({ key: require('../platform/secrets-broker.js').loadSecret('OPUS_PRO_API_KEY') });
    const release = cmd === 'accounts' ? () => {} : acquireLock();
    process.on('exit', release);
    const state = loadState(); const persist = () => saveState(state);
    state.projects = state.projects || {}; state.clips = state.clips || {};
    if (cmd === 'accounts') {
      const r = (await api('GET', '/social-accounts?q=mine')).json;
      return console.log(JSON.stringify((r.data || []).map((a) => ({ platform: a.platform, name: a.extUserName, postAccountId: a.postAccountId, subAccountId: a.subAccountId })), null, 2));
    }
    if (cmd === 'upload') {
      const slugs = process.argv.slice(3).filter((a) => !a.startsWith('--'));
      for (const slug of slugs.length ? slugs : mediaSlugs()) {
        if (state.projects[slug]) { console.log(`${slug}: already uploaded (${state.projects[slug]})`); continue; }
        state.projects[slug] = await upload(slug, { api, file: path.join(COURSE_DIR, 'media', `${slug}.mp4`) }); persist();
        console.log(`${slug}: project ${state.projects[slug]}`);
      }
      return;
    }
    if (cmd === 'status') {
      for (const [slug, projectId] of Object.entries(state.projects)) {
        if (!state.clips[slug]) { const c = await findClip(projectId, { api }); if (c) { state.clips[slug] = c; persist(); } }
        console.log(`${slug}: ${state.clips[slug] ? `ready (clip ${state.clips[slug].clipId})` : 'processing'}`);
      }
      return;
    }
    if (cmd === 'schedule') {
      const wanted = (arg('--platforms', '') || '').split(',').filter(Boolean);
      const accounts = ((await api('GET', '/social-accounts?q=mine')).json.data || []).filter((a) => !wanted.length || wanted.includes(a.platform));
      if (!accounts.length) throw new Error('no connected social accounts match; connect them in the Opus dashboard (Social accounts)');
      const captions = parseCaptions(fs.readFileSync(path.join(COURSE_DIR, 'marketing', 'posts', 'short-captions.md'), 'utf8'));
      const rows = buildSchedule({ slugs: Object.keys(state.clips), accounts, captions, start: arg('--start'), hours: Number(arg('--hours', 24)) });
      if (process.argv.includes('--dry-run')) return console.log(JSON.stringify(rows.map((r) => ({ slug: r.slug, platform: r.platform, publishAt: r.publishAt, title: r.title })), null, 2));
      return console.log(JSON.stringify(await schedule(rows, { api, state, persist }), null, 2));
    }
    console.error('usage: node opus-poster.js accounts | upload [slug...] | status | schedule --start <ISO> [--hours 24] [--platforms P1,P2] [--dry-run]');
    process.exit(1);
  })().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
}
