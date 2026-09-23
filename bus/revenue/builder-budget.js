// builder-budget.js -- Round 20. Usage governance for the Claude builder.
// The Claude subscription cap is shared with the owner's interactive
// sessions, so the builder (1) reads real utilization from Claude's own
// rate_limit_event, (2) pauses until that window's resetsAt instead of
// probing (a probe costs usage), (3) caps builds per day. Wrong unit to
// count: invocations (one agentic build can cost 50x another).

const avPaths = require('../lib/paths.js');
const fs = require('fs');
const path = require('path');

const VAULT_ROOT = avPaths.ROOT;
let STATE_PATH = path.join(VAULT_ROOT, 'bus', 'builder-state.json');
let CONFIG_PATH = path.join(VAULT_ROOT, 'bus', 'builder-budget.json');
const DEFAULTS = { dailyBuilds: 2, maxFiveHourUtilization: 0.85, maxSevenDayUtilization: 0.90 };

function _setPathsForTesting(state, config) { STATE_PATH = state; if (config) CONFIG_PATH = config; }
function readConfig() { try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) }; } catch (_) { return { ...DEFAULTS }; } }
function readState() { try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (_) { return { pausedUntil: 0, windows: null, builds: {} }; } }
function writeState(s) { fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true }); fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2), 'utf8'); }
const dayKey = (now) => new Date(now).toISOString().slice(0, 10);

// Deny while paused, while a known window is over its threshold and has not
// yet reset (stale windows are ignored), or once the daily build cap is hit.
function canBuild({ now = Date.now(), state = readState(), cfg = readConfig() } = {}) {
  if (state.pausedUntil && state.pausedUntil > now) return { ok: false, reason: `paused until ${new Date(state.pausedUntil).toISOString()} (usage limit)`, until: state.pausedUntil };
  const w = state.windows || {};
  const over = (win, max) => win && win.resetsAt * 1000 > now && win.utilization >= max ? win.resetsAt * 1000 : 0;
  const s = over(w.seven_day, cfg.maxSevenDayUtilization), f = over(w.five_hour, cfg.maxFiveHourUtilization);
  if (s || f) { const until = Math.max(s, f); return { ok: false, reason: `usage window at/over threshold (seven_day ${w.seven_day ? w.seven_day.utilization : '?'}, five_hour ${w.five_hour ? w.five_hour.utilization : '?'}); waiting until ${new Date(until).toISOString()}`, until }; }
  if ((state.builds[dayKey(now)] || 0) >= cfg.dailyBuilds) return { ok: false, reason: `daily build cap reached (${cfg.dailyBuilds})` };
  return { ok: true, reason: 'ok' };
}

// Called after every Claude run: refreshes window utilization and, when the
// run failed on a limit, pauses until that limit's resetsAt (fallback +1h).
function recordRun(run, { now = Date.now(), countAsBuild = false } = {}) {
  const st = readState();
  if (run.windows) st.windows = run.windows;
  const limited = run.rateLimit && run.rateLimit.status && !/^allowed/.test(run.rateLimit.status);
  if (limited || (run.isError && /limit|usage|quota/i.test(run.result || ''))) st.pausedUntil = (run.rateLimit && run.rateLimit.resetsAt) || now + 3600e3;
  if (countAsBuild) st.builds[dayKey(now)] = (st.builds[dayKey(now)] || 0) + 1;
  st.lastRunAt = new Date(now).toISOString();
  writeState(st);
  return st;
}

module.exports = { canBuild, recordRun, readState, readConfig, DEFAULTS, _setPathsForTesting };

if (require.main === module) console.log(JSON.stringify({ state: readState(), decision: canBuild(), cfg: readConfig() }, null, 2));
