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
5. The exact captured response is written back into the task file's own
   `output:` field (fenced, verbatim) and appended to `bus/log.md` with
   what was sent and received.
6. Later tasks can `dependsOnTaskId` on this one deterministically.

**Orchestrator-sourced tasks** (real data, not Codex) skip steps 3-4:
Claude fetches a verifiable figure directly and writes the task file by
hand (`to: claude`, `type: response`, a `source:` citation). Downstream
tasks consume it identically via `dependsOnTaskId`.

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
- [ ] No verification/peer-review gate exists in `/bus/` yet (agent-comms
      has one; `/bus/` doesn't -- a task's self-reported `done` is
      currently trusted outright).
- [ ] Antigravity has no real invocation mechanism in `/bus/` -- fully
      deferred.
- [ ] Dependency chains tested only for a single linear hop (task A ->
      task B). Multi-dependency or longer chains are untested.
- [ ] `agent-comms`'s own Antigravity adapter (used by its general
      broadcast task system, separate from the dashboard) is still a
      confirmed-fake stub. Doesn't affect `/bus/` correctness, but is real
      unresolved debt in the system being kept for dashboard use.

## 7. What this system does NOT do

No broker integration. No trade execution. No position sizing. No risk
management. No live order flow. Nothing in this system touches real money
or a live market in any way -- it is task orchestration and research
plumbing only.
