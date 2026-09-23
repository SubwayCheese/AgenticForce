// video-providers.js -- visual sources for shorts-pipeline.js. One interface per provider:
//   available() -> {ok, reason}   and   generate({prompt, lines, title, seconds, palette, outPath}) -> outPath
// makeSceneClip() walks the chain in order and falls through on "unavailable" / provider-down, so a video
// always renders: AI b-roll when a working key exists, ffmpeg motion graphics otherwise.
//   0. manual      -- clips the owner made by hand and dropped in media-in/<slug>/scene-<n>.mp4 (free, no API)
//   1. veo         -- Google Veo through the `gemini-video` CLI that Antigravity built (2026-09-23, MCP server
//                     `gemini-video`, own venv in ~/.local/share/gemini-video). It calls Google's Gemini API with the
//                     key in ~/.gemini/video-config.json (this module never reads that key). Veo over the API needs
//                     a billed plan: on the free tier every call is 429 RESOURCE_EXHAUSTED, which takes the provider
//                     out of the run at zero cost. A billed plan pays per generated second -- see MAX_AI_CLIPS.
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
const { spawnSync, execFile } = require('child_process');
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
// Shrink long titles to fit: DejaVu Sans Bold caps average ~0.68em wide, and the frame leaves ~980px.
// (First batch clipped "AGENTS THAT RUN THEMSELVES" at a fixed 76px.)
function titleFontSize(title) {
  return Math.max(36, Math.min(76, Math.floor(980 / (String(title).length * 0.68))));
}

function localFilter({ lines = [], title, seconds, palette, tmpDir }) {
  const p = palette || PALETTES[0];
  const f = [];
  const shown = lines.slice(0, 8);
  if (title) {
    const tf = path.join(tmpDir, 'title.txt');
    fs.writeFileSync(tf, title);
    f.push(`drawtext=fontfile=${BOLD_FONT}:textfile=${tf}:expansion=none:fontsize=${titleFontSize(title)}:fontcolor=white:x=(w-text_w)/2:y=190:borderw=5:bordercolor=black@0.6`);
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

// AI b-roll is only a BACKGROUND: the same title + terminal card the local provider draws goes on top, because
// that text carries each short's actual story. Returns { vf, cleanup } for the final re-encode.
function withOverlay(scene, baseFilter) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-overlay-'));
  const overlay = localFilter({ lines: scene.lines || [], title: scene.title, seconds: Number(scene.seconds), palette: scene.palette, tmpDir });
  return { vf: overlay === 'null' ? baseFilter : `${baseFilter},${overlay}`, cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }) };
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

// ---- manual: clips the owner generated by hand (e.g. in the Gemini app with a Pro subscription) ---------------
// Drop <MANUAL_CLIPS_DIR>/<slug>/scene-<n>.mp4 (n starts at 1). The clip becomes the scene BACKGROUND under the same
// text card; landscape clips are center-cropped to 9:16. Costs nothing and needs no API, so it goes first in the chain.
const MANUAL_CLIPS_DIR = path.join(avPaths.PRODUCTS_REPO, 'courses', 'agentic-systems', 'media-in');
const MANUAL_EXTS = ['.mp4', '.mov', '.webm', '.mkv'];

function manualClipFor(scene, deps = {}) {
  if (!scene || !scene.slug) return null;
  const dir = deps.manualDir || MANUAL_CLIPS_DIR;
  const exists = deps.fileExists || fs.existsSync;
  const n = Number(scene.index) + 1;
  for (const ext of MANUAL_EXTS) {
    const f = path.join(dir, scene.slug, `scene-${n}${ext}`);
    if (exists(f)) return f;
  }
  return null;
}

const manual = {
  name: 'manual',
  paid: false,
  available: (deps = {}, scene) => (manualClipFor(scene, deps) ? { ok: true } : { ok: false, reason: 'no hand-made clip for this scene' }),
  async generate(scene, deps = {}) {
    const ff = deps.runFfmpeg || runFfmpeg;
    const src = manualClipFor(scene, deps);
    if (!src) throw new Error('manual clip disappeared');
    const part = `${scene.outPath}.part.mp4`;
    const ov = withOverlay(scene, `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}`);
    try {
      // -stream_loop covers clips shorter than the scene; -t trims longer ones. Audio is dropped (the voiceover is the audio).
      ff(['-stream_loop', '-1', '-i', src, '-t', Number(scene.seconds).toFixed(3), '-an', '-vf', ov.vf, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', part]);
      fs.renameSync(part, scene.outPath);
    } finally {
      ov.cleanup();
      fs.rmSync(part, { force: true });
    }
    return scene.outPath;
  },
};

// ---- veo (Google, via the gemini-video CLI) ------------------------------------------------------------
const GEMINI_VIDEO_BIN = path.join(os.homedir(), '.local', 'share', 'gemini-video', 'venv', 'bin', 'gemini-video');
const GEMINI_VIDEO_CONFIG = path.join(os.homedir(), '.gemini', 'video-config.json');
const VEO_MODEL = 'veo-3.1-lite-generate-preview'; // cheapest Veo 3.1 tier; change here to trade cost for quality
const VEO_TIMEOUT_MS = 12 * 60 * 1000;

function veoDuration(seconds) { return seconds <= 4 ? 4 : seconds <= 6 ? 6 : 8; } // Veo renders 4, 6 or 8 s

function runVeoCli(args) {
  return new Promise((resolve) => {
    execFile(GEMINI_VIDEO_BIN, args, { timeout: VEO_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, env: { ...process.env } }, (err, stdout, stderr) => {
      resolve({ exitCode: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

function parseVeoJson(stdout) {
  const i = stdout.indexOf('{');
  if (i < 0) return null;
  try { return JSON.parse(stdout.slice(i)); } catch (_) { return null; }
}

const veo = {
  name: 'veo',
  paid: true,
  available: (deps = {}) => {
    const exists = deps.fileExists || fs.existsSync;
    if (!exists(GEMINI_VIDEO_BIN)) return { ok: false, reason: 'gemini-video CLI not installed' };
    let hasKey = false;
    try { hasKey = !!JSON.parse((deps.readConfig || ((f) => fs.readFileSync(f, 'utf8')))(GEMINI_VIDEO_CONFIG)).api_key; } catch (_) { /* no config */ }
    return hasKey ? { ok: true } : { ok: false, reason: 'no api_key in ~/.gemini/video-config.json' };
  },
  async generate(scene, deps = {}) {
    const { prompt, seconds, outPath } = scene;
    const runCli = deps.runVeoCli || runVeoCli;
    const ff = deps.runFfmpeg || runFfmpeg;
    const raw = `${outPath}.veo.mp4`;
    const r = await runCli(['generate', prompt, '-m', VEO_MODEL, '-a', '9:16', '-r', '720p', '-d', String(veoDuration(seconds)), '--no-audio', '-o', raw, '--json']);
    const res = parseVeoJson(r.stdout);
    const err = (res && res.error) || r.stderr || '';
    if (/RESOURCE_EXHAUSTED|429|Quota/i.test(err)) throw new ProviderDown('veo', 'quota/billing (429): Veo API needs a billed plan');
    if (/API key|PERMISSION_DENIED|401|403|UNAUTHENTICATED/i.test(err)) throw new ProviderDown('veo', 'auth rejected');
    if (r.exitCode !== 0 || !res || !res.success || !(deps.fileExists || fs.existsSync)(raw)) throw new Error(`veo generation failed: ${String(err).slice(0, 200) || 'no output'}`);
    const part = `${outPath}.part.mp4`;
    const ov = withOverlay(scene, `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}`);
    try {
      const d = Number(seconds).toFixed(3);
      // Loop/trim the 4-8 s clip to the scene length, cover-crop 720x1280 up to 1080x1920, draw the text card on top.
      ff(['-stream_loop', '-1', '-i', raw, '-t', d, '-an', '-vf', ov.vf, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', part]);
      fs.renameSync(part, outPath);
    } finally {
      ov.cleanup();
      fs.rmSync(raw, { force: true });
      fs.rmSync(part, { force: true });
    }
    return { outPath, id: res.operation_name || null };
  },
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
  async generate(scene, deps = {}) {
    const { prompt, seconds, outPath } = scene;
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
        const ov = withOverlay(scene, `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}`);
        try {
          ff(['-stream_loop', '-1', '-i', raw, '-t', d, '-an', '-vf', ov.vf, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', part]);
          fs.renameSync(part, outPath);
        } finally {
          ov.cleanup();
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

const DEFAULT_CHAIN = [manual, veo, vyro, local];

// Walks the chain for one scene. `run` is per-pipeline-run state: {down:Set, aiClips:number, maxAiClips, noAi, log[]}.
async function makeSceneClip(scene, run, { chain = DEFAULT_CHAIN, deps = {}, spendLog = SPEND_LOG } = {}) {
  for (const p of chain) {
    if (run.down.has(p.name)) continue;
    if (p.paid && (run.noAi || run.aiClips >= run.maxAiClips)) continue;
    const av = p.available(deps, scene);
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

module.exports = { manual, manualClipFor, MANUAL_CLIPS_DIR, withOverlay, titleFontSize, RENDER_CPUS, niced, MAX_LINE_CHARS, makeSceneClip, newRun, local, vyro, veo, veoDuration, DEFAULT_CHAIN, ProviderDown, PALETTES, localFilter, runFfmpeg, W, H, FPS, MAX_AI_CLIPS_DEFAULT, BOLD_FONT };
