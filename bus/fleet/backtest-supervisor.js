#!/usr/bin/env node
// backtest-supervisor.js -- the "is a recurring backtest due yet" decision,
// structured directly after pilot-supervisor.js's isCycleDue()/
// todayCycleExists()/maybeGenerateCycle() pattern. Closes the gap named in
// ARCHITECTURE.md section 9 ("no recurring backtest is wired into the 24/7
// loop") -- added 2026-09-13 alongside generate-backtest-tasks.js and
// backtest-vault-writer.js.
//
// Two jobs, both REPORT-ONLY by construction -- this script never calls
// execute-portfolio-setup.js and never touches paper-trades.jsonl:
//   1. Daily (idempotent per UTC date): re-run the existing, unmodified
//      backtest-screen-score-v2.js, record its top-line verdict as a
//      durable fact (memory-store.js) and a dated vault note
//      (backtest-vault-writer.js).
//   2. Every ~3 days (idempotent per elapsed-day-count, checked on this
//      same daily wake): run the parameter-search "learning" layer
//      (backtest-parameter-search.js, ARCHITECTURE.md section 13) --
//      pure computation, no LLM dispatch.
//
// UPDATE 2026-09-14 (ARCHITECTURE.md section 14): the weekly deep
// multi-agent entry/exit validation batch this script used to generate
// here (a small rotating slice, once a week) is SUPERSEDED by
// continuous-backtest-supervisor.js -- direct user request for constant,
// full-universe Codex backtesting instead of a small weekly sample. That
// script has its own cron entry (every 30 min); this file no longer
// generates any entry/exit batch itself. publishReadyWeeklyBatches()
// below stays only to publish any batch generated before this change that
// was still in flight -- it naturally becomes a no-op once those drain.
//
// UPDATE 2026-09-14 (ARCHITECTURE.md section 17): the parameter search
// moved off "once/week on Sunday" to "at least every 3 days," still
// riding this same existing daily 08:00 UTC cron wake (no new crontab
// entry). This is only valid because backtest-parameter-search.js itself
// was redesigned the same day to a fixed train/test split with a
// GROWING test set -- see that file's header for why a naive cadence cut
// on the OLD design would have made consecutive runs redundant.
//
// Usage: node backtest-supervisor.js   (one run; call on a schedule --
// see the new crontab line, 08:00 UTC daily, deliberately off the crypto
// pilot's 02:00 UTC and the equity pilot's ~10:00 ET generation windows
// so the queue daemon never has both a live cycle and a fresh backtest
// batch queuing at once).

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const memoryStore = require('../platform/memory-store.js');
const vaultWriter = require('./backtest-vault-writer.js');

const SCRIPTS_DIR = __dirname;
const VAULT_ROOT = avPaths.ROOT;
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'backtest-supervisor.log');
const STATE_PATH = path.join(VAULT_ROOT, 'bus', 'backtest-rotation-state.json');
const RESULTS_PATH = avPaths.fleetData('backtest-screen-score-v2-results.md');

const SEARCH_INTERVAL_DAYS = 3; // minimum days between parameter-search runs (was: Sunday-only)

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  console.log(line);
}

function todayUtcDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { lastDailyRunDate: null, lastParameterSearchRun: null };
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (err) {
    log(`WARNING: ${path.basename(STATE_PATH)} malformed (${err.message}) -- starting fresh rather than guessing`);
    return { lastDailyRunDate: null, lastParameterSearchRun: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// ---------- Daily: cheap score-ranking re-check ----------

// Parses backtest-screen-score-v2.js's own results file -- never
// re-derives or paraphrases the verdict, just extracts what the script
// already concluded.
function parseResults(resultsPath) {
  if (!fs.existsSync(resultsPath)) return { verdictLine: null, excerpt: null };
  const text = fs.readFileSync(resultsPath, 'utf8');
  const lines = text.split('\n');
  const headingIdx = lines.findIndex((l) => l.trim() === '## Direct verdict');
  if (headingIdx === -1) return { verdictLine: null, excerpt: text.slice(0, 800) };
  const after = lines.slice(headingIdx + 1).find((l) => l.trim());
  const verdictLine = after ? after.replace(/\*\*/g, '').trim() : null;
  const nextHeadingIdx = lines.findIndex((l, i) => i > headingIdx && /^## /.test(l));
  const excerptLines = nextHeadingIdx === -1 ? lines.slice(headingIdx) : lines.slice(headingIdx, nextHeadingIdx);
  return { verdictLine, excerpt: excerptLines.join('\n').trim() };
}

function maybeRunDailyBacktest() {
  const state = loadState();
  const today = todayUtcDateStr();
  if (state.lastDailyRunDate === today) {
    return; // already run today -- safe to call this function every wake
  }
  log('Running daily screen-score backtest (backtest-screen-score-v2.js)...');
  try {
    execFileSync('node', [avPaths.script('backtest-screen-score-v2.js')], { cwd: VAULT_ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch (err) {
    log(`daily backtest FAILED (will retry on next scheduled run): ${err.message.split('\n')[0]}`);
    return; // do not mark as run -- let the next daily wake retry
  }

  const { verdictLine, excerpt } = parseResults(RESULTS_PATH);
  if (verdictLine) {
    // Direct call, not through the task-dispatch eligibility gate in
    // run-task.js -- this is real script output (deterministic
    // computation over real Alpaca bars), not LLM recall, so it's
    // trustworthy by construction, the same category writeTaskResult()
    // already grants `to: claude` orchestrator-sourced facts.
    memoryStore.recordFact('backtest_daily_screen_score_verdict', verdictLine, { sourceTaskId: 'backtest-supervisor-cron', taskTo: 'claude' });
  }
  const pub = vaultWriter.publishDailyBacktestNote({ asOfDate: new Date().toISOString().slice(0, 10), verdictLine, resultsPath: RESULTS_PATH, resultsExcerpt: excerpt });
  log(`daily backtest done: ${verdictLine || '(no verdict line parsed)'} -- vault note: ${pub.written ? pub.path : pub.reason}`);

  state.lastDailyRunDate = today;
  saveState(state);
}

// ---------- Every ~3 days: parameter-search "learning" layer ----------

function isSearchDue(state) {
  if (!state.lastParameterSearchRun) return true;
  const elapsedMs = Date.now() - new Date(state.lastParameterSearchRun).getTime();
  return elapsedMs >= SEARCH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}

// The weekly multi-agent entry/exit batch that used to be generated here
// is superseded by continuous-backtest-supervisor.js (ARCHITECTURE.md
// section 14) -- this now only runs the parameter-search layer (section
// 13), pure computation, no LLM dispatch. Renamed from
// maybeRunWeeklyBacktest() -- it no longer runs weekly (section 17).
async function maybeRunParameterSearch() {
  const state = loadState();
  if (!isSearchDue(state)) return;

  log('Running parameter search (backtest-parameter-search.js)...');
  try {
    const paramSearch = require('./backtest-parameter-search.js');
    await paramSearch.main();
  } catch (err) {
    // Do NOT mark as run -- mirrors maybeRunDailyBacktest()'s own retry
    // posture above. Previously state.lastParameterSearchRun was written
    // BEFORE main() ran, so a single transient failure (Alpaca outage, bad
    // response) silently cost up to SEARCH_INTERVAL_DAYS (3 days) of
    // missed learning-layer updates, with no retry until the next
    // scheduled window regardless of how soon the underlying issue cleared.
    log(`parameter search FAILED (will retry on next scheduled wake -- not marked as run): ${err.message}`);
    return;
  }

  state.lastParameterSearchRun = new Date().toISOString();
  saveState(state);
}

// ---------- Publish any now-completed prior weekly batch ----------

// A weekly batch generated last week may only have finished dispatching
// (via the queue daemon) after this script's own run that week ended --
// scan for any batch-synthesis task that's now status:done and not yet
// published, same "publish whenever it's actually ready" posture as
// vault-research-writer.js's publishPendingCompanyResearch().
function publishReadyWeeklyBatches() {
  const tasksDir = path.join(VAULT_ROOT, 'tasks');
  if (!fs.existsSync(tasksDir)) return;
  const runTask = require('../platform/run-task.js');
  const files = fs.readdirSync(tasksDir).filter((f) => /^strategy_backtest_\d+_(fleet|crypto)_synthesis_batch\.md$/.test(f));
  for (const file of files) {
    const taskId = file.replace(/\.md$/, '');
    const m = taskId.match(/^strategy_backtest_(\d+)_(fleet|crypto)_synthesis_batch$/);
    if (!m) continue;
    const [, weekPrefix, pilot] = m;
    const task = runTask.readTaskFile(taskId);
    if (!task || task.status !== 'done') continue;
    const result = vaultWriter.publishWeeklyBacktestNote(pilot, weekPrefix, taskId);
    if (result.written) log(`published weekly batch note: ${result.path}`);
  }
}

async function main() {
  maybeRunDailyBacktest();
  await maybeRunParameterSearch();
  publishReadyWeeklyBatches();
}

if (require.main === module) {
  main().catch((err) => { log(`FAILED: ${err.message}`); process.exit(1); });
}

module.exports = { log, loadState, saveState, parseResults, maybeRunDailyBacktest, isSearchDue, maybeRunParameterSearch, publishReadyWeeklyBatches, main };
