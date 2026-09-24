// shorts-pipeline.js + video-providers.js. Everything runs in the sandbox (no network, no secrets file, so the
// vyro provider is unavailable unless a test injects a fake). The last test renders a real short with real ffmpeg
// and a deterministic fake TTS, then checks the output with ffprobe (plan review I3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { makeSandbox } = require('./_sandbox.js');

function fresh() {
  const sbx = makeSandbox();
  return { sbx, sp: sbx.load('shorts-pipeline'), vp: sbx.load('video-providers') };
}

test('lint catches identifiers, credentials, addresses and local paths; passes clean copy', () => {
  const { sbx, sp } = fresh();
  for (const bad of ['mail me at a.b@example.com', 'key sk-abcdefghijk123', 'host 192.168.1.20', 'see /home/pi/x', 'id 123e4567-e89b-12d3-a456-426614174000', 'biz_PPKuEPjr6iEsPB', 'pi.local']) {
    assert.ok(sp.lintText(bad).length, `should flag: ${bad}`);
  }
  assert.deepEqual(sp.lintText('My agent had $50 and chose no-action. Mission 007, market closed.'), []);
  const hits = sp.lintScript({ slug: 'x', sources: ['bus/city/survive-supervisor.js'], scenes: [{ say: 'ok', visual: { lines: ['ip 10.0.0.1'] } }] });
  assert.equal(hits.length, 1, 'sources are provenance paths and are not linted; scene text is');
  sbx.cleanup();
});

test('validateScript requires slug, scenes with text, and sources (provenance)', () => {
  const { sbx, sp } = fresh();
  assert.deepEqual(sp.validateScript({ slug: 'good-one', sources: ['a'], scenes: [{ say: 'hi' }] }), []);
  const errs = sp.validateScript({ slug: 'Bad Slug', scenes: [{ say: '' }] });
  assert.ok(errs.some((e) => /slug/.test(e)) && errs.some((e) => /say required/.test(e)) && errs.some((e) => /sources/.test(e)));
  sbx.cleanup();
});

test('alignWords: exact when phoneme groups match words; proportional fallback otherwise', () => {
  const { sbx, sp } = fresh();
  const groups = [{ p: 'maɪ', s: 0.1, e: 0.3 }, { p: 'eɪdʒənt', s: 0.35, e: 0.8 }, { p: '.', s: 0.8, e: 0.85 }];
  assert.deepEqual(sp.alignWords('My agent.', groups, 1), [{ w: 'My', s: 0.1, e: 0.3 }, { w: 'agent.', s: 0.35, e: 0.8 }]);
  const fb = sp.alignWords('It had $50 left.', [{ p: 'ɪt', s: 0.2, e: 0.3 }, { p: 'hæd', s: 0.3, e: 0.5 }, { p: 'fɪfti', s: 0.5, e: 0.8 }, { p: 'dɑləɹz', s: 0.8, e: 1.1 }, { p: 'lɛft', s: 1.1, e: 1.4 }], 1.5);
  assert.equal(fb.length, 4);
  assert.equal(fb[0].s, 0.2);
  assert.ok(Math.abs(fb[3].e - 1.4) < 1e-9, 'fallback spans exactly the spoken range');
  for (let i = 1; i < fb.length; i++) assert.ok(fb[i].s >= fb[i - 1].s);
  sbx.cleanup();
});

test('chunkWords: at most 3 words, splits at punctuation, keeps chunks short', () => {
  const { sbx, sp } = fresh();
  const w = (s) => s.split(' ').map((x, i) => ({ w: x, s: i, e: i + 0.5 }));
  const chunks = sp.chunkWords(w('My agent had fifty real dollars. Tonight it did nothing.')).map((c) => c.map((x) => x.w).join(' '));
  assert.deepEqual(chunks, ['My agent had', 'fifty real', 'dollars.', 'Tonight it did', 'nothing.']);
  for (const c of chunks) assert.ok(c.split(' ').length <= 3);
  sbx.cleanup();
});

test('buildAss: valid timestamps, uppercase captions, gold emphasis, ordered events', () => {
  const { sbx, sp } = fresh();
  assert.equal(sp.assTime(0), '0:00:00.00');
  assert.equal(sp.assTime(61.237), '0:01:01.24');
  const ass = sp.buildAss([{ offset: 2, duration: 2, words: [{ w: 'it', s: 0.1, e: 0.3 }, { w: 'did', s: 0.3, e: 0.5 }, { w: 'nothing.', s: 0.5, e: 1.0 }] }], ['nothing']);
  const events = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
  assert.equal(events.length, 1);
  assert.match(events[0], /^Dialogue: 0,0:00:02\.10,0:00:03\.35,Cap,,0,0,0,,IT DID \{\\c&H0030C8F5&?\}NOTHING\{\\c\}$/);
  assert.match(ass, /PlayResX: 1080/);
  sbx.cleanup();
});

test('provider chain: no key -> local; 401 marks provider down for the run; cap and --no-ai skip paid providers', async () => {
  const { sbx, vp } = fresh();
  const spend = sbx.file('spend.jsonl');
  const calls = [];
  const paid = (name, behaviour) => ({ name, paid: true, available: () => ({ ok: true }), async generate(s) { calls.push(`${name}:${s.index}`); return behaviour(s); } });
  const local = { name: 'local', paid: false, available: () => ({ ok: true }), async generate(s) { calls.push(`local:${s.index}`); return s.outPath; } };

  let run = vp.newRun();
  // deps cut the real Veo CLI off: it runs as a separate process, so the sandbox's in-process network block
  // would NOT stop it (this test once made a real, zero-cost 429 call because of that).
  const r0 = await vp.makeSceneClip({ index: 0, outPath: 'x' }, run, { chain: vp.DEFAULT_CHAIN.filter((p) => p.name !== 'local').concat(local), spendLog: spend, deps: { fileExists: () => false } });
  assert.equal(r0.provider, 'local', 'veo has no CLI/config in the sandbox and vyro has no key');
  assert.ok(run.log.some((l) => l.provider === 'vyro' && /VYRO_API_KEY/.test(l.skipped)));

  calls.length = 0;
  run = vp.newRun();
  const bad = paid('vyro', () => { throw new vp.ProviderDown('vyro', 'invalid api key (401)'); });
  await vp.makeSceneClip({ index: 0, outPath: 'a' }, run, { chain: [bad, local], spendLog: spend });
  await vp.makeSceneClip({ index: 1, outPath: 'b' }, run, { chain: [bad, local], spendLog: spend });
  assert.deepEqual(calls, ['vyro:0', 'local:0', 'local:1'], 'a down provider is not retried on later scenes');
  const logged = fs.readFileSync(spend, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(logged.length, 1);
  assert.equal(logged[0].ok, false);

  calls.length = 0;
  run = vp.newRun({ maxAiClips: 1 });
  const good = paid('vyro', (s) => ({ outPath: s.outPath, id: 'job1' }));
  await vp.makeSceneClip({ index: 0, outPath: 'a' }, run, { chain: [good, local], spendLog: spend });
  await vp.makeSceneClip({ index: 1, outPath: 'b' }, run, { chain: [good, local], spendLog: spend });
  assert.deepEqual(calls, ['vyro:0', 'local:1'], 'MAX_AI_CLIPS caps paid calls per run');

  calls.length = 0;
  run = vp.newRun({ noAi: true });
  await vp.makeSceneClip({ index: 0, outPath: 'a' }, run, { chain: [good, local], spendLog: spend });
  assert.deepEqual(calls, ['local:0']);
  sbx.cleanup();
});

test('vyro client: 401 and 402 are provider-down; success polls, downloads over https and renders', async () => {
  const { sbx, vp } = fresh();
  const deps = (responses) => {
    const seen = [];
    return {
      seen,
      hasSecret: () => true,
      loadSecret: () => 'test-key',
      sleep: async () => {},
      pollMs: 0,
      httpJson: async (req) => { seen.push(`${req.method} ${req.url}`); return responses.shift(); },
      download: async (url, out) => { seen.push(`download ${url}`); fs.writeFileSync(out, 'x'); return out; },
      runFfmpeg: (args) => { seen.push('ffmpeg'); fs.writeFileSync(args[args.length - 1], 'mp4'); },
    };
  };
  await assert.rejects(vp.vyro.generate({ prompt: 'p', seconds: 3, outPath: sbx.file('a.mp4') }, deps([{ status: 401, json: {}, text: '' }])), (e) => e instanceof vp.ProviderDown && /401/.test(e.message));
  await assert.rejects(vp.vyro.generate({ prompt: 'p', seconds: 3, outPath: sbx.file('a.mp4') }, deps([{ status: 402, json: {}, text: '' }])), (e) => e instanceof vp.ProviderDown && /402/.test(e.message));
  const d = deps([
    { status: 200, json: { id: 'job-9' } },
    { status: 200, json: { status: 'processing' } },
    { status: 200, json: { video: { status: 'success', url: { generation: 'https://cdn.example/v.mp4' } } } },
  ]);
  const out = sbx.file('ok.mp4');
  const res = await vp.vyro.generate({ prompt: 'p', seconds: 3, outPath: out }, d);
  assert.equal(res.id, 'job-9');
  assert.ok(fs.existsSync(out));
  assert.deepEqual(d.seen, ['POST https://api.vyro.ai/v2/video/text-to-video', 'GET https://api.vyro.ai/v2/assets/job-9/status', 'GET https://api.vyro.ai/v2/assets/job-9/status', 'download https://cdn.example/v.mp4', 'ffmpeg']);
  sbx.cleanup();
});

test('run lock: a live holder blocks a second run; a stale lock from a dead pid is recovered', () => {
  const { sbx, sp } = fresh();
  const lock = sbx.file('shorts.lock');
  const release = sp.acquireLock(lock);
  assert.throws(() => sp.acquireLock(lock), /another shorts-pipeline run is active/);
  release();
  fs.writeFileSync(lock, '999999');
  const again = sp.acquireLock(lock);
  assert.equal(fs.readFileSync(lock, 'utf8'), String(process.pid));
  again();
  sbx.cleanup();
});

test('end to end: real ffmpeg render of a 2-scene short with a deterministic fake TTS', { timeout: 180000 }, async () => {
  const { sbx, sp, vp } = fresh();
  const fakeTts = (scenes, { workDir }) => scenes.map((s, i) => {
    const wav = path.join(workDir, `voice${i}.wav`);
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2:sample_rate=24000', '-ac', '1', wav]);
    assert.equal(r.status, 0);
    const words = sp.textWords(s.say);
    return { wav, duration: 1.2, groups: words.map((w, j) => ({ p: w, s: 0.1 + j * 0.3, e: 0.35 + j * 0.3 })) };
  });
  const out = sbx.file('media');
  const script = { slug: 'e2e-test', sources: ['test fixture'], emphasis: ['nothing'], scenes: [{ say: 'It had fifty.', visual: { title: 'TEST', lines: ['a: 1', 'b: 2'] } }, { say: 'It did nothing.', visual: { lines: ['c: 3'] } }] };
  const res = await sp.renderShort(script, { outDir: out, run: vp.newRun({ noAi: true }), tts: fakeTts, chain: [vp.local] });
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-show_entries', 'format=duration', '-of', 'json', res.mp4], { encoding: 'utf8' });
  const info = JSON.parse(probe.stdout);
  const video = info.streams.find((s) => s.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1920);
  assert.ok(info.streams.some((s) => s.codec_type === 'audio'), 'has an audio stream');
  const expected = 2 * (1.2 + sp.SCENE_GAP);
  assert.ok(Math.abs(Number(info.format.duration) - expected) < 0.15, `duration ${info.format.duration} ~ ${expected}`);
  assert.ok(fs.statSync(res.cover).size > 1000, 'cover jpg written');
  assert.deepEqual(res.meta.providers, ['local', 'local']);
  assert.ok(!fs.readdirSync(out).some((f) => f.includes('.part')), 'no partial files left behind');
  sbx.cleanup();
});

test('long titles shrink to fit the frame; short ones keep full size', () => {
  const { sbx, vp } = fresh();
  assert.equal(vp.titleFontSize('REAL MONEY'), 84);
  const size = vp.titleFontSize('AGENTS THAT RUN THEMSELVES');
  assert.ok(size < 84 && 26 * 0.68 * size <= 980, 'the CTA that clipped in the first batch now fits');
  assert.ok(vp.titleFontSize('X'.repeat(200)) >= 36, 'never shrinks below a readable floor');
  sbx.cleanup();
});

test('TTS cache: a fully cached script never starts the voice model', () => {
  const { sbx, sp } = fresh();
  const cacheDir = sbx.file('tts-cache');
  const workDir = sbx.file('work');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });
  const key = sp.ttsCacheKey('Hello there.', 'af_heart', 1.1);
  fs.writeFileSync(path.join(cacheDir, `${key}.wav`), 'RIFF-fake');
  fs.writeFileSync(path.join(cacheDir, `${key}.json`), JSON.stringify({ duration: 1.5, groups: [{ p: 'h', s: 0, e: 1 }] }));
  const res = sp.kokoroTts([{ say: 'Hello there.' }], { voice: 'af_heart', speed: 1.1, workDir, cacheDir });
  assert.equal(res[0].duration, 1.5);
  assert.equal(fs.readFileSync(res[0].wav, 'utf8'), 'RIFF-fake');
  assert.notEqual(sp.ttsCacheKey('Hello there.', 'af_heart', 1.2), key, 'speed is part of the key');
  sbx.cleanup();
});

test('veo provider: 429 quota is provider-down at zero cost; success loops the clip into the scene; no key -> unavailable', async () => {
  const { sbx, vp } = fresh();
  assert.equal(vp.veoDuration(3), 4);
  assert.equal(vp.veoDuration(5.5), 6);
  assert.equal(vp.veoDuration(9), 8);
  assert.equal(vp.veo.available({ fileExists: () => true, readConfig: () => '{"api_key":"x"}' }).ok, true);
  assert.equal(vp.veo.available({ fileExists: () => true, readConfig: () => '{}' }).ok, false);
  assert.equal(vp.veo.available({ fileExists: () => false }).ok, false);
  const quota = async () => ({ exitCode: 1, stdout: JSON.stringify({ success: false, error: 'API request failed: 429 Quota Exceeded (RESOURCE_EXHAUSTED).' }), stderr: '' });
  await assert.rejects(vp.veo.generate({ prompt: 'p', seconds: 4, outPath: sbx.file('a.mp4') }, { runVeoCli: quota }), (e) => e instanceof vp.ProviderDown && /429/.test(e.message));
  const calls = [];
  const ok = async (args) => { calls.push(args); fs.writeFileSync(args[args.indexOf('-o') + 1], 'raw'); return { exitCode: 0, stdout: JSON.stringify({ success: true, operation_name: 'op-1' }), stderr: '' }; };
  const out = sbx.file('b.mp4');
  const res = await vp.veo.generate({ prompt: 'a scene', seconds: 5.2, outPath: out }, { runVeoCli: ok, runFfmpeg: (a) => fs.writeFileSync(a[a.length - 1], 'mp4') });
  assert.equal(res.id, 'op-1');
  assert.ok(fs.existsSync(out));
  assert.ok(!fs.existsSync(`${out}.veo.mp4`), 'raw clip cleaned up');
  assert.deepEqual(calls[0].slice(calls[0].indexOf('-a'), calls[0].indexOf('-a') + 2), ['-a', '9:16']);
  assert.equal(calls[0][calls[0].indexOf('-d') + 1], '6');
  sbx.cleanup();
});

test('paid b-roll keeps the story text: the overlay filter is appended to the re-encode of both paid providers', async () => {
  const { sbx, vp } = fresh();
  const scene = { prompt: 'p', seconds: 4, title: 'THE BUG', lines: ['bid: 1', 'ask: 0'], palette: vp.PALETTES[0] };
  const seen = [];
  const ff = (args) => { seen.push(args[args.indexOf('-vf') + 1]); fs.writeFileSync(args[args.length - 1], 'mp4'); };
  const cli = async (args) => { fs.writeFileSync(args[args.indexOf('-o') + 1], 'raw'); return { exitCode: 0, stdout: JSON.stringify({ success: true }), stderr: '' }; };
  await vp.veo.generate({ ...scene, outPath: sbx.file('v.mp4') }, { runVeoCli: cli, runFfmpeg: ff });
  assert.match(seen[0], /crop=1080:1920/);
  assert.match(seen[0], /drawtext=.*textfile=/, 'title/terminal lines are drawn over the clip');
  assert.match(seen[0], /drawbox=/);
  const bare = vp.withOverlay({ seconds: 4, lines: [], palette: vp.PALETTES[0] }, 'BASE');
  assert.equal(bare.vf, 'BASE', 'no text -> no overlay filter');
  bare.cleanup();
  sbx.cleanup();
});

test('manual clips: a hand-made scene-N clip is found, wins over paid providers, and is rendered under the text card', async () => {
  const { sbx, sp, vp } = fresh();
  const dir = sbx.file('media-in');
  fs.mkdirSync(path.join(dir, 'demo'), { recursive: true });
  const src = path.join(dir, 'demo', 'scene-2.mp4');
  const mk = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=24:duration=2', '-pix_fmt', 'yuv420p', src]);
  assert.equal(mk.status, 0, 'test clip created (landscape, 2s)');
  assert.equal(vp.manualClipFor({ slug: 'demo', index: 0 }, { manualDir: dir }), null, 'scene 1 has no clip');
  assert.equal(vp.manualClipFor({ slug: 'demo', index: 1 }, { manualDir: dir }), src, 'index 1 == scene-2');
  assert.equal(vp.manualClipFor({ index: 1 }, { manualDir: dir }), null, 'no slug -> no manual lookup');
  const calls = [];
  const paid = { name: 'veo', paid: true, available: () => ({ ok: true }), async generate() { calls.push('veo'); return {}; } };
  const run = vp.newRun();
  const outPath = sbx.file('scene.mp4');
  const res = await vp.makeSceneClip({ index: 1, slug: 'demo', seconds: 3, title: 'HI', lines: ['a: 1'], palette: vp.PALETTES[0], outPath }, run, { chain: [vp.manual, paid, vp.local], deps: { manualDir: dir }, spendLog: sbx.file('s.jsonl') });
  assert.equal(res.provider, 'manual');
  assert.deepEqual(calls, [], 'a free hand-made clip means no paid call');
  const info = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-show_entries', 'format=duration', '-of', 'json', outPath], { encoding: 'utf8' }).stdout);
  assert.equal(info.streams[0].width, 1080);
  assert.equal(info.streams[0].height, 1920);
  assert.ok(Math.abs(Number(info.format.duration) - 3) < 0.2, 'a 2s clip is looped to the 3s scene');
  const pack = sp.promptPack({ slug: 'demo', scenes: [{ say: 'hello', visual: { prompt: 'a red door' } }] });
  assert.match(pack, /scene-1\.mp4/);
  assert.match(pack, /a red door/);
  assert.ok(!pack.includes('/home/'), 'no absolute home paths in a committed prompt pack');
  sbx.cleanup();
});
