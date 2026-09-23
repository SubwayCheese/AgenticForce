#!/usr/bin/env node
// pilot-supervisor.js -- the coarse-grained "is today's cycle due yet"
// decision for the 24/7 unattended paper-trading pilot (ARCHITECTURE.md
// section 9). Runs on a schedule (Task Scheduler, every 30 min -- see
// section 9 for why 30 min and why this is a SEPARATE registration from
// run-queue-daemon.js, not folded into one process).
//
// What it does NOT do: dispatch tasks itself. generate-pilot-tasks.js
// authors status:pending .md files; run-queue-daemon.js (already real,
// already working, unchanged by this file) picks them up and handles the
// entire dependency-chain fan-out/fan-in. This script's jobs are
// (1) deciding once a day per pilot whether a new cycle is due,
// (2) checking conditional-triggers.js's watched price triggers and
// resolving any completed rescans (added 2026-09-10 -- round-3 can now
// output a genuinely conditional candidate instead of only approve/reject;
// this is what turns "the price hasn't confirmed yet" into "keep watching,
// re-verify, then act" rather than a dead end), and (3) calling the two
// already-schedule-ready scripts that close a cycle out:
// execute-portfolio-setup.js --auto and monitor-paper-trades.js --execute.
//
// PAPER-ONLY by construction, transitively: everything this script calls
// eventually goes through alpaca-client.js's loadConfig(), which throws
// unless ALPACA_ENDPOINT is Alpaca's paper host. Nothing here can change
// that.
//
// Usage: node pilot-supervisor.js   (one run; call this on a schedule,
// it does not loop itself -- Task Scheduler is the loop)

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const gen = require('./generate-pilot-tasks.js');
const alpaca = require('./alpaca-client.js');
const triggers = require('./conditional-triggers.js');
const journal = require('./trading-journal.js');
const runTask = require('../platform/run-task.js');
const vaultWriter = require('./vault-research-writer.js');

const SCRIPTS_DIR = __dirname;
const VAULT_ROOT = avPaths.ROOT;
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'pilot-supervisor.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  console.log(line);
}

// Same underlying Alpaca call monitor-paper-trades.js's own getMarketClock()
// makes -- no hand-rolled NYSE holiday calendar, never-throw contract.
async function getMarketClock() {
  try {
    const clock = await alpaca.apiRequest('GET', '/clock');
    return { available: true, isOpen: !!clock.is_open };
  } catch (err) {
    return { available: false, error: String((err && err.message) || err) };
  }
}

function etHour(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date || new Date());
  return Number(parts.find((p) => p.type === 'hour').value);
}

function utcHour(date) {
  return (date || new Date()).getUTCHours();
}

// A pilot's cycle is "due" once/day: equity gates on the market actually
// being open (so it also naturally skips weekends/holidays, no calendar
// needed) plus 10:00 ET -- 30 min past the 9:30 open, avoiding open-print
// volatility skewing the screen score while leaving ~6 hours for the full
// chain. Crypto gates on 02:00 UTC daily (every day, 24/7 asset class),
// deliberately offset from equity's ~14:00-15:00 UTC window so the two
// pilots' Codex dispatch load never stacks on the same wall-clock window.
async function isCycleDue(pilot) {
  if (pilot === 'crypto') return utcHour() >= 2;
  const clock = await getMarketClock();
  if (!clock.available || !clock.isOpen) return false;
  return etHour() >= 10;
}

// Today's cycle already has a file on disk -- generation is a once-a-day
// action, safe to call maybeGenerateCycle() every 30-min wake because of
// this check, not because generation itself is cheap.
//
// BUG FOUND LIVE 2026-09-11: a conditional-trigger rescan is named with
// the date it FIRES on, not the date its original cycle ran (see
// generate-pilot-tasks.js's generateRescanTask() and the identical
// rescan-date-collision bug fixed in fleet-status.js/crypto-status.js
// last night) -- so `fleet_pilot_20260911_rescan_vz_....md` matches this
// prefix check just as well as a real universe50_consolidation/thesis/
// synthesis file would. That silently convinced this function "today's
// fleet cycle already exists" the entire trading day, even though no
// real cycle had run -- confirmed live: market open since 9:30am ET,
// zero fleet_pilot_20260911_thesis/challenge/synthesis files on disk,
// only the two rescans. Exclude rescans from this check, same fix.
function todayCycleExists(pilot, datePrefix) {
  const prefix = pilot === 'crypto' ? 'crypto_pilot_' : 'fleet_pilot_';
  return gen.listTaskFilenames().some((f) => f.startsWith(`${prefix}${datePrefix}_`) && !f.includes('_rescan_'));
}

async function maybeGenerateCycle(pilot) {
  const datePrefix = gen.todayDatePrefix();
  if (todayCycleExists(pilot, datePrefix)) return; // already generated today, possibly still mid-chain

  const due = await isCycleDue(pilot);
  if (!due) return;

  log(`Generating ${pilot} cycle for ${datePrefix}...`);
  const snapshot = await gen.generateDataSnapshotTasks(pilot, datePrefix);
  if (!snapshot) {
    log(`${pilot} ${datePrefix}: data-snapshot generation skipped (see prior log line / ntfy alert) -- not generating the rest of the cycle without real data to ground it.`);
    return;
  }

  const priorSection = gen.getPriorLearningsSection(pilot, datePrefix);
  const r1Ids = snapshot.symbols.map((symbol) => gen.generateThesisTask(pilot, symbol, datePrefix, priorSection, snapshot.taskId));
  // Company-research (2026-09-13, layered research pipeline): depends
  // ONLY on the data-snapshot task, same as r1Ids -- runs in parallel
  // with round-1, never delays it. Order relative to r1Ids doesn't
  // matter since neither depends on the other.
  const researchIds = snapshot.symbols.map((symbol) => gen.generateCompanyResearchTask(pilot, symbol, datePrefix, snapshot.taskId));
  const r2Ids = snapshot.symbols.map((symbol, i) => gen.generateChallengeTask(pilot, symbol, datePrefix, r1Ids[i], researchIds[i]));
  const r3Id = gen.generateSynthesisTask(pilot, datePrefix, snapshot.symbols, r1Ids, r2Ids, priorSection);

  log(`${pilot} ${datePrefix}: generated ${snapshot.symbols.length} symbols, ${r1Ids.length} thesis + ${researchIds.length} company-research + ${r2Ids.length} challenge tasks, synthesis ${r3Id}. run-queue-daemon.js will dispatch from here.`);
}

// Both scripts are already argument-free/schedule-ready (execute-portfolio-
// setup.js's --auto path added in ARCHITECTURE.md section 9; monitor-
// paper-trades.js already was). Each runs in its own try/catch so one
// pilot's failure never blocks the other pilot's execute/monitor step.
function runExecuteAuto(pilot) {
  try {
    const out = execFileSync('node', [avPaths.script('execute-portfolio-setup.js'), '--auto', `--pilot=${pilot}`], { cwd: VAULT_ROOT, encoding: 'utf8' });
    // Full output, not just the last line via .pop() -- that discarded the
    // actually useful diagnostic text (which candidate ran, sizing, any
    // per-candidate skip/alert) for the sake of one terse summary line.
    log(`execute --auto --pilot=${pilot}: ${out.trim() || '(no output)'}`);
  } catch (err) {
    const stdout = (err && err.stdout) ? String(err.stdout).trim() : '';
    log(`execute --auto --pilot=${pilot} FAILED: ${err.message.split('\n')[0]}${stdout ? ` -- output: ${stdout}` : ''}`);
  }
}

// --execute is passed explicitly, always -- monitor-paper-trades.js
// defaults to dry-run with no flag, and that safety posture must survive
// integration untouched. Never call this without --execute here.
function runMonitorExecute() {
  try {
    const out = execFileSync('node', [avPaths.script('monitor-paper-trades.js'), '--execute'], { cwd: VAULT_ROOT, encoding: 'utf8' });
    log(`monitor --execute: ${out.trim() || '(no output)'}`);
  } catch (err) {
    const stdout = (err && err.stdout) ? String(err.stdout).trim() : '';
    log(`monitor --execute FAILED: ${err.message.split('\n')[0]}${stdout ? ` -- output: ${stdout}` : ''}`);
  }
}

async function checkConditionalTriggers() {
  try {
    // armNewTriggers() became async 2026-09-11 when it started calling the
    // new portfolio-risk-envelope.js gate (live account/positions lookups) --
    // must be awaited now so its pending-triggers.jsonl writes are guaranteed
    // to land before checkTriggers()/checkRescanResults() read that same
    // file below. See conditional-triggers.js / portfolio-risk-envelope.js.
    await triggers.armNewTriggers('fleet');
    await triggers.armNewTriggers('crypto');
    const fired = await triggers.checkTriggers();
    const resolved = await triggers.checkRescanResults();
    if (fired.length || resolved.length) {
      log(`conditional-triggers: ${fired.length} newly fired, ${resolved.length} rescan(s) resolved.`);
    }
  } catch (err) {
    log(`conditional-triggers FAILED: ${err.message}`);
  }
}

// "The stock is the teacher" (added 2026-09-10, direct user request):
// journal every newly-closed trade (cheap, mechanical, every wake), and
// periodically dispatch a real reflection pass once enough close-outs
// accumulate (batched -- see trading-journal.js for why this is NOT one
// agent call per micro-trade).
function checkTradingJournal() {
  try {
    journal.journalClosedTrades();
    journal.maybeDispatchReflection(gen);
    journal.checkReflectionResults(runTask);
  } catch (err) {
    log(`trading-journal FAILED: ${err.message}`);
  }
}

// Persists completed company-research dispatches into the real vault
// (06 - Markets & Trading Research) so findings compound over time
// instead of only flowing through one cycle's round-2 prompt and being
// discarded -- direct user request 2026-09-13. Mechanical and cheap
// (a tasks/ dir scan + a small published-ledger check), same posture as
// checkTradingJournal() above.
function checkVaultResearchPublishing() {
  try {
    const results = vaultWriter.publishPendingCompanyResearch();
    const written = results.filter((r) => r.written);
    if (written.length) {
      log(`vault-research-writer: published ${written.length} new company-research note(s): ${written.map((r) => r.taskId).join(', ')}`);
    }
  } catch (err) {
    log(`vault-research-writer FAILED: ${err.message}`);
  }
}

async function main() {
  await maybeGenerateCycle('fleet');
  await maybeGenerateCycle('crypto');
  await checkConditionalTriggers();
  runExecuteAuto('fleet');
  runExecuteAuto('crypto');
  runMonitorExecute();
  checkTradingJournal();
  checkVaultResearchPublishing();
}

if (require.main === module) {
  main().catch((err) => { log(`FAILED: ${err.message}`); process.exit(1); });
}

module.exports = { log, getMarketClock, isCycleDue, todayCycleExists, maybeGenerateCycle, checkConditionalTriggers, checkTradingJournal, checkVaultResearchPublishing, runExecuteAuto, runMonitorExecute, main };
