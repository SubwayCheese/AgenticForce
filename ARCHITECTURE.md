# Architecture (current state)

This is a snapshot of how the system works right now. It is not a history
log -- see `bus/log.md` for that. Update this file whenever the
architecture materially changes; do not let it go stale.

## 1. What this system is

A multi-agent orchestration backbone: Claude Code coordinates specialist
AI agents (currently Codex) to execute discrete, logged, auditable tasks,
with a two-tier system for keeping verified facts and model recall
clearly distinguishable. **This is not yet a trading system** -- it is
general-purpose task orchestration infrastructure, currently exercised
with financial-research-shaped examples because that's the intended
eventual use case.

## 2. Two orchestration systems, different jobs

- **`/bus/`** (this vault) -- **canonical for task execution.** File-based,
  auditable, no server. Every task is a markdown file with a structured
  lifecycle; every step is logged in plain, human-readable prose.
- **`agent-comms`** (`C:\Users\trevo\agent-comms`) -- **kept only for its
  live browser/phone dashboard.** Not used for real task execution
  anymore. It has its own task journal and adapters, but they are a
  separate, unaudited path -- do not treat agent-comms output as
  equivalent to a `/bus/` task.

## 3. Task lifecycle (end to end)

1. Create `/tasks/<task_id>.md` from `tasks/task_template.md` (status:
   `pending`; optionally set `dependsOnTaskId`).
2. Run `node bus/scripts/run-task.js <task_id>`.
3. If `dependsOnTaskId` is set, the script resolves it first: missing,
   not-`done`, or malformed-output dependency -> task is marked `blocked`
   with a stated reason and **never dispatched**. No guessing.
4. If resolved (or no dependency), the script builds the prompt (task
   payload + injected dependency value, if any + the mandatory SOURCE/
   as-of/invalid-premise suffix) and dispatches to Codex via `codex exec`
   (stdin-piped, not argv -- argv silently mangles multi-line/quoted
   prompts on Windows).
5. The response is verified before being trusted (`verifyOutput()`,
   section 6's now-closed item): non-empty, has the mandatory SOURCE tag,
   matches `expectedType` if declared. Fails -> status `unverified` with
   the reason recorded, not silently `done`.
6. The exact captured response is written back into the task file's own
   `output:` field (fenced, verbatim) and appended to `bus/log.md` with
   what was sent and received.
7. Later `done` tasks can `dependsOnTaskId` on this one deterministically.

**Orchestrator-sourced tasks** (real data, not Codex) skip steps 3-5:
Claude fetches a verifiable figure directly and writes the task file by
hand (`to: claude`, `type: response`, a `source:` citation). Downstream
tasks consume it identically via `dependsOnTaskId`.

**Daily research chains** (first production-shaped task type, added
2026-08-31): for a fixed watchlist, one fetch task (orchestrator-sourced)
+ one flag task (Codex, `dependsOnTaskId` on the fetch) per ticker, filed
under `/tasks/daily/<date>/`. The flag task is constrained to
observation-only (FLAG/NO FLAG + brief reasoning, explicitly no trade
recommendations/signals/price targets). A same-day summary is appended to
`bus/research_log.md` (separate from `bus/log.md` -- one line per ticker,
meant to be scanned over time, not a raw task dump).

**Live dashboard** (added 2026-08-31): `bus/scripts/run-backlog.js`
processes a seeded list (`bus/backlog.json`) of task IDs via `run-task.js`'s
real functions, writing live progress to `bus/status.json` after every
real phase change (not just at the end). `bus/dashboard.html`, served via
`npx http-server bus -p 8080`, polls `status.json` every 2s and renders
whatever it finds -- no simulated data. Orchestrator-sourced (`to:
claude`) items in the backlog must already be `done` before the backlog
runs; this script cannot fetch real data itself (same constraint as
`run-task.js` -- see section 6).

## 4. Two-tier data grounding

- **Verified-live:** numeric facts fetched directly by Claude via the
  connected **Financial Modeling Prep (FMP) API** (income statements,
  quotes, company data). Proven deterministic: 3 back-to-back calls for
  the same fact returned byte-identical results. Only Claude can call this
  (in-session) -- `run-task.js` and `codex exec` cannot reach it.
- **Tagged recall:** everything Codex answers without a supplied verified
  figure. Every such response is required to open with the exact line:

  ```
  SOURCE: training-data recall, not verified live
  ```

  (or `SOURCE: supplied by orchestrator from a prior verified step` when
  fed a verified figure), followed by an explicit as-of date. Enforced by
  `run-task.js`'s mandatory prompt suffix, not by convention alone.

**Background research crew** (added 2026-08-31, single-cycle mode --
NOT yet scheduled continuously, awaiting user sign-off on scope/
thresholds): `bus/scripts/run-research-crew.js` runs one research cycle
per invocation against a bounded scope (`bus/research-scope.json`),
writing raw, unreviewed output to `/tasks/UNVERIFIED_Cl/` with a new
status, `unverified_new` -- distinct from `unverified` (failed the
verification gate): `unverified_new` was never submitted for
verification at all, by design, pending deliberate human review. The
SOURCE-tag rule still applies to every entry. A queue-size pause
threshold stops the crew from piling up entries unattended; `ntfy.js`
sends phone notifications (digest on interval, immediate on pause/hard
failure) to the "ClaudeTeam" ntfy.sh topic. `bus/scripts/crew-status.js`
answers "what are they doing" without reading raw logs.
`bus/scripts/watch-inbox.js` (supersedes `check-inbox.js`'s role as of
2026-08-31, after "more immediate responses" was requested) is a
long-lived, `fs.watch`-based process that reacts to new content in
`bus/inbox_claude.md` instantly (no polling delay) and actually answers
it via Codex, pushing the real answer over ntfy immediately -- not just a
"something needs review" alert. Still safe by construction: every call
goes through `runCodex()`'s `--sandbox read-only` invocation, so it can
only ever produce a text answer, never take a real action, regardless of
what's asked. A reduced-frequency heartbeat (5 min) still confirms
liveness when nothing new has come in. `check-inbox.js` (detect-and-alert
only, 10-min poll) still exists but is no longer the one wired into
`run-continuous.js`.

## 5. Agent roles and status

- **Claude (orchestrator):** creates tasks, runs `run-task.js`, fetches
  verified facts, logs everything. Always "active" -- it's the one
  running the show.
- **Codex (active specialist):** real, direct headless invocation
  (`codex exec`), no live data access, always tagged per section 4.
- **Antigravity (deferred):** no CLI/API exists. Only a documented,
  untested-in-`/bus/` async path (write to a shared channel, wait for a
  voluntary reply) -- see `roles/antigravity_role.md`. Not wired into
  `run-task.js` or the dependency mechanism.

## 6. Known open items

- [ ] `run-task.js` cannot call the FMP connector itself -- only Claude
      can, in-session. Orchestrator-sourced tasks are written by hand each
      time; the grounding step itself isn't scripted, only its consumption
      (via `dependsOnTaskId`) is.
- [x] ~~No verification/peer-review gate exists in `/bus/`~~ -- **closed
      2026-08-31.** `verifyOutput()` in `bus/scripts/run-task.js` is a
      second, independent check (non-empty output, mandatory SOURCE tag
      present for Codex tasks, `expectedType` match if declared) that must
      pass before a task can land as `done`; a failing task lands as
      `unverified` with the reason recorded, never silently passed.
      Deliberately minimal -- checks the response has the right shape, not
      that it's semantically correct. Tested against a clean pass
      (`task_20260831_verify_pass`) and a deliberately sabotaged response
      with the SOURCE tag stripped (`task_20260831_verify_sabotage`,
      correctly caught).
- [ ] Antigravity has no real invocation mechanism in `/bus/` -- fully
      deferred.
- [ ] Dependency chains tested only for a single linear hop (task A ->
      task B). Multi-dependency or longer chains are untested.
- [ ] `agent-comms`'s own Antigravity adapter (used by its general
      broadcast task system, separate from the dashboard) is still a
      confirmed-fake stub. Doesn't affect `/bus/` correctness, but is real
      unresolved debt in the system being kept for dashboard use.
- [x] ~~Background research crew not wired to run continuously~~ --
      **closed 2026-08-31.** User confirmed the proposed scope/thresholds
      by requesting a run; wired via a Windows Scheduled Task
      (`BusResearchCrewContinuous`) running `bus/scripts/run-continuous.js`
      for a bounded 2-hour window (not indefinite -- matches what was
      actually asked). Note found and fixed along the way: a shell
      job-control PID from a background test process did not map to the
      real Windows node.exe PID on this Git-Bash/MSYS setup, leaving an
      orphaned duplicate watcher running -- same class of gotcha as
      agent-comms' earlier orphaned-process issue. Verify process kills
      via `Get-CimInstance`/PowerShell, not a shell-reported PID.
- [ ] The autonomous research crew can only run Codex-recall categories
      (SOURCE-tagged as such) -- same as `run-task.js`, it has no path to
      the FMP connector, so real-data-grounded research categories can't
      be part of an unattended loop without Claude present to fetch them.
- [ ] `check-inbox.js` deliberately does not act on what it finds in
      `bus/inbox_claude.md` -- it notifies either way, but interpreting
      and executing new instructions still requires a real, reviewed
      Claude session (see the file's own header for the reasoning).

## 7. What this system does NOT do

No broker integration. No trade execution. No position sizing. No risk
management. No live order flow. Nothing in this system touches real money
or a live market in any way -- it is task orchestration and research
plumbing only.
