// research-swarm-tasks.js -- Round 17. Minimal, INDEPENDENT task-file
// read/write/event helpers for the isolated research swarm, scoped
// entirely to tasks-research-swarm/ (a sibling of tasks/, never watched
// by run-queue-daemon.js -- confirmed via a full read of that file that
// its fs.watch(TASKS_DIR) is rooted only at VAULT_ROOT/tasks). Never
// requires run-task.js -- zero shared state with the shared daemon.

const fs = require('fs');
const path = require('path');

const VAULT_ROOT = path.resolve(__dirname, '..', '..');
let TASKS_RS_DIR = path.join(VAULT_ROOT, 'tasks-research-swarm', 'survive');
let EVENTS_PATH = path.join(VAULT_ROOT, 'bus', 'research-swarm-events.jsonl');

// Test-only hook, same pattern as every other survive-*.jsonl module's
// _set*PathForTesting -- lets a test point this module at throwaway
// dirs/files instead of the real ones. Never called outside a test.
function _setResearchSwarmDirsForTesting(tasksDir, eventsPath) {
  TASKS_RS_DIR = tasksDir;
  EVENTS_PATH = eventsPath;
}

function nowIso() { return new Date().toISOString(); }

function taskPath(taskId) {
  // taskId is the bare "survive_research_cNNN_slug" form (no directory
  // prefix) -- this module owns its own directory, unlike run-task.js's
  // taskId which includes a "survive/" prefix into the shared tasks/ tree.
  return path.join(TASKS_RS_DIR, `${taskId}.md`);
}

function writeTaskFile(taskId, { payload }) {
  const p = taskPath(taskId);
  if (fs.existsSync(p)) throw new Error(`Refusing to overwrite existing research-swarm task file: ${taskId}.md`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const lines = [`## ${taskId}`, 'status: pending', `payload: ${payload}`, `timestamp: ${nowIso()}`, ''];
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  return taskId;
}

// Real research output almost always contains its own nested ```json
// fence (every category's response schema requires one) -- a FIXED
// 3-backtick outer wrapper collides with that every time, truncating the
// real output before the actual JSON (the exact class of bug already
// found and fixed in run-task.js's pickResultFence(); caught here for
// real, live, by this module's own round-trip test before it ever ran
// against real codex output). Fix: pick an outer fence strictly longer
// than any backtick run already present in the content.
function pickResultFence(content) {
  const runs = String(content == null ? '' : content).match(/`+/g) || [];
  const longestRun = runs.reduce((max, r) => Math.max(max, r.length), 0);
  return '`'.repeat(Math.max(3, longestRun + 1));
}

function writeTaskResult(taskId, { status, output }) {
  const p = taskPath(taskId);
  let text = fs.readFileSync(p, 'utf8');
  text = text.replace(/^status:\s*.*$/m, `status: ${status}`);
  text = text.replace(/\n## Result[\s\S]*$/, '');
  const fence = pickResultFence(output);
  text += `\n## Result\noutput:\n${fence}\n${output}\n${fence}\n`;
  fs.writeFileSync(p, text, 'utf8');
}

function readTaskFile(taskId) {
  const p = taskPath(taskId);
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  const field = (name) => { const m = new RegExp(`^${name}:[ \\t]*(.*)$`, 'm').exec(text); return m ? m[1].trim() : ''; };
  const status = field('status') || 'pending';
  const headerMatch = /output:[ \t]*\n(`{3,})\n/.exec(text);
  let output = null;
  if (headerMatch) {
    const fence = headerMatch[1];
    const contentStart = headerMatch.index + headerMatch[0].length;
    const closeIdx = text.indexOf('\n' + fence, contentStart);
    if (closeIdx !== -1) output = text.slice(contentStart, closeIdx);
  }
  return { taskId, status, output };
}

function appendEvent(entry) {
  fs.mkdirSync(path.dirname(EVENTS_PATH), { recursive: true });
  fs.appendFileSync(EVENTS_PATH, JSON.stringify({ ts: nowIso(), ...entry }) + '\n', 'utf8');
}

function readEvents() {
  if (!fs.existsSync(EVENTS_PATH)) return [];
  return fs.readFileSync(EVENTS_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch (_) { return null; }
  }).filter(Boolean);
}

// Discovers every real specialist task file for a cycle (by filename
// convention, not a memory-store pointer -- a single fact can only ever
// hold the LATEST value, which is exactly what orphaned tasks under the
// old weekly module), then subtracts categories already marked resolved
// in the real event log. This is findLatestUnresolvedDecision()'s own
// pattern, generalized from "the one latest unresolved thing" to "the
// full unresolved set."
function findUnresolvedSpecialistTasks(cycle) {
  if (!fs.existsSync(TASKS_RS_DIR)) return [];
  const re = new RegExp(`^survive_research_c${cycle}_([a-z0-9-]+)\\.md$`);
  const candidates = fs.readdirSync(TASKS_RS_DIR)
    .map((f) => { const m = re.exec(f); return m ? { taskId: f.replace(/\.md$/, ''), category: m[1] } : null; })
    .filter(Boolean);
  const resolved = new Set(readEvents().filter((e) => e.type === 'specialist-resolved' && e.cycle === cycle).map((e) => e.category));
  return candidates.filter((c) => !resolved.has(c.category));
}

function nextCycleNumber() {
  const started = readEvents().filter((e) => e.type === 'cycle-started');
  if (!started.length) return 1;
  const max = Math.max(...started.map((e) => e.cycle));
  return max + 1;
}

// Round 17 fix (cross-review): a crashed cycle or a Pi power-loss
// mid-run must not wedge the system forever behind "a cycle is still
// outstanding." If the outstanding cycle's own cycle-started event is
// older than CYCLE_STALE_HOURS, treat it as abandoned (never silently --
// the caller is expected to alert) and allow a new one.
const CYCLE_STALE_HOURS = 2;

function isCycleDue(cadenceDays) {
  const events = readEvents();
  const starts = events.filter((e) => e.type === 'cycle-started').sort((a, b) => a.ts.localeCompare(b.ts));
  if (!starts.length) return { due: true };
  const last = starts[starts.length - 1];
  const unresolved = findUnresolvedSpecialistTasks(last.cycle);
  if (unresolved.length) {
    const hoursSince = (Date.now() - new Date(last.ts).getTime()) / 3600000;
    if (hoursSince < CYCLE_STALE_HOURS) return { due: false, reason: 'prior cycle still in flight', cycle: last.cycle, unresolved };
    return { due: true, staleCycle: last.cycle, staleUnresolved: unresolved }; // abandoned -- caller alerts, then proceeds
  }
  const daysSince = (Date.now() - new Date(last.ts).getTime()) / (24 * 60 * 60 * 1000);
  return { due: daysSince >= cadenceDays };
}

module.exports = {
  TASKS_RS_DIR, EVENTS_PATH, CYCLE_STALE_HOURS,
  writeTaskFile, writeTaskResult, readTaskFile,
  appendEvent, readEvents, findUnresolvedSpecialistTasks, nextCycleNumber, isCycleDue,
  _setResearchSwarmDirsForTesting,
};
