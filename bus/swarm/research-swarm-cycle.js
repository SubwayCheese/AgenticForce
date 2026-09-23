#!/usr/bin/env node
// research-swarm-cycle.js -- Round 17. Oneshot orchestrator: author this
// cycle's specialist tasks -> dispatch through the bounded worker pool
// -> parse results -> synthesize/rank -> record & notify -> exit. Fired
// daily by research-swarm-cycle.timer (systemd --user), same Type=oneshot
// shape as survive-supervisor.service, not a long-lived daemon.

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');
const rsTasks = require('./research-swarm-tasks.js');
const { dispatchCodexAsync, runPool } = require('../platform/research-swarm-worker.js');
const { CATEGORIES, buildPrompt } = require('./research-swarm-categories.js');
const { runSynthesis, extractFirstJsonBlock } = require('./survive-research-synthesis.js');
const ntfy = require('../platform/ntfy.js');
const dispatchBudget = require('../platform/dispatch-budget.js');

const VAULT_ROOT = avPaths.ROOT;
const MECHANISMS_DIR = avPaths.MECHANISMS;
const CADENCE_DAYS = 1;
const RESEARCH_SWARM_CONCURRENCY = Number(process.env.RESEARCH_SWARM_CONCURRENCY) || 2;
const SURVIVE_NTFY_TOPIC = 'AgentVaultSurvive';

function log(msg) { console.log(`[research-swarm] ${msg}`); }

async function runCycle({ allowFn = dispatchBudget.allow } = {}) {
  const due = rsTasks.isCycleDue(CADENCE_DAYS);
  if (!due.due) {
    log(`Not due -- ${due.reason} (cycle ${due.cycle}, ${due.unresolved.length} unresolved: ${due.unresolved.map((u) => u.category).join(', ')})`);
    return;
  }
  if (due.staleCycle) {
    const names = due.staleUnresolved.map((u) => u.category).join(', ');
    log(`Prior cycle ${due.staleCycle} abandoned (stale, >${rsTasks.CYCLE_STALE_HOURS}h) -- never resolved: ${names}. Alerting and proceeding.`);
    try {
      await ntfy.sendNtfy({ topic: SURVIVE_NTFY_TOPIC, title: 'Research swarm: prior cycle abandoned', message: `Cycle ${due.staleCycle} never resolved: ${names}. Starting a new cycle anyway.`, priority: 3 });
    } catch (_) { /* best-effort */ }
  }

  // Round 19: advisory budget gate. Denied -> no cycle is authored at all
  // (nothing to wedge; the next daily timer fire simply asks again).
  const gate = await allowFn('swarm');
  if (!gate.allow) { log(`Budget governor denied this cycle: ${gate.reason}`); return; }

  const cycle = rsTasks.nextCycleNumber();
  rsTasks.appendEvent({ type: 'cycle-started', cycle });
  log(`Cycle ${cycle} started -- ${CATEGORIES.length} specialists, concurrency ${RESEARCH_SWARM_CONCURRENCY}.`);

  const authored = CATEGORIES.map((cat) => {
    const taskId = `survive_research_c${cycle}_${cat.slug}`;
    rsTasks.writeTaskFile(taskId, { payload: buildPrompt(cat) });
    rsTasks.appendEvent({ type: 'specialist-authored', cycle, category: cat.slug, taskId });
    return { taskId, category: cat.slug, cat };
  });

  const results = await runPool(authored, RESEARCH_SWARM_CONCURRENCY, async (item) => {
    const prompt = buildPrompt(item.cat);
    // Re-checked per specialist WITHOUT a probe (the cycle-level check just
    // verified health); a denial resolves the task as skipped so the cycle
    // can still complete cleanly instead of wedging on unresolved tasks.
    const g = await allowFn('swarm', { probe: false });
    if (!g.allow) {
      rsTasks.writeTaskResult(item.taskId, { status: 'error', output: `skipped by budget governor: ${g.reason}` });
      rsTasks.appendEvent({ type: 'specialist-resolved', cycle, category: item.category, taskId: item.taskId, exitCode: 1, skipped: true });
      return { ...item, result: { exitCode: 1, output: '', stderr: `skipped by budget governor: ${g.reason}` } };
    }
    rsTasks.appendEvent({ type: 'specialist-dispatch-started', cycle, category: item.category, taskId: item.taskId });
    const result = await dispatchCodexAsync(prompt);
    rsTasks.writeTaskResult(item.taskId, { status: result.exitCode === 0 ? 'done' : 'error', output: result.output || result.stderr || '' });
    rsTasks.appendEvent({ type: 'specialist-resolved', cycle, category: item.category, taskId: item.taskId, exitCode: result.exitCode });
    return { ...item, result };
  });

  const resolvedFindings = [];
  for (const r of results) {
    if (r.result.exitCode !== 0 || !r.result.output) { log(`${r.category}: failed (${r.result.stderr || 'no output'})`); continue; }
    const parsed = extractFirstJsonBlock(r.result.output);
    if (!parsed) { log(`${r.category}: no parseable proposal -- leaving unrecorded, not guessing.`); continue; }
    resolvedFindings.push({ category: r.category, parsed });
    if (parsed.mechanismId && parsed.clearsHardBoundary && parsed.recommendImplementing && parsed.draftModuleContent) {
      const proposedPath = path.join(MECHANISMS_DIR, `${parsed.mechanismId}.proposed.js`);
      if (!fs.existsSync(proposedPath)) {
        fs.mkdirSync(MECHANISMS_DIR, { recursive: true });
        fs.writeFileSync(proposedPath, parsed.draftModuleContent, 'utf8');
        log(`${r.category}: new proposal drafted -> mechanisms/${parsed.mechanismId}.proposed.js`);
      }
    }
    if (parsed.existingOssToolFound) log(`${r.category}: existing OSS tool found -- ${parsed.existingOssToolFound.name} (${parsed.existingOssToolFound.url})`);
  }

  let synthesis = null;
  try { synthesis = await runSynthesis(cycle, resolvedFindings); } catch (err) { log(`Synthesis failed: ${err.message}`); }

  rsTasks.appendEvent({ type: 'cycle-completed', cycle, resolvedCount: resolvedFindings.length, totalCount: CATEGORIES.length });
  log(`Cycle ${cycle} completed -- ${resolvedFindings.length}/${CATEGORIES.length} specialists resolved.`);

  try {
    const reviewNow = synthesis && synthesis.ok ? (synthesis.parsed.rankedFindings || []).filter((f) => f.tier === 'review-now') : [];
    await ntfy.sendNtfy({
      topic: SURVIVE_NTFY_TOPIC,
      title: `Research swarm cycle ${cycle}: ${resolvedFindings.length}/${CATEGORIES.length} resolved`,
      message: synthesis && synthesis.ok
        ? `${synthesis.parsed.topPickSummary || ''} -- ${reviewNow.length} marked review-now.`
        : 'Cycle finished; synthesis unavailable this run.',
      priority: reviewNow.length ? 4 : 3,
    });
  } catch (_) { /* best-effort */ }
}

if (require.main === module) {
  runCycle().catch((err) => { console.error('[research-swarm] FAILED:', err.message); process.exit(1); });
}

module.exports = { runCycle, CADENCE_DAYS, RESEARCH_SWARM_CONCURRENCY };
