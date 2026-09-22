// bus/city/survive-market-scan.js -- Round 27. Widens C1's candidate universe beyond the 5 hardcoded,
// human-vetted symbols (SGOV/BIL/SHY/VOO/SCHD) without touching survive-supervisor.js's hot path.
//
// DECOUPLED BY DESIGN (a real gap a review found in the first draft): running a live codex dispatch with web
// search INSIDE authorNewMission would (a) risk a real dispatch firing from an ordinary unit test that
// forgets to stub it, and (b) block that citizen's whole wake for up to DISPATCH_TIMEOUT_MS (10 minutes) if
// the dispatch hangs -- exactly the anti-pattern Round 17 already moved OFF the per-wake path once (see
// survive-supervisor.js's own comment on why mechanism-research became research-swarm-cycle.js). So:
//   - runMarketScan() does the real work (codex dispatch, parse, validate) and is meant to be called from
//     market-scan-cycle.js on ITS OWN cadence (a separate oneshot, mirroring research-swarm-cycle.js).
//   - writeScanCache()/readScanCache() persist the result to a small local file.
//   - survive-supervisor.js only ever calls readScanCache() -- a plain, fast, local file read with no
//     network and no possible hang -- never runMarketScan() directly.
// No API key needed: this reuses the same isolated dispatchCodexAsync() research-swarm-worker.js already
// proved safe (bypasses the shared run-queue-daemon entirely), with the same web-search-enabled codex agent.

const fs = require('fs');
const path = require('path');
const avPaths = require('../lib/paths.js');
const { dispatchCodexAsync } = require('../platform/research-swarm-worker.js');

// Duplicated from bus/swarm/survive-research-synthesis.js rather than imported -- the architecture test
// correctly refuses a city -> swarm dependency (domains may only import themselves + platform). This is the
// same "duplication is the safety feature" precedent this codebase already uses for the live/paper Alpaca
// clients: a genuinely separate domain owning its own small copy of a stable utility, not sharing a module.
function extractFirstJsonBlock(text) {
  if (!text) return null;
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try { return JSON.parse(match[1]); } catch (_) { /* try next fence */ }
  }
  return null;
}

let CACHE_PATH = avPaths.bus('city-state', 'market-scan-cache.json');
const MAX_NEW_DEFAULT = 5;
const MAX_CACHE_AGE_MS = 36 * 3600 * 1000; // a stale (>36h) cache is treated as absent, not fed to a live mission
const TICKER_RE = /^[A-Z]{1,5}$/;
// A same-day web-search proposal is a real but thin evidence source (E0/E1 on this project's evidence
// ladder) -- a spread this wide would already fail fetchCandidateUniverseData's real Alpaca check for most
// symbols, but this is a second, cheap, pre-Alpaca-call floor against an obviously illiquid/manipulable name
// slipping into a real research prompt at all (Round 27 review finding: no liquidity floor existed).
const MAX_SCAN_SPREAD_PCT = 2.0;

function _setCachePathForTesting(p) { CACHE_PATH = p; }

function buildScanPrompt(existingUniverse) {
  return [
    'You are scouting NEW candidate US equities/ETFs for a small, cautious, real-money account -- not deciding anything, just proposing.',
    `Already-covered baseline (do not repeat these): ${existingUniverse.join(', ')}.`,
    '',
    `Using live web search, propose up to ${MAX_NEW_DEFAULT} additional US-listed, well-known, liquid, likely-fractionable equities or ETFs that look genuinely worth a closer look TODAY based on real current market or news conditions -- not penny stocks, not OTC, not anything obscure or thinly traded. This is a same-day, speculative shortlist (E0/E1 evidence, not a recommendation) that will each get independently, rigorously verified against real market data and a full bull/bear review before anything is ever decided -- your job is only to widen what gets looked at, honestly, not to argue for any of them.`,
    '',
    'Respond with ONLY a fenced ```json block: {"candidates": [{"symbol": "TICKER", "reason": "one real, current, specific reason -- cite what you found"}]}. Fewer than 5 is fine if you do not have that many genuinely current, well-known, liquid ideas -- an empty list is a legitimate, honest answer.',
  ].join('\n');
}

function validateCandidates(parsed, existingUniverse, maxNew) {
  if (!parsed || !Array.isArray(parsed.candidates)) return [];
  const existing = new Set(existingUniverse.map((s) => s.toUpperCase()));
  const seen = new Set();
  const out = [];
  for (const c of parsed.candidates) {
    if (!c || typeof c.symbol !== 'string' || typeof c.reason !== 'string' || !c.reason.trim()) continue;
    const sym = c.symbol.trim().toUpperCase();
    if (!TICKER_RE.test(sym) || existing.has(sym) || seen.has(sym)) continue;
    seen.add(sym);
    out.push({ symbol: sym, reason: c.reason.trim().slice(0, 300) });
    if (out.length >= maxNew) break;
  }
  return out;
}

// runMarketScan(): the real work. NEVER call this from survive-supervisor.js's per-wake path -- see header.
async function runMarketScan({ dispatchFn = dispatchCodexAsync, existingUniverse, maxNew = MAX_NEW_DEFAULT } = {}) {
  if (!existingUniverse || !existingUniverse.length) throw new Error('survive-market-scan: existingUniverse is required');
  const prompt = buildScanPrompt(existingUniverse);
  let result;
  try { result = await dispatchFn(prompt); } catch (err) { return { symbols: [], candidates: [], error: err.message, generatedAt: new Date().toISOString() }; }
  if (result.exitCode !== 0 || !result.output) return { symbols: [], candidates: [], error: result.stderr || 'no output', generatedAt: new Date().toISOString() };
  const parsed = extractFirstJsonBlock(result.output);
  const candidates = validateCandidates(parsed, existingUniverse, maxNew);
  return { symbols: candidates.map((c) => c.symbol), candidates, generatedAt: new Date().toISOString() };
}

function writeScanCache(result) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  const tmp = `${CACHE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(result, null, 2));
  fs.renameSync(tmp, CACHE_PATH);
  return result;
}

// readScanCache(): plain, fast, local, no network -- the ONLY function survive-supervisor.js's per-wake path
// may call. Returns null (not a thrown error) on anything not usable, so a caller can always safely fall
// back to the baseline-only universe.
function readScanCache({ maxAgeMs = MAX_CACHE_AGE_MS, now = Date.now() } = {}) {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (!raw || !raw.generatedAt || !Array.isArray(raw.symbols)) return null;
    if (now - Date.parse(raw.generatedAt) > maxAgeMs) return null;
    return raw;
  } catch (_) { return null; }
}

module.exports = { buildScanPrompt, validateCandidates, runMarketScan, writeScanCache, readScanCache, _setCachePathForTesting, MAX_SCAN_SPREAD_PCT, MAX_NEW_DEFAULT, TICKER_RE };
