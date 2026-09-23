// conditional-triggers.js -- the "keep passively scanning, confirm before
// firing" path added 2026-09-10, direct user request: round-3 shouldn't be
// stuck choosing between "execute now" and "nothing happens today" --
// a genuinely conditional thesis (sound reasoning, wrong current price)
// should sit as a watched price trigger, and when that price is actually
// touched, a brief automated rescan re-verifies the thesis BEFORE anything
// fires -- never a blind fill.
//
// State machine per (sourceTask, symbol): armed -> fired (rescan
// dispatched) -> confirmed (executed) | invalidated | expired. A candidate
// can also go straight to `trigger-blocked` -- a TERMINAL state added
// 2026-09-11 for the two things that must never be retried on a timer: a
// candidate whose own text says its levels aren't derived this cycle (the
// real VZ case), and an execution the position-identity check permanently
// refused (we already hold the symbol). Tracked in
// bus/pending-triggers.jsonl, append-only event log -- same discipline as
// bus/paper-trades.jsonl, latest event per key wins for current state.
//
// Live price comes from alpaca-client.js's getLatestQuote() (the execution
// venue's own market-data API), NOT FMP -- this works today even though
// FMP_API_KEY isn't configured yet, and it's the more honest source of
// truth for "would this order actually fill near this price."

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const runTask = require('../platform/run-task.js');
const fleetStatus = require('./fleet-status.js');
const cryptoStatus = require('./crypto-status.js');
const alpaca = require('./alpaca-client.js');
const cryptoSymbols = require('./crypto-symbols.js');
const gen = require('./generate-pilot-tasks.js');
const executor = require('./execute-portfolio-setup.js');
const ntfy = require('../platform/ntfy.js');
// Portfolio-level risk envelope (capital-at-risk ceiling, crypto-correlation
// cap, daily circuit breaker) -- added 2026-09-11, a NEW standalone module,
// see portfolio-risk-envelope.js for the full rationale and real thresholds.
// Called from this file's own arm/fire functions below (armNewTriggers(),
// checkRescanResults()) as the practical integration point: this package
// doesn't own execute-portfolio-setup.js's actual order-placement call site,
// but every entry this system makes flows through one of those two funnels
// first, so gating here is a real, effective checkpoint without touching a
// file owned by another agent's package.
const riskEnvelope = require('./portfolio-risk-envelope.js');

const VAULT_ROOT = avPaths.ROOT;
const LOG_PATH = path.join(VAULT_ROOT, 'bus', 'pending-triggers.jsonl');

function nowIso() {
  return new Date().toISOString();
}

// Alert promises started from a synchronous code path (armNewTriggers), so a
// short-lived `node conditional-triggers.js` run can't exit before an ntfy
// POST it started has actually gone out. Drained by main(); harmless to
// ignore in the long-running supervisor.
const pendingAlerts = [];

function appendEvent(record) {
  fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: nowIso(), ...record }) + '\n', 'utf8');
}

function readEvents() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

// Groups events by "sourceTask::symbol" and returns only the latest event
// per key -- that latest event's `type` IS the current state.
function latestStateByKey() {
  const byKey = new Map();
  for (const e of readEvents()) {
    const key = `${e.sourceTask}::${e.symbol}`;
    byKey.set(key, e); // later in file wins, matches append-only + chronological order
  }
  return byKey;
}

// Same JSON-fence extraction pattern as execute-portfolio-setup.js's
// extractApprovedCandidates(), for the new conditionalCandidates array.
function extractConditionalCandidates(taskId) {
  const taskPath = path.join(VAULT_ROOT, 'tasks', `${taskId}.md`);
  if (!fs.existsSync(taskPath)) return [];
  const text = fs.readFileSync(taskPath, 'utf8');
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed.conditionalCandidates)) return parsed.conditionalCandidates;
    } catch (_) { /* try next fence */ }
  }
  return [];
}

function findLatestRound3(pilot) {
  const status = pilot === 'crypto' ? cryptoStatus : fleetStatus;
  const findDate = pilot === 'crypto' ? status.findLatestCryptoPipelineDate : status.findLatestPipelineDate;
  const date = findDate();
  if (!date) return null;
  const versions = status.discoverRound3Versions(date);
  if (!versions.length) return null;
  return versions[versions.length - 1].taskId;
}

// Arms any conditionalCandidate from the latest round-3 synthesis that
// isn't already tracked (by sourceTask::symbol) -- safe to call every
// supervisor wake, idempotent by construction (readEvents() check below).
// Async since 2026-09-11: the portfolio-risk-envelope gate below needs a
// live account/positions lookup. pilot-supervisor.js's checkConditionalTriggers()
// already awaits this call (updated the same day). The data-integrity
// gate's own ntfy alert is still parked in pendingAlerts rather than
// awaited inline, same reasoning as before -- no need to block arming on
// an alert send succeeding.
async function armNewTriggers(pilot) {
  const taskId = findLatestRound3(pilot);
  if (!taskId) return [];
  const task = runTask.readTaskFile(taskId);
  if (!task || task.status !== 'done') return [];

  const candidates = extractConditionalCandidates(taskId);
  if (!candidates.length) return [];

  const known = latestStateByKey();
  const armed = [];
  for (const c of candidates) {
    const symbol = c.conditionalSetup ? c.conditionalSetup.symbol : c.symbol;
    const key = `${taskId}::${symbol}`;
    if (known.has(key)) continue; // already armed (or further along) this cycle
    if (typeof c.triggerPrice !== 'number' || !['at_or_below', 'at_or_above'].includes(c.triggerType)) {
      console.log(`[conditional-triggers] SKIPPED ${symbol}: malformed triggerPrice/triggerType, not arming (got ${JSON.stringify({ triggerPrice: c.triggerPrice, triggerType: c.triggerType })})`);
      continue;
    }
    // Data-integrity gate, applied at ARM time as well as at execution time
    // (executor.executeOne() runs the same scan). Arming a candidate whose
    // own text says its levels aren't derived would otherwise burn a real
    // Codex rescan dispatch on something that can never legally execute --
    // and the real VZ candidate on 2026-09-11 was exactly this shape: it
    // armed, fired, rescanned, and filled, with "inherited" sitting in its
    // own bullCase the whole time. Terminal state, deliberately: a blocked
    // trigger is not retried, the round-3 output has to be fixed upstream.
    const redFlags = executor.scanCandidateForRedFlags(c);
    if (redFlags.length) {
      appendEvent({
        type: 'trigger-blocked',
        sourceTask: taskId,
        pilot,
        symbol,
        reason: 'data-integrity: candidate text flags its levels as inherited/not-derived/stale',
        findings: redFlags,
        candidate: c,
      });
      console.log(`[conditional-triggers] BLOCKED ${symbol}: not arming -- ${redFlags.map((f) => `${f.field}: "${f.matched}"`).join('; ')}`);
      pendingAlerts.push(ntfy.sendNtfy({
        title: `${symbol}: conditional trigger BLOCKED, non-derived levels`,
        message: `${symbol} (from ${taskId}) was not armed as a price trigger: its own candidate text flags the trigger/invalidation levels as not derived this cycle (${redFlags.map((f) => f.matched).join(', ')}). This is the VZ 2026-09-11 failure mode.`,
        priority: 4,
      }).catch(() => {}));
      continue;
    }

    // Portfolio risk envelope gate -- arming a trigger doesn't spend
    // capital yet, but the crypto-correlation check is specifically about
    // not letting a pile of correlated altcoin longs get armed in the
    // first place (see portfolio-risk-envelope.js), so this check belongs
    // at arm-time too, not just at fire-time below.
    //
    // REAL BUG FOUND LIVE 2026-09-13 (multi-agent risk re-review, same day
    // as the $15->$1,000/leg sizing change): this call and the one below
    // both hardcoded `newLegNotionalUsd: 15` -- so every real arm/fire
    // check told the $10,000 capital-at-risk ceiling "this new leg only
    // adds $15" even after real legs became $1,000. The ceiling was
    // rescaled correctly in portfolio-risk-envelope.js, but these two
    // callers, which feed it the real leg size, were missed in that same
    // commit -- the ceiling was effectively decorative on this path.
    // Fixed by referencing the real live constant instead of a copied
    // literal, so this can't silently drift out of sync again.
    let gate;
    try {
      gate = await riskEnvelope.checkPortfolioRiskEnvelope({ symbol, newLegNotionalUsd: executor.AUTO_MICRO_NOTIONAL_PER_LEG, stage: 'arm' });
    } catch (err) {
      console.log(`[conditional-triggers] ${symbol}: portfolio risk envelope check FAILED (${err.message}) -- not arming, fail safe.`);
      continue;
    }
    if (!gate.ok) {
      console.log(`[conditional-triggers] NOT ARMING ${symbol}: blocked by portfolio risk envelope -- ${gate.reasons.join('; ')}`);
      continue;
    }
    appendEvent({
      type: 'trigger-armed',
      sourceTask: taskId,
      pilot,
      symbol,
      direction: c.conditionalSetup && c.conditionalSetup.direction,
      triggerPrice: c.triggerPrice,
      triggerType: c.triggerType,
      candidate: c, // full candidate payload, needed later to execute or rescan
    });
    armed.push(symbol);
  }
  if (armed.length) console.log(`[conditional-triggers] Armed ${armed.length} trigger(s) from ${taskId}: ${armed.join(', ')}`);
  return armed;
}

function isTriggered(mid, triggerPrice, triggerType) {
  return triggerType === 'at_or_below' ? mid <= triggerPrice : mid >= triggerPrice;
}

// For every currently-"armed" (watching) trigger: fetch a live quote,
// check against triggerPrice/triggerType. On a match, this does NOT
// execute -- it dispatches a brief rescan task and logs "trigger-fired".
// Actual execution only happens in checkRescanResults(), and only if that
// rescan comes back STILL VALID.
async function checkTriggers() {
  const byKey = latestStateByKey();
  const watching = Array.from(byKey.values()).filter((e) => e.type === 'trigger-armed');
  const fired = [];

  for (const record of watching) {
    let quote;
    try {
      quote = await alpaca.getLatestQuote(record.symbol);
    } catch (err) {
      console.log(`[conditional-triggers] ${record.symbol}: quote lookup failed, skipping this check -- ${err.message}`);
      continue;
    }
    if (!isTriggered(quote.mid, record.triggerPrice, record.triggerType)) continue;

    const datePrefix = gen.todayDatePrefix();
    const rescanTaskId = gen.generateRescanTask(record.pilot, record.symbol, datePrefix, record.sourceTask, quote.mid, record.triggerPrice, record.triggerType);
    appendEvent({
      type: 'trigger-fired',
      sourceTask: record.sourceTask,
      pilot: record.pilot,
      symbol: record.symbol,
      livePrice: quote.mid,
      triggerPrice: record.triggerPrice,
      triggerType: record.triggerType,
      rescanTaskId,
      candidate: record.candidate,
    });
    console.log(`[conditional-triggers] TRIGGERED ${record.symbol}: live $${quote.mid} vs trigger $${record.triggerPrice} (${record.triggerType}) -- rescan dispatched: ${rescanTaskId}`);
    fired.push(record.symbol);
  }
  return fired;
}

function parseVerdict(outputText) {
  const text = String(outputText || '');
  if (/VERDICT:\s*STILL VALID/i.test(text)) return 'still_valid';
  if (/VERDICT:\s*NO LONGER VALID/i.test(text)) return 'no_longer_valid';
  return null; // malformed/missing verdict -- never guess, treat as unresolved
}

// For every "trigger-fired" (rescan dispatched, awaiting result) trigger:
// check whether its rescan task has completed, and if so, act on the
// verdict. STILL VALID -> execute for real via execute-portfolio-setup.js's
// own executeOne() (idempotency-guarded there too, so a duplicate check
// never double-enters). NO LONGER VALID -> logged, nothing executed. A
// malformed/missing verdict is left pending rather than assumed either way.
async function checkRescanResults() {
  const byKey = latestStateByKey();
  const pendingRescans = Array.from(byKey.values()).filter((e) => e.type === 'trigger-fired');
  const results = [];

  for (const record of pendingRescans) {
    const rescanTask = runTask.readTaskFile(record.rescanTaskId);
    if (!rescanTask || rescanTask.status !== 'done' || !rescanTask.output) continue; // still waiting

    const verdict = parseVerdict(rescanTask.output);
    if (verdict === null) {
      console.log(`[conditional-triggers] ${record.symbol}: rescan ${record.rescanTaskId} completed but has no parseable VERDICT line -- leaving pending, not guessing.`);
      continue;
    }

    if (verdict === 'no_longer_valid') {
      appendEvent({
        type: 'trigger-invalidated',
        sourceTask: record.sourceTask,
        pilot: record.pilot,
        symbol: record.symbol,
        rescanTaskId: record.rescanTaskId,
        reason: 'rescan verdict: NO LONGER VALID',
      });
      console.log(`[conditional-triggers] INVALIDATED ${record.symbol}: rescan said no longer valid, not executing.`);
      results.push({ symbol: record.symbol, verdict });
      continue;
    }

    // STILL VALID -- but gate on the portfolio risk envelope BEFORE sizing
    // or executing anything. This is the moment capital actually gets
    // committed, so it's the most important of the two integration points
    // in this file (the other being armNewTriggers() above) -- see
    // portfolio-risk-envelope.js for the real thresholds and rationale.
    let gate;
    try {
      gate = await riskEnvelope.checkPortfolioRiskEnvelope({ symbol: record.symbol, newLegNotionalUsd: executor.AUTO_MICRO_NOTIONAL_PER_LEG, stage: 'fire' });
    } catch (err) {
      console.log(`[conditional-triggers] ${record.symbol}: portfolio risk envelope check FAILED (${err.message}) -- not executing, fail safe, leaving fired for retry.`);
      results.push({ symbol: record.symbol, verdict, blockedByRiskEnvelope: true, reasons: [`envelope check errored: ${err.message}`] });
      continue;
    }
    if (!gate.ok) {
      console.log(`[conditional-triggers] ${record.symbol}: rescan confirmed still valid, but BLOCKED by portfolio risk envelope -- ${gate.reasons.join('; ')} -- leaving fired, will retry next wake.`);
      results.push({ symbol: record.symbol, verdict, blockedByRiskEnvelope: true, reasons: gate.reasons });
      continue;
    }

    // STILL VALID -- execute for real, same micro sizing as every other
    // --auto execution (execute-portfolio-setup.js's computeMicroSizing()).
    const setup = record.candidate.conditionalSetup;
    const isCrypto = cryptoSymbols.isCryptoSymbol(setup.symbol);
    const sizing = await executor.computeMicroSizing(setup.symbol, setup.direction, isCrypto);
    try {
      const outcome = await executor.executeOne(record.candidate, record.sourceTask, sizing);
      // Real incident, 2026-09-10/11: executeOne() used to have no way to
      // say "I didn't actually do anything" (e.g. equity market closed) --
      // this got logged as trigger-confirmed anyway, which both lied about
      // what happened and meant nothing would ever retry it. `.skipped`
      // fixes both: leave this trigger in "trigger-fired" state (the
      // STILL VALID verdict stays on record, no need to re-dispatch a
      // rescan) so the NEXT wake retries executeOne() directly.
      if (outcome && outcome.skipped) {
        // Two genuinely different kinds of skip, and conflating them is a
        // real bug: a TRANSIENT skip (market closed, positions lookup
        // failed) must stay in "trigger-fired" so the next wake retries,
        // but a PERMANENT one (we already hold this symbol, the candidate
        // failed the data-integrity gate) would retry forever, re-running
        // the same refused order every wake and re-alerting each time.
        // Permanent skips get a terminal event instead.
        if (outcome.permanent) {
          appendEvent({
            type: 'trigger-blocked',
            sourceTask: record.sourceTask,
            pilot: record.pilot,
            symbol: record.symbol,
            rescanTaskId: record.rescanTaskId,
            reason: `execution refused permanently: ${outcome.reason}`,
            detail: outcome.detail || null,
            findings: outcome.findings || null,
          });
          console.log(`[conditional-triggers] BLOCKED ${record.symbol}: rescan confirmed still valid but execution was permanently refused (${outcome.reason}${outcome.detail ? ` -- ${outcome.detail}` : ''}). Not retrying.`);
          results.push({ symbol: record.symbol, verdict, skipped: true, permanent: true, reason: outcome.reason });
          continue;
        }
        console.log(`[conditional-triggers] ${record.symbol}: rescan confirmed still valid, but execution was skipped (${outcome.reason}) -- leaving fired, will retry next wake.`);
        results.push({ symbol: record.symbol, verdict, skipped: true, reason: outcome.reason });
        continue;
      }
      appendEvent({
        type: 'trigger-confirmed',
        sourceTask: record.sourceTask,
        pilot: record.pilot,
        symbol: record.symbol,
        rescanTaskId: record.rescanTaskId,
        sizing,
        // The lot this trigger actually became -- ties a pending-triggers.jsonl
        // row to its exact position in paper-trades.jsonl, not just to a symbol.
        lotId: (outcome && outcome.lotId) || null,
        modeledEntry: (outcome && outcome.modeledEntry != null) ? outcome.modeledEntry : null,
        stopPlaced: outcome ? outcome.stopPlaced : null,
      });
      console.log(`[conditional-triggers] CONFIRMED + EXECUTED ${record.symbol}: rescan said still valid.`);
      await ntfy.sendNtfy({
        title: `${record.symbol}: conditional trigger confirmed and executed`,
        message: `${record.symbol} hit its trigger ($${record.triggerPrice}), rescan confirmed the thesis still holds, and the entry was placed (paper).${outcome && !outcome.stopPlaced ? ' WARNING: no protective stop was placed -- see execute-portfolio-setup.js log.' : ''}`,
        priority: 4,
      }).catch(() => {});
    } catch (err) {
      console.log(`[conditional-triggers] ${record.symbol}: execution FAILED after confirmed rescan -- ${err.message}`);
      appendEvent({
        type: 'trigger-execution-failed',
        sourceTask: record.sourceTask,
        pilot: record.pilot,
        symbol: record.symbol,
        rescanTaskId: record.rescanTaskId,
        error: err.message,
      });
    }
    results.push({ symbol: record.symbol, verdict });
  }
  return results;
}

async function main() {
  await armNewTriggers('fleet');
  await armNewTriggers('crypto');
  const fired = await checkTriggers();
  const resolved = await checkRescanResults();
  await Promise.allSettled(pendingAlerts);
  console.log(`[conditional-triggers] Wake complete: ${fired.length} newly fired, ${resolved.length} rescan(s) resolved.`);
}

if (require.main === module) {
  main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
}

module.exports = { appendEvent, readEvents, latestStateByKey, extractConditionalCandidates, findLatestRound3, armNewTriggers, checkTriggers, checkRescanResults, isTriggered, parseVerdict, main, LOG_PATH };
