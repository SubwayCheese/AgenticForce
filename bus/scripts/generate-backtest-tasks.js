// generate-backtest-tasks.js -- authors the weekly deep multi-agent
// entry/exit backtest batch (ARCHITECTURE.md section 9's recurring-
// backtest gap, closed 2026-09-13). Generalizes the one-off
// strategy_backtest_20260913_* task suite (NVDA/JPM/KO, hand-built and
// run manually the same day) into a reusable generator so
// backtest-supervisor.js can call it on a rotating schedule without a
// human re-authoring task files each week.
//
// Deliberately reuses real, already-proven pieces rather than
// reimplementing them: alpaca-client.js's getDailyBars() for real daily
// bars, generate-pilot-tasks.js's computeRSI14()/computeSupportResistance()
// for the exact same walk-forward technical readouts the live pilot
// itself computes, and its writeTaskFile()-adjacent primitives
// (taskExists()/taskFilePath()) for on-disk task-file conventions.
//
// This is a REPORT-ONLY generator: every task it writes is `to: codex` /
// `to: claude-agent` / (for the data task) an orchestrator-sourced
// `to: claude`, `status: done` fact. Nothing here calls
// execute-portfolio-setup.js or touches paper-trades.jsonl -- the queue
// daemon (already running, unmodified) dispatches the pending ones
// exactly like any other task file, and dispatch here can never place a
// real (paper) order.
//
// Codex + Claude usage split, per the user's explicit 2026-09-13 decision:
// Claude only appears here, in this low-frequency (weekly) role -- never
// in the live daily fleet_pilot_*/crypto_pilot_* cycle, which stays
// Codex-only for the reason generate-pilot-tasks.js's own header already
// documents (claude-agent shares the interactive Claude Code session's
// own usage pool; a real session-limit incident already happened once).

const fs = require('fs');
const path = require('path');
const alpaca = require('./alpaca-client.js');
const gen = require('./generate-pilot-tasks.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const TASKS_DIR = path.join(VAULT_ROOT, 'tasks');

const COMPANY_NAMES = require('./company-names.json').names;
const CRYPTO_NAMES = require('./crypto-names.json').names;

// Tightened 2026-09-15 (from 10): real evidence across dozens of live
// dispatches showed 10-day sampling produces "zero genuine triggers" for
// nearly every symbol -- not because the strategy has no signal, but
// because a 10-day-coarse sample mostly misses the days a support/
// resistance level was actually touched. Every prompt string below
// already references this constant via template literals (grepped
// before this change: no hardcoded "10" strings anywhere in this file),
// so this is the entire fix -- no prompt text can drift out of sync.
// Real tradeoff: ~3x more rows in the injected walk-forward table per
// symbol (~36 -> ~116 over the same ~500-bar window), same single Alpaca
// fetch either way.
const WALKFORWARD_STEP_DAYS = 3;
const MIN_BARS_FOR_WARMUP = 200; // needs a real 200-day MA before the first sampled point
const BARS_TO_FETCH = 500; // ~2 years, matches today's one-off run

function nowIso() {
  return new Date().toISOString();
}

function taskFilePath(id) {
  return path.join(TASKS_DIR, `${id}.md`);
}

function taskExists(id) {
  return fs.existsSync(taskFilePath(id));
}

function resolveName(pilot, symbol) {
  const map = pilot === 'crypto' ? CRYPTO_NAMES : COMPANY_NAMES;
  return (map && map[symbol]) || symbol;
}

function strategyRuleText(pilot) {
  const lines = [
    'STRATEGY UNDER TEST (condensed, faithfully, from this vault\'s own LIVE decision logic in bus/scripts/generate-pilot-tasks.js -- the same conditionalSetup/triggerPrice/triggerType/invalidationCondition rules actually used to gate real paper-account entries today, NOT a hypothetical rule invented for this backtest):',
    '',
    '1. Trend filter -- MA50 vs MA200 posture (computeMAPosture): "above" (MA50 > MA200) = constructive backdrop, favors long entries; "below" = cautious backdrop. This strategy is long-only (no short side), matching the live pilot\'s actual constraint.',
    '2. Entry trigger -- exactly two trigger types, using the trailing 20-day support/resistance band (computeSupportResistance) as the exact trigger level, same as the live conditionalCandidates.triggerPrice/triggerType fields:',
    '   - "at_or_below" (pullback/breakdown-confirmed entry): price reaches or dips to/below the current 20-day support level. Treat as a genuine trigger only when the trend filter is NOT decisively broken (MA50 not falling away from MA200) and RSI14 is not already deeply overbought.',
    '   - "at_or_above" (breakout/strength-confirmed entry): price closes at/above the current 20-day resistance level, showing renewed strength.',
    '3. RSI14 as a supporting filter, not a standalone trigger: <=30 = oversold (adds confirmation to a support-test/pullback entry), >=70 = overbought (adds confirmation to a breakout entry but raises chase risk), 30-70 = neutral context only.',
    '4. Exit rule -- whichever fires first:',
    '   - Time-based: exit after a fixed holding horizon if no invalidation fired first (this backtest uses 5/10/20-trading-day horizons, the same horizons already used in this vault\'s bus/scripts/backtest-screen-score-v2.js, for direct comparability).',
    '   - Invalidation: for a support/pullback entry, a subsequent close back below the support level that triggered entry (thesis broken); for a breakout entry, a subsequent close back below the resistance level that triggered entry (failed breakout).',
  ];
  if (pilot === 'crypto') {
    lines.push('', 'This universe is confirmed spot/long-only on the live paper account (shortable:false) -- no short side exists here either, consistent with the live pilot\'s own crypto constraint.');
  }
  return lines.join('\n');
}

function fmtPoint(p) {
  return `| ${p.date} | $${p.close} | ${p.rsi14 ?? 'n/a'} | $${p.ma50 ?? 'n/a'} | $${p.ma200 ?? 'n/a'} | $${p.support20d} | $${p.resistance20d} |`;
}

function symbolTable(points) {
  const header = '| Date | Close | RSI14 | 50-day MA | 200-day MA | 20-day support | 20-day resistance |\n|---|---|---|---|---|---|---|';
  return `${header}\n${points.map(fmtPoint).join('\n')}`;
}

// No-lookahead walk-forward technical series, identical method to the
// 2026-09-13 one-off run: every point uses ONLY bars available up to and
// including that date.
function computeWalkForward(bars) {
  const points = [];
  for (let i = MIN_BARS_FOR_WARMUP; i < bars.length; i += WALKFORWARD_STEP_DAYS) {
    points.push(pointAt(bars, i));
  }
  const lastIdx = bars.length - 1;
  if (!points.length || points[points.length - 1].date !== String(bars[lastIdx].t).slice(0, 10)) {
    points.push(pointAt(bars, lastIdx));
  }
  return points;
}

function pointAt(bars, i) {
  const windowBars = bars.slice(0, i + 1);
  const rsi14 = gen.computeRSI14(windowBars);
  const closes = windowBars.map((b) => b.c);
  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  const ma50 = avg(closes.slice(-50));
  const ma200 = avg(closes.slice(-200));
  const { support, resistance } = gen.computeSupportResistance(windowBars);
  const bar = bars[i];
  return {
    date: String(bar.t).slice(0, 10),
    close: Number(bar.c.toFixed(2)),
    rsi14: rsi14 !== null ? Number(rsi14.toFixed(1)) : null,
    ma50: ma50 !== null ? Number(ma50.toFixed(2)) : null,
    ma200: ma200 !== null ? Number(ma200.toFixed(2)) : null,
    support20d: Number(support.toFixed(2)),
    resistance20d: Number(resistance.toFixed(2)),
  };
}

function writeRaw(id, lines) {
  if (taskExists(id)) throw new Error(`Refusing to overwrite existing task file: ${id}.md`);
  fs.writeFileSync(taskFilePath(id), lines.join('\n'), 'utf8');
  return id;
}

function writeDataTask(prefix, pilot, symbol, points, totalBars, firstDate, lastDate) {
  const id = `${prefix}data_${symbol.toLowerCase()}`;
  const name = resolveName(pilot, symbol);
  const source = `Alpaca market-data API (${pilot === 'crypto' ? 'data.alpaca.markets/v1beta3/crypto/us/bars' : 'data.alpaca.markets/v2/stocks/bars, feed=iex'}, timeframe=1Day), fetched live for ${symbol} (${name}), ${totalBars} real daily bars ${firstDate} through ${lastDate}. Walk-forward technical readouts below (RSI14, 50/200-day close MA, 20-day support/resistance) computed with this vault's own live functions -- generate-pilot-tasks.js's computeRSI14()/computeSupportResistance() -- every ${WALKFORWARD_STEP_DAYS} trading days from bar ${MIN_BARS_FOR_WARMUP} onward, each point using ONLY bars available up to and including that date (no lookahead), exactly matching how the live pilot computes these same fields each cycle.`;
  return writeRaw(id, [
    `## ${id}`,
    'from: claude',
    'to: claude',
    'type: response',
    'status: done',
    `source: ${source}`,
    'payload: (orchestrator-sourced -- no dispatch)',
    `timestamp: ${nowIso()}`,
    '',
    '## Result (auto)',
    `resolved_at: ${nowIso()}`,
    'output:',
    '```',
    'SOURCE: verified live (Alpaca market-data API, not training-data recall)',
    `As of: fetched ${nowIso().slice(0, 10)}. Series: ${points.length} walk-forward points, ${points[0].date} through ${points[points.length - 1].date} (~${WALKFORWARD_STEP_DAYS}-trading-day sampling interval -- this is NOT a daily series; treat each point as an approximate window, not an exact trigger day).`,
    '',
    `### ${symbol} (${name}) -- walk-forward technical series`,
    symbolTable(points),
    '',
    strategyRuleText(pilot),
    '```',
    '',
  ]);
}

function backtestPayload(symbol, dataTaskId) {
  return [
    `BACKTEST the strategy rule (auto-injected below via dependency, from ${dataTaskId}) against ${symbol}'s real walk-forward technical series (also injected). This is a real historical validation exercise, not a hypothetical -- every number in the injected series came from live Alpaca daily bars.`,
    '',
    'Walk the series chronologically. For EACH point where the strategy\'s entry trigger condition is genuinely met (support-level pullback trigger with trend/RSI support, OR resistance-level breakout trigger with trend/RSI support -- see the injected rule for the exact conditions), record it as a candidate historical entry: state the trigger type, the date, the trigger price, and your reasoning for why it counts (or does not count) as a real trigger under the stated rule.',
    '',
    'For each entry you accept, determine the exit using the injected exit rule: scan forward through the remaining series points for the first invalidation (a later close back through the trigger level), or -- if none appears -- treat the position as still open at the horizon implied by the next available sampled point(s), being explicit that the sampling interval means you cannot pinpoint the exact session an intraday invalidation or a precise 5/10/20-session time exit would have fired; approximate using the nearest sampled point(s) and say so plainly rather than inventing false precision.',
    '',
    'Compute the real % return for each accepted entry using the actual injected closes (entry trigger price to exit price). Then give an overall verdict for this single symbol: does the strategy\'s entry/exit logic, applied honestly to this real history, produce a net positive, net negative, or inconclusive result -- and how many genuine trigger events did you actually find (a very small count, e.g. 0-2, is a real and expected possible outcome given the sampling granularity -- do not manufacture triggers that do not genuinely meet the rule just to have something to report).',
    '',
    'Be explicit about what this backtest can and cannot prove: a single symbol, a coarse sampling interval, is a small sample -- state that plainly rather than overstating confidence either way.',
    '',
    'On the FINAL line of your response, state exactly: `TRIGGER_COUNT: <integer>` -- the exact count of genuine accepted entries from above, machine-checkable, matching this vault\'s existing SOURCE:/Lean:-style convention. This must be the literal count you just walked through, never rounded or estimated.',
  ].join('\n');
}

function writeBacktestTask(prefix, symbol, dataTaskId, to, recordFactKey) {
  const agentTag = to === 'codex' ? 'codex' : 'claude';
  const id = `${prefix}${agentTag}_${symbol.toLowerCase()}`;
  const lines = [
    `## ${id}`,
    'from: claude',
    `to: ${to}`,
    'type: request',
    'status: pending',
    `payload: ${backtestPayload(symbol, dataTaskId)}`,
    `timestamp: ${nowIso()}`,
    `dependsOnTaskId: ${dataTaskId}`,
  ];
  if (recordFactKey) lines.push(`recordFact: ${recordFactKey}`);
  lines.push('');
  return writeRaw(id, lines);
}

function writeSynthesisTask(prefix, symbol, codexId, claudeId) {
  const id = `${prefix}synthesis_${symbol.toLowerCase()}`;
  const payload = [
    `RECONCILE two INDEPENDENT backtests of the same strategy rule against the same real ${symbol} history (Codex's and a separate Claude instance's, auto-injected below -- neither saw the other's output before producing it).`,
    '',
    'Compare their identified entry/exit points and computed returns. Where they agree on a trigger event, note it as corroborated. Where they disagree (one found a trigger the other missed, or they computed different exit points/returns for the same entry), identify the actual discrepancy and judge which reading more faithfully follows the injected strategy rule and data -- do not just average or split the difference; make a real judgment call and say why.',
    '',
    `Produce ONE final verdict for ${symbol}: is this strategy's entry/exit logic validated by this real historical sample (net positive, corroborated by both independent readings), invalidated (net negative or the readings expose a real logical flaw in the rule), or inconclusive (too few genuine trigger events in this sample to judge either way -- a legitimate outcome, not a failure to find something)? State the actual trigger count and net return implied by your reconciled reading.`,
  ].join('\n');
  return writeRaw(id, [
    `## ${id}`,
    'from: claude',
    'to: codex',
    'type: request',
    'status: pending',
    `payload: ${payload}`,
    `timestamp: ${nowIso()}`,
    `dependsOnTaskIds: ${codexId}, ${claudeId}`,
    '',
  ]);
}

function writeBatchSynthesisTask(prefix, pilot, symbols, synthesisIds, weekPrefix) {
  const id = `${prefix}synthesis_batch`;
  const payload = [
    `WEEKLY BATCH VERDICT for the current trading strategy's entry/exit rules across this week's rotating sample (${pilot}, week ${weekPrefix}): ${symbols.join(', ')}. Combining the independently-reconciled per-symbol verdicts, auto-injected below.`,
    '',
    'State plainly, across this week\'s symbols together: how many genuine trigger events were found in total, how many were net-positive vs net-negative, and whether the strategy\'s entry/exit logic shows a real, consistent edge across this sample or not. If the symbols disagree (e.g. validated on one, invalidated on another), do not force a false consensus -- report the split honestly and say what that split itself implies.',
    '',
    "For context only (do not treat as the same question): this vault's bus/scripts/backtest-screen-score-v2.js separately found NO statistically defensible, cost-surviving edge in the LIVE SCREEN-SCORE RANKING. That is a different claim (portfolio selection/ranking edge) from this task's claim (whether specific entry/exit trigger rules on individual symbols are validated) -- note whether your finding here is consistent with, or in tension with, that separate result, without conflating the two questions.",
    '',
    'Close with an explicit, honest confidence statement about what this small, rotating-sample backtest can and cannot claim to prove about the strategy going forward. This is a REPORT for the record, not a trading decision -- nothing downstream of this task executes any order.',
  ].join('\n');
  return writeRaw(id, [
    `## ${id}`,
    'from: claude',
    'to: codex',
    'type: request',
    'status: pending',
    `payload: ${payload}`,
    `timestamp: ${nowIso()}`,
    `dependsOnTaskIds: ${synthesisIds.join(', ')}`,
    `recordFact: strategy_backtest_${weekPrefix}_${pilot}_verdict`,
    '',
  ]);
}

// The one function backtest-supervisor.js calls. `pilot` is 'fleet' or
// 'crypto' (matching generate-pilot-tasks.js's own vocabulary); `symbols`
// is this week's rotating slice (caller decides which N); `weekPrefix` is
// a caller-supplied label (e.g. an ISO date the rotation week started),
// used only for task-id/fact-key naming, not parsed as a date here.
async function generateWeeklyBacktestBatch(pilot, symbols, weekPrefix) {
  const prefix = `strategy_backtest_${weekPrefix}_${pilot}_`;
  if (taskExists(`${prefix}synthesis_batch`)) {
    return { skipped: true, reason: `${prefix}synthesis_batch already exists -- this week's batch was already generated` };
  }

  const barsBySymbol = await alpaca.getDailyBars(symbols, { limit: BARS_TO_FETCH });
  const synthesisIds = [];
  const createdIds = [];
  const skippedSymbols = [];

  for (const symbol of symbols) {
    const entry = barsBySymbol[symbol];
    if (!entry || !entry.bars || entry.bars.length < MIN_BARS_FOR_WARMUP + WALKFORWARD_STEP_DAYS) {
      skippedSymbols.push({ symbol, reason: !entry ? 'no bars returned' : `only ${entry.bars.length} bars, need at least ${MIN_BARS_FOR_WARMUP + WALKFORWARD_STEP_DAYS}` });
      continue;
    }
    const bars = entry.bars;
    const points = computeWalkForward(bars);
    const firstDate = String(bars[0].t).slice(0, 10);
    const lastDate = String(bars[bars.length - 1].t).slice(0, 10);

    const dataId = writeDataTask(prefix, pilot, symbol, points, bars.length, firstDate, lastDate);
    const codexId = writeBacktestTask(prefix, symbol, dataId, 'codex');
    const claudeId = writeBacktestTask(prefix, symbol, dataId, 'claude-agent');
    const synId = writeSynthesisTask(prefix, symbol, codexId, claudeId);
    createdIds.push(dataId, codexId, claudeId, synId);
    synthesisIds.push(synId);
  }

  if (!synthesisIds.length) {
    return { skipped: true, reason: `no symbol had enough bars to backtest this week (${JSON.stringify(skippedSymbols)})` };
  }

  const batchId = writeBatchSynthesisTask(prefix, pilot, symbols.filter((s) => barsBySymbol[s] && barsBySymbol[s].bars && barsBySymbol[s].bars.length >= MIN_BARS_FOR_WARMUP + WALKFORWARD_STEP_DAYS), synthesisIds, weekPrefix);
  createdIds.push(batchId);

  return { skipped: false, createdIds, batchId, skippedSymbols };
}

// Codex-only, continuous track (added 2026-09-14, ARCHITECTURE.md section
// 14 -- supersedes the weekly dual-specialist batch above as the
// scheduled/automatic path; that function stays callable manually, just
// no longer auto-invoked). Per symbol: the same real data task as the
// weekly batch, and ONE `to: codex` backtest task -- no claude-agent task,
// no per-symbol synthesis, since there's only one specialist's reading to
// report, nothing to reconcile. `recordFact: continuous_backtest_<symbol>`
// on the codex task captures its verdict automatically through the
// existing writeTaskResult()/recordFact mechanism -- no manual
// memory-store call needed here, unlike backtest-parameter-search.js
// (that script isn't a dispatched task; this is).
//
// `tickId` (caller-supplied, e.g. the generating tick's own
// YYYYMMDDHHmm) makes every tick's task ids unique so the same symbol
// can be re-tested every ~7 hours forever without ever colliding with a
// prior run's files.
async function generateContinuousBacktestBatch(pilot, symbols, tickId) {
  const prefix = `continuous_backtest_${tickId}_${pilot}_`;
  const barsBySymbol = await alpaca.getDailyBars(symbols, { limit: BARS_TO_FETCH });
  const createdIds = [];
  const skippedSymbols = [];

  for (const symbol of symbols) {
    const entry = barsBySymbol[symbol];
    if (!entry || !entry.bars || entry.bars.length < MIN_BARS_FOR_WARMUP + WALKFORWARD_STEP_DAYS) {
      skippedSymbols.push({ symbol, reason: !entry ? 'no bars returned' : `only ${entry.bars.length} bars, need at least ${MIN_BARS_FOR_WARMUP + WALKFORWARD_STEP_DAYS}` });
      continue;
    }
    const bars = entry.bars;
    const points = computeWalkForward(bars);
    const firstDate = String(bars[0].t).slice(0, 10);
    const lastDate = String(bars[bars.length - 1].t).slice(0, 10);

    const dataId = writeDataTask(prefix, pilot, symbol, points, bars.length, firstDate, lastDate);
    const codexId = writeBacktestTask(prefix, symbol, dataId, 'codex', `continuous_backtest_${symbol}`);
    createdIds.push(dataId, codexId);
  }

  return { createdIds, skippedSymbols };
}

module.exports = { generateWeeklyBacktestBatch, generateContinuousBacktestBatch, strategyRuleText };
