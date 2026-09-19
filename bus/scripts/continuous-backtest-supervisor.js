#!/usr/bin/env node
// continuous-backtest-supervisor.js -- the "constant" entry/exit backtest
// track (ARCHITECTURE.md section 14, added 2026-09-14), superseding
// backtest-supervisor.js's weekly dual-specialist batch. Direct user
// request: the weekly cadence + small rotating sample wasn't enough --
// backtesting should run "constantly, every day all day" across every
// symbol in the documented universe (all 82: 50 equities + 32 crypto).
//
// The real tension this resolves: continuous, full-universe backtesting
// with BOTH specialists would multiply Claude usage far past the
// low-frequency scope already agreed (claude-agent shares this
// interactive session's own usage pool -- a real session-limit incident
// already happened once when it was used in a high-frequency path). The
// user's own resolution: Codex runs constantly, alone; Claude's only role
// here is a bi-daily (twice a day) audit of what Codex has accumulated,
// not a per-symbol parallel backtest.
//
// PAPER-ONLY, report-only, same as every other piece of this backtest
// layer: this script only ever generates task files, an audit task, and
// vault notes. It never calls execute-portfolio-setup.js and never
// touches paper-trades.jsonl.
//
// Usage: node continuous-backtest-supervisor.js   (one run; scheduled
// every 30 minutes via cron, matching pilot-supervisor.js's own cadence)

const fs = require('fs');
const path = require('path');
const memoryStore = require('./memory-store.js');
const runTask = require('./run-task.js');
const backtestGen = require('./generate-backtest-tasks.js');
const vaultWriter = require('./backtest-vault-writer.js');

const SCRIPTS_DIR = __dirname;
const VAULT_ROOT = path.resolve(SCRIPTS_DIR, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');
const ARCHIVE_DIR = path.join(TASKS_DIR, '_archive_continuous_backtest');
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'continuous-backtest-supervisor.log');
const STATE_PATH = path.join(VAULT_ROOT, 'bus', 'continuous-backtest-rotation-state.json');

const FLEET_UNIVERSE_PATH = path.join(SCRIPTS_DIR, 'fleet-universe.json');
const CRYPTO_UNIVERSE_PATH = path.join(SCRIPTS_DIR, 'crypto-universe.json');
const BATCH_SIZE_PER_TICK = 6; // ~82 symbols / 6 per tick ~= 14 ticks * 30 min ~= 7h per full pass, ~3-4 passes/day
const ARCHIVE_AFTER_HOURS = 24;
const AUDIT_WINDOW_HOURS = [0, 12]; // UTC hours that start a new bi-daily audit window

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  console.log(line);
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { cursor: 0, lastAuditWindowStart: null, lastTestedDate: {} };
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (err) {
    log(`WARNING: ${path.basename(STATE_PATH)} malformed (${err.message}) -- starting fresh rotation rather than guessing`);
    return { cursor: 0, lastAuditWindowStart: null, lastTestedDate: {} };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function buildCombinedUniverse() {
  const fleetSymbols = JSON.parse(fs.readFileSync(FLEET_UNIVERSE_PATH, 'utf8')).symbols.map((s) => ({ pilot: 'fleet', symbol: s }));
  const cryptoSymbols = JSON.parse(fs.readFileSync(CRYPTO_UNIVERSE_PATH, 'utf8')).coins.map((s) => ({ pilot: 'crypto', symbol: s }));
  return [...fleetSymbols, ...cryptoSymbols]; // fixed order -- the rotation cursor indexes into this
}

function tickId() {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12); // YYYYMMDDHHmm
}

function todayUtcDateStr() {
  return new Date().toISOString().slice(0, 10);
}

// Freshness fix (added 2026-09-14, direct user request): daily bars only
// update once per real trading day, so re-testing the same symbol 3-4x/day
// (the original design) was mostly re-analyzing unchanged data. Fix is
// deliberately simple, not a live bar-date lookup: track the last UTC
// CALENDAR DATE each symbol was tested, skip it if that's still today --
// within one calendar day a symbol's daily-bar-based series cannot have
// meaningfully changed regardless of exact intraday timing, so wall-clock
// dedup achieves the same effect as a live freshness check with zero
// extra API calls. Net effect: the whole 82-symbol universe gets covered
// once per day (~14 ticks, ~7h), then the supervisor goes correctly idle
// (0 new backtests, cheap date comparisons only) until the next UTC day,
// instead of cycling the same symbols repeatedly for no new information.
function nextFreshSlice(universe, cursor, lastTestedDate, count) {
  const today = todayUtcDateStr();
  const picked = [];
  const total = universe.length;
  // Clamp the persisted cursor into range before using it as an array
  // index. If fleet-universe.json/crypto-universe.json shrink between
  // runs (a symbol removed), a stale cursor >= the new, smaller `total`
  // would otherwise index past the end of `universe`, throwing on
  // `candidate.symbol` below. Because that throw happens before
  // saveState() ever runs, the bad cursor would never get corrected --
  // every subsequent tick would fail identically forever.
  let index = total > 0 ? ((cursor % total) + total) % total : 0;
  let examined = 0;
  while (picked.length < count && examined < total) {
    const candidate = universe[index];
    // Keyed by pilot+symbol, not bare symbol: fleet-universe.json and
    // crypto-universe.json don't currently share any ticker, but nothing
    // guarantees that stays true -- a future collision would otherwise let
    // testing one asset class's symbol incorrectly mark the other's
    // same-named symbol as already tested today.
    if (lastTestedDate[`${candidate.pilot}:${candidate.symbol}`] !== today) picked.push(candidate);
    index = (index + 1) % total;
    examined += 1;
  }
  return { picked, nextIndex: index, examined };
}

async function runContinuousTick(state) {
  const universe = buildCombinedUniverse();
  if (!universe.length) {
    log('WARNING: combined universe is empty -- nothing to backtest this tick');
    return;
  }
  if (!state.lastTestedDate) state.lastTestedDate = {};

  const { picked, nextIndex, examined } = nextFreshSlice(universe, state.cursor, state.lastTestedDate, BATCH_SIZE_PER_TICK);
  state.cursor = nextIndex;
  if (!picked.length) {
    log(`tick: every symbol already tested today (scanned all ${examined}) -- nothing new until the next UTC day, no dispatch this tick.`);
    return;
  }

  const byPilot = { fleet: [], crypto: [] };
  for (const { pilot, symbol } of picked) byPilot[pilot].push(symbol);

  const id = tickId();
  const today = todayUtcDateStr();
  for (const pilot of ['fleet', 'crypto']) {
    if (!byPilot[pilot].length) continue;
    try {
      const result = await backtestGen.generateContinuousBacktestBatch(pilot, byPilot[pilot], id);
      for (const symbol of byPilot[pilot]) state.lastTestedDate[`${pilot}:${symbol}`] = today;
      log(`tick ${id}: ${pilot} -- ${result.createdIds.length} task file(s) for ${byPilot[pilot].join(', ')} (examined ${examined} candidates in rotation to find this fresh batch)${result.skippedSymbols.length ? `; skipped: ${JSON.stringify(result.skippedSymbols)}` : ''}. run-queue-daemon.js will dispatch from here.`);
    } catch (err) {
      log(`tick ${id}: ${pilot} generation FAILED: ${err.message}`);
    }
  }
}

// ---------- Bi-daily Claude audit ----------

function currentAuditWindowStart() {
  const now = new Date();
  const hour = AUDIT_WINDOW_HOURS.slice().reverse().find((h) => now.getUTCHours() >= h) ?? AUDIT_WINDOW_HOURS[0];
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0)).toISOString();
}

// Reads bus/memory.jsonl directly (already exported as
// memoryStore.MEMORY_PATH) rather than adding a new bulk-read function to
// that module -- this is the one caller that needs "every fact since X",
// a shape none of memory-store.js's existing get*() functions provide.
function gatherRecentContinuousVerdicts(sinceIso) {
  if (!fs.existsSync(memoryStore.MEMORY_PATH)) return [];
  const lines = fs.readFileSync(memoryStore.MEMORY_PATH, 'utf8').split('\n').filter((l) => l.trim());
  const out = [];
  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch (_) { continue; }
    if (!entry.key || !entry.key.startsWith('continuous_backtest_')) continue;
    if (!entry.ts || entry.ts < sinceIso) continue;
    out.push(entry);
  }
  return out;
}

function auditPayload(windowLabel, verdicts) {
  const rows = verdicts.map((v) => `- ${v.key.replace('continuous_backtest_', '')} (task ${v.sourceTaskId}, ${v.ts}): ${v.value.replace(/\n/g, ' ').slice(0, 400)}`).join('\n');
  return [
    `BI-DAILY AUDIT for the ${windowLabel} window: review the ${verdicts.length} Codex entry/exit backtest verdict(s) below, each independently recorded from a real dispatched backtest against real historical data over the last ~12 hours.`,
    '',
    'You are NOT being asked to re-backtest anything yourself -- Codex already did the backtesting. Your job is quality review: do these verdicts look internally consistent with each other and with the stated strategy rule? Does anything look like a likely error (a symbol reporting a return with zero accepted entries, a verdict that contradicts its own trigger count, an implausible number)? Is there a real pattern worth naming across multiple symbols (e.g. many symbols found zero triggers, or several disagree on a similar setup)?',
    '',
    'Be honest if nothing notable stands out -- "reviewed N verdicts, no inconsistencies or notable patterns found" is a legitimate, expected result on a normal day, not a failure to find something.',
    '',
    verdicts.length ? rows : '(no continuous-backtest verdicts were recorded in this window)',
  ].join('\n');
}

async function maybeGenerateBiDailyAudit(state) {
  const windowStart = currentAuditWindowStart();
  if (state.lastAuditWindowStart === windowStart) return; // already generated for this window

  // Gather everything recorded since the LAST audit ran (not just since
  // this window started) -- covers the full ~12h gap even if a prior run
  // was skipped/delayed. Falls back to this window's own start on the
  // very first-ever run, when there is no prior audit to measure from.
  const sinceIso = state.lastAuditWindowStart || windowStart;
  const verdicts = gatherRecentContinuousVerdicts(sinceIso);
  const windowLabel = windowStart.slice(0, 13).replace('T', ' ') + 'h UTC';
  const taskId = `bidaily_audit_${windowStart.slice(0, 10).replace(/-/g, '')}_${windowStart.slice(11, 13)}`;
  if (runTask.readTaskFile(taskId)) {
    state.lastAuditWindowStart = windowStart;
    return; // already exists (e.g. a prior run this same window already created it)
  }

  const lines = [
    `## ${taskId}`,
    'from: claude',
    'to: claude-agent',
    'type: request',
    'status: pending',
    `payload: ${auditPayload(windowLabel, verdicts)}`,
    `timestamp: ${new Date().toISOString()}`,
    '',
  ];
  fs.writeFileSync(path.join(TASKS_DIR, `${taskId}.md`), lines.join('\n'), 'utf8');
  log(`generated bi-daily audit task ${taskId} covering ${verdicts.length} verdict(s) for window ${windowLabel}`);

  state.lastAuditWindowStart = windowStart;
}

function publishReadyAudits() {
  const files = fs.existsSync(TASKS_DIR) ? fs.readdirSync(TASKS_DIR).filter((f) => /^bidaily_audit_\d{8}_\d{2}\.md$/.test(f)) : [];
  for (const file of files) {
    const taskId = file.replace(/\.md$/, '');
    const task = runTask.readTaskFile(taskId);
    if (!task || task.status !== 'done') continue;
    const m = taskId.match(/^bidaily_audit_(\d{4})(\d{2})(\d{2})_(\d{2})$/);
    const windowLabel = m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}h UTC` : taskId;
    const result = vaultWriter.publishBiDailyAuditNote(windowLabel, taskId);
    if (result.written) log(`published bi-daily audit note: ${result.path}`);
  }
}

// ---------- Archive sweep ----------

// Moves already-done continuous-backtest task files older than
// ARCHIVE_AFTER_HOURS into tasks/_archive_continuous_backtest/ -- their
// verdict is already durably recorded via recordFact by the time they're
// done, so the raw task file's only remaining value is audit-trail, which
// the archive (not deletion) preserves. run-task.js's listTaskIdsByStatus()
// already excludes this directory name (added the same day as this file),
// so archived files never re-enter the daemon's pending/blocked scan --
// section 3k's own lesson (skipping that step made old archived files
// "live again") applied here from the start, not after the fact.
function archiveOldContinuousTasks() {
  if (!fs.existsSync(TASKS_DIR)) return;
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const cutoff = Date.now() - ARCHIVE_AFTER_HOURS * 60 * 60 * 1000;
  const files = fs.readdirSync(TASKS_DIR).filter((f) => /^continuous_backtest_\d{12}_(fleet|crypto)_(data|codex)_[a-z0-9]+\.md$/.test(f));
  let moved = 0;
  for (const file of files) {
    const m = file.match(/^continuous_backtest_(\d{12})_/);
    const tickTs = m ? new Date(`${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}T${m[1].slice(8, 10)}:${m[1].slice(10, 12)}:00Z`).getTime() : NaN;
    if (!Number.isFinite(tickTs) || tickTs > cutoff) continue;
    const taskId = file.replace(/\.md$/, '');
    const task = runTask.readTaskFile(taskId);
    if (!task || task.status !== 'done') continue; // never archive anything not yet resolved
    fs.renameSync(path.join(TASKS_DIR, file), path.join(ARCHIVE_DIR, file));
    moved++;
  }
  if (moved) log(`archived ${moved} completed continuous-backtest task file(s) older than ${ARCHIVE_AFTER_HOURS}h`);
}

async function main() {
  const state = loadState();
  await runContinuousTick(state);
  await maybeGenerateBiDailyAudit(state);
  saveState(state);
  publishReadyAudits();
  archiveOldContinuousTasks();
}

if (require.main === module) {
  main().catch((err) => { log(`FAILED: ${err.message}`); process.exit(1); });
}

module.exports = { log, loadState, saveState, nextFreshSlice, todayUtcDateStr, buildCombinedUniverse, runContinuousTick, maybeGenerateBiDailyAudit, gatherRecentContinuousVerdicts, publishReadyAudits, archiveOldContinuousTasks, main };
