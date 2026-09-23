// shorts-pipeline.js -- renders vertical short videos (Reels/Shorts/TikTok) from a script JSON.
//   script -> content lint -> Kokoro voiceover per scene (+ phoneme timings -> word timings) -> 2-3 word captions
//   (ASS, burned in) -> one visual per scene from video-providers.js -> concat 1080x1920@30 + audio -> mp4 + cover.
// Design borrowed from MoneyPrinterTurbo (script/TTS/subtitles/visuals/assemble), rebuilt light enough for a Pi.
// Voice is Kokoro-82M (Apache-2.0 weights) run locally: edge-tts was rejected for published output because it
// uses an unofficial Microsoft endpoint (plan review, 2026-09-23).
//
// Usage: node shorts-pipeline.js <script.json> [more.json ...] [--out DIR] [--no-ai] [--max-ai N]
//        node shorts-pipeline.js --check
// Script JSON: { slug, voice?, speed?, emphasis?: [words], sources: [..], scenes: [{ say, visual: { lines?, title?, prompt? } }] }

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const providers = require('./video-providers.js');

const DATA_DIR = path.join(os.homedir(), '.local', 'share', 'agentvault');
const VENV_PY = path.join(DATA_DIR, 'venv-media', 'bin', 'python');
const KOKORO_MODEL = path.join(DATA_DIR, 'kokoro', 'kokoro-v1.0-timed.onnx');
const KOKORO_VOICES = path.join(DATA_DIR, 'kokoro', 'voices-v1.0.bin');
const KOKORO_MODEL_SHA256 = 'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a';
const KOKORO_VERSION = '0.6.1';
const DEFAULT_OUT = path.join(avPaths.PRODUCTS_REPO, 'courses', 'agentic-systems', 'media');
const LOCK_PATH = avPaths.bus('shorts-pipeline.lock');
const SCENE_GAP = 0.18; // seconds of silence after each scene -- lets a cut land between sentences
const GOLD = '&H0030C8F5'; // ASS colours are &HAABBGGRR -- this is #F5C830

// ---- content lint (plan review C2) ------------------------------------------------------------------------
// Anything that looks like an identifier, credential, address or local path fails the render. Content is
// hand-written; this is the backstop, not the process.
const LINT_RULES = [
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['api-key-like', /\b(sk|pk|rk|apik|vk|biz|whsec|ghp|am_us)[-_][A-Za-z0-9_-]{8,}/i],
  ['ipv4', /\b\d{1,3}(\.\d{1,3}){3}\b/],
  ['home-path', /\/home\/[a-z]/i],
  ['uuid', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
  ['long-hex', /\b[0-9a-f]{24,}\b/i],
  ['long-token', /\b[A-Za-z0-9+/]{40,}={0,2}/],
  ['hostname', /\b[a-z0-9-]+\.(local|internal|lan)\b/i],
];

function lintText(text) {
  const hits = [];
  for (const [name, re] of LINT_RULES) {
    const m = re.exec(String(text));
    if (m) hits.push({ rule: name, match: m[0].slice(0, 40) });
  }
  return hits;
}

function lintScript(script) {
  const strings = [];
  (function walk(v) {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (k !== 'sources') walk(x); });
  })(script);
  return strings.flatMap((s) => lintText(s).map((h) => ({ ...h, in: s.slice(0, 60) })));
}

function validateScript(script) {
  const errs = [];
  if (!script || typeof script !== 'object') return ['script is not an object'];
  if (!/^[a-z0-9-]{3,60}$/.test(script.slug || '')) errs.push('slug must be 3-60 chars of a-z0-9-');
  if (!Array.isArray(script.scenes) || !script.scenes.length) errs.push('scenes[] required');
  else script.scenes.forEach((s, i) => { if (!s || typeof s.say !== 'string' || !s.say.trim()) errs.push(`scene ${i}: say required`); });
  if (!Array.isArray(script.sources) || !script.sources.length) errs.push('sources[] required (plan review I6: provenance)');
  return errs;
}

// ---- timing ---------------------------------------------------------------------------------------------
function textWords(say) {
  return String(say).split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
}

// Kokoro phoneme groups -> text words. Exact when the phonemizer produced one group per word; otherwise
// (numbers, abbreviations) fall back to spreading the words over the spoken span by length.
function alignWords(say, groups, duration) {
  const words = textWords(say);
  const spoken = (groups || []).filter((g) => /[^\s.,!?;:…"'()\-–—]/.test(g.p));
  if (words.length && spoken.length === words.length) {
    return words.map((w, i) => ({ w, s: spoken[i].s, e: spoken[i].e }));
  }
  const s0 = spoken.length ? spoken[0].s : 0;
  const e0 = spoken.length ? spoken[spoken.length - 1].e : duration;
  const weights = words.map((w) => w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = s0;
  return words.map((w, i) => {
    const d = ((e0 - s0) * weights[i]) / total;
    const out = { w, s: t, e: t + d };
    t += d;
    return out;
  });
}

// 1-3 words per caption, never across a sentence/clause end, never more than 16 characters.
function chunkWords(words) {
  const chunks = [];
  let cur = [];
  const flush = () => { if (cur.length) chunks.push(cur); cur = []; };
  for (const w of words) {
    const text = cur.map((x) => x.w).concat(w.w).join(' ');
    if (cur.length >= 3 || (cur.length && text.length > 16)) flush();
    cur.push(w);
    if (/[.,!?;:…]$/.test(w.w)) flush();
  }
  flush();
  return chunks;
}

function assTime(t) {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

function assEscape(s) {
  return String(s).replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim();
}

function captionText(chunk, emphasis) {
  const em = new Set((emphasis || []).map((x) => x.toLowerCase()));
  return chunk.map((x) => {
    const clean = assEscape(x.w).replace(/[.,;:]+$/, '');
    const up = clean.toUpperCase();
    return em.has(clean.toLowerCase().replace(/[^a-z0-9$%]/g, '')) ? `{\\c${GOLD}}${up}{\\c}` : up;
  }).join(' ');
}

// scenes: [{ offset, duration, words:[{w,s,e}] }] (word times relative to the scene start)
function buildAss(scenes, emphasis) {
  const head = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${providers.W}`, `PlayResY: ${providers.H}`, 'WrapStyle: 2', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Cap,DejaVu Sans,92,&H00FFFFFF,&H000000FF,&H00000000,&H78000000,1,0,0,0,100,100,0,0,1,7,3,2,70,70,560,1',
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const lines = [];
  for (const sc of scenes) {
    const chunks = chunkWords(sc.words);
    chunks.forEach((ch, i) => {
      const start = sc.offset + ch[0].s;
      const next = chunks[i + 1] ? sc.offset + chunks[i + 1][0].s : sc.offset + Math.min(sc.duration, ch[ch.length - 1].e + 0.35);
      const end = Math.max(start + 0.2, next);
      lines.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Cap,,0,0,0,,${captionText(ch, emphasis)}`);
    });
  }
  return head.concat(lines).join('\n') + '\n';
}

// ---- TTS (Kokoro, local) --------------------------------------------------------------------------------
const KOKORO_PY = `
import sys, json, wave
import numpy as np
from kokoro_onnx import Kokoro
req = json.load(sys.stdin)
k = Kokoro(req["model"], req["voices"])
out = []
for sc in req["scenes"]:
    a, sr, tm = k.create_timed(sc["text"], voice=req["voice"], speed=req["speed"], lang="en-us")
    with wave.open(sc["wav"], "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())
    groups, cur = [], None
    for t in tm:
        if t.phoneme.strip() == "":
            if cur: groups.append(cur); cur = None
            continue
        if cur is None: cur = {"p": "", "s": float(t.start), "e": float(t.end)}
        cur["p"] += t.phoneme; cur["e"] = float(t.end)
    if cur: groups.append(cur)
    out.append({"wav": sc["wav"], "duration": len(a) / sr, "groups": groups})
print("@@JSON@@" + json.dumps(out))
`;

function kokoroTts(scenes, { voice = 'af_heart', speed = 1.08, workDir }) {
  const req = {
    model: KOKORO_MODEL, voices: KOKORO_VOICES, voice, speed,
    scenes: scenes.map((s, i) => ({ text: s.say, wav: path.join(workDir, `voice${i}.wav`) })),
  };
  const r = spawnSync('nice', ['-n', '10', VENV_PY, '-c', KOKORO_PY], { input: JSON.stringify(req), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 45 * 60 * 1000 });
  const marker = (r.stdout || '').lastIndexOf('@@JSON@@');
  if (r.status !== 0 || marker < 0) throw new Error(`kokoro TTS failed (${r.status}): ${(r.stderr || '').slice(-500)}`);
  return JSON.parse(r.stdout.slice(marker + 8).trim());
}

// ---- lock (plan review I4) --------------------------------------------------------------------------------
function acquireLock(lockPath = LOCK_PATH) {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    return () => { try { fs.unlinkSync(lockPath); } catch (_) { /* already gone */ } };
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    const pid = Number(fs.readFileSync(lockPath, 'utf8'));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch (_) { /* dead */ }
    if (alive) throw new Error(`another shorts-pipeline run is active (pid ${pid})`);
    fs.unlinkSync(lockPath);
    return acquireLock(lockPath);
  }
}

// ---- render ---------------------------------------------------------------------------------------------
async function renderShort(script, { outDir = DEFAULT_OUT, run = providers.newRun(), tts = kokoroTts, chain, deps = {}, runFfmpeg = providers.runFfmpeg } = {}) {
  const errs = validateScript(script);
  if (errs.length) throw new Error(`invalid script: ${errs.join('; ')}`);
  const lint = lintScript(script);
  if (lint.length) throw new Error(`content lint failed: ${JSON.stringify(lint)}`);
  fs.mkdirSync(outDir, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `av-short-${script.slug}-`));
  try {
    const voiced = tts(script.scenes, { voice: script.voice, speed: script.speed, workDir });
    let offset = 0;
    const timed = [];
    for (let i = 0; i < script.scenes.length; i++) {
      const v = voiced[i];
      const duration = v.duration + SCENE_GAP;
      timed.push({ offset, duration, wav: v.wav, words: alignWords(script.scenes[i].say, v.groups, v.duration) });
      offset += duration;
    }
    const total = offset;
    fs.writeFileSync(path.join(workDir, 'captions.ass'), buildAss(timed, script.emphasis));

    const clips = [];
    for (let i = 0; i < script.scenes.length; i++) {
      const vis = script.scenes[i].visual || {};
      const clip = await providers.makeSceneClip({
        index: i, prompt: vis.prompt || script.scenes[i].say, lines: vis.lines || [], title: vis.title,
        seconds: timed[i].duration, palette: providers.PALETTES[i % providers.PALETTES.length],
        outPath: path.join(workDir, `scene${i}.mp4`),
      }, run, { chain, deps });
      clips.push(clip);
    }

    fs.writeFileSync(path.join(workDir, 'scenes.txt'), clips.map((c) => `file '${c.path}'`).join('\n') + '\n');
    const audioIn = timed.flatMap((t) => ['-i', t.wav]);
    const pads = timed.map((t, i) => `[${i}:a]aresample=48000,apad=pad_dur=${SCENE_GAP}[a${i}]`).join(';');
    const cat = timed.map((_, i) => `[a${i}]`).join('') + `concat=n=${timed.length}:v=0:a=1[aout]`;
    const audio = path.join(workDir, 'voice.m4a');
    runFfmpeg([...audioIn, '-filter_complex', `${pads};${cat}`, '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k', audio]);

    const outMp4 = path.join(outDir, `${script.slug}.mp4`);
    const part = `${outMp4}.part.mp4`;
    runFfmpeg([
      '-f', 'concat', '-safe', '0', '-i', path.join(workDir, 'scenes.txt'), '-i', audio,
      // Gold progress bar sliding in along the bottom edge (a cheap retention cue). overlay evaluates x per
      // frame; drawbox's w does not (tried first: it rendered full-width from frame 0).
      '-filter_complex', `[0:v]ass=${path.join(workDir, 'captions.ass')}[cap];color=c=0xF5C830:s=${providers.W}x16:r=${providers.FPS}[bar];[cap][bar]overlay=x='-w+w*t/${total.toFixed(3)}':y=H-16:shortest=1[v]`,
      '-map', '[v]', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(providers.FPS),
      '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', total.toFixed(3), part,
    ]);
    fs.renameSync(part, outMp4);
    const cover = path.join(outDir, `${script.slug}.jpg`);
    runFfmpeg(['-ss', String(Math.min(1.2, total / 2)), '-i', outMp4, '-frames:v', '1', '-q:v', '3', cover]);
    const meta = { slug: script.slug, durationSec: Number(total.toFixed(2)), scenes: timed.length, providers: clips.map((c) => c.provider), providerLog: run.log, voice: script.voice || 'af_heart', renderedAt: new Date().toISOString(), sources: script.sources };
    fs.writeFileSync(path.join(outDir, `${script.slug}.meta.json`), JSON.stringify(meta, null, 2));
    return { mp4: outMp4, cover, meta };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

// ---- --check (plan review I2) -----------------------------------------------------------------------------
function check() {
  const results = [];
  const ok = (name, pass, detail) => results.push({ name, pass, detail });
  ok('venv python', fs.existsSync(VENV_PY), VENV_PY);
  const v = spawnSync(VENV_PY, ['-c', 'import importlib.metadata as m; print(m.version("kokoro-onnx"))'], { encoding: 'utf8' });
  ok(`kokoro-onnx ${KOKORO_VERSION}`, v.status === 0 && v.stdout.trim() === KOKORO_VERSION, (v.stdout || v.stderr || '').trim());
  let sha = null;
  if (fs.existsSync(KOKORO_MODEL)) sha = crypto.createHash('sha256').update(fs.readFileSync(KOKORO_MODEL)).digest('hex');
  ok('kokoro timed model sha256', sha === KOKORO_MODEL_SHA256, sha ? sha.slice(0, 16) : 'missing');
  ok('kokoro voices', fs.existsSync(KOKORO_VOICES), KOKORO_VOICES);
  const f = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
  for (const name of ['ass', 'drawtext', 'gradients', 'apad', 'concat']) ok(`ffmpeg filter ${name}`, new RegExp(`\\s${name}\\s`).test(f.stdout || ''), '');
  ok('bold font', fs.existsSync(providers.BOLD_FONT), providers.BOLD_FONT);
  return results;
}

const BOOTSTRAP = [
  'python3 -m venv ~/.local/share/agentvault/venv-media',
  `~/.local/share/agentvault/venv-media/bin/pip install kokoro-onnx==${KOKORO_VERSION}`,
  'mkdir -p ~/.local/share/agentvault/kokoro && cd ~/.local/share/agentvault/kokoro',
  'curl -sSL -o kokoro-v1.0-timed.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx',
  'curl -sSL -o voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin',
];

module.exports = { renderShort, lintText, lintScript, validateScript, alignWords, chunkWords, buildAss, assTime, captionText, acquireLock, check, kokoroTts, textWords, BOOTSTRAP, DEFAULT_OUT, SCENE_GAP };

if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    if (argv.includes('--check')) {
      const res = check();
      for (const r of res) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
      if (res.some((r) => !r.pass)) { console.log('\nBootstrap:\n  ' + BOOTSTRAP.join('\n  ')); process.exit(1); }
      return;
    }
    const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
    const outDir = opt('--out') || DEFAULT_OUT;
    const maxAi = opt('--max-ai') !== undefined ? Number(opt('--max-ai')) : providers.MAX_AI_CLIPS_DEFAULT;
    const files = argv.filter((a, i) => a.endsWith('.json') && argv[i - 1] !== '--out');
    if (!files.length) { console.error('usage: node shorts-pipeline.js <script.json...> [--out DIR] [--no-ai] [--max-ai N] | --check'); process.exit(2); }
    const release = acquireLock();
    const run = providers.newRun({ maxAiClips: maxAi, noAi: argv.includes('--no-ai') });
    let failed = 0;
    try {
      for (const f of files) {
        const t0 = Date.now();
        try {
          const r = await renderShort(JSON.parse(fs.readFileSync(f, 'utf8')), { outDir, run });
          console.log(`rendered ${r.mp4} (${r.meta.durationSec}s, visuals: ${r.meta.providers.join(',')}) in ${Math.round((Date.now() - t0) / 1000)}s`);
        } catch (err) {
          failed++;
          console.error(`FAILED ${f}: ${err.message}`);
        }
      }
    } finally {
      release();
    }
    if (failed) process.exit(1);
  })();
}
