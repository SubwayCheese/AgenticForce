// edge-status.js -- closes the loop the user flagged (2026-09-14): the
// recurring backtest layer (sections 12-14) was writing real findings to
// vault notes and the fact store, but nothing fed them back into the live
// trading decisions, and nothing gave a single, honest answer to "do we
// have real edge yet" without piecing together several vault notes by
// hand. This module is that single source, used two ways:
//   1. generate-pilot-tasks.js injects a per-thesis section built from
//      getCurrentEdgeStatus() into every round-1 thesis -- informational
//      context, not a hard gate (matches this vault's existing pattern:
//      prior learnings/symbol history are injected the same way, never
//      forced conclusions).
//   2. dashboard-status.js surfaces getOverallEdgeSummary() on the simple
//      dashboard as one always-current readout.
//
// Deliberately read-only and best-effort: this never writes anything,
// and the free-text extraction below is explicitly heuristic (backtest
// verdicts are written in prose by different specialist runs, not a
// fixed machine-readable format) -- it degrades to omitting a section
// rather than guessing when it can't confidently extract one.

const fs = require('fs');
const memoryStore = require('../platform/memory-store.js');

// Best-effort: pulls the sentence containing "verdict" (case-insensitive)
// out of a free-text backtest result, since every prompt in this pipeline
// asks for an explicit verdict but phrasing varies by run/specialist.
// Falls back to a truncated lead-in rather than the full multi-paragraph
// text, which would bloat every thesis prompt this gets injected into.
function extractVerdictSnippet(text, maxLen = 280) {
  if (!text) return null;
  const sentences = text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
  const verdictSentence = sentences.find((s) => /verdict/i.test(s));
  const snippet = (verdictSentence || text).replace(/\*\*/g, '').trim();
  return snippet.length > maxLen ? `${snippet.slice(0, maxLen)}...` : snippet;
}

// Per-(pilot, symbol) evidence bundle for injection into a single thesis.
function getCurrentEdgeStatus(pilot, symbol) {
  const dailyVerdict = memoryStore.getFact('backtest_daily_screen_score_verdict');
  const weightFact = memoryStore.getFact(`screen_score_weights_${pilot}`);
  const symbolFact = symbol ? memoryStore.getFact(`continuous_backtest_${symbol.toUpperCase()}`) : null;
  return { dailyVerdict, weightFact, symbolFact };
}

// Scans every continuous_backtest_<SYMBOL> fact's LATEST recording
// (memory.jsonl is append-only chronological, so the last line seen per
// key is the latest) for a rough "did this symbol ever show a real
// trigger" read. Explicitly heuristic text matching, not a parsed
// structured field -- degrades to "unclear" per symbol rather than
// guessing which side of an ambiguous phrasing it falls on.
function getAggregateContinuousStats() {
  if (!fs.existsSync(memoryStore.MEMORY_PATH)) return { totalChecked: 0, symbolsWithSignal: [], symbolsInconclusive: 0 };
  const lines = fs.readFileSync(memoryStore.MEMORY_PATH, 'utf8').split('\n').filter((l) => l.trim());
  const latestBySymbol = new Map();
  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch (_) { continue; }
    if (!entry.key || !entry.key.startsWith('continuous_backtest_')) continue;
    latestBySymbol.set(entry.key, entry); // later lines overwrite earlier ones for the same key -> latest wins
  }
  const symbolsWithSignal = [];
  let symbolsInconclusive = 0;
  // Added 2026-09-15 alongside the TRIGGER_COUNT prompt addition
  // (generate-backtest-tasks.js): prefer the exact machine-checkable line
  // when present -- reliable, no guessing. Falls back to the original
  // prose-regex heuristic only for facts recorded before TRIGGER_COUNT
  // existed, so historical data already in bus/memory.jsonl doesn't
  // silently stop being counted.
  // Anchored to end-of-line: generate-backtest-tasks.js's backtestPayload()
  // requires TRIGGER_COUNT on the FINAL line of the response.
  const triggerCountPattern = /TRIGGER_COUNT:\s*(\d+)\s*$/im;
  const zeroPattern = /\bzero genuine\b|\b0\s*genuine\b|genuine trigger[^.]*:\s*\*{0,2}0\*{0,2}|no genuine (entry )?trigger/i;
  const positivePattern = /\b([1-9]\d*)\s*genuine (entry )?trigger/i;
  for (const [key, entry] of latestBySymbol) {
    const text = String(entry.value || '');
    // Take the LAST match, not the first: a specialist that restates or
    // second-guesses a count earlier in its reasoning before landing on
    // its real final answer would otherwise have that earlier mention
    // picked up instead of the authoritative final-line one.
    const explicitMatches = [...text.matchAll(new RegExp(triggerCountPattern, 'gim'))];
    const explicitMatch = explicitMatches.length ? explicitMatches[explicitMatches.length - 1] : null;
    // Fallback (facts recorded before TRIGGER_COUNT existed) restricted to
    // the response's tail -- reusing extractVerdictSnippet()'s own
    // sentence-split logic -- so self-correcting prose ("initially thought
    // zero genuine triggers, but on closer review found one") can't flip
    // the result via an earlier draft/rejected count.
    const sentences = text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
    const verdictIdx = sentences.findIndex((s) => /verdict/i.test(s));
    const tail = (verdictIdx === -1 ? sentences.slice(-2) : sentences.slice(verdictIdx)).join(' ');
    const hasSignal = explicitMatch
      ? Number(explicitMatch[1]) > 0
      : positivePattern.test(tail) && !zeroPattern.test(tail);
    if (hasSignal) {
      symbolsWithSignal.push(key.replace('continuous_backtest_', ''));
    } else {
      symbolsInconclusive += 1;
    }
  }
  return { totalChecked: latestBySymbol.size, symbolsWithSignal, symbolsInconclusive };
}

// The single aggregate readout -- what the dashboard shows, and the raw
// material a future stronger aggregation could build on. Never asserts
// "edge confirmed" itself; states what each layer has found and lets the
// numbers speak.
function getOverallEdgeSummary() {
  const daily = memoryStore.getFact('backtest_daily_screen_score_verdict');
  const fleetWeights = memoryStore.getFact('screen_score_weights_fleet');
  const cryptoWeights = memoryStore.getFact('screen_score_weights_crypto');
  const continuous = getAggregateContinuousStats();

  const plainLine = daily
    ? `Screen-score ranking: ${extractVerdictSnippet(daily.value, 140)} (as of ${daily.ts.slice(0, 10)}). Entry/exit rule: checked ${continuous.totalChecked} symbol(s) so far, ${continuous.symbolsWithSignal.length} showed a real trigger (${continuous.symbolsWithSignal.slice(0, 5).join(', ') || 'none yet'}), ${continuous.symbolsInconclusive} inconclusive/no-trigger.`
    : 'No systematic backtest evidence recorded yet.';

  return { daily, fleetWeights, cryptoWeights, continuous, plainLine };
}

module.exports = { getCurrentEdgeStatus, getAggregateContinuousStats, getOverallEdgeSummary, extractVerdictSnippet };
