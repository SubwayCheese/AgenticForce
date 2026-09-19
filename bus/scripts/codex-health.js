// codex-health.js -- Round 18. Automatic detection of codex being
// unusable (out of credits / auth / outage), and of it coming back, so
// nobody has to tell the system "credits are back." A probe is one tiny
// codex call and is only ever made while something is actually stuck --
// when codex is out of credits the probe fails instantly at no cost, and
// when it is healthy nothing probes at all.

const fs = require('fs');
const path = require('path');
const { dispatchCodexAsync } = require('./research-swarm-worker.js');
const ntfy = require('./ntfy.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
let STATE_PATH = path.join(VAULT_ROOT, 'bus', 'codex-health.json');
const NTFY_TOPIC = 'AgentVaultSurvive';

function _setStatePathForTesting(p) { STATE_PATH = p; }

function classify(result) {
  if (result.exitCode === 0 && /ok/i.test(result.output || '')) return { status: 'ok', detail: null };
  const text = `${result.stderr || ''} ${result.output || ''}`;
  if (/out of credits|usage limit|quota|refill/i.test(text)) return { status: 'out-of-credits', detail: 'workspace out of credits' };
  if (/timed out/i.test(text)) return { status: 'error', detail: 'probe timed out' };
  return { status: 'error', detail: (result.stderr || 'no output').split('\n').filter(Boolean).slice(-1)[0] };
}

async function probeCodex({ dispatchFn = dispatchCodexAsync, timeoutMs = 45000 } = {}) {
  const result = await dispatchFn('Reply with the single word OK.', { timeoutMs });
  return classify(result);
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (_) { return null; }
}

// Records the probe result; alerts exactly once per transition (down,
// then back up), never per probe.
async function recordProbe(probe, { notify = ntfy.sendNtfy } = {}) {
  const prev = readState();
  const now = new Date().toISOString();
  const changed = !prev || prev.status !== probe.status;
  const next = { status: probe.status, detail: probe.detail, since: changed ? now : prev.since, lastChecked: now };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2), 'utf8');
  // Round 19: an ok -> out-of-credits transition is a real data point for
  // calibrating the dispatch budget (volume at the moment the limit hit).
  if (changed && probe.status === 'out-of-credits' && prev && prev.status === 'ok') {
    try { require('./dispatch-budget.js').recordExhaustion({ detail: probe.detail }); } catch (_) { /* best-effort */ }
  }
  if (changed && (prev || probe.status !== 'ok')) {
    try {
      if (probe.status === 'ok') await notify({ topic: NTFY_TOPIC, title: 'Codex is back', message: `Codex is working again (was ${prev.status} since ${prev.since}). Stalled missions are being recovered automatically.`, priority: 3 });
      else await notify({ topic: NTFY_TOPIC, title: `Codex unavailable: ${probe.status}`, message: `${probe.detail || ''} -- research/decision dispatch is paused until it recovers; this is detected and resumed automatically.`, priority: 4 });
    } catch (_) { /* best-effort */ }
  }
  return next;
}

module.exports = { probeCodex, recordProbe, readState, classify, _setStatePathForTesting };
