#!/usr/bin/env node
// dashboard-status.js -- the live snapshot for the dashboard (Phase 3
// piece 5, added 2026-09-03). One exported buildSnapshot(), called
// fresh on every /status.json request by serve-dashboard.js.
//
// Deliberately thin: every real computation already lives in
// bus-status.js (split into get*()/report*() pairs the same day this
// file was added, specifically so the CLI report and this live view
// share one definition of every number, not two that can drift) --
// this file only adds the one thing bus-status.js has no reason to
// know about, in-flight task detection, and assembles the JSON shape
// the dashboard's front end actually consumes.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const busStatus = require('./bus-status.js');
const runTask = require('./run-task.js');
const engine = require('./agent-engine.js');
const cycleDateUtils = require('./cycle-date-utils.js');
const fleetStatus = require('./fleet-status.js');
const journal = require('./trading-journal.js');
const alpaca = require('./alpaca-client.js');
const edgeStatus = require('./edge-status.js');
const memoryStore = require('./memory-store.js');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
const DAEMON_LOG_PATH = path.join(VAULT_ROOT, 'bus', 'queue-daemon.log');

// Parses the queue daemon's own log for tasks that have a "DISPATCHING:"
// line with no later "<taskId>: ..." completion line after it -- both
// already written by run-queue-daemon.js's dispatchOne()/log() (see
// its comments), not a new signal invented for this. A retried task
// (BLOCKED then AUTO-RETRY then DISPATCHING again) naturally re-enters
// the in-flight set on its second DISPATCHING line even though its
// first attempt already completed, since this walks top to bottom and
// tracks membership rather than "ever seen."
// logText param is test-only (see run-verification-suite.js's
// testInFlightDetectionFast()) -- omitted in every real call site, which
// reads the actual daemon log.
function getInFlightTasks(logText) {
  let text = logText;
  if (text === undefined) {
    if (!fs.existsSync(DAEMON_LOG_PATH)) return [];
    text = fs.readFileSync(DAEMON_LOG_PATH, 'utf8');
  }
  const lines = text.split('\n');
  const inFlight = new Set();
  for (const line of lines) {
    const dispatchMatch = line.match(/^\[[^\]]+\] DISPATCHING: (\S+)$/);
    if (dispatchMatch) {
      inFlight.add(dispatchMatch[1]);
      continue;
    }
    const doneMatch = line.match(/^\[[^\]]+\] (\S+): /);
    if (doneMatch && inFlight.has(doneMatch[1])) {
      inFlight.delete(doneMatch[1]);
    }
  }
  return Array.from(inFlight);
}

// The optional run-backlog.js live-progress file (pre-existing,
// 2026-08-31) -- passed through as its own panel rather than merged
// into the system-wide counts above, since it tracks a seeded
// bus/backlog.json campaign, a different (and optional -- not always
// running) thing from the standing /bus/ system. "Fresh" = updated in
// the last 5 minutes; older than that is presumed to be a finished or
// abandoned run, not a live one, and the dashboard hides the panel
// rather than showing stale progress.
const BACKLOG_STATUS_PATH = path.join(VAULT_ROOT, 'bus', 'status.json');
const BACKLOG_FRESH_MS = 5 * 60 * 1000;

function getBacklogRunStatus() {
  if (!fs.existsSync(BACKLOG_STATUS_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(BACKLOG_STATUS_PATH, 'utf8'));
    if (!data.updatedAt) return null;
    const ageMs = Date.now() - new Date(data.updatedAt).getTime();
    if (!(ageMs >= 0) || ageMs > BACKLOG_FRESH_MS) return null;
    return data;
  } catch (e) {
    return null; // malformed/mid-write -- next poll will pick up a clean read
  }
}

function buildSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    statusCounts: busStatus.getStatusCounts(),
    recentActivity: busStatus.getRecentActivity(20),
    inFlight: getInFlightTasks(),
    memory: busStatus.getMemorySummary(),
    agents: busStatus.getAgentConfigStatus(),
    backlogRun: getBacklogRunStatus(),
  };
}

// ---------- Agent hierarchy graph (added 2026-09-03, a direct
// follow-on to the dashboard) ----------
// Reads a task's real `to:` field straight from its file -- not by
// string-parsing bus/log.md's free-text "via" field, which is a
// dispatch-script description (e.g. "run-task-generic.js -- agent:
// Claude, mode: read-only"), not a clean, uniformly-populated agent id.
// This is the only reliable way to know which agent actually owns a
// given task.
const RECENT_TASKS_PER_AGENT = 6;
// Wide enough that each agent's own recent tasks are still findable
// even when heavily interleaved with the other agent's activity (a
// verification suite run alone produces dozens of interleaved entries).
const ACTIVITY_WINDOW_FOR_GRAPH = 60;

// Builds: orchestrator (root, "claude") -> each configured agent -> its
// current in-flight task (if any) plus its last few recent tasks, with
// dependency edges (dependsOnTaskId(s)) drawn only between two tasks
// that are BOTH included in this graph -- no dangling references to
// tasks not shown, so the graph stays bounded regardless of the vault's
// total task history. Nothing here hardcodes a specific number of
// agents -- reads bus/scripts/agents/*.json the same way
// bus-status.js's getAgentConfigStatus() does, so a third configured
// agent would appear automatically.
// Domain activity for bus/city.html (added 2026-09-09) -- buildAgentGraph()'s
// existing recentTasks is capped at RECENT_TASKS_PER_AGENT (6) per agent
// out of a 60-entry activity window, not enough for a real "how active has
// this domain been" figure across potentially dozens of task files. This
// does a full, separate scan of tasks/ instead, bucketed by filename
// prefix -- so a new pilot/domain shows up automatically the day its first
// task file lands, no hardcoded domain list to maintain.
const DOMAIN_PATTERNS = [
  { id: 'fleet', label: 'Equity Fleet', prefix: /^fleet_pilot_/, cyclePrefix: 'fleet_pilot_' },
  { id: 'crypto', label: 'Crypto Fleet', prefix: /^crypto_pilot_/, cyclePrefix: 'crypto_pilot_' },
];
// Short-TTL memoization for getDomainActivity()/getLearningActivity() --
// both do a full, uncached tasks/ directory scan + per-file read/parse,
// and both are called (via buildAgentGraph()/getSkillScore()) on every
// /agent-graph.json poll, which city.html/agents.html hit every 2s. With
// 600+ real task files, that's real repeated work for data that can't
// meaningfully change faster than this TTL.
const ACTIVITY_CACHE_TTL_MS = 1500;
let domainActivityCache = null;
let domainActivityCacheAt = 0;
let learningActivityCache = null;
let learningActivityCacheAt = 0;

function getDomainActivity() {
  if (domainActivityCache && (Date.now() - domainActivityCacheAt) < ACTIVITY_CACHE_TTL_MS) return domainActivityCache;
  const files = fs.existsSync(runTask.TASKS_DIR) ? fs.readdirSync(runTask.TASKS_DIR).filter((f) => f.endsWith('.md')) : [];
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const domains = DOMAIN_PATTERNS.map((d) => ({ id: d.id, label: d.label, total: 0, last7Days: 0 }));
  const otherDomain = { id: 'vault-ops', label: 'Vault Ops', total: 0, last7Days: 0 };

  for (const f of files) {
    const match = DOMAIN_PATTERNS.find((d) => d.prefix.test(f));
    const bucket = match ? domains.find((d) => d.id === match.id) : otherDomain;
    bucket.total += 1;
    // Prefer the filename's own embedded YYYYMMDD (stable, doesn't drift
    // on a git checkout/clone the way mtime does); fall back to mtime for
    // undated files (probes, one-off tests). For a domain-matched file,
    // ask cycle-date-utils.js first -- the same real cycle-date-vs-rescan-
    // fire-date bug fixed in fleet-status.js/crypto-status.js/
    // generate-pilot-tasks.js applies here too (a rescan's fire date is
    // not a new cycle's date). Its answer is null for a rescan (or any
    // non-domain file), so the original unanchored extraction -- which
    // still returns a real, if less precise, embedded date for those --
    // is kept as the fallback rather than dropped, to avoid changing what
    // this panel has always shown for rescans/undated/other-domain files.
    const cycleDate = match ? cycleDateUtils.resolveCycleDate(f, match.cyclePrefix) : null;
    const dateMatch = cycleDate ? null : /_(\d{8})_/.exec(f);
    let ts;
    if (cycleDate) {
      ts = new Date(`${cycleDate.slice(0, 4)}-${cycleDate.slice(4, 6)}-${cycleDate.slice(6, 8)}T00:00:00Z`).getTime();
    } else if (dateMatch) {
      const s = dateMatch[1];
      ts = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`).getTime();
    } else {
      try { ts = fs.statSync(path.join(runTask.TASKS_DIR, f)).mtimeMs; } catch (_) { ts = 0; }
    }
    if (ts && now - ts <= sevenDaysMs) bucket.last7Days += 1;
  }

  domainActivityCache = [...domains, otherDomain];
  domainActivityCacheAt = Date.now();
  return domainActivityCache;
}

// Real "how much has this domain learned" count for city.html's 3D
// rebuild (added 2026-09-11) -- two genuine sources summed per domain,
// NOT a naive grep (the string "keyLearnings" also appears in every
// synthesis prompt's own boilerplate instructions, which would overcount):
//   1. bus/trading-journal.jsonl entries with a real attached lesson,
//      bucketed by the entry's own assetClass field.
//   2. Each tasks/*_synthesis_r3_*.md's keyLearnings[] length, extracted
//      via fleet-status.js's parseRound3Output() (empty-safe, handles
//      both the JSON-fence and prose output formats already), bucketed
//      by filename prefix. Every version of a re-run cycle (_v2, _v3,
//      ...) counts separately -- each is a real completed synthesis with
//      its own real keyLearnings, not a superseded draft to skip.
function getLearningActivity() {
  if (learningActivityCache && (Date.now() - learningActivityCacheAt) < ACTIVITY_CACHE_TTL_MS) return learningActivityCache;
  const counts = { fleet: 0, crypto: 0 };

  for (const entry of journal.getJournalEntriesWithLessons()) {
    if (!entry.lesson) continue;
    const bucket = entry.assetClass === 'crypto' ? 'crypto' : 'fleet';
    counts[bucket] += 1;
  }

  const files = fs.existsSync(runTask.TASKS_DIR) ? fs.readdirSync(runTask.TASKS_DIR).filter((f) => f.endsWith('.md')) : [];
  const synthesisRe = /^(fleet_pilot_|crypto_pilot_)\d{8}_synthesis_r3_/;
  for (const f of files) {
    const match = synthesisRe.exec(f);
    if (!match) continue;
    const bucket = match[1] === 'crypto_pilot_' ? 'crypto' : 'fleet';
    const task = runTask.readTaskFile(f.replace(/\.md$/, ''));
    if (!task || task.status !== 'done' || !task.output) continue;
    const parsed = fleetStatus.parseRound3Output(task.output);
    if (parsed && Array.isArray(parsed.keyLearnings)) counts[bucket] += parsed.keyLearnings.length;
  }

  learningActivityCache = counts; // { fleet, crypto } -- vault-ops has no learning concept, stays 0 by omission
  learningActivityCacheAt = Date.now();
  return learningActivityCache;
}

// ---------- "Skill" bar (added 2026-09-14, explicitly arbitrary) ----------
//
// Direct user request for a growing progress bar representing "skill" --
// the user called it "arbitrary" themselves, which matters: this is a
// composite ACTIVITY score (real counts, weighted by an arbitrary point
// scale below), not a claim of validated trading skill or proven edge.
// It must never be allowed to read as contradicting the honest "Do we
// have a real trading edge yet?" card on the same page -- that stays the
// only place this vault claims anything about actual performance. This
// only ever measures how much real work has accumulated: backtest
// checks, trade-outcome lessons, and completed search/reflection cycles.
// Monotonically non-decreasing by construction (every input is a
// cumulative count, nothing here can go down), which is fine and correct
// for an activity meter, unlike a performance metric.
const SKILL_POINTS = {
  continuousBacktestCheck: 1,
  dailyBacktestRun: 2,
  tradeOrCycleLesson: 5,
  weeklyParameterSearchRun: 10,
};
const SKILL_POINTS_PER_LEVEL = 100;

function getSkillScore() {
  const continuousChecks = edgeStatus.getAggregateContinuousStats().totalChecked;
  const dailyRuns = memoryStore.getFactHistory('backtest_daily_screen_score_verdict').length;
  const weeklySearchRuns = memoryStore.getFactHistory('screen_score_weights_fleet').length + memoryStore.getFactHistory('screen_score_weights_crypto').length;
  const learning = getLearningActivity();
  const lessons = learning.fleet + learning.crypto;

  const totalPoints = continuousChecks * SKILL_POINTS.continuousBacktestCheck
    + dailyRuns * SKILL_POINTS.dailyBacktestRun
    + weeklySearchRuns * SKILL_POINTS.weeklyParameterSearchRun
    + lessons * SKILL_POINTS.tradeOrCycleLesson;

  const level = Math.floor(totalPoints / SKILL_POINTS_PER_LEVEL) + 1;
  const pointsIntoLevel = totalPoints % SKILL_POINTS_PER_LEVEL;

  return {
    totalPoints,
    level,
    pointsIntoLevel,
    pointsPerLevel: SKILL_POINTS_PER_LEVEL,
    percentToNextLevel: Math.round((pointsIntoLevel / SKILL_POINTS_PER_LEVEL) * 100),
    breakdown: { continuousChecks, dailyRuns, weeklySearchRuns, lessons },
  };
}

function buildAgentGraph() {
  const agentIds = engine.listAgentConfigs();
  const inFlightIds = getInFlightTasks();
  const activity = busStatus.getRecentActivity(ACTIVITY_WINDOW_FOR_GRAPH).slice().reverse(); // most recent first

  const taskCache = new Map(); // taskId -> readTaskFile() result or null, avoids re-reading the same file twice
  function getTask(taskId) {
    if (!taskCache.has(taskId)) taskCache.set(taskId, runTask.readTaskFile(taskId));
    return taskCache.get(taskId);
  }
  function buildNode(taskId, reason) {
    const task = getTask(taskId);
    if (!task) return null; // file removed since the log entry/in-flight signal was recorded
    const relPath = path.relative(VAULT_ROOT, runTask.taskFilePath(taskId)).split(path.sep).join('/');
    const dependsOn = [];
    if (task.dependsOnTaskId) dependsOn.push(task.dependsOnTaskId);
    if (task.dependsOnTaskIds) {
      task.dependsOnTaskIds.split(',').map((s) => s.trim()).filter(Boolean).forEach((id) => dependsOn.push(id));
    }
    return { taskId, to: task.to, status: task.status, reason: reason || null, path: relPath, dependsOn };
  }

  const includedTaskIds = new Set();
  const agents = agentIds.map((id) => {
    const config = engine.loadAgentConfig(id);

    let currentTask = null;
    for (const taskId of inFlightIds) {
      const task = getTask(taskId);
      if (task && task.to === id) {
        currentTask = buildNode(taskId, null);
        break;
      }
    }
    if (currentTask) includedTaskIds.add(currentTask.taskId);

    const recentTasks = [];
    for (const entry of activity) {
      if (recentTasks.length >= RECENT_TASKS_PER_AGENT) break;
      if (currentTask && entry.taskId === currentTask.taskId) continue; // already shown as the current task
      const task = getTask(entry.taskId);
      if (!task || task.to !== id) continue;
      const node = buildNode(entry.taskId, entry.reason);
      if (!node) continue;
      recentTasks.push(node);
      includedTaskIds.add(node.taskId);
    }

    return {
      id,
      displayName: (config && config.displayName) || id,
      ok: !!config,
      currentTask,
      recentTasks,
    };
  });

  const dependsOnEdges = [];
  for (const agent of agents) {
    for (const node of [agent.currentTask, ...agent.recentTasks].filter(Boolean)) {
      for (const depId of node.dependsOn) {
        if (includedTaskIds.has(depId)) dependsOnEdges.push({ from: node.taskId, to: depId });
      }
    }
  }

  const learning = getLearningActivity();
  const domains = getDomainActivity().map((d) => ({ ...d, learningCount: learning[d.id] || 0 }));

  return {
    generatedAt: new Date().toISOString(),
    orchestrator: { id: 'claude', label: 'claude (orchestrator)' },
    agents,
    dependsOnEdges,
    domains,
  };
}

// ---------- Plain-language summary (added 2026-09-14) ----------
//
// Direct user request: the existing dashboard/agents.html/city.html are
// all real, but every one of them shows raw task ids, JSON-shaped
// counts, and a dark-terminal aesthetic -- the user said it was
// "confusing" and asked for something simpler that answers one question
// plainly: are the 24/7 agents actually still working right now? This is
// a NEW, separate summary (not a replacement for the detailed views,
// which stay available for anyone who wants the raw detail) built
// specifically to answer that in plain English.

const PILOT_SUPERVISOR_LOG_PATH = path.join(VAULT_ROOT, 'bus', 'pilot-supervisor.log');
const BACKTEST_SUPERVISOR_LOG_PATH = path.join(VAULT_ROOT, 'bus', 'backtest-supervisor.log');
const PILOT_CADENCE_MINUTES = 30; // matches the crontab entry
const PILOT_HEALTHY_GRACE_MINUTES = 5; // buffer above the cadence before calling it stalled
const BACKTEST_CADENCE_MINUTES = 1440; // daily, matches backtest-supervisor.js's 08:00 UTC crontab entry
const BACKTEST_HEALTHY_GRACE_MINUTES = 120; // 2h buffer -- the daily backtest can legitimately run a bit late

function lastLogTimestamp(logPath) {
  if (!fs.existsSync(logPath)) return null;
  // Read only the tail -- these logs can grow large over weeks, and only
  // the last real "[timestamp] ..." line is needed.
  const stat = fs.statSync(logPath);
  const readFrom = Math.max(0, stat.size - 8000);
  const fd = fs.openSync(logPath, 'r');
  const buf = Buffer.alloc(stat.size - readFrom);
  fs.readSync(fd, buf, 0, buf.length, readFrom);
  fs.closeSync(fd);
  const lines = buf.toString('utf8').split('\n').filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^\[([^\]]+)\]/);
    if (m) {
      const ts = new Date(m[1]);
      if (!Number.isNaN(ts.getTime())) return ts.toISOString();
    }
  }
  return null;
}

// Best-effort, read-only -- `systemctl is-active` needs no sudo. Returns
// 'unknown' rather than throwing if systemd/the unit isn't present (e.g.
// a dev machine that isn't the Pi), same "degrade, don't crash" posture
// as everything else in this file.
function getQueueDaemonSystemdStatus() {
  try {
    return execSync('systemctl is-active agentvault-queue-daemon.service', { encoding: 'utf8' }).trim();
  } catch (err) {
    // systemctl exits non-zero for "inactive"/"failed" too -- stdout on
    // the thrown error still carries the real state.
    const out = (err.stdout || '').toString().trim();
    return out || 'unknown';
  }
}

// Translates a real task id + status into one plain-English sentence, no
// jargon (no "task", "dispatch", "synthesis", raw ids). Falls back to a
// generic sentence for anything unrecognized rather than showing nothing.
// Short, non-technical clause per status -- deliberately never includes
// the raw `reason` text (dependency chains/error messages are real but
// far too long/technical for this simple view; the detailed view at
// /dashboard.html and bus/log.md still have the exact wording).
function statusClause(status) {
  if (status === 'blocked') return 'waiting on a related task to finish first';
  // Verified live 2026-09-15: unlike 'blocked' (which retryBlocked() really
  // does auto-retry once its dependency resolves), nothing in this
  // codebase ever auto-retries 'error' or 'unverified' -- 38 real tasks
  // are currently stuck permanently in these two statuses. This card was
  // telling users they'd self-resolve when they never do.
  if (status === 'error') return 'ran into a technical problem -- needs a human to look at it';
  if (status === 'unverified') return "didn't pass a quality check -- needs a human to look at it";
  return null;
}

function plainDescribeTask(entry) {
  const { taskId, status } = entry;
  const failed = status === 'blocked' || status === 'error' || status === 'unverified';

  let subject = null;
  let symbol = null;
  const stratMatch = taskId.match(/^strategy_backtest_\d+_(fleet|crypto)?_?(data|codex|claude|synthesis)_([a-z0-9]+)$/);
  const pilotMatch = taskId.match(/^(fleet_pilot|crypto_pilot)_\d+_(data_snapshot|thesis|challenge|synthesis|research_company|rescan)_?([a-z0-9]*)/);
  const continuousMatch = taskId.match(/^continuous_backtest_\d{12}_(fleet|crypto)_(data|codex)_([a-z0-9]+)$/);
  const auditMatch = /^bidaily_audit_/.test(taskId);

  if (/^trading_journal_reflection/.test(taskId)) {
    subject = 'Reviewed a closed trade and wrote down what it learned';
  } else if (auditMatch) {
    subject = "Reviewed the last several hours of Codex's backtest findings for anything unusual";
  } else if (continuousMatch) {
    symbol = continuousMatch[3].toUpperCase();
    subject = continuousMatch[2] === 'data' ? `Pulled fresh price history for ${symbol}` : `Backtested the trading rule on ${symbol}`;
  } else if (pilotMatch) {
    const isCrypto = pilotMatch[1] === 'crypto_pilot';
    const kind = pilotMatch[2];
    symbol = pilotMatch[3] ? pilotMatch[3].toUpperCase() : null;
    const domain = isCrypto ? 'crypto' : 'stock';
    if (kind === 'data_snapshot') subject = `Pulled today's real ${domain} market data`;
    else if (kind === 'thesis') subject = `Wrote an initial case for ${symbol || `a ${domain}`}`;
    else if (kind === 'challenge') subject = `Pressure-tested the case for ${symbol || `a ${domain}`}`;
    else if (kind === 'research_company') subject = `Looked up recent news on ${symbol || `a ${domain}`}`;
    else if (kind === 'synthesis') subject = `Finished today's ${domain} research and made a decision`;
    else if (kind === 'rescan') subject = `Re-checked a watched ${domain} price trigger`;
  } else if (stratMatch) {
    const kind = stratMatch[2];
    symbol = stratMatch[3].toUpperCase();
    if (kind === 'data') subject = `Pulled historical price history for ${symbol}`;
    else if (kind === 'codex' || kind === 'claude') subject = `Backtested the trading rule on ${symbol}`;
    else if (kind === 'synthesis') subject = symbol === 'BATCH' || symbol === 'PORTFOLIO' ? 'Combined this week\'s backtest results' : `Compared two independent backtests of ${symbol}`;
  }

  if (!subject) subject = 'Worked on a background research task';
  if (failed) return `${subject} -- ${statusClause(status)}`;
  return subject;
}

async function getOpenPositionsPlain() {
  try {
    const positions = await alpaca.getPositions();
    return positions.map((p) => ({
      symbol: p.symbol,
      side: p.side,
      unrealizedPnl: Number(p.unrealized_pl),
      unrealizedPnlPct: Number(p.unrealized_plpc) * 100,
      marketValue: Number(p.market_value),
    }));
  } catch (err) {
    return null; // surfaced as "couldn't reach the broker" by the caller, not thrown
  }
}

function minutesAgo(iso) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function nextUtc8am() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

async function getPlainSummary() {
  const lastPilotCheck = lastLogTimestamp(PILOT_SUPERVISOR_LOG_PATH);
  const pilotMinutesAgo = minutesAgo(lastPilotCheck);
  const pilotHealthy = pilotMinutesAgo !== null && pilotMinutesAgo <= (PILOT_CADENCE_MINUTES + PILOT_HEALTHY_GRACE_MINUTES);
  const queueDaemonStatus = getQueueDaemonSystemdStatus();

  const lastBacktestCheck = lastLogTimestamp(BACKTEST_SUPERVISOR_LOG_PATH);
  const backtestMinutesAgo = minutesAgo(lastBacktestCheck);
  // Was entirely missing: unlike pilotLoop, backtestLoop had no
  // healthy/cadence-check field at all, so a silently-stopped daily
  // backtest cron would show as routine on the dashboard forever -- no
  // signal anywhere that it had stopped.
  const backtestHealthy = backtestMinutesAgo !== null && backtestMinutesAgo <= (BACKTEST_CADENCE_MINUTES + BACKTEST_HEALTHY_GRACE_MINUTES);

  const activity = busStatus.getRecentActivity(15).slice().reverse();
  const recentEvents = activity.map((entry) => ({
    taskId: entry.taskId,
    status: entry.status,
    text: plainDescribeTask(entry),
  }));

  const openPositions = await getOpenPositionsPlain();

  const overallStatus = queueDaemonStatus === 'active' && pilotHealthy && backtestHealthy ? 'running' : (queueDaemonStatus === 'active' || pilotHealthy || backtestHealthy) ? 'checking' : 'stopped';

  // Closes the loop the user flagged 2026-09-14: one always-current,
  // honest answer to "do we have real edge yet" instead of piecing it
  // together from several vault notes -- see edge-status.js.
  let edgeSummary = null;
  try {
    edgeSummary = edgeStatus.getOverallEdgeSummary();
  } catch (err) {
    edgeSummary = { plainLine: `Couldn't compute edge status: ${err.message}` };
  }

  let skillScore = null;
  try {
    skillScore = getSkillScore();
  } catch (err) {
    skillScore = null;
  }

  return {
    generatedAt: new Date().toISOString(),
    overallStatus, // 'running' | 'checking' | 'stopped'
    queueDaemonStatus,
    pilotLoop: {
      lastCheckedAt: lastPilotCheck,
      minutesAgo: pilotMinutesAgo,
      cadenceMinutes: PILOT_CADENCE_MINUTES,
      healthy: pilotHealthy,
    },
    backtestLoop: {
      lastRunAt: lastBacktestCheck,
      minutesAgo: backtestMinutesAgo,
      nextRunAt: nextUtc8am(),
      cadenceMinutes: BACKTEST_CADENCE_MINUTES,
      healthy: backtestHealthy,
    },
    edgeSummary,
    skillScore,
    openPositions,
    recentEvents,
  };
}

module.exports = { buildSnapshot, getInFlightTasks, getBacklogRunStatus, buildAgentGraph, getDomainActivity, getLearningActivity, getSkillScore, getPlainSummary };
