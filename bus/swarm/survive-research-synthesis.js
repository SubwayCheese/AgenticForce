// survive-research-synthesis.js -- Round 17. Mirrors survive-leader-
// council.js's real "several independent inputs -> one synthesis
// dispatch" pattern. Ranks a cycle's specialist findings; does NOT gate
// .proposed.js writes (each specialist already wrote its own on
// resolving -- gating the only copy of a good draft behind a second,
// independently-fallible LLM call risks losing real work for no
// compensating safety benefit, especially now that mechanism-registry.js
// never auto-loads a .proposed.js file regardless).

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const { dispatchCodexAsync } = require('../platform/research-swarm-worker.js');
const memoryStore = require('../platform/memory-store.js');

const VAULT_ROOT = avPaths.ROOT;
const MECHANISMS_DIR = avPaths.MECHANISMS;

function extractFirstJsonBlock(text) {
  if (!text) return null;
  const fenceRe = /```json\s*([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    try { return JSON.parse(match[1]); } catch (_) { /* try next fence */ }
  }
  return null;
}

function buildSynthesisPrompt(findings) {
  // draftModuleContent deliberately stripped -- ranking doesn't need the
  // full draft code, and it keeps the prompt sane-sized at 15 findings.
  const slim = findings.map((f) => ({ ...f.parsed, draftModuleContent: undefined, sourceCategory: f.category }));
  return [
    'You are the synthesis reviewer for a city-bank research swarm -- several independent specialist researchers each investigated a genuinely distinct revenue-mechanism category for a real, small ($50-ish scale), long-only, US-jurisdiction autonomous system. Weigh their real findings against each other honestly; a finding recommended by its own author gets no automatic deference.',
    '',
    'Real findings this cycle:',
    JSON.stringify(slim, null, 2),
    '',
    'Rank them: which are genuinely worth a human reviewing now, which are worth reconsidering later (e.g. blocked only on a resolvable ToS ambiguity), and which should be discarded (fails the hard boundary, no real payoff, or duplicates an existing mechanism). Respond with ONLY a fenced ```json block matching exactly this shape:',
    '{"rankedFindings": [{"mechanismId": "..."|null, "sourceCategory": "...", "rank": 1, "tier": "review-now"|"review-later"|"discard", "whyRanked": "..."}], "topPickSummary": "..."}',
  ].join('\n');
}

async function runSynthesis(cycle, resolvedFindings) {
  if (!resolvedFindings.length) return null;
  const prompt = buildSynthesisPrompt(resolvedFindings);
  const result = await dispatchCodexAsync(prompt);
  if (result.exitCode !== 0 || !result.output) {
    return { ok: false, reason: `synthesis dispatch failed: ${result.stderr || 'no output'}` };
  }
  const parsed = extractFirstJsonBlock(result.output);
  if (!parsed) return { ok: false, reason: 'synthesis produced no parseable JSON' };

  for (const rf of parsed.rankedFindings || []) {
    if (!rf.mechanismId) continue;
    const metaPath = path.join(MECHANISMS_DIR, `${rf.mechanismId}.proposed.meta.json`);
    if (fs.existsSync(path.join(MECHANISMS_DIR, `${rf.mechanismId}.proposed.js`))) {
      fs.writeFileSync(metaPath, JSON.stringify({ rank: rf.rank, tier: rf.tier, whyRanked: rf.whyRanked, cycle }, null, 2), 'utf8');
    }
  }
  memoryStore.recordFact(`survive_research_swarm_synthesis_cycle_${cycle}`, parsed, {});
  return { ok: true, parsed };
}

module.exports = { runSynthesis, buildSynthesisPrompt, extractFirstJsonBlock };
