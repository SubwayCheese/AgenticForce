// video-providers.js -- visual sources for shorts-pipeline.js. One interface per provider:
//   available() -> {ok, reason}   and   generate({prompt, lines, title, seconds, palette, outPath}) -> outPath
// makeSceneClip() walks the chain in order and falls through on "unavailable" / provider-down, so a video
// always renders: AI b-roll when a working key exists, ffmpeg motion graphics otherwise.
//   1. antigravity -- placeholder until the owner has access (no public API details yet)
//   2. vyro        -- ImagineArt text-to-video; only when VYRO_API_KEY exists. 401 (bad key) and 402 (out of
//                     credits) take it out of the chain for the rest of the run. Every paid call is appended to
//                     the spend log, and MAX_AI_CLIPS caps paid calls per run.
//   3. local       -- ffmpeg-only terminal/code card over a moving gradient; always available, costs nothing.
// Note (found live 2026-09-23): api.vyro.ai validates `style` BEFORE auth, so a 400 "Invalid style" says
// nothing about the key -- only a 401 does.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');
const secrets = require('../platform/secrets-broker.js');

const W = 1080;
const H = 1920;
const FPS = 30;
const MAX_AI_CLIPS_DEFAULT = 6;
const VYRO_STYLE = 'kling-1.0-standard';
const VYRO_POLL_MS = 10000;
const VYRO_MAX_WAIT_MS = 8 * 60 * 1000;
const SPEND_LOG = avPaths.bus('revenue-video-spend.jsonl');
const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
const MONO_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf';
const MAX_LINE_CHARS = 34; // DejaVu Sans Mono at 44px is ~26.5px/char; 34 chars fit the 925px card interior
const BOLD_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const PALETTES = [
  { c0: '0x0b1020', c1: '0x1b2a4a', ink: '0x7CFC8A' },
  { c0: '0x140c1f', c1: '0x3a1f4a', ink: '0xF2C14E' },
  { c0: '0x06161a', c1: '0x114a52', ink: '0x9BE7FF' },
  { c0: '0x1a0d0a', c1: '0x4a2414', ink: '0xFFB38A' },
];

class ProviderDown extends Error {
  constructor(provider, reason) { super(`${provider} down: ${reason}`); this.provider = provider; this.reason = reason; }
}

// nice -n 10: renders share the Pi with C1's supervisor and the queue daemon; a render must never starve them.
// taskset to 2 of 4 cores: at full 4-core load this Pi reported under-voltage + throttling (get_throttled
// 0x50005, 2026-09-23) -- its power supply can't feed sustained all-core load, and brownouts risk the SD card
// that also holds C1's live state. Slower renders are the right trade.
const RENDER_CPUS = '0-1';
function niced(cmd, args) { return ['-n', '10', 'taskset', '-c', RENDER_CPUS, cmd, ...args]; }
function runFfmpeg(args) {
  const r = spawnSync('nice', niced('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-threads', '2', ...args]), { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status}): ${(r.stderr || '').slice(-600)}`);
}

// ---- local: ffmpeg motion graphics -------------------------------------------------------------------
// Lines appear one by one across the first ~60% of the scene (a "typing" feel without per-character cost).
// Text goes through textfile= with expansion=none so no user text is ever parsed as an ffmpeg expression.
function localFilter({ lines = [], title, seconds, palette, tmpDir }) {
  const p = palette || PALETTES[0];
  const f = [];
  const shown = lines.slice(0, 8);
  if (title) {
    const tf = path.join(tmpDir, 'title.txt');
    fs.writeFileSync(tf, title);
    f.push(`drawtext=fontfile=${BOLD_FONT}:textfile=${tf}:expansion=none:fontsize=76:fontcolor=white:x=(w-text_w)/2:y=190:borderw=5:bordercolor=black@0.6`);
  }
  if (shown.length) {
    const boxY = title ? 330 : 280;
    const boxH = 100 + shown.length * 74;
    f.push(`drawbox=x=60:y=${boxY}:w=960:h=${boxH}:color=0x000000@0.6:t=fill`);
    f.push(`drawbox=x=60:y=${boxY}:w=960:h=46:color=0xffffff@0.08:t=fill`);
    const step = shown.length > 1 ? (seconds * 0.6) / shown.length : 0;
    shown.forEach((line, i) => {
      const lf = path.join(tmpDir, `line${i}.txt`);
      fs.writeFileSync(lf, String(line).slice(0, MAX_LINE_CHARS));
      const at = (0.15 + i * step).toFixed(2);
      f.push(`drawtext=fontfile=${MONO_FONT}:textfile=${lf}:expansion=none:fontsize=44:fontcolor=${p.ink}:x=92:y=${boxY + 74 + i * 74}:enable='gte(t,${at})'`);
    });
  }
  return f.length ? f.join(',') : 'null';
}

const local = {
  name: 'local',
  paid: false,
  available: () => ({ ok: true }),
  async generate({ lines, title, seconds, palette, outPath }, deps = {}) {
    const ff = deps.runFfmpeg || runFfmpeg;
    const p = palette || PALETTES[0];
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-local-'));
    try {
      const d = Number(seconds).toFixed(3);
      const part = `${outPath}.part.mp4`;
      ff([
        '-f', 'lavfi', '-i', `gradients=s=${W}x${H}:c0=${p.c0}:c1=${p.c1}:x0=0:y0=0:x1=${W}:y1=${H}:speed=0.015:d=${d}:r=${FPS}`,
        '-vf', localFilter({ lines, title, seconds: Number(seconds), palette: p, tmpDir }),
        '-t', d, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', part,
      ]);
      fs.renameSync(part, outPath);
      return outPath;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
};

// ---- antigravity: placeholder -------------------------------------------------------------------------
const antigravity = {
  name: 'antigravity',
  paid: true,
  available: () => ({ ok: false, reason: 'not configured (owner access pending; no API details yet)' }),
  async generate() { throw new ProviderDown('antigravity', 'not configured'); },
};

// ---- vyro (ImagineArt) --------------------------------------------------------------------------------
function httpJson({ method, url, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ method, hostname: u.hostname, path: u.pathname + u.search, headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { /* non-JSON body */ }
        resolve({ status: res.statusCode, json, text: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('request timed out')));
    if (body) req.write(body);
    req.end();
  });
}

// https only, bounded size, written to a .part file and renamed only when complete (no half-files on disk).
function download(url, outPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (_) { reject(new Error('download: invalid url')); return; }
    if (u.protocol !== 'https:') { reject(new Error(`download: refusing non-https url (${u.protocol})`)); return; }
    https.get(u, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 3) { reject(new Error('download: too many redirects')); return; }
        download(new URL(res.headers.location, u).toString(), outPath, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`download HTTP ${res.statusCode}`)); return; }
      const part = `${outPath}.part`;
      const out = fs.createWriteStream(part);
      let bytes = 0;
      res.on('data', (c) => {
        bytes += c.length;
        if (bytes > MAX_DOWNLOAD_BYTES) { res.destroy(new Error('download exceeds size cap')); }
      });
      res.on('error', (e) => { out.destroy(); fs.rmSync(part, { force: true }); reject(e); });
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(part, outPath); resolve(outPath); }));
      out.on('error', (e) => { fs.rmSync(part, { force: true }); reject(e); });
    }).on('error', reject);
  });
}

function multipart(fields) {
  const boundary = `----av${Date.now().toString(16)}`;
  const parts = [];
  for (const [k, v] of Object.entries(fields)) parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  parts.push(`--${boundary}--\r\n`);
  return { body: parts.join(''), contentType: `multipart/form-data; boundary=${boundary}` };
}

function pick(obj, ...paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

const vyro = {
  name: 'vyro',
  paid: true,
  available: (deps = {}) => ((deps.hasSecret || secrets.hasSecret)('VYRO_API_KEY') ? { ok: true } : { ok: false, reason: 'VYRO_API_KEY not set' }),
  async generate({ prompt, seconds, outPath }, deps = {}) {
    const http = deps.httpJson || httpJson;
    const dl = deps.download || download;
    const ff = deps.runFfmpeg || runFfmpeg;
    const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    const key = (deps.loadSecret || secrets.loadSecret)('VYRO_API_KEY');
    const auth = { Authorization: `Bearer ${key}` };
    const { body, contentType } = multipart({ prompt, style: VYRO_STYLE, aspect_ratio: '9:16' });
    const sub = await http({ method: 'POST', url: 'https://api.vyro.ai/v2/video/text-to-video', headers: { ...auth, 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body) }, body });
    if (sub.status === 401) throw new ProviderDown('vyro', 'invalid api key (401)');
    if (sub.status === 402) throw new ProviderDown('vyro', 'out of credits (402)');
    const id = pick(sub.json, 'id', 'data.id', 'video.uuid', 'uuid');
    if (sub.status >= 300 || !id) throw new Error(`vyro submit failed: HTTP ${sub.status} ${String(sub.text).slice(0, 200)}`);
    const deadline = Date.now() + (deps.maxWaitMs || VYRO_MAX_WAIT_MS);
    for (;;) {
      await sleep(deps.pollMs === undefined ? VYRO_POLL_MS : deps.pollMs);
      const st = await http({ method: 'GET', url: `https://api.vyro.ai/v2/assets/${encodeURIComponent(id)}/status`, headers: auth });
      const url = pick(st.json, 'video.url.generation', 'data.video.url.generation', 'url.generation');
      const state = String(pick(st.json, 'video.status', 'status', 'data.status') || '').toLowerCase();
      if (url) {
        const raw = `${outPath}.src.mp4`;
        await dl(url, raw);
        const d = Number(seconds).toFixed(3);
        // Loop the (typically 5s) clip to cover the scene, then cover-crop to 1080x1920.
        const part = `${outPath}.part.mp4`;
        try {
          ff(['-stream_loop', '-1', '-i', raw, '-t', d, '-an', '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}`, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', part]);
          fs.renameSync(part, outPath);
        } finally {
          fs.rmSync(raw, { force: true });
          fs.rmSync(part, { force: true });
        }
        return { outPath, id };
      }
      if (/fail|error|reject/.test(state)) throw new Error(`vyro job ${id} failed: ${state}`);
      if (Date.now() > deadline) throw new Error(`vyro job ${id} timed out`);
    }
  },
};

const DEFAULT_CHAIN = [antigravity, vyro, local];

// Walks the chain for one scene. `run` is per-pipeline-run state: {down:Set, aiClips:number, maxAiClips, noAi, log[]}.
async function makeSceneClip(scene, run, { chain = DEFAULT_CHAIN, deps = {}, spendLog = SPEND_LOG } = {}) {
  for (const p of chain) {
    if (run.down.has(p.name)) continue;
    if (p.paid && (run.noAi || run.aiClips >= run.maxAiClips)) continue;
    const av = p.available(deps);
    if (!av.ok) { run.log.push({ provider: p.name, skipped: av.reason }); continue; }
    try {
      if (p.paid) run.aiClips++;
      const res = await p.generate(scene, deps);
      if (p.paid) appendSpend(spendLog, { provider: p.name, ok: true, jobId: res && res.id, scene: scene.index });
      run.log.push({ provider: p.name, ok: true, scene: scene.index });
      return { provider: p.name, path: scene.outPath };
    } catch (err) {
      if (p.paid) appendSpend(spendLog, { provider: p.name, ok: false, error: err.message, scene: scene.index });
      if (err instanceof ProviderDown) run.down.add(p.name);
      run.log.push({ provider: p.name, error: err.message, scene: scene.index });
    }
  }
  throw new Error(`no provider could render scene ${scene.index}`);
}

function appendSpend(file, entry) {
  try { fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'); } catch (_) { /* logging must never break a render */ }
}

function newRun({ maxAiClips = MAX_AI_CLIPS_DEFAULT, noAi = false } = {}) {
  return { down: new Set(), aiClips: 0, maxAiClips, noAi, log: [] };
}

module.exports = { RENDER_CPUS, niced, MAX_LINE_CHARS, makeSceneClip, newRun, local, vyro, antigravity, DEFAULT_CHAIN, ProviderDown, PALETTES, localFilter, runFfmpeg, W, H, FPS, MAX_AI_CLIPS_DEFAULT, BOLD_FONT };
