#!/usr/bin/env node
// backtest-parameter-search.js -- the "learning" layer (ARCHITECTURE.md
// section 13, added 2026-09-13): treats computeScreenScore()'s weights as
// parameters fit to data via a real grid search against the recurring
// backtest, rather than hand-picked once and left static. Genuine
// learning (optimizing parameters against an objective) -- not inside
// Codex or Claude, which cannot be fine-tuned from this pipeline.
//
// REWRITTEN 2026-09-14 (ARCHITECTURE.md section 17), direct user request:
// run this every ~3 days instead of weekly. Naively shrinking the cadence
// on the OLD design (fresh 70/30 split of "the most recent N days" every
// run) would have made consecutive runs share most of their test window --
// "cleared the bar 4 times in a row" would really be one observation
// dressed up as four, the exact autocorrelation trap this vault's own
// non-overlapping-trial statistics exist to avoid.
//
// THE FIX: stop re-splitting. The train/test boundary (`splitDate`) is
// chosen ONCE per pilot and persisted (bus/fleet/data/backtest-search-split-state.json).
// From then on, TRAIN stays fixed and TEST simply grows forward as real
// trading days accumulate -- new dates are appended at the END of a
// fixed-start array, so backtest-screen-score-v2.js's existing
// non-overlapping thinning (observationsForSampling: `index % horizon
// === 0`, unchanged) automatically treats every run's newly-available
// days as genuinely new, correctly-phased evidence. Zero changes needed
// to that thinning logic -- the old design's bug was re-picking the
// split, not the thinning itself.
//
// HONEST LIMIT, not an oversight: a horizon still needs real calendar
// time >= its own length (5/10/20 days) to produce one new non-overlapping
// data point for that horizon. Running every 3 days means most runs add a
// new 5-day-horizon trial; 10- and 20-day evidence accumulates slower,
// automatically and correctly -- every run is still genuinely informative
// (a bigger, richer test set), even on days where only the 5-day horizon
// gained new evidence.
//
// DELIBERATE SCOPE LIMIT: the training window's start stays fixed
// indefinitely under this design -- no periodic re-anchoring to recent
// market regimes. A real, known tradeoff, left for a future pass rather
// than solved here, to keep this change focused on the one problem it's
// for (making sub-weekly cadence valid, not redundant).
//
// Reuses backtest-screen-score-v2.js's own real fetch/scoring machinery
// (fetchAssetClassData/scoreAssetClassData) rather than reimplementing
// any of it -- fetchAssetClassData's new extraHistoryDays parameter
// (this file's only real dependency change) fetches deep enough history
// for the test set to keep growing for a long time before running out of
// front-loaded training data.
//
// SAFETY, unchanged: the grid search picks its winner using ONLY the
// fixed TRAIN slice, then re-scores that exact winner on the (now-growing)
// held-out TEST slice and requires it to clear assetClassHasDefensibleEdge()
// -- the SAME predeclared, non-overlapping, cost-adjusted, dual-comparator
// bar the existing daily verdict already uses. No new, weaker bar is
// invented here. Only a combination that clears that bar out-of-sample
// ever gets written to screen-score-weights.json.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const { fetchAssetClassData, scoreAssetClassData, assetClassHasDefensibleEdge, ASSET_CLASSES } = require('./backtest-screen-score-v2.js');
const memoryStore = require('../platform/memory-store.js');
const vaultWriter = require('./backtest-vault-writer.js');

const WEIGHTS_PATH = avPaths.fleetData('screen-score-weights.json');
const SPLIT_STATE_PATH = avPaths.fleetData('backtest-search-split-state.json');
const EXTRA_HISTORY_DAYS = 750; // deep fetch so the test set has a long runway to keep growing
const INITIAL_TRAIN_FRACTION = 0.7; // applied ONCE, at first-ever init, to place splitDate
const GRID_STEP = 10; // chgPct/avgVolume split in steps of 10 -- 11 combinations, marketCap fixed at 0 (deferred dimension, see ARCHITECTURE.md section 13)
const MIN_TRAIN_DATES = 30;
const MIN_TEST_DATES = 15;

// equity/crypto (backtest-screen-score-v2.js's own vocabulary) -> fleet/
// crypto (generate-pilot-tasks.js's / screen-score-weights.json's).
const CONFIG_KEY_TO_PILOT = { equity: 'fleet', crypto: 'crypto' };

function loadWeightsDoc() {
  if (!fs.existsSync(WEIGHTS_PATH)) throw new Error(`${WEIGHTS_PATH} missing -- expected to be committed (see ARCHITECTURE.md section 13)`);
  return JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
}

function saveWeightsDoc(doc) {
  // Atomic write, same reasoning as saveSplitStateDoc() above.
  const tmpPath = `${WEIGHTS_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, WEIGHTS_PATH);
}

function loadSplitStateDoc() {
  if (!fs.existsSync(SPLIT_STATE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(SPLIT_STATE_PATH, 'utf8'));
  } catch (err) {
    // Do NOT treat a malformed file as "no pilot has ever been split" --
    // getOrInitSplitDate() reads an empty {} as "never initialized" and
    // would pick a BRAND NEW splitDate for every pilot, silently
    // re-triggering the exact re-splitting/autocorrelation bug
    // ARCHITECTURE.md section 17 was written to eliminate. A corrupted
    // state file must halt the run loudly (it's git-committed, so it's
    // recoverable), not be guessed away as empty.
    throw new Error(`${SPLIT_STATE_PATH} exists but is malformed (${err.message}). Refusing to treat this as an empty/uninitialized state -- that would silently pick new splitDate(s) for every pilot and reintroduce the pre-section-17 re-splitting bug. Restore the file from git history before re-running.`);
  }
}

function saveSplitStateDoc(doc) {
  // Atomic write: a plain writeFileSync can leave a truncated/corrupt JSON
  // file if the process is killed mid-write (power loss, OOM-kill -- a
  // real risk on an unattended Pi), which loadSplitStateDoc() above now
  // treats as a hard failure rather than silently resetting state.
  const tmpPath = `${SPLIT_STATE_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, SPLIT_STATE_PATH);
}

// Returns { splitDate, initialized, previousTestCount }. Chosen ONCE per
// pilot and persisted -- every subsequent call for that pilot returns the
// exact same splitDate, regardless of how much more history has since
// become available, so TRAIN never moves and TEST only ever grows.
function getOrInitSplitDate(pilot, eligibleDates, splitStateDoc) {
  const existing = splitStateDoc[pilot];
  if (existing && existing.splitDate) {
    return { splitDate: existing.splitDate, initialized: false, previousTestCount: existing.lastTestCount || null };
  }
  const cutIndex = Math.floor(eligibleDates.length * INITIAL_TRAIN_FRACTION);
  const splitDate = eligibleDates[cutIndex];
  return { splitDate, initialized: true, previousTestCount: null };
}

function buildGrid() {
  const grid = [];
  for (let chgPct = 0; chgPct <= 100; chgPct += GRID_STEP) {
    grid.push({ chgPct, avgVolume: 100 - chgPct, marketCap: 0 });
  }
  return grid;
}

// Conservative objective: the WORST of the three horizons, not the best or
// the average -- avoids picking a combination that only looks good on one
// lucky horizon, matching this vault's existing all-horizons philosophy
// (directVerdict()/assetClassHasDefensibleEdge() already require all three).
function worstHorizonExcess(assetResult) {
  return Math.min(...assetResult.nonOverlappingMetrics.map((m) => m.netVsBenchmark.mean));
}

async function searchOnePilot(config, splitStateDoc) {
  const pilot = CONFIG_KEY_TO_PILOT[config.key];
  const data = await fetchAssetClassData(config, EXTRA_HISTORY_DAYS);

  const { splitDate, initialized, previousTestCount } = getOrInitSplitDate(pilot, data.eligibleDates, splitStateDoc);
  const train = data.eligibleDates.filter((d) => d <= splitDate);
  const test = data.eligibleDates.filter((d) => d > splitDate);

  // fetchAssetClassData(..., EXTRA_HISTORY_DAYS) fetches a window rolling
  // from TODAY (alpaca-client.js's getDailyBars() computes `start` as
  // Date.now() minus a day count), not from a fixed calendar date. This
  // file's own header claims the training window's start "stays fixed
  // indefinitely," but that only holds while EXTRA_HISTORY_DAYS trading
  // days still reach back past splitDate -- once the fetch window's oldest
  // boundary ages past splitDate, TRAIN would silently start losing its
  // earliest dates on every subsequent run. Detect and fail loud instead
  // of quietly training on a shrinking window.
  const previousTrainCount = splitStateDoc[pilot] && splitStateDoc[pilot].lastTrainCount;
  if (previousTrainCount && train.length < previousTrainCount) {
    throw new Error(`${pilot}: TRAIN shrank from ${previousTrainCount} to ${train.length} signal dates -- EXTRA_HISTORY_DAYS=${EXTRA_HISTORY_DAYS} no longer reaches back to splitDate (${splitDate}). Increase EXTRA_HISTORY_DAYS or re-anchor the fetch to a fixed calendar start instead of "today minus N trading days".`);
  }
  splitStateDoc[pilot] = { splitDate, lastRunAt: new Date().toISOString(), lastTestCount: test.length, lastTrainCount: train.length };

  if (train.length < MIN_TRAIN_DATES || test.length < MIN_TEST_DATES) {
    return { pilot, config, skipped: true, reason: `insufficient signal dates for the fixed split (train=${train.length}, test=${test.length}, need >= ${MIN_TRAIN_DATES}/${MIN_TEST_DATES})` };
  }

  const grid = buildGrid().map((weights) => ({ weights, objective: worstHorizonExcess(scoreAssetClassData(data, weights, train)) }));
  grid.sort((a, b) => b.objective - a.objective);
  const winner = grid[0];

  const testResult = scoreAssetClassData(data, winner.weights, test);
  const passes = assetClassHasDefensibleEdge(testResult);

  const doc = loadWeightsDoc();
  const previousWeights = doc[pilot];
  let applied = false;
  if (passes) {
    doc[pilot] = { ...winner.weights, lastUpdated: new Date().toISOString(), appliedBy: 'backtest-parameter-search.js' };
    saveWeightsDoc(doc);
    applied = true;
  }

  const growthNote = previousTestCount !== null ? ` (test set grew from ${previousTestCount} to ${test.length} signals since the last run)` : ' (first run under the fixed-split design -- this splitDate is now permanent for this pilot)';
  const factKey = `screen_score_weights_${pilot}`;
  const factValue = applied
    ? `Applied ${JSON.stringify(winner.weights)} (was ${JSON.stringify(previousWeights)}) -- cleared the out-of-sample bar on ${test.length} held-out signals, extending since ${splitDate}${growthNote}.`
    : `Searched (train=${train.length} fixed, test=${test.length} signals extending since ${splitDate}${growthNote}), best in-sample combo ${JSON.stringify(winner.weights)} did NOT clear the out-of-sample bar -- no change applied, weights remain ${JSON.stringify(previousWeights)}.`;
  // Direct call, not the task-dispatch eligibility gate -- this is a real
  // deterministic computation over real historical bars, trustworthy by
  // construction, same posture as backtest-supervisor.js's daily fact.
  memoryStore.recordFact(factKey, factValue, { sourceTaskId: 'backtest-parameter-search-cron', taskTo: 'claude' });

  return { pilot, config, splitDate, initialized, trainCount: train.length, testCount: test.length, previousTestCount, grid, winner, testResult, passes, applied, previousWeights };
}

async function main() {
  const splitStateDoc = loadSplitStateDoc();
  const results = [];
  for (const config of ASSET_CLASSES) {
    try {
      results.push(await searchOnePilot(config, splitStateDoc));
    } catch (err) {
      console.error(`parameter search FAILED for ${config.key}: ${err.message}`);
      results.push({ pilot: CONFIG_KEY_TO_PILOT[config.key], config, failed: true, reason: err.message });
    }
  }
  saveSplitStateDoc(splitStateDoc); // persisted once per run, after all pilots attempted -- a mid-run crash never leaves a pilot's splitDate half-written

  for (const result of results) {
    if (result.failed) { console.log(`${result.pilot}: FAILED -- ${result.reason}`); continue; }
    if (result.skipped) { console.log(`${result.pilot}: skipped -- ${result.reason}`); continue; }
    console.log(`${result.pilot}: ${result.initialized ? `initialized split at ${result.splitDate}` : `split fixed at ${result.splitDate}`}, test set ${result.testCount} signals${result.previousTestCount !== null ? ` (was ${result.previousTestCount})` : ''} -- winner chgPct=${result.winner.weights.chgPct}/avgVolume=${result.winner.weights.avgVolume} (train worst-horizon excess ${(result.winner.objective * 100).toFixed(2)}%), out-of-sample ${result.passes ? 'PASSED' : 'failed'} -- ${result.applied ? 'APPLIED to live weights' : 'no change'}.`);
    const weekPrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const pub = vaultWriter.publishWeightSearchNote(result.pilot, weekPrefix, result);
    console.log(`  vault note: ${pub.written ? pub.path : pub.reason}`);
  }
  return results;
}

if (require.main === module) {
  main().catch((err) => { console.error(`backtest-parameter-search FAILED: ${err.message}`); process.exitCode = 1; });
}

module.exports = { main, searchOnePilot, buildGrid, getOrInitSplitDate, worstHorizonExcess, CONFIG_KEY_TO_PILOT };
