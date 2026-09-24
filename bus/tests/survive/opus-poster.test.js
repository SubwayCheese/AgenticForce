const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeSandbox } = require('./_sandbox.js');

const CAPTIONS = `# Captions

## 01-a
My agent did nothing. That was right.
AI voice. #aiagents

## 02-b
A $0.00 ask is a -100% spread! Check sanity.
AI voice. #debugging

## 03-c
No disclosure here.
#oops
`;
const ACCOUNTS = [{ platform: 'YOUTUBE', postAccountId: 'yt1' }, { platform: 'TIKTOK_BUSINESS', postAccountId: 'tt1', subAccountId: 's1' }];

test('opus-poster: captions -> first-sentence titles; schedule is ordered, spaced, and refuses posts without AI disclosure', () => {
  const sbx = makeSandbox(); const op = sbx.load('opus-poster');
  const caps = op.parseCaptions(CAPTIONS);
  assert.equal(caps['01-a'].title, 'My agent did nothing.');
  assert.equal(caps['02-b'].title, 'A $0.00 ask is a -100% spread!');
  assert.match(caps['01-a'].description, /That was right\. AI voice\./);
  const rows = op.buildSchedule({ slugs: ['02-b', '01-a'], accounts: ACCOUNTS, captions: caps, start: '2026-09-25T16:00:00Z', hours: 24 });
  assert.deepEqual(rows.map((r) => [r.slug, r.platform, r.publishAt]), [
    ['01-a', 'YOUTUBE', '2026-09-25T16:00:00.000Z'], ['01-a', 'TIKTOK_BUSINESS', '2026-09-25T16:00:00.000Z'],
    ['02-b', 'YOUTUBE', '2026-09-26T16:00:00.000Z'], ['02-b', 'TIKTOK_BUSINESS', '2026-09-26T16:00:00.000Z']]);
  assert.equal(rows[1].subAccountId, 's1');
  assert.throws(() => op.buildSchedule({ slugs: ['03-c'], accounts: ACCOUNTS, captions: caps, start: '2026-09-25T16:00:00Z' }), /AI voice/);
  assert.throws(() => op.buildSchedule({ slugs: ['09-x'], accounts: ACCOUNTS, captions: caps, start: '2026-09-25T16:00:00Z' }), /no caption/);
  assert.throws(() => op.buildSchedule({ slugs: ['01-a'], accounts: ACCOUNTS, captions: caps, start: 'soon' }), /bad --start/);
  sbx.cleanup();
});

test('opus-poster: upload runs link -> resumable session -> PUT -> skipCurate project', async () => {
  const sbx = makeSandbox(); const op = sbx.load('opus-poster');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'opus-')), 'v.mp4'); fs.writeFileSync(file, 'VIDEO');
  const seen = [];
  const fetchFn = async (url, o) => {
    seen.push(`${o.method} ${url}`);
    if (url.endsWith('/upload-links')) return { ok: true, status: 200, headers: new Map(), text: async () => '{"url":"https://gcs/start","uploadId":"up1"}' };
    if (url === 'https://gcs/start') { assert.equal(o.headers['x-goog-resumable'], 'start'); return { ok: true, status: 201, headers: new Map([['location', 'https://gcs/session']]) }; }
    if (url === 'https://gcs/session') { assert.equal(String(o.body), 'VIDEO'); return { ok: true, status: 200 }; }
    if (url.endsWith('/clip-projects')) { const b = JSON.parse(o.body); assert.equal(b.videoUrl, 'up1'); assert.equal(b.curationPref.skipCurate, true); assert.equal(b.renderPref.enableCaption, false); return { ok: true, status: 200, headers: new Map(), text: async () => '{"id":"P1"}' }; }
    throw new Error(`unexpected ${url}`);
  };
  const api = op.makeApi({ key: 'k', fetchFn });
  assert.equal(await op.upload('01-a', { api, fetchFn, file }), 'P1');
  assert.deepEqual(seen.map((s) => s.split(' ')[0]), ['POST', 'POST', 'PUT', 'POST']);
  sbx.cleanup();
});

test('opus-poster: findClip strips the project prefix; schedule is idempotent and needs a processed clip', async () => {
  const sbx = makeSandbox(); const op = sbx.load('opus-poster');
  const clipApi = async () => ({ json: { data: [{ id: 'P1.C9', durationMs: 27000 }] } });
  assert.equal((await op.findClip('P1', { api: clipApi })).clipId, 'C9');
  assert.equal(await op.findClip('P1', { api: async () => ({ json: { data: [] } }) }), null);
  const caps = op.parseCaptions(CAPTIONS);
  const rows = op.buildSchedule({ slugs: ['01-a'], accounts: [ACCOUNTS[0]], captions: caps, start: '2026-09-25T16:00:00Z' });
  const posted = [];
  const api = async (m, p, body) => { posted.push(body); return { json: { data: { scheduleId: `S${posted.length}` } } }; };
  await assert.rejects(op.schedule(rows, { api, state: { projects: { '01-a': 'P1' } }, persist() {} }), /no processed clip/);
  const state = { projects: { '01-a': 'P1' }, clips: { '01-a': { clipId: 'C9' } } };
  await op.schedule(rows, { api, state, persist() {} });
  assert.equal(posted.length, 1);
  assert.deepEqual([posted[0].clipId, posted[0].projectId, posted[0].postDetail.custom.privacy], ['C9', 'P1', 'public']);
  await op.schedule(rows, { api, state, persist() {} });
  assert.equal(posted.length, 1, 'a re-run never posts twice');
  assert.equal(state.posts[rows[0].key].scheduleId, 'S1', 'documented {data:{scheduleId}} shape is kept for cancelling');
  // A request whose outcome is unknown stays pending, and the next run refuses to resend it.
  const lost = { projects: { '01-a': 'P1' }, clips: { '01-a': { clipId: 'C9' } } };
  await assert.rejects(op.schedule(rows, { api: async () => { throw new Error('socket hang up'); }, state: lost, persist() {} }), /hang up/);
  assert.equal(lost.posts[rows[0].key].pending, true);
  await assert.rejects(op.schedule(rows, { api, state: lost, persist() {} }), /never confirmed/);
  assert.equal(posted.length, 1);
  sbx.cleanup();
});

test('opus-poster: state is written atomically, corrupt state is an error, one run at a time, 429s back off', async () => {
  const sbx = makeSandbox(); const op = sbx.load('opus-poster');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opus-st-')); const st = path.join(dir, 's.json');
  assert.deepEqual(op.loadState(st), {}, 'missing file = first run');
  op.saveState({ posts: { a: { scheduleId: 'S1' } } }, st);
  assert.equal(op.loadState(st).posts.a.scheduleId, 'S1');
  assert.ok(!fs.existsSync(`${st}.tmp`));
  fs.writeFileSync(st, '{"posts": {"a"');
  assert.throws(() => op.loadState(st), /corrupt/, 'never silently treat a damaged ledger as empty');
  const release = op.acquireLock(`${st}.lock`);
  assert.throws(() => op.acquireLock(`${st}.lock`), /another opus-poster run/);
  release(); op.acquireLock(`${st}.lock`)();
  let calls = 0; const waits = [];
  const fetchFn = async () => (++calls < 3 ? { status: 429, ok: false } : { status: 200, ok: true, headers: new Map(), text: async () => '{"ok":1}' });
  const api = op.makeApi({ key: 'k', fetchFn, sleep: async (ms) => waits.push(ms) });
  assert.deepEqual((await api('GET', '/x')).json, { ok: 1 });
  assert.deepEqual(waits, [15000, 30000]);
  const stuck = op.makeApi({ key: 'k', fetchFn: async () => ({ status: 429, ok: false }), sleep: async () => {}, maxRetries: 2 });
  await assert.rejects(stuck('GET', '/x'), /429 after 2 retries/);
  sbx.cleanup();
});
