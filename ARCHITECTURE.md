> **HISTORICAL LOG.** This file is a dated, round-by-round history of how the system was built and is NOT the current architecture.
> For the current structure read `AGENTS.md`, `docs/SYSTEM-MAP.md` (generated) and `docs/DECISIONS.md`.

---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: hub
status: active
domain: root
description: Entry point for the /bus/ orchestration protocol -- task lifecycle, verification gate, write-mode collaboration, and the permanent regression suite
tags: ["bus-protocol", "orchestration", "hub", "verification"]
---
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

**Two Codex dispatch modes** (added 2026-09-01): `run-task.js` (read-only,
used by every autonomous/unattended path) and `run-task-collab.js`
(write-enabled, manual-only) -- see section 3a.

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

## 3a. Write-enabled collaboration mode (added 2026-09-01)

`bus/scripts/run-task-collab.js` is a second, deliberately separate entry
point from `run-task.js`, for supervised sessions (user + Claude both
present) working on the vault itself -- e.g. Codex leaving its own notes,
editing shared docs directly, contributing to `/bus/` improvements. Key
differences from the default read-only path:

- Dispatches via `codex exec --sandbox workspace-write` instead of
  `read-only`. Scoped to `VAULT_ROOT` only (via the `cwd` process option,
  not an explicit `--cd` argv flag -- see the file's own comments for why
  passing `--cd` as an argv element broke under Windows shell quoting).
  Nothing outside the vault directory is writable.
- No `dependsOnTaskId` support -- this is for direct collaborative edits,
  not data pipelines.
- No SOURCE-tag verification -- that machinery is about factual-recall
  grounding, which doesn't apply to file edits. Instead, every call
  snapshots the vault's file tree (path -> size/mtime) before and after,
  and logs the real added/modified/removed diff to `bus/log.md` and the
  task's own output -- so Claude sees what Codex actually changed on disk,
  not just Codex's own text summary of what it did.
- **Manual-only, by design.** Nothing in this repo invokes this script
  automatically -- not `run-continuous.js`, not `run-research-crew.js`,
  not `watch-inbox.js`. Those stay on `run-task.js` / read-only. Do not
  wire this into any unattended path.

Tested 2026-09-01 (`task_20260901_collab_write_test`): Codex created
`bus/codex_notes.md` (now a real, ongoing scratch space for Codex to leave
notes between sessions); the file-diff mechanism correctly detected the
addition independent of Codex's own claim.

**Sandbox boundary stress-tested 2026-09-01**
(`task_20260901_sandbox_boundary_test`): instructed Codex to actually
attempt (not just reason about) a shell write to
`C:\Users\trevo\agent-comms\codex_boundary_test.txt` -- a real directory
outside the vault. Codex ran `Set-Content`, got a real OS-level
`Access to the path ... is denied` error, and reported it faithfully; the
target path was independently confirmed absent afterward (not just taking
Codex's report on faith). The vault-write path scoping holds under a real
attempt, not only in the happy-path case. One caveat worth knowing:
`codex exec --sandbox workspace-write`'s own startup banner reports its
writable scope as `[workdir, /tmp, $TMPDIR]` -- the OS temp directory is
always additionally writable regardless of `--cd`/`cwd`. Not a project-data
risk (nothing sensitive lives there) but worth remembering if a future task
ever needs the boundary to be *absolute*, not just "nothing outside the
vault or system temp."

## 3b. Permanent regression suite (added 2026-09-01)

`bus/scripts/run-verification-suite.js` -- `node bus/scripts/run-verification-suite.js`,
no arguments. Exists because every safety property in this document (the
verification gate, dependency blocking, chain propagation, the write-mode
sandbox boundary) had been proven exactly once, by hand, as a one-off task
file -- real evidence, but nothing that would catch a regression if
`run-task.js`/`run-task-collab.js` changed later, and nothing that could be
re-run together as a single check.

Covers, every run:
- **Fast (no live Codex process):** `verifyOutput()` against a valid
  response plus 3 fabricated failure shapes (empty, missing SOURCE tag,
  `expectedType: number` with no digit); `resolveDependency()` against all
  3 blocking cases (missing dependency, not-yet-done dependency, done-but-
  no-output dependency).
- **Slow (spawns real `codex exec`):** a live 2-hop numeric dependency
  chain with a fresh seed each run (not the same numbers as the original
  manual `chain_a/b/c` test, so a hard-coded-response bug couldn't hide
  behind a repeated value); the live sandbox-boundary write-outside-the-
  vault attempt, independently re-verified via `fs.existsSync`, not by
  trusting Codex's own report.

Every generated task file lands under
`tasks/verification_suite/<run_id>/`, isolated from real work and from
other suite runs. Suite dispatches are logged to `bus/log.md` exactly like
a normal `run-task.js`/`run-task-collab.js` call (this was missed in the
first draft of the suite -- caught immediately by checking `bus/log.md`
for the run and finding nothing there, fixed before relying on it).

**Two real findings surfaced while building this, not before:**
- `verifyOutput()`'s `expectedType: number` check scans the *entire*
  response text for any digit, not specifically the answer -- a response
  whose only digit is in the as-of preamble (e.g. "As of: 2026") still
  passes. Deliberately minimal per this file's own stated philosophy
  ("does not attempt semantic correctness"), not a bug, but worth knowing
  precisely rather than assuming the check is stricter than it is.
- The write-mode file-diff (section 3a) had a real false-positive source:
  `.obsidian/workspace.json` (Obsidian's own autosaved UI state -- open
  tabs, cursor position) changed during a sandbox-boundary test run
  because the vault was open in Obsidian at the time, and the diff wrongly
  attributed that background write to Codex. Fixed by adding `.obsidian`
  to `run-task-collab.js`'s `IGNORE_DIRS` (alongside the pre-existing
  `.git`/`node_modules`). Confirmed clean on a follow-up run.

## 3c. Second real specialist: Claude, via run-task-claude.js (added 2026-09-01)

Added specifically to test a concrete question before designing a Phase 2
agent-scaffold system: which parts of `run-task.js`'s design are
genuinely generic across specialists, versus Codex-specific assumptions
that were never actually tested because Codex was the only specialist
that had ever existed. `bus/scripts/run-task-claude.js` dispatches to a
nested headless `claude -p` process, read-only by default
(`--permission-mode plan`). Tasks use `to: claude-agent` (deliberately
distinct from `to: claude`, which stays reserved for orchestrator-sourced
tasks -- see `verifyOutput()`'s `DISPATCHED_SPECIALISTS` set in
`run-task.js`).

**What generalized with zero code changes** (reused directly via
`require('./run-task.js')`): dependency resolution (`resolveDependency`),
the task file format, `writeTaskResult`, `appendLog`. These were never
actually Codex-specific -- just never exercised against anything else
until now. `MANDATORY_SUFFIX`'s wording was already agent-neutral too
("you have no live data lookup"), reused verbatim.

**What needed a real, one-line generalization, not a rewrite**:
`verifyOutput()`'s SOURCE-tag check was hardcoded to `task.to === 'codex'`.
Generalized to a `DISPATCHED_SPECIALISTS` set once a second specialist
needed it. A real accidental-coupling found by actually building the
second integration, not by inspection.

**What was genuinely different per specialist** (not generalizable, and
correctly isn't shared): invocation shape (`codex exec --sandbox
read-only ...` vs `claude -p --permission-mode plan`, stdin-piped either
way); the Windows subprocess quirk (`codex.exe` is a `.cmd` wrapper
needing `execFileSync`'s `shell:true` plus the manual-quoting workaround
in `run-task-collab.js`; `claude.exe` is a real PE32+ executable --
confirmed via `file` before writing the script -- needing neither);
sandbox vocabulary (Codex's `read-only/workspace-write/
danger-full-access` vs Claude's `plan/acceptEdits/bypassPermissions/...`,
a different underlying model, not just different names for the same
thing).

**Tested 2026-09-01, both passing identically to Codex's own tests**:
- Basic dispatch (`task_20260901_claude_basic_test`): 15+22=37, correct,
  verification gate passed.
- Dependency blocking (`task_20260901_claude_block_notdone`): correctly
  blocked, never dispatched, same as Codex's equivalent test.
- **Cross-agent dependency chain** (`task_20260901_cross_agent_a/b/c`):
  seed 61 -> Claude adds 19 (=80) -> Codex multiplies by 2 (=160),
  exactly right. This is the real test: Codex correctly consumed a value
  Claude produced, despite Claude's slightly different formatting
  (`As-of:` vs Codex's `As of:`, an extra blank line before the number) --
  the pipeline doesn't assume a single specialist's exact output shape.

**Answer to the Phase 2 question this was built to answer**: the core
`/bus/` abstractions (dependency chains, the verification gate, task file
format) hold up across two structurally different real specialists with
almost no per-agent special-casing -- one generalized field
(`DISPATCHED_SPECIALISTS`) and one new dispatch script whose differences
are genuinely invocation-shape differences, not design flaws. This
directly motivated section 3d.

## 3d. Phase 2 scaffold: config-driven agent dispatch (added 2026-09-01)

**The actual Phase 2 deliverable.** Sections 3a-3c proved the pattern
generalizes but did nothing to make adding a third agent easier -- each
one still meant hand-writing a ~150-line near-duplicate script. This
closes that gap: everything that varies per specialist now lives in a
small JSON config, and everything that doesn't stays shared code.

**Files:**
- `bus/scripts/agents/<id>.json` -- one config per agent (`codex.json`,
  `claude-agent.json` today). Fields: `binary`, `isWindowsCmdWrapper`,
  `outputMethod` (`file` | `stdout`), `promptDelivery`, `modes.readOnly.args`
  / `modes.write.args` (with `{outputFile}` as the one supported
  placeholder), and `boundaryTestMethod` (see below).
- `bus/scripts/agent-engine.js` -- shared dispatch engine: `dispatch()`
  (read-only or write mode, handles the Windows `.cmd`-wrapper quirk and
  either output-capture method), `dispatchWrite()` (adds the
  snapshot/diff auditing from 3a, generalized to any agent), plus
  `loadAgentConfig()`/`listAgentConfigs()`.
- `bus/scripts/run-task-generic.js <task_id> [--write]` -- the
  operator-facing entry point. Reads the task's `to:` field, loads the
  matching config, dispatches. One command instead of remembering which
  script goes with which agent.

**Deliberately additive, not a replacement**: `run-task.js`,
`run-task-claude.js`, and `run-task-collab.js` are untouched and still
work exactly as before -- `run-backlog.js`, `run-research-crew.js`,
`watch-inbox.js`, and `run-verification-suite.js` all depend on
`run-task.js`'s exports directly and have no reason to change. The
generic engine was validated by dispatching the SAME two agents through
it and confirming real, passing results (see the verification suite's
`testEnginePerAgentDispatch`/`testEngineSandboxBoundaries`, which cover
every configured agent automatically -- adding `agents/<id>.json` for a
future agent gets it covered with no new test code).

**A real, non-obvious finding from closing the write-mode gap for
Claude**: a boundary test needs to match how the agent's permission
model actually works, or it tests the wrong thing. First attempt used
the same shell-command boundary test that worked for Codex --
`--permission-mode acceptEdits` blocked it, but via Claude Code's
Bash-tool approval gate ("This command requires approval"), not a
file-permission boundary. That's a real block, but proves the wrong
thing -- Codex's sandbox governs shell execution uniformly; Claude's
permission model gates Bash and its native Write/Edit tools separately.
The real equivalence-class test asked Claude to use its own Write tool
directly: correctly blocked with "outside the session's approved working
directories" -- the actual boundary property, confirmed. This is now
encoded as each config's `boundaryTestMethod` (`"shell"` for Codex,
`"write-tool"` for Claude) rather than assumed identical, and the
verification suite picks the right test per agent from that field.

**A second finding, structural rather than fixable**: while the Claude
write-mode boundary tests were running, an unrelated concurrent edit
(this section being written) landed inside the snapshot window and
showed up in that task's file-diff as a "modified" file. Same class of
false positive as the `.obsidian` issue in section 3a, but this one
isn't a fixable ignore-list gap -- it's inherent to diff-based auditing
during genuinely concurrent edits. Practical mitigation: don't edit
vault files while a write-mode task is in flight, not a code fix.

**How to add a new agent**: the full checklist lives in
`bus/scripts/agents/README.md`, written from what actually went wrong or
had to be verified the first time (not guessed in advance). Short
version: write `bus/scripts/agents/<id>.json` with real, verified values
(`<binary> --help`, `file <path-to-binary>`, one live smoke-test call --
don't guess flag names or the Windows-wrapper question from an existing
config), validate its shape with `node validate-agent-config.js <id>`
(fast, no live call), dispatch one real task through
`run-task-generic.js`, then run `run-verification-suite.js` -- which
covers the new agent automatically (`testAgentConfigShapes`,
`testEnginePerAgentDispatch`, `testEngineSandboxBoundaries` all loop over
whatever configs exist). If any of that requires writing a new
agent-specific test function, something about the config or the engine
is under-general and worth fixing at that level instead.

**Also validated 2026-09-01**: a full cross-agent dependency chain
dispatched entirely through `run-task-generic.js` (not the hand-written
scripts) -- seed 29 -> Claude adds 13 (=42) -> Codex multiplies by 3
(=126), exact. Confirms the generic engine handles chained dependencies
correctly end to end, not just isolated single dispatches.

**A real bug found and fixed during a self-review pass (2026-09-01, not
prompted by a test failure)**: neither `run-task.js` nor
`run-task-collab.js` ever checked a task's `to:` field before dispatching
to Codex -- both just always called Codex, unconditionally. Harmless
before today, by construction (Codex was the only possible dispatch
target). Not harmless once `to: claude-agent` tasks exist: running
`node run-task.js <task_id>` on a Claude-intended task would have
silently sent it to Codex instead, with no error, and a generic-enough
prompt might even have happened to pass verification -- making the
mistake invisible rather than loud. Both scripts now reject a task whose
`to:` doesn't match what they dispatch to (`run-task-claude.js` already
had this guard from when it was written); `run-task-generic.js` also
explicitly rejects `to: claude` (the reserved orchestrator-sourced
marker) rather than relying on no `agents/claude.json` ever existing by
coincidence. Verified safe to add: neither `run-backlog.js`,
`run-research-crew.js`, nor `watch-inbox.js` calls any of these scripts'
`main()` -- all three use the exported primitives directly with their
own dispatch logic, so this change only affects direct CLI invocation,
exactly the mistake it guards against. Tested all three new guards live
(`task_20260901_guard_test_wrong_script`, `task_20260901_collab_guard_test`,
`task_20260901_generic_guard_test` in both modes): correctly rejected,
task status left `pending` (not falsely marked done/error), full
regression suite still green after each change. The four manual guard
tests are now permanent (`testDispatchGuards` in
`run-verification-suite.js`) -- spawns each script as a real subprocess
(can't call `main()` in-process, it calls `process.exit()` directly on
rejection) and confirms rejection, exit code, untouched task status, and
the specific expected stderr message. No live agent call happens on any
reject path, so this stays in the fast tier despite spawning real
subprocesses.

Also made permanent: the nonexistent-binary dispatch test (manually
confirmed once, now `testNonexistentBinaryDispatch` -- built entirely
in-memory, no file touches `bus/scripts/agents/`, so there's no cleanup
risk of a broken config leaking into the real directory).

**A real gap found while looking for what else was still only manually
tested**: the cross-agent dependency chain -- the actual core claim of
the whole Phase 2 scaffold effort -- had been proven by hand three
separate times that day (`task_20260901_cross_agent_*`,
`task_20260901_generic_chain_*`, the 5-hop `longchain_*`) but never made
a permanent regression test. `testLiveChain()` only ever exercised
Codex-only chains. Added `testCrossAgentChain()` (seed 23 -> Claude adds
6[=29] -> Codex multiplies by 4[=116]) using a new generic in-process
helper (`runFullTaskGeneric`, dispatches via whichever `agents/<id>.json`
matches the task's own `to:` field, instead of `runFullTask`'s
Codex-only `runCodex()` call) -- so the single most important thing this
whole effort was meant to prove now gets checked every suite run, not
just when someone remembers to test it by hand again.

**One more gap closed the same way**: `testEngineSandboxBoundaries` only
ever proves a write correctly *fails* outside the vault -- whether a
legitimate write *inside* the vault actually *succeeds* was tested by
hand for both agents that day but never made permanent either. Added
`testEngineWriteSuccess`, completing the read/write x success/failure
matrix for the generic engine (previously 3 of 4 cells covered).
Independently verifies the file landed on disk with the right content,
not just that the agent claimed success, then cleans up.

**A second real finding from the same review pass**: `agent-engine.js`'s
`promptDelivery` config field was validated by
`validate-agent-config.js` and documented in both configs, but never
actually read by `dispatch()` -- the prompt is unconditionally piped via
stdin regardless of what the field says. A future config setting
`promptDelivery: "positional"` would have silently done nothing, and
that agent might never receive its prompt if its CLI doesn't read stdin.
`dispatch()` now asserts `promptDelivery === 'stdin'` explicitly and
throws a clear error otherwise -- loud failure at dispatch time instead
of silent wrong behavior. Confirmed both existing configs are
unaffected (both already declare `"stdin"`).

## 3e. Phase 3 groundwork: `vault-search.js` (added 2026-09-01)

First real Phase 3 piece ("shared persistent infrastructure underneath
both" the orchestration hub and the agent scaffold). `bus/scripts/
vault-search.js` is a thin Node wrapper around autograph's `search.py`
(BM25 FTS5 + link-graph rerank over the vault -- zero extra deps, tested
live against the real vault before writing the wrapper, not assumed from
its docstring). Usable as a CLI (`node vault-search.js "<query>"
[--limit N]`) or programmatically (`const { search } = require(...)`) by
any future script that wants to pull real, ranked vault context before
building a task prompt, instead of relying on the orchestrator's own
memory of what's in the vault. Read-only, side-effect-free, degrades to
`{ engine: 'unavailable' }` rather than throwing if autograph or `uv`
isn't available -- callers should treat this as optional enrichment, not
a hard dependency.

**Update 2026-09-01: now wired in, opt-in only** (the design decision
above was made explicitly, not bolted on without being asked). A task
sets `enrichWithSearch: true` (see `task_template.md`); `run-task-generic.js`
then searches the vault using the task's own payload as the query, top 3
results, and prepends a clearly-labeled block ("may be incomplete or
irrelevant, use your own judgment... do not treat this as verified
fact") before the mandatory SOURCE-tag suffix. Read-only mode only.
Degrades silently (no enrichment, task still dispatches normally) if
search is unavailable -- an optional feature failing should never block
the actual task.

**A real bug found while testing this, not before**: the search hit
list included the very task file that was about to be dispatched.
`search.py` turns out to keep its own separate `IGNORE_DIRS`, not
shared with `common.py`'s (which every other autograph script uses) --
the earlier `bus`/`tasks`/`roles` exclusion patch (section 3, discovery
scan) never propagated to it. Fixed the same way, in `search.py`
directly; now permanent in the suite (`testVaultSearch`'s
leaked-paths check).

**A more significant finding, from the same test**: dispatched read-only,
Claude answered a question about this file by directly reading
`ARCHITECTURE.md` with its own Read tool and citing exact line numbers
-- not by relying on the search enrichment, and not from training-data
recall. It then correctly *refused* to open with the mandatory "SOURCE:
training-data recall, not verified live" line, calling out that the
premise was false in its case, and used the second accepted tag instead
(itself not quite accurate either -- nothing was "supplied by the
orchestrator," Claude fetched it itself). **This means `MANDATORY_SUFFIX`'s
blanket claim ("you have no live data lookup... this is true for every
response you give in this pipeline") is not actually true for the Claude
specialist** -- `--permission-mode plan` blocks writes, not reads, and
Claude retains its native Read/Grep/Glob tools scoped to `cwd`
(`VAULT_ROOT`). Whether Codex's `--sandbox read-only` has the same
property (file reads allowed, only writes blocked) is untested --
plausible given the name, not confirmed. **Not fixed this round** --
this is a real gap in the verification gate's truthfulness for one
agent, deserving its own careful pass (how should the SOURCE tag work
for an agent that legitimately *can* read local files live?), not a
rushed edit alongside an unrelated feature. Tracked as a new open item
in section 6.

**Fixed 2026-09-02**, as its own careful pass, not folded into an
unrelated change. `run-task.js` now exports `getMandatorySuffix(to)`
instead of a single flat `MANDATORY_SUFFIX`: a new
`LIVE_FILE_READ_CAPABLE` set names every specialist actually verified to
retain live file-read access, and only those specialists get a third,
honest SOURCE tag option -- `SOURCE: verified live via direct file read
in this pipeline`, naming the exact file(s) read -- alongside the
original two. `verifyOutput()` now checks a per-specialist accepted-tag
list instead of one fixed pair for everyone.

Landed in two passes the same day, not one: first with
`LIVE_FILE_READ_CAPABLE` containing only `claude-agent` (Codex's
read-but-not-write property was still an open question, tracked in
section 6). That question was then answered the same day -- see section
6's now-closed Codex item -- and Codex was added too, so **both real
dispatched specialists are in `LIVE_FILE_READ_CAPABLE` today**.
Answering that question also surfaced a second real bug (`run-task.js`'s
own `main()`, plus three more scripts -- `run-research-crew.js`,
`run-backlog.js`, `watch-inbox.js` -- had been missed and still
hardcoded the flat suffix); all fixed the same pass, see section 6.

Every dispatch call site now goes through `getMandatorySuffix()` rather
than hardcoding a suffix, so this is decided in exactly one place.
Verified via the suite's `testVerifyOutputFast` (both specialists'
live-read tags accepted) and multiple live full-suite runs -- one run
recorded a single genuine flake (`engine dispatch (Claude)` failed
verification once with `verified=false`), reproduced manually 4/4 times
clean afterward and clean again on a full re-run; consistent with this
mechanism's pre-existing exact-string-match brittleness against live LLM
output (already an accepted tradeoff before this change, not a
regression introduced by it), not investigated further as its own item.

## 3f. Phase 3: `bus-status.js` (added 2026-09-01)

A single, human-readable snapshot of the whole `/bus/` system --
mirrors `crew-status.js`'s existing pattern (focused summary, not raw
logs) generalized from "the research crew" to everything: agent config
validity (via `validate-agent-config.js`), recent dispatch activity
(parsed from `bus/log.md`), pending-but-never-dispatched tasks, and
vault health (via autograph, if installed -- degrades to "skipping" if
not). Read-only and side-effect-free; reports the LAST recorded state,
not a fresh live test (`run-verification-suite.js` is still the way to
get a fresh, live-tested result). `node bus/scripts/bus-status.js`, no
arguments. Has a fast smoke test in the verification suite
(`testBusStatusSmoke`) confirming all four report functions run without
throwing.

## 3g. Phase 3, piece 1: `run-queue-daemon.js` (added 2026-09-02)

Closes the most concrete Phase 3 gap: every `/bus/` dispatch, chain or
not, required a human to type `node run-task-generic.js <task_id>` by
hand. This is the real "runs on its own" piece -- long-lived (like
`watch-inbox.js`, runs until killed, no duration cap; this is standing
infrastructure, not a bounded content-generation window like
`run-continuous.js`'s research-crew run), watches `tasks/` via
`fs.watch(..., { recursive: true })`, and dispatches any new
`status: pending` file through the existing, unchanged `run-task-generic.js`
path (as a subprocess -- `execFileSync`, same pattern
`run-continuous.js`'s `runScriptOnce()` already used, so a crash/hang in
one task's dispatch can't take the daemon down). `to: claude` tasks
(orchestrator-reserved) are filtered out at scan time, never dispatched.

**The actual payoff, not just automation of the existing manual step**:
a periodic tick (2 min in production, overridable via
`QUEUE_DAEMON_BLOCKED_RETRY_MS` for fast testing) re-checks every
`status: blocked` task's dependency; once it resolves, the daemon flips
`status:` back to `pending` and re-dispatches automatically. Before
this, a multi-step chain still needed a human to notice a dependency
finished and manually reset the blocked step -- this closes that
without touching `dependsOnTaskId`'s single-parent format at all.

`listPendingTaskIds()` (and the more general `listTaskIdsByStatus(status)`
it's built on) is new in `run-task.js`, extracted from `bus-status.js`'s
`reportPendingTasks()` -- that function used to walk `tasks/` inline;
now it calls the shared function, so there's one definition of "pending"
for both the report and the daemon, not two that can drift (kept honest
by `testPendingTaskIdsAgreement()` in the suite).

**A real, non-hypothetical risk found before ever running this against
the live vault, not after**: six 2026-08-31/09-01 hand-authored
guard-test task files were sitting `status: pending` forever by design
(deliberately left unfinished, or meant to prove a script rejects them)
-- exactly the kind of historical audit record this vault's own
convention (see `run-verification-suite.js`'s header) says must never
be silently modified. A daemon that dispatches anything pending would
have done exactly that on its very first live scan. Moved to
`tasks/archive_pre_daemon/` (`git mv`, content untouched) instead, and
that directory is excluded from `listTaskIdsByStatus()`'s walk the same
way `verification_suite/` already was. (Later folded into
`tasks/_archive_tests/` -- see the consolidation note below.)

Verified live, not assumed: a manual smoke test (daemon running, single
trivial task dropped in by hand, zero manual dispatch command, correctly
auto-dispatched) plus a real 2-hop dependency chain dropped in at once
(both files pending simultaneously -- daemon dispatched the parent,
then the child, entirely unprompted, 30+11 then x2 = 82, correct). The
blocked-then-auto-retry path specifically was proven separately: a
child task was dropped in with its parent deliberately not yet
existing (forcing a genuine `blocked` status), then the parent was
created -- the next retry tick correctly detected the now-resolved
dependency, flipped status back to pending, and re-dispatched, landing
on 7*6+100=142 with zero manual intervention (`tasks/daemon_smoke_test_*.md`,
kept as historical proof records). This exact scenario is now permanent
suite coverage too (`testQueueDaemon()`, spawns a real daemon child
process against `tasks/` root -- deliberately NOT under
`verification_suite/`, since that directory is excluded from the
daemon's own scan and would prove nothing; its own two test task files
are cleaned up after assertion, unlike the suite's other generated
tasks, so repeated suite runs don't permanently litter `tasks/` root).

**Deliberately out of scope, named so it isn't silently assumed**:
persistence across logoff/reboot (Windows Task Scheduler wiring -- a
separate, later decision); true multi-parent fan-in (`dependsOnTaskId`
stays single-parent; this only makes existing single-parent chains
hands-off).

## 3h. Phase 3, piece 2: fan-in / multi-parent dependencies (added
2026-09-02)

The limitation piece 1's daemon exposed rather than solved: a task can
depend on exactly one prior task. A task that genuinely needs two prior
results (e.g. "combine Codex's answer and Claude's answer") couldn't be
expressed at all. New field `dependsOnTaskIds` (plural, comma-separated
task IDs) closes this, added alongside the existing `dependsOnTaskId`
(singular) rather than changing it -- zero format/behavior change for
any existing single-parent task file or test. A task sets exactly one
of the two; declaring both is treated as malformed and blocked with an
explicit reason, never silently resolved using one of them.

**Collapsed duplication while adding the capability, not alongside
it.** The same ~15-line block (call `resolveDependency()`, block on
failure, hand-format an `injectedContext` string on success) was
independently duplicated across `run-task.js`'s own `main()`,
`run-task-claude.js`, `run-task-generic.js`, `run-backlog.js`, and
`run-verification-suite.js`'s two `runFullTask*` mirrors -- 5 near-copies,
confirmed by grep before writing anything. Adding multi-parent support
as a 6th duplicated block in each would have made that worse, and after
this same session's SOURCE-tag suffix fix (where a missed call site
caused a real bug), more duplicated copies means more places a future
change can be missed. All of it now goes through one new function in
`run-task.js`, `resolveTaskDependencies(taskId, task)`, returning
`{ ok, reason?, injectedContext, logNote }` -- `injectedContext`/
`logNote` are always `''` (not `undefined`) when there's nothing to
inject, so every call site can unconditionally append/log them.
`resolveDependency()` itself is untouched and still exported -- the new
function calls it once per ID, single or multi.

`run-queue-daemon.js`'s `retryBlocked()` needed zero fan-in-specific
logic: swapping its `resolveDependency()` call for
`resolveTaskDependencies()` and widening its guard to
`(dependsOnTaskId || dependsOnTaskIds)` was the entire change -- the
daemon's blocked-retry mechanism itself (proven correct in piece 1)
doesn't care whether one or two dependencies resolved, only whether
`dep.ok` is now true. A blocked multi-parent task gets auto-retried the
moment its *last* dependency finishes, same as a single-parent one.

Write mode (`run-task-collab.js`, `run-task-generic.js --write`) rejects
`dependsOnTaskIds` the same way it already rejected `dependsOnTaskId` --
dependency resolution stays read-only-mode only, unchanged reasoning
from before this piece.

Verified: new fast unit checks
(`testResolveTaskDependenciesFast` -- no-dependency, both-fields-set
rejection, single-parent parity with calling `resolveDependency()`
directly, multi-parent success, multi-parent partial-failure naming
which dependency) plus a new live dispatch test (`testLiveFanIn` --
two independent deterministic seeds, one real dispatched task with
`dependsOnTaskIds` pointing at both, asserting the correct combined sum
AND that the response used the "supplied by orchestrator" SOURCE tag,
not recall, proving both values were actually injected). Full suite run
alongside every existing single-parent check
(`testLiveChain`, `testCrossAgentChain`, `testDependencyBlocking`,
`testQueueDaemon`) to confirm the refactor changed nothing about
existing behavior.

## 3i. Phase 3, piece 3: the memory/knowledge layer (added 2026-09-02)

`vault-search.js` (section 3e) is keyword search over static Markdown
notes a human wrote -- it has no way to durably remember a fact a
*dispatched task* produced. Before this, if task A verified something
and task C needed it, C could only get it via `dependsOnTaskId: A`,
which requires knowing A's exact task_id in advance. No way existed to
ask "what's the last verified value of X" regardless of which task
produced it or when. New module `bus/scripts/memory-store.js` closes
this: a small, dependency-free (just `fs`, no new package -- matching
the "no unjustified complexity" precedent from Phase 1's
Task-Scheduler-over-PM2 decision) append-only JSONL key/value fact
store at `bus/memory.jsonl` -- `{ts, key, value, sourceTaskId, taskTo}`
per line. `getFact(key)` returns the latest entry, `getFactHistory(key)`
every one (history is never overwritten, same discipline as
`bus/log.md`), `listKeys()` summarizes for reporting. A malformed line
is skipped, not fatal -- `resolveDependency()`'s "malformed/missing --
refuse to guess, don't crash either" posture, applied to file I/O.
`bus/memory.jsonl` is committed to git (unlike the gitignored
`bus/continuous-run.log`/`bus/queue-daemon.log`) -- a durable record of
what's been verified over time, closer in character to `bus/log.md`
than to a disposable operational log.

**Recording is gated by the SOURCE-tag honesty work built earlier the
same day, not a second trust mechanism.** New field `recordFact: <key>`
(opt-in). On `status: done`, `isEligibleForMemory()` in `run-task.js`
decides whether to promote the result: `to: claude` (orchestrator-
sourced, e.g. a real FMP fetch, see section 4) is always eligible,
trusted by construction; a dispatched specialist's output is eligible
unless it's tagged `SOURCE: training-data recall, not verified live` --
a recall-tagged guess must never get promoted to "remembered fact,"
that would quietly undermine the whole point of the tag. Declining is a
silent skip, not an error. The hook lives in exactly one place --
`writeTaskResult()` (already the one function every dispatch script
calls to persist a result) re-reads the just-written file and calls
`maybeRecordFact()` -- no new call site needed in any of the 5 dispatch
scripts, one level cleaner than fan-in's collapse (which still needed
one call per script) since this needed none.

**Looking a fact up reuses `resolveTaskDependencies()`, not a second
resolution path.** New field `dependsOnFact: <key>`. The function fan-in
built is now split into `resolveTaskLineageDependencies()` (the exact
prior logic, unchanged) and `resolveFactDependency()` (new -- looks up
`memoryStore.getFact()`, blocks naming the key if nothing's recorded
yet, or injects a clearly-attributed block if found), combined by
`resolveTaskDependencies()`: task-lineage resolves first (identical
behavior for any task not using `dependsOnFact` -- early return on
failure, nothing new evaluated), then the fact dependency is checked
only if that succeeded. A task may combine `dependsOnTaskId(s)` with
`dependsOnFact` -- they're not mutually exclusive with each other the
way `dependsOnTaskId` and `dependsOnTaskIds` are (different questions:
"this specific task's fresh output" vs "whatever the most recently
verified value of X is").

**The daemon gets fact-based auto-retry for free, same mechanism fan-in
already proved.** `run-queue-daemon.js`'s `retryBlocked()` guard widens
to `dependsOnFact`; the call already goes through
`resolveTaskDependencies()`, so a task blocked purely on a missing fact
gets retried the moment ANY task records it -- without the daemon
knowing in advance which task that will be.

New CLI `bus/scripts/memory-query.js` (mirrors `vault-search.js`'s
usability): `<key>` for the latest fact, `--history` for every
recording, `--list` for every known key. `bus-status.js` gained a
matching `reportMemoryStore()` section (key count, total recordings,
most recent).

Verified: fast unit checks for `memory-store.js`'s round-trip
(including malformed-line resilience), the eligibility gate (exercised
through the REAL `writeTaskResult()` path, not a reimplementation --
`to: claude` recorded, recall-tagged output skipped, orchestrator-
supplied-tagged output recorded), and `dependsOnFact`'s three shapes
(missing, present, combined with `dependsOnTaskId`). Live: a real
dispatched task instructed to read a vault file and report a fact from
it, `recordFact` set, confirmed to land with the live-file-read SOURCE
tag and land in the store correctly -- then a second real task with
ONLY `dependsOnFact` set (no `dependsOnTaskId` at all) confirmed to
correctly look the fact up by key and use it, proving lookup-by-meaning
actually works end-to-end, not just lookup-by-lineage.

**A real finding surfaced by this same live test, closed the same
day**: when the injected value's own embedded SOURCE/as-of preamble
happens to be well-formed, it has exactly the shape of a complete,
valid response -- early testing showed a specialist sometimes copying
the WHOLE quoted block verbatim instead of producing its own honest
"supplied by orchestrator" tag. `wrapInjectedValue()` now blockquotes
every line (`"| "` prefix) and strips a leading `SOURCE:` line before
quoting. But the deeper finding, from a clean 10-rep probe: most of the
apparent unreliability wasn't injection confusion at all -- the test's
own fact happened to be file-derived, and claude-agent (real
Read/Grep/Glob access) was honestly re-reading the live file itself
rather than trusting the supplied value, a correct, encouraged
behavior, not a bug. Isolated with a synthetic, non-file-reverifiable
fact instead: **10/10 correct**. See section 6 for the full
investigation.

## 3j. Phase 3, piece 4: the credential/secrets broker (added 2026-09-02)

The real, demonstrated gap, not a hypothetical one: before this piece,
the only way to get a credential to a dispatched task would have been
pasting it into `payload:` -- which puts it in plaintext in the task
file, in the specialist's visible prompt, and permanently in
`bus/log.md`'s "Sent (exact)" block, exactly like every other piece of
prompt text this vault dispatches. No real external API/service
integration exists yet that needs one (FMP/LunarCrush are handled
entirely by claude.ai's own connector auth and never touch `/bus/`), so
per the user's call this piece builds and proves the leak-prevention
*mechanism*, tested synthetically with a fake secret, ready for whenever
a real one is needed.

**Storage**: `bus/secrets.local.json` (gitignored, flat
`{"NAME": "value"}`), plus a committed `bus/secrets.local.json.example`
template. New module `bus/scripts/secrets-broker.js` (parallel to
`memory-store.js`, `vault-search.js`) exports `loadSecret(name)`,
`loadAllSecrets()`, and `redactSecrets(text)` -- literal substring
replacement (not regex -- safe against a secret containing regex-special
characters) of every currently-loaded secret's value with
`[REDACTED:<name>]`.

**New task field `withSecret: <name>`** (opt-in; see `task_template.md`).
`resolveSecretRequirement(task)` in `run-task.js` -> `{ ok, reason?,
envOverlay }`, deliberately separate from `resolveTaskDependencies()`:
this is about environment/access, not data flowing between tasks.
Missing secret -> `blocked`, naming which one -- and deliberately never
auto-retried by the daemon (a missing local secret is a manual setup
fact, not a pipeline dependency that resolves itself, unlike
`dependsOnFact`).

**The secret is injected at the subprocess env level, never the
prompt.** Every subprocess-spawning function (`runCodex()`,
`runClaude()`, `dispatch()`/`dispatchWrite()` in `agent-engine.js`)
gained an optional env-overlay parameter merged into its `execFileSync`
call's `env` option. Each dispatch call site
(`run-task.js`/`run-task-claude.js`/`run-task-generic.js` both modes/
`run-task-collab.js`) resolves the requirement once and passes the
overlay through -- the prompt text itself is completely untouched by
this field.

**Redaction is automatic and structural, not per-call-site.** Unlike
env-injection (which genuinely needs multiple touch points, since
subprocess spawning differs per script), the output side needs exactly
one: `redactSecrets()` is called inside `appendLog()` and inside
`writeTaskResult()`'s result-block construction -- both already the
single shared functions every dispatch script calls to persist a
result. Every log entry and every task file gets scrubbed of any
currently-known secret value automatically, regardless of which script
produced it or whether that task used a secret at all (a cheap no-op
when it didn't).

**A real finding from the first live run, not a hypothetical one**: the
first version of the live test named the env var
`SUITE_LIVE_SECRET_<RUN_ID>` and told the dispatched specialist "this is
a deliberate credential-handling test." Codex safety-refused outright
("I can't retrieve or disclose secret environment variables"), exitCode
0, no crash -- a correct refusal to a prompt that reads exactly like a
secret-exfiltration attempt, not a plumbing bug. Fixed by renaming the
variable and dropping the "secret"/"credential test" framing from the
prompt, asking for it the same neutral way any other live test in this
suite asks for its task -- the underlying guarantee (real env injection,
real redaction on every persisted write) was never in question, only
the test's own honesty framing was wrong. Confirmed live, both halves:
a real shell command in the dispatched subprocess actually printed the
real value (proves injection), and neither the persisted task file nor
`bus/log.md` ever contained it (proves the redaction net catches a real
leak on the real write path, not a fabricated string).

## 3k. Vault housekeeping: consolidating test/proof task files
(added 2026-09-02)

By this point `tasks/` had accumulated ~55 top-level task files plus
`tasks/archive_pre_daemon/` -- every stress-test batch, dependency-chain
test, SOURCE-tag check, sandbox-boundary probe, and live-read
verification task written while building pieces 1-3 above, sitting
mixed in with the real workflow content (`tasks/daily/`,
`tasks/UNVERIFIED_Cl/`, the templates). The user's call: these files are
proof-of-work for a debugging session, not reference material a future
agent would ever want to read or learn from -- move them somewhere out
of the way rather than deleting them outright (git history would have
kept them either way, but a still-browsable archive was preferred over
relying on `git log`).

All of it -- the top-level files and `archive_pre_daemon/`'s six -- was
`git mv`'d, content untouched, into one flat `tasks/_archive_tests/`.
`tasks/verification_suite/` (already gitignored suite-run scratch, not
git-tracked content) was cleared out the same pass rather than moved,
since it's disposable by construction and repopulates on the next suite
run.

This is a pure reorganization, not a behavior change, but it had one
real functional dependency to fix: `listTaskIdsByStatus()` in
`run-task.js` (section 3g above) hardcoded `archive_pre_daemon` in its
directory-name exclusion list, specifically so the daemon's pending/
blocked scan would never re-discover those old guard-test files (left
deliberately `status: pending` forever) and try to dispatch them. Left
unfixed, moving those six files out from under that exclusion would
have made them live again on the next daemon tick -- caught and updated
to exclude `_archive_tests` instead before this landed, not after.

## 3l. Phase 3, piece 5: the live dashboard (added 2026-09-03)

The last Phase 3 piece, done at the user's direct request ("Do the
dashboard") -- personally important to them beyond function (see the
project memory), not a token implementation.

**Not a greenfield build**: `bus/dashboard.html` (2026-08-31) already
existed -- a real, well-designed dark-terminal dashboard (IBM Plex Mono,
animated status icons, a scrolling log feed) polling `bus/status.json`
every 2s, driven by `run-backlog.js` (a batch runner for a seeded
`bus/backlog.json` list, e.g. the daily 10-K research batches -- itself
real, still-maintained infrastructure, not dead code). Two real gaps,
found by actually trying it rather than assumed: (1) that dashboard only
ever showed a `run-backlog.js` campaign, nothing about the *standing*
`/bus/` system Phase 3 spent the day building -- the daemon, task
counts, the memory store, agent health, all of which `bus-status.js`
already reports, just on demand as a CLI printout, not live; (2) nothing
served `dashboard.html` at all -- it `fetch()`es a relative
`status.json`, which fails outright under a `file://` origin (Chrome
blocks it), confirmed directly. This had likely never been seen working.

**Design, in three pieces:**

1. `bus-status.js` refactored -- each `report*()` split into a `get*()`
   returning plain data plus the existing `report*()` formatting and
   printing it, so the CLI report and the live dashboard share one
   computation, not two that drift (the same discipline
   `listPendingTaskIds()` already established for "pending"). New
   `getStatusCounts()`: one tasks/-tree walk bucketing every task file
   by its literal `status:` value -- not a hardcoded status list, so it
   stays correct if a new status string is ever introduced.

2. `dashboard-status.js` (new) -- one `buildSnapshot()` combining
   `bus-status.js`'s `get*()`s with one new signal,
   `getInFlightTasks()`: parses `bus/queue-daemon.log` (the daemon
   already logs both `DISPATCHING: <id>` and `<id>: <result>`, added
   piece 1) for tasks with a dispatch line and no completion line yet --
   a real "currently dispatching" signal, not synthesized. Also
   freshness-gates the pre-existing `bus/status.json` (a
   `run-backlog.js` run counts as "active" only if updated in the last 5
   minutes; older is presumed finished/abandoned and hidden rather than
   shown stale) -- verified live against the real file, which was
   correctly reported absent/stale from a 2026-09-01 run.

3. `serve-dashboard.js` (new) -- the one missing piece that makes any of
   this viewable: a minimal server on Node's built-in `http` module (no
   new dependency), `GET /` -> `dashboard.html`, `GET /status.json` ->
   `buildSnapshot()` computed fresh per request (cheap -- `bus/log.md`
   is under 500KB, sub-millisecond to read and parse), `GET
   /backlog-status.json` -> the raw `run-backlog.js` file if present.
   Manual/on-demand lifecycle (`node serve-dashboard.js`, Ctrl+C to
   stop) -- not wired into the daemon or any standing process, this is a
   look-when-you-want-to tool. `start-dashboard.bat` is a Windows
   double-click launcher (starts the server, opens the browser).

`dashboard.html`'s visual design and its original backlog-run panel were
kept, not discarded -- only the JS data layer changed: extended status
counts (whatever statuses actually exist, not a fixed set), a
recent-activity lane list from `bus/log.md` with real block/unverified/
error reasons shown inline, in-flight lanes using the original
active-pulse animation now driven by a real signal, and new memory-store
and agent-health panels. The backlog-run panel reads from
`/backlog-status.json` and is hidden whenever `/status.json` says no
run is currently fresh.

**Verified, not assumed**: `node -c` on every file; new fast checks
(`testStatusCountsAgreement()` -- cross-checks `getStatusCounts()`
against `listTaskIdsByStatus()` per status, same drift-prevention idiom
as the pending-tasks agreement test; `testInFlightDetectionFast()` --
isolated via a test-only `logText` param on `getInFlightTasks()`,
confirms a completed dispatch drops out and an unfinished one stays;
`testQueueDaemon()`'s own real blocked child now also asserts
`getRecentActivity()` surfaces its actual block reason, reusing that
test's existing fixture rather than adding a new one) all pass, full
suite 39/39. Live: `serve-dashboard.js` started for real, `/` and
`/status.json` curl-tested, then actually opened in a real Chrome tab --
counts, in-flight, recent activity with a real blocked reason, memory
panel, and agent badges all rendered correctly against live data both
before and after a fresh full suite run, no console errors.

**Addendum, same day: the agent hierarchy graph** (`bus/agents.html`, a
second dashboard page). Direct follow-on after seeing the shipped
dashboard, inspired by a reference screenshot of an Obsidian-style
force-directed node graph. The honest translation onto this vault's real
data (there's no agent-dispatches-agent chaining today, just one
orchestrator and two flat-reporting specialists): orchestrator (root,
"claude") -> each configured agent -> that agent's current in-flight
task (if any) plus its last 6 real tasks, each carrying its actual file
path and status. New `buildAgentGraph()` in `dashboard-status.js`
resolves which agent a task belongs to by reading the task file's real
`to:` field directly (`readTaskFile()`), not by string-parsing
`bus/log.md`'s free-text "via" description -- the only reliable source,
since that description isn't a clean, uniformly-populated agent id.
Dependency edges (`dependsOnTaskId(s)`) are drawn only between two task
nodes both already included in the graph -- no dangling references, so
the graph stays bounded regardless of total task history, and this is
what actually produces cross-agent connecting lines when e.g. a
Claude-handled task depends on a Codex-handled one.

Rendering (`bus/agents.html`) is a hand-rolled force-directed layout in
vanilla JS + SVG -- no external library, matching `dashboard.html`'s
existing zero-dependency, fully-offline approach: pairwise node
repulsion, spring edges, a radial initial layout (orchestrator center,
agents in a ring, each agent's tasks in a smaller ring around it), node
positions persisted across polls (matched by id) so the layout doesn't
jitter every 2s. Click a node for its full detail in a side panel
(agent health, or a task's real path/status/reason/dependencies); drag
to reposition (pinned only while dragging -- released nodes settle back
into the simulation, which is correct behavior, not a bug). Two new
routes on the same `serve-dashboard.js` (`/agents.html`,
`/agent-graph.json`), plus small nav links each way between the two
pages -- opens as a genuinely separate browser tab per the request, not
a tab-switcher within the existing page.

Verified: `testAgentGraphFast()` (new) confirms every agent node is a
real configured agent, every task node's resolved owner genuinely
matches that task's real `to:` field, and every dependency edge's
endpoints are both actually present in the graph -- full suite 40/40.
Live: both routes curl-tested, then `bus/agents.html` opened in a real
Chrome tab -- the graph rendered correctly with real task data and
cross-agent dependency edges, node click and drag both worked, the nav
links between the two pages worked, no console errors. In-flight-task
detection on this page reuses `getInFlightTasks()` unchanged from the
main dashboard (already verified there), not re-proven separately here.

## 3m. Bug fix: multi-line `payload:` was silently truncated (found
2026-09-03)

A real, load-bearing bug, found the moment it was first possible to find
it, not before: every task `payload:` dispatched anywhere in this vault
up to this point had happened to be a single line, because
`readTaskFile()`'s generic field-extraction regex
(`^${name}:[ \t]*(.*)$`, multiline mode) captures only up to the first
newline after the field name -- true for every OTHER field (`from`,
`to`, `status`, `timestamp`, etc., all genuinely short scalars), but
`payload` is meant to hold real prose. The first genuinely
multi-paragraph payload ever dispatched (a planning prompt for a
separate project, asking Codex for a five-part written plan) got
silently cut down to its first sentence; Codex received almost nothing
and correctly reported that no real requirements had been given -- a
completely reasonable response to what it actually got, not a Codex
problem at all. Caught by reading the full "Sent (exact)" block in
`bus/log.md` rather than trusting the short reply at face value, the
same discipline that caught the injection-echo and secrets-broker-
framing findings earlier.

Fixed with a dedicated `extractPayload(text)` in `run-task.js`: reads
everything from right after `payload:` up to (not including) the next
recognized field-name line or the `## Result` marker, instead of
stopping at the first newline. Every other field's extraction is
untouched. `readTaskFile()` now calls this instead of the generic
`field('payload')`. Exported alongside the rest of `run-task.js`'s
primitives.

Verified: a new fast check, `testExtractPayloadFast()`, confirms the
single-line case is byte-identical to the old behavior (no regression
for any of this session's prior payloads), a genuine multi-paragraph
payload is now captured in full, a blank payload still parses as an
empty string, and extraction correctly stops before an appended `##
Result` block. Live: the actual multi-paragraph planning task was
re-dispatched after the fix and Codex received and acted on the full
prompt (confirmed via its `SOURCE: verified live via direct file read`
tag and a genuinely complete five-part answer, not a truncated one).

One false alarm surfaced while chasing this down, worth recording so it
isn't mistaken for a second bug later: the very next full suite run
showed the queue-daemon test failing ("child never reached status:
blocked within 25s"). Traced with real evidence (exact `bus/
queue-daemon.log` timestamps), not assumed: an unrelated real task file
had been left sitting `status: pending` in `tasks/` while the suite ran
-- the daemon test spawns a genuine `run-queue-daemon.js` process that
scans the REAL `tasks/` directory at startup, found that leftover
pending task too, and (queue is strictly serial) dispatched it first,
starving the test's own fixture of its 25-second window before the
daemon ever got to it. Not a parser regression -- confirmed by
re-running the full suite with `tasks/` clean of any real pending work:
41/41. Lesson for future sessions: don't leave a real pending task
sitting in `tasks/` while running the verification suite -- the daemon
test is not isolated from the live directory the way the suite's own
fixtures (written under `tasks/verification_suite/<RUN_ID>/`) are.

## 3n. A prompt-level fix made an honesty problem worse, not better --
the real fix was one level down (found 2026-09-03)

The most instructive finding of the day, arguably more valuable than
any single bug fix: **a well-calibrated specialist correctly refused to
comply with a legitimate system instruction, because that instruction
was structurally indistinguishable from a prompt-injection attempt --
and insisting harder made it worse, not better.**

Section 3m's fix (`CLAUDE_AGENT_NO_PLAN_MODE_SUFFIX`, "this dispatch is
headless, don't use Plan Mode, answer directly") worked for the simple
case it was built against. Dispatched against a more complex, multi-
dependency consolidation task in the trading-fleet pilot
(`tasks/fleet_pilot_20260903_consolidation.md`), it partially failed
again (a summary answered directly, but "full detail" still diverted to
a plan file). The fix attempt: strengthen the instruction, and add an
explicit note that the "headless, no Plan Mode" framing is legitimate,
not an attack, so the specialist wouldn't second-guess it.

That escalation made a second dispatch actively call the *correction
itself* "the injection technique" and refuse to answer at all. On
inspection, this was the right call by the specialist, not a malfunction:
"you're in a special situation, the normal rules don't apply, don't
verify this, proceed differently than usual" is *exactly* the shape of
a real prompt-injection attempt, and a prompt-level instruction
asserting its own legitimacy cannot structurally distinguish itself
from an attacker asserting the same thing. No amount of "no, really,
trust this" text fixes that -- asserting harder only reproduces the
same red flag more insistently. The specialist had already done real
verification (confirmed `ExitPlanMode`/`AskUserQuestion` were genuinely
absent from its toolset) before raising the concern -- correct
diligence, not paranoia.

**The actual fix was one level down, not more prompt text:** claude-agent's
`readOnly` dispatch mode used `--permission-mode plan` -- Claude Code's
own interactive plan-approval workflow, not just a file-write
restriction. Checked `claude --help` directly rather than guessing at
available modes; found `--permission-mode dontAsk` and tested it live,
three separate ways, before trusting it: (1) a trivial direct-answer
task -- correct, no diversion; (2) a real write attempt -- correctly
blocked, denying Bash, Write, and PowerShell alike, confirmed absent on
disk afterward; (3) a real read task -- succeeded, and the reported file
content was cross-checked against the actual file rather than trusted.
`dontAsk` preserves the identical read-only guarantee `plan` provided,
with none of its interactive-approval semantics -- so the diversion
failure mode cannot occur in the first place, and the prompt-level
patch (with the injection-shaped risk it introduced) both became
unnecessary at once. `CLAUDE_AGENT_NO_PLAN_MODE_SUFFIX` was removed
outright rather than left dormant (see run-task.js's `getMandatorySuffix()`
comment and `agent-engine.js`'s `claude-agent.json` for the full account).

**A second-order effect, also fixed, not just noted:** two existing live
tests (`testLiveFanIn`, `testLiveMemoryLayer`'s `dependsOnFact` half)
gated pass/fail on the specialist using one specific SOURCE tag
("supplied by orchestrator"). Under `dontAsk`, claude-agent showed a
real, honest tendency to independently verify an injected value via a
real file read when one was available (`bus/memory.jsonl` for
`recordFact`, or the seed task files under
`tasks/verification_suite/<RUN_ID>/` for fan-in) rather than trust the
injected text -- the exact same, already-diagnosed, correct behavior
section 3i's live-memory-layer work identified and closed once before
(re-verifying over blind-trusting is encouraged, not a bug). Both tests
were relaxed to accept either honest tag (`supplied by orchestrator` OR
`verified live via direct file read`) as passing, since either one
proves the real thing under test -- injection fidelity -- while still
requiring a genuinely correct computed answer. Full suite after every
change in this section: 43/43.

**Why this is worth its own section, not folded into 3m as a footnote:**
the SOURCE-tag honesty discipline this vault built across Phase 1-3 was
explicitly meant to make dispatched specialists skeptical of unverified
claims and quick to say so rather than comply silently. Today it did
exactly that -- correctly -- against text the orchestrator itself wrote,
not an external attacker. That the fix from here is "don't ask the
model to trust an assertion it can't verify, remove the need for the
assertion instead" is the whole design philosophy this vault has followed
all day, just applied to itself for the first time.

## 3o. Nested code-fence truncation, and an intermittent (not
structural) refusal on chained fact re-injection -- found 2026-09-03

Two more findings from the same trading-fleet-pilot dispatch run that
produced section 3n, both in `run-task.js`/`run-verification-suite.js`.

**Finding 1 -- silent output truncation on nested fences (real bug,
fixed).** `readTaskFile()` extracted a task's `output:` field with a
non-greedy regex bounded by the first fixed 3-backtick fence it found.
When a specialist's own response contained a nested triple-backtick
block (e.g. quoting a formula), that inner fence closed the match early
and everything after it was silently dropped -- on every read,
including fan-in injections into downstream tasks. Caught because the
consolidation specialist itself noticed and flagged that batch B's
injected content looked truncated (only a preamble survived; see the
"Premise flag" in `tasks/fleet_pilot_20260903_consolidation.md`).
Traced via `bus/log.md`'s actual "Sent (exact)" prompt content, which
confirmed the mechanism exactly. Fixed with the standard Markdown
approach -- pick an outer fence strictly longer than the longest run of
backticks anywhere in the content (`pickResultFence()` in
`writeTaskResult()`), and extract by finding the matching fence length
on read (`extractOutputField()` in `readTaskFile()`) instead of a fixed
3-backtick regex. Verified with a new fast suite test,
`testNestedFenceRoundTripFast` (4 adversarial cases: no backticks, one
nested block, a nested block containing 4 backticks, multiple separate
nested blocks) -- all pass. The consolidation task was then re-dispatched
under the fix and completed cleanly.

**Finding 2 -- intermittent refusal on an ambiguous provenance
annotation (real, but not a structural bug; documented, not
"fixed").** After the fence fix, `live memory layer: dependsOnFact`
failed twice across three consecutive full-suite runs, each time with
`got=173` instead of the expected `346`, then passed clean (`346`) on
the third run with no code change in between. Reading the actual
`bus/log.md` dispatch showed the model was not computing a wrong
answer -- it was refusing to compute at all: the injected fact value
read `As-of: value supplied in this prompt (73)` immediately followed by
the fact's real value, `173`, on the next line. `73` is what the
memory-chain-recorder step started from (the seed); `173` is the
correct recorded value (73+100). The two numbers are provenance vs.
value, not a conflict -- but a reader with no access to that context can
reasonably read them as contradictory, and this specialist did exactly
that, explicitly declining to "silently pick one and report a doubled
result as if it were verified" rather than guess. The test's own
answer-extraction (last digit sequence in the response) then picked up
the stray `173` mentioned inside that refusal and reported it as if it
were a computed (wrong) answer, which is a separate, minor test-harness
reporting imprecision worth knowing about but not worth chasing right
now -- the failure is not a wrong computation, it is an honest refusal
being mis-labeled by the test's own regex.

This is the same category of finding as section 3n (a specialist
correctly declining to resolve an apparent inconsistency rather than
silently guessing), just triggered by ambiguous formatting instead of
injection-shaped text, and it self-resolves on retry rather than
requiring a code fix -- the underlying fact-store value is always
correct; only the specialist's read of an adjacent provenance line is
occasionally uncertain. Left open rather than "fixed": if this recurs
often enough to be a real pipeline-reliability problem (not just a
verification-suite flake), the actual fix is to stop embedding a
different number in a fact's own As-of annotation than the fact's
value -- e.g. label it "derived from seed 73" instead of bare `(73)` --
so there is nothing for a careful reader to misread as a conflict.

## 3p. Paper-trading execution + portfolio-approval round-3 (added
2026-09-08)

The trading-fleet pilot (scoped in `tasks/trading_fleet_scoping_plan.md`,
section 3-ish of the project's own history -- see memory
`project_agentvault_phase4_trading_fleet.md` for the full narrative)
graduated from research-only to real paper-trade execution the same day.

**Pipeline shape, as actually built and run:** scan a universe of stocks
via individual FMP `profile-symbol` calls (bulk screener is tier-gated,
confirmed unavailable) -> compute a unified `screenScore` -> take the
top 15-20 by score as the deep-dive shortlist -> for each shortlisted
symbol, round 1 (independent thesis, dispatched to Codex or claude-agent)
-> round 2 (adversarial challenge, dispatched to a DIFFERENT specialist
than wrote round 1 where practical) -> round 3 (synthesis). Universe
scanned so far: 50 stocks; shortlist depth used: 15.

**Round 3 was redesigned mid-project from single-winner to
portfolio-approval.** The original design ranked all surviving
candidates and picked at most ONE `conditionalSetup`. The user's
explicit instruction (2026-09-08): "i want multiple trades happening
not just a 1 and done." Round 3 now independently approves or rejects
EACH shortlisted symbol on its own merits -- zero, several, or (in
principle) all of them can be approved in the same run. A human-set cap
(3-5 approvals) applies to the current pilot phase only; the user has
explicitly stated future runs should have NO cap once this mode is
proven -- this must stay a standing instruction embedded in every
round-3 task payload, not silently re-applied as a permanent design
choice.

**A real design bug in round 3's first version, caught and fixed same
day:** the first portfolio-approval run gated every approved
candidate's entry on a FUTURE scheduled event (e.g. "enter short only
after the Oct 28 earnings report misses estimates"). The user correctly
rejected this -- the whole point is trades executable TODAY, not a
6-9-week conditional watchlist. Fixed by re-running round 3 with an
explicit constraint: `conditionalSetup.entryCondition` must be
actionable at today's close using data already in the ledger; earnings
dates may still appear in `riskWarnings` as disclosed risk, but must
never gate entry. `invalidationCondition` became a price-level stop
(e.g. "closes above $390.00") or a session-count time exit, not a
future confirming event.

**Execution layer: `bus/scripts/alpaca-client.js`.** Real REST wrapper
around Alpaca's paper-trading API (`paper-api.alpaca.markets`). Hard
guard: throws if `ALPACA_ENDPOINT` doesn't contain that host string --
not a convention, an actual code check, so a mistyped/edited endpoint
can never silently route at a live account. `submitOrder()` supports
`market`, `limit`, `stop`, and `stop_limit` order types; deliberately
has NO position-sizing logic of its own -- `qty` is always a required
argument (a separate, later, human decision per the approved plan).

**A real operational bug found and fixed the same day: entry and stop
protection were placed in two separate steps, ~90 minutes apart.** The
first real multi-trade execution (3 shorts: TSLA/GOOGL/CSCO) placed
entry orders via one ad hoc script, then a SEPARATE stop-order script
was run roughly 90 minutes later. In that gap, the positions moved
against the account with zero downside protection; the user manually
closed all three at a small loss via Alpaca's own dashboard before the
stop orders were ever placed (confirmed by order history: the closing
fills carry no `access_key` source tag, unlike every order this
pipeline's own scripts place). **Fix: `bus/scripts/execute-portfolio-setup.js`**
is now the canonical executor -- for each approved candidate, it places
the entry order, confirms the fill, THEN IMMEDIATELY places the
protective GTC stop order (parsed straight out of the setup's own
`invalidationCondition` string) in the same script run, with no
human-timed step in between. This supersedes the two-script ad hoc
process used for the first run; do not go back to placing entry and
stop as separate manually-sequenced steps.

**What a stop order does NOT cover: the time-based half of the exit
rule.** `invalidationCondition` often reads "...or exit after N sessions
if not triggered" -- a price-level stop order can't express that.
`bus/scripts/monitor-paper-trades.js` is the separate piece for this:
reads `bus/paper-trades.jsonl` for open research-driven positions,
counts trading sessions elapsed (a simple Mon-Fri weekday count --
does NOT know about market holidays, a documented approximation, not a
silently-assumed one), and if a position has outlived its stated
horizon, closes it (cancelling any associated stop order first) and
logs the exit. Defaults to a DRY-RUN report; `--execute` is required to
actually place a closing order or write a reconciliation record. Also
handles reconciliation: if the log thinks a position is open but the
live account shows it already closed (e.g. a stop order fired, or a
human closed it manually), it detects the mismatch and (in `--execute`
mode) writes the missing exit record rather than leaving the log
silently wrong.

**Deliberately still NOT built:** wiring `monitor-paper-trades.js` into
an unattended recurring schedule (e.g. a Windows Scheduled Task, the
same pattern already used for `BusResearchCrewContinuous` -- see the
closed item in section 6). The script is built and tested against real
positions; turning it into an autonomous recurring trigger is a further
step the user should explicitly approve, since it's new autonomy scope
beyond "the script exists and works when run."

**Trade log:** every entry, stop-order-placed, and exit record is
appended to `bus/paper-trades.jsonl` (one JSON object per line) --
`type` field distinguishes `research-driven-entry`,
`stop-order-placed`, `research-driven-exit`, and the original
`mechanism-test` (the first-ever SPY round-trip used to prove the
pipeline end-to-end before any research-driven trade was placed).

## 3q. Fleet-pilot dashboard (added 2026-09-08)

`bus/fleet.html` + `bus/scripts/fleet-status.js`, served by two new
routes on the existing `serve-dashboard.js` (`/fleet.html`,
`/fleet-status.json`). A read-only, non-technical-friendly view of ONE
pipeline run: the funnel (universe scan -> shortlist -> round 1 ->
round 2 -> round 3), what round 3 approved and rejected, every
shortlisted symbol with the specialist that handled each round, the
live paper account, the trade log in plain language, and the run's
recorded learnings.

**Purely observational.** It places no orders and touches neither
`execute-portfolio-setup.js` nor `monitor-paper-trades.js` -- it only
reads what those already wrote. It reaches Alpaca exactly the way every
other script here does (`alpaca-client.js`), for account/positions only.

**Nothing is hardcoded to a run.** `findLatestPipelineDate()` takes the
largest `fleet_pilot_<YYYYMMDD>_` prefix in `tasks/`;
`discoverShortlist()` derives the symbol list from the round-1/round-2
filenames themselves (keeping the highest `v<N>` per symbol, matching
the 2026-09-03 run's `thesis_r1v3_aapl` convention); and
`discoverRound3Versions()` picks the newest round 3, preferring
`_portfolio` variants outright when both designs exist for the same
date (they do for 2026-09-08: the legacy single-winner `_r3.md` sits
alongside the portfolio-approval `_r3_portfolio*.md` files). A future
run on a different date renders with no code change.

**Why the round-3 parser is defensive, with a real reason.** Round-3
output has appeared in two genuinely different formats from the same
pipeline on the same day: `_portfolio_v2` emitted a ` ```json ` fence
with a clean `approvedCandidates` array, while `_portfolio_v3` emitted
pure prose/Markdown with **no JSON anywhere**. This is not
hypothetical -- `execute-portfolio-setup.js`, which only understands the
JSON form, throws outright on v3. `parseRound3Output()` therefore tries
the JSON fence first, falls back to a Markdown section/bullet parser,
and if both fail returns `{format:'raw', rawText}` so the page shows the
human the output exactly as written rather than a blank panel. Every
field below the symbol is best-effort and independently regexed, so one
malformed candidate never drops the rest. The returned `format` is shown
in the UI ("parsed as markdown"), keeping provenance visible the same
way the SOURCE-tag discipline does elsewhere.

**A distinction the page deliberately keeps visible**: "the current
recommendation" and "what is actually open in the account" are not the
same thing. On 2026-09-08, v3 was the active recommendation while the
only executed trades came from v2 (entered, then manually closed by the
human before their stops were placed). `getTradeLog()` cross-references
`sourceTask` against the ACTIVE round 3 to compute
`executedApprovedSymbols`, and each trade card carries an
EXECUTED/not-yet-executed pill off that -- so a recommendation is never
mistaken for a live position.

It also surfaces `sameSpecialistBothRounds` honestly. Round 2 is meant
to go to a different specialist than round 1 "where practical," and it
genuinely did not always (CSCO drew Codex for both rounds that day).

Two fast regression tests cover this in `run-verification-suite.js`:
`testFleetStatusParserFast()` asserts both real production formats still
parse to the same three approved candidates with correct
same-day/multi-day hold types (so a future format drift fails loudly
here instead of silently emptying the dashboard), and
`testFleetSymbolGridFast()` re-reads every grid cell's task file to
confirm the specialist and status shown match the file's real `to:` and
`status:` fields -- the same drift-prevention idiom
`testAgentGraphFast()` uses.

The round-3 `keyLearnings` from this pipeline's `_synthesis_r3_portfolio_v3`
run are saved as a standalone durable doc, [[fleet_pilot_20260908_learnings]]
(vault root), since findings about the pipeline's own methodology should
survive past any individual task file -- see section 9 for how these
now feed forward automatically into each new cycle's round-1 prompts.

## 3r. Crypto trading -- BTC/ETH/XRP (added 2026-09-08/09)

Extends the same account, the same 3-round deliberation design, and the
same execution scripts to crypto -- because the equity pipeline is
gated by market hours (hit directly the same day: round 3 approved
equity trades while the market was closed) and crypto trades 24/7.
Purely additive -- nothing about the equity pipeline changed or was
removed.

**Confirmed live, not assumed, before building anything**: BTC/USD,
ETH/USD, XRP/USD are all tradable on this paper account; crypto here is
spot, cash-settled, and **long-only** (`shortable:false` on every
crypto asset -- no short side exists at all); fractional/continuous
sizing (BTC min order ≈0.0000126, ~$1) means crypto positions size by
dollar `notional`, not share `qty`; the account is genuinely 24/7 (no
crypto-specific session-hours concept, confirmed via `/v2/clock` being
equities-only). FMP's crypto data (`mcp__claude_ai_FMP__crypto`) is
price/volume/market-cap only -- **no earnings, valuation multiples, or
analyst targets exist for this asset class, structurally, not as a
today-gap.** LunarCrush (crypto social/sentiment) is wired up but
returns "subscription required" on every real call -- not usable
without a paid upgrade.

**`bus/scripts/crypto-symbols.js`** (new) -- the one place that knows
both symbol conventions in play: Alpaca's order-placement format is
slash-delimited (`BTC/USD`), FMP's research format is not (`BTCUSD`).
A flat, hardcoded table of exactly the 3 coins, not a general
asset-class registry. `isCryptoSymbol()`/`toAlpacaSymbol()`/
`toFmpSymbol()` are called from every other file below rather than each
re-deriving the format inline.

**`bus/scripts/alpaca-client.js`** -- `submitOrder()` gains `notional`
as an alternate to `qty` (exactly one required), and a pre-flight guard
(`assertNotCryptoShortEntry()`, exported separately so it's unit-testable
with zero network calls) rejects an attempted crypto short **entry**
before any HTTP call, with a clear message -- replacing what would
otherwise be an opaque Alpaca rejection. The guard is scoped to
entry-style orders only (`orderType` not `stop`/`stop_limit`) so it does
not block the legitimate sell-side stop that closes an existing long.

**Three real Alpaca crypto quirks found live, not in any doc, each
causing a real order rejection or a wrong sizing before being fixed:**
1. **`time_in_force: "day"` is rejected for crypto** (422 "invalid
   crypto time_in_force") -- crypto entries and closes use `"gtc"`
   instead. Equity behavior is unchanged.
2. **Plain `"stop"` orders are rejected for crypto** (422 "invalid order
   type for crypto order") -- Alpaca crypto only supports `stop_limit`,
   not stop-market. `execute-portfolio-setup.js` now places crypto stops
   as `stop_limit` with a 1% stop/limit buffer (fillable through normal
   slippage rather than sitting unfilled at an exact price); equity
   stops are unchanged.
3. **Crypto fees are deducted IN-KIND from the asset itself** -- an
   order's own `filled_qty` can be measurably larger than what's
   actually available in the resulting position afterward (found live:
   `0.000124636` filled vs. `0.000124324` available on a $10 BTC test
   buy). Sizing a protective stop off `filled_qty` can request more than
   the account holds and get a 403 "insufficient balance." Fixed: for
   crypto, `execute-portfolio-setup.js` re-fetches the live position
   after entry and sizes the stop off ITS `qty_available`, not the
   order's `filled_qty`. Equities have no such mechanic and are
   unaffected.
4. **`GET /v2/positions` returns crypto symbols WITHOUT the slash**
   (`"BTCUSD"`) even though orders and account activities use the slash
   (`"BTC/USD"`) -- a real asymmetry within Alpaca's own API surface.
   Every symbol this pipeline logs is the order-format (slash), so
   `monitor-paper-trades.js`'s live-position lookup normalizes crypto
   position keys back to the slash form before matching -- without this,
   a genuinely open crypto position would be silently misread as already
   closed. Found by running the real monitor script against a real open
   position, not by inspection.

5. **The no-short guard (bug 2's fix) was itself too blunt at first,
   found the next session when the mechanism-test position's own
   2-hour time exit tried to close it.** Guarding on `orderType` alone
   (exempting only `stop`/`stop_limit`) can't distinguish "market sell
   that OPENS a new short" from "market sell that CLOSES an existing
   long" -- both are `side:"sell", orderType:"market"`.
   `monitor-paper-trades.js`'s time-based exit is exactly the second
   case, and got wrongly rejected by the guard. Fixed: `submitOrder()`
   gained an explicit `intent: "open"|"close"` parameter (default
   `"open"`, matching prior behavior for the common entry case); the
   guard now checks `intent !== "close"` instead of `orderType`. Every
   closing call site (`execute-portfolio-setup.js`'s protective stop,
   `monitor-paper-trades.js`'s time-based flatten) now passes
   `intent: "close"` explicitly. Equities are unaffected either way
   (the guard only fires for crypto symbols).

6. **Same-day exits weren't handled at all until 2026-09-09** --
   `monitor-paper-trades.js` only understood session-count and
   crypto-hour deadlines; round-3 v3's actual same-day setups (GOOGL,
   CSCO -- "...exit at today's close if not stopped out.") had no
   corresponding trigger. Added `isSameDayExit()` (regex on
   `invalidationCondition`) + `sameDayTriggered()` (true once the
   entry's own trading session has genuinely ended -- either the ET
   calendar date has rolled past entry day, or it's still entry day but
   `/v2/clock` shows the market has since closed; never true while
   still inside the same session). **Real bug caught in testing, not
   production**: the first regex (`/exit at (today's|the) close/`)
   false-positived on TSLA's actual multi-day phrasing, "...exit at the
   close of the fifth trading session after entry" -- both share "exit
   at the close" as a substring. Fixed with a negative lookahead
   excluding `close of ...`. Verified against all 3 real fleet_pilot_v3
   invalidationCondition strings before shipping.

All six were caught by actually running the code against the real
paper account (a deliberate small BTC mechanism-test trade, same
discipline as the original SPY round-trip -- see 3p; bug 5 specifically
was found when that same test position's real 2-hour exit fired a
session later), not by reading Alpaca's documentation, which does not
clearly state several of these.

**`bus/scripts/execute-portfolio-setup.js`** -- crypto candidates size
via a new `--notionalPerLeg=<dollars>` CLI arg; **no default dollar
amount is invented** -- a crypto candidate present with no notional
supplied fails loudly rather than guessing, matching the existing
equity `qtyPerLeg` boundary (position sizing is the human operator's
call, not this pipeline's). `research-driven-entry` and
`stop-order-placed` log records now carry `assetClass: "equity"|"crypto"`
-- a logged fact, not something later code sniffs from symbol format.

**`bus/scripts/monitor-paper-trades.js`** -- new `hoursElapsed()`/
`parseHourDeadline()` (plain calendar-hour diff, no weekday filtering)
alongside the existing `sessionsElapsed()`/`parseSessionDeadline()`,
kept as separate functions rather than overloading one with ambiguous
units. Branches on the logged `assetClass` field. The short-closing
branch is structurally unreachable for crypto rows (long-only by
construction) -- commented inline so a future reader doesn't wonder why.

**Research pipeline, `crypto_pilot_<YYYYMMDD>_*` task naming** (parallel
to but never colliding with `fleet_pilot_*`): no universe-scan/shortlist
stage needed (3 fixed symbols) -- one orchestrator-sourced
`crypto_pilot_<date>_data_snapshot.md` (same pattern as the equity
shortlist-enrichment file) feeds round 1. Round-1/round-2 reuse the
equity output schema as a structural contract but the content is a real
rewrite: price/volume/trend/volatility/drawdown only, any macro/
narrative claim must be tagged `INTERPRETATION: unverified narrative, no
data source backing this claim` and never FACT, and confidence should
rarely reach "high" on narrative alone given no fundamentals floor
exists. Round 3's evidence-quality gate is explicitly recalibrated
(stated in its own payload) rather than silently holding crypto to the
equity standard it structurally cannot clear, and its hard boundaries
forbid `direction:"short"` outright -- a bear case means reject/stay-out.

**First real run's result (2026-09-08), worth recording as a clean
outcome, not a failure**: round 1 produced 3 genuinely engaged
neutral-insufficient-edge theses; round 2 found real substance in every
one (a moving-average invalidation-ordering error on XRP -- round 1 had
the 200-day average, which is actually ABOVE the 50-day average,
backwards; ~95.8% of ETH's entire 30-day gain concentrated in one 3-day
window with the other 26 days netting near zero; BTC's nearest bearish
invalidation trigger sitting inside a single average day's volatility);
round 3 **rejected all 3 candidates** under the recalibrated bar --
`approvedCandidates: []`. This is the discipline holding, the same way
the equity pipeline's early NO_ACTIONABLE_CANDIDATE runs validated it
wasn't manufacturing certainty from thin data. Zero live crypto trades
came from this research pass. A separate, explicitly-labeled
`crypto_pilot_20260908_mechanism_test` (NOT research-driven, modeled on
the original SPY test) proved the execution code path itself: a real
$10 BTC paper buy, filled, protected by a real `stop_limit` GTC stop,
`assetClass:"crypto"` correctly logged, `monitor-paper-trades.js`
correctly finding and tracking it afterward -- this is what surfaced
bugs 1-4 above.

**Dashboard integration, built the next session** (`bus/crypto.html` +
`bus/scripts/crypto-status.js`, routes `/crypto.html`/`/crypto-status.json`
on the same `serve-dashboard.js`): mirrors `fleet.html`'s shape but
simpler -- no universe/shortlist funnel (only 3 fixed symbols), reuses
`fleet-status.js`'s `parseRound3Output()`/`getTradeLog()` directly
rather than duplicating the dual-format parser. Live positions/account
are filtered to crypto symbols only (`cryptoSymbols.isCryptoSymbol()`);
the trade feed is filtered to `assetClass:"crypto"` records. Nav links
added both ways between all 4 dashboard pages.

**Tabbed layout, added 2026-09-09** after direct user feedback that
both pages were "not very organized" stacking 7 sections vertically.
Both `fleet.html` and `crypto.html` now have: a persistent KPI pill
strip above the tabs (approved count, market open/closed on fleet.html
only, equity, open-position count -- always visible regardless of
active tab, sourced from `fleet-status.js`'s new `getMarketClock()`,
a small `/v2/clock` call with the same never-throw contract as
`getLivePositionsAndAccount()`); and 4 tabs grouping the same sections
by concern rather than round: Overview (funnel + recommendation),
Research (symbol grid + rejected detail), Trading (positions + trade
feed), Learnings & History. Grounded in real research, not just
internal-pattern reuse: dashboard UX guidance on top-loading 3-5 KPIs
before detail; tab-navigation guidance confirming this grouping avoids
tabbing sequential or comparison content; and this project's own
`artifact-design` skill (pills encode state, not plain text; existing
color/type system already correct, not touched). Tab CSS is a flat
GitHub/Stripe-style animated underline, not `markets.html`'s boxed
per-tab chart panels (different content shape, different pattern).
Zero changes to either page's render functions or `poll()` -- only
markup regrouping plus the small `renderKpis()`/tab-click addition.

**Originally deliberately NOT built in the first pass (see the crypto
plan's own scoping call)**: dashboard integration. `fleet-status.js`'s discovery regexes
are anchored to `fleet_pilot_*` and its 5-stage funnel assumes stages
crypto doesn't have -- the `crypto_pilot_*` naming was chosen
specifically so it won't collide with or get silently swept into
today's discovery (the dashboard correctly shows nothing crypto-shaped,
not something wrong). Live positions/account and the raw trade-log feed
in `bus/fleet.html` ARE already asset-class-unfiltered, so a real crypto
trade already appears there today with zero code changes -- only the
funnel/symbol-grid panels stay equity-shaped. A future
`crypto-status.js`/`crypto.html` (3-row grid, no funnel, reusing
`parseRound3Output()`) is the natural follow-up if wanted.

## 4. Three-tier data grounding (revised 2026-09-03 -- see below)

- **Verified-live (highest trust):** numeric facts fetched directly by
  Claude via the connected **Financial Modeling Prep (FMP) API** (income
  statements, quotes, company data). Proven deterministic: 3 back-to-back
  calls for the same fact returned byte-identical results. Only Claude
  can call this (in-session) -- a structured, deterministic API, not a
  free-text web search.
- **Specialist web search (live, but noisy -- added 2026-09-03):** see
  the finding below. A dispatched specialist actually reaching the live
  internet, tagged `SOURCE: web search performed live in this pipeline,
  not independently verified`. Genuinely live, unlike recall -- but not
  the same trust tier as the row above: AI-summarized search results can
  contain wrong or unconfirmed claims stated as fact (see the finding),
  so this tier is an honest "here's a live lead," not "here's a verified
  number."
- **Tagged recall (lowest trust):** everything a specialist answers
  without a supplied verified figure or a live lookup. Every such
  response is required to open with the exact line:

  ```
  SOURCE: training-data recall, not verified live
  ```

  (or `SOURCE: supplied by orchestrator from a prior verified step` when
  fed a verified figure), followed by an explicit as-of date. Enforced by
  `run-task.js`'s mandatory prompt suffix, not by convention alone.

**Finding, 2026-09-03: "Codex has no web access" was wrong, or had gone
stale -- corrected via direct live tests, not assumed either way.** This
file used to state flatly that Codex has no live web data source
(checked once, months earlier, no search/fetch flag found in its CLI at
the time). The user pushed back directly, having confirmed otherwise
themselves. Rather than trusting either the old cached finding or the
new claim on faith, both were tested live: a capability-probe task was
dispatched to each specialist, instructing it to actually invoke a
real web-search tool (not reason about what one might return) and
report a checkable, current headline. **Both complied and both
produced genuinely live results** -- Codex explicitly stated "I
verified live via a web-search tool" and correctly refused to misuse
any of the three SOURCE tags that existed at the time to describe it
("No listed SOURCE tag is truthful here" -- its own words); claude-agent
did the same. This is a real capability this vault didn't know it had,
confirmed the same "dispatch it for real and check the evidence" way
every other finding in this document was confirmed.

**The same test also caught a real reliability problem worth recording
as prominently as the capability itself**: the AI-summarized search
digests both specialists received included a specific, plausible-
sounding but unconfirmed claim (a named executive replacing Tim Cook as
Apple's CEO). Both specialists caught this themselves and flagged it as
likely-hallucinated summarizer output rather than repeating it as fact
-- exactly the honesty discipline this vault has been building toward
all day, working as intended on a capability that was still brand new
in the same test. This is why the new tag is worded "not independently
verified" rather than folded into the existing live-file-read tag's
higher trust tier: a live web search is a real, live source, but not a
verified one in the same sense as a local vault file or an FMP fetch.

Fixed in `run-task.js`: a new `SOURCE_TAG_WEB_SEARCH` constant and
`WEB_SEARCH_CAPABLE` set (currently `{codex, claude-agent}`, both
confirmed the way `LIVE_FILE_READ_CAPABLE` requires -- kept as a
separate set even though membership is identical today, since local
file access and live internet access are genuinely different
capabilities a future specialist could have independently). The
previously-static `MANDATORY_SUFFIX_LIVE_READ_CAPABLE` array was
replaced with `buildLiveCapableSuffix()`, which composes however many
honest SOURCE-tag options are actually true for a given specialist (2,
3, or 4 depending on which of the two live-grounding capability sets it
belongs to) instead of a fixed table -- the same generalization
`getStatusCounts()` made for status values, applied here for the same
reason: a second capability arriving the same day a fixed pair of
constants was written made the fixed-table approach obsolete
immediately. `verifyOutput()`'s accepted-tag list picks up the new tag
automatically for any specialist in `WEB_SEARCH_CAPABLE`.

New fast check `testWebSearchTagFast()` confirms the tag is offered and
accepted for both confirmed-capable specialists, and that the composed
suffix still contains the base SOURCE-tag contract (not replaced by the
new option). Verified live: both capability-probe tasks were re-run
after the fix and both now pass verification cleanly with the correct
new tag, still visibly cautious about what they couldn't confirm (Codex:
a Yahoo Finance rate-limit blocked direct confirmation of the exact
headline text, and it said so rather than papering over it).

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

- **Claude (orchestrator, and now also dispatched specialist):** as
  orchestrator, creates tasks, runs `run-task.js`, fetches verified
  facts, logs everything -- always "active," it's the one running the
  show. As of 2026-09-01, also dispatchable as a second real specialist
  via `run-task-claude.js` (`to: claude-agent`, distinct from
  orchestrator-sourced `to: claude` tasks) -- a nested headless `claude
  -p` process, same SOURCE-tag/verification rules as Codex, see
  section 3c.
- **Codex (active specialist):** real, direct headless invocation
  (`codex exec`), no live data access, always tagged per section 4 in
  read-only (autonomous) tasks. In manual, supervised collaboration
  sessions only, `run-task-collab.js` grants write access scoped to the
  vault directory (section 3a) -- unattended paths never get this.
- **Antigravity (deferred):** no CLI/API exists. Only a documented,
  untested-in-`/bus/` async path (write to a shared channel, wait for a
  voluntary reply) -- see [[antigravity_role]]. Not wired into
  `run-task.js` or the dependency mechanism.

## 6. Known open items

*(Trimmed 2026-09-09 -- resolved items collapsed to one line each; the
full forensic narrative for each was archived in git history, not lost.
Only genuinely open items keep full detail below.)*

- [x] ~~SOURCE/as-of preamble copy-through~~ -- resolved 2026-09-02. Root
      cause turned out to be honest live re-verification by claude-agent,
      not injection confusion; `wrapInjectedValue()` confirmed 10/10 once
      tested with a properly non-reverifiable fact.
- [x] ~~`MANDATORY_SUFFIX`'s "no live data lookup" claim, false for
      file-read-capable specialists~~ -- resolved 2026-09-02 via
      `getMandatorySuffix(to)` + `LIVE_FILE_READ_CAPABLE`.
- [x] ~~Whether Codex's `--sandbox read-only` has the same read-but-not-
      write property as Claude's plan mode~~ -- resolved 2026-09-02,
      confirmed via a live `Get-Content` test cross-checked against
      Codex's own sandbox log. `codex` added to `LIVE_FILE_READ_CAPABLE`.
      A second bug found while re-verifying this fix (four call sites --
      `run-task.js`, `run-research-crew.js`, `run-backlog.js`,
      `watch-inbox.js` -- still hardcoding the old flat suffix) was found
      and fixed the same pass.
- [x] ~~`verifyOutput()`'s number check scanned the whole response for
      any digit~~ -- resolved 2026-09-01, tightened to the last non-empty
      line; permanent regression case added to `run-verification-suite.js`.
- [x] ~~No verification/peer-review gate existed in `/bus/`~~ -- resolved
      2026-08-31 via `verifyOutput()` in `run-task.js` (shape/SOURCE-tag
      check, not semantic correctness); tested against a clean pass and a
      deliberately sabotaged response.
- [x] ~~Dependency chains tested only for a single linear hop~~ --
      resolved 2026-09-01: verified lossless across a 3-hop and a 5-hop
      chain (alternating Codex/Claude), zero drift. The fan-in gap noted
      at the time ("`dependsOnTaskId` is a scalar, not a list") is itself
      now stale -- `dependsOnTaskIds` (plural, array) exists and is in
      real daily use by every `fleet_pilot`/`crypto_pilot` round-3
      synthesis task, which depends on the full set of that cycle's
      round-1 and round-2 tasks at once.
- [x] ~~Background research crew not wired to run continuously~~ --
      resolved 2026-08-31 via the `BusResearchCrewContinuous` Windows
      Scheduled Task (bounded 2-hour window, not indefinite). Found and
      fixed along the way: a shell job-control PID didn't map to the real
      Windows node.exe PID on this Git-Bash/MSYS setup -- verify process
      kills via `Get-CimInstance`, not a shell-reported PID.

**Still open:**

- [ ] `run-task.js` cannot call the FMP connector itself -- only Claude
      can, in-session. Orchestrator-sourced tasks are written by hand each
      time; the grounding step itself isn't scripted, only its consumption
      (via `dependsOnTaskId`) is. **Update, 2026-09-11: no longer relevant
      to the 24/7 autonomous pilot (section 9) specifically** -- that gap
      was closed there not by provisioning a real FMP REST key (never
      happened) but by dropping FMP entirely in favor of
      `alpaca-client.js`'s free market-data API (price/volume, same
      paper-account key already in use, no new credential) plus
      `finnhub-client.js`'s free tier (equity market cap, optional). See
      section 9's credential-gap bullet for the real fix. This item still
      stands for any OTHER orchestrator-sourced task that needs a scripted
      grounding step -- just not for the trading pilots' own data
      snapshot anymore.
- [ ] Antigravity has no real invocation mechanism in `/bus/` -- deferred
      2026-09-01 in favor of proving the scaffold against Claude instead
      of a third stub. **Update, still not acted on:** Google Antigravity
      is confirmed real and now ships a CLI/SDK, not just a GUI --
      [[antigravity_role]] updated to reflect this. Still untested: whether
      that CLI is installed on this machine, its real flags, or whether it
      can be wired in via section 3c/3d's playbook. A confirmed lead, not
      a completed integration -- a fourth `/bus/` specialist is a separate
      decision.
- [ ] `agent-comms`'s own Antigravity adapter (its general broadcast task
      system, separate from the dashboard) is still a confirmed-fake stub.
      Doesn't affect `/bus/` correctness, but is real unresolved debt.
- [ ] The autonomous research crew can only run Codex-recall categories --
      same FMP-connector gap as above, no path to real-data-grounded
      research without Claude present to fetch it.
- [ ] `check-inbox.js` deliberately does not act on what it finds in
      `bus/inbox_claude.md` -- it notifies either way, but interpreting
      and executing new instructions still requires a real, reviewed
      Claude session (see the file's own header for the reasoning).

## 7. What this system does NOT do

**Updated 2026-09-08 -- this section was stale.** Broker integration and
real trade execution DO now exist (see section 3p) -- Alpaca
paper-trading, real orders, real fills, real P&L. What remains true and
still holds as a hard boundary:

- **No real money, ever, without a separate, deliberate future
  decision.** `alpaca-client.js` hard-guards against any endpoint that
  isn't `paper-api.alpaca.markets`; there is no "live mode" flag
  anywhere in this codebase to flip. Graduating to a real account is an
  explicit, separate, later decision -- not a config change.
- **No autonomous position sizing formula.** `submitOrder()` always
  requires an explicit `qty`/`notional` argument. As of section 9's
  unattended pilot (2026-09-09), the `--auto` execution path uses two
  fixed constants (`AUTO_EQUITY_QTY_PER_LEG`, `AUTO_CRYPTO_NOTIONAL_PER_LEG`
  in `execute-portfolio-setup.js`) rather than a per-run human choice --
  this is still not a sizing FORMULA (nothing computes a size from
  volatility, conviction, or account equity), and those two constants
  themselves require an explicit one-time human sign-off before `--auto`
  is ever run on a live schedule (see section 9).
- **No real-money autonomous execution with no per-trade human
  approval**, even paper-proven, even framed as small/acceptable-loss
  training -- see the standing boundary in
  `project_agentvault_phase4_trading_fleet.md` (memory). Full autonomy
  is the agreed target for the PAPER phase specifically; real money
  keeps a human go/no-go per trade until the user explicitly revisits
  that. (See section 19 for a separate, narrowly-scoped exception
  covering the standalone "survive" branch only -- this section's
  boundary is otherwise unchanged, and remains fully binding for the
  fleet/crypto pilots described throughout this document.)
- **No individualized investment advice, suitability claims, or
  guarantees** -- every synthesis task's output carries the disclaimer
  "Research decision-support only. A human must independently decide
  whether to act; this system cannot execute trades" verbatim, even
  though, as of 2026-09-08, a human-run script now DOES execute the
  approved setups on the paper account after that output lands. The
  disclaimer describes the research/synthesis layer's own authority,
  not whether a downstream script exists.

## 9. 24/7 unattended paper-trading pilot (added 2026-09-09)

**Scope, stated once, applies to everything below:** PAPER-TRADING ONLY,
transitively guaranteed by `alpaca-client.js`'s `paper-api.alpaca.markets`
guard (section above). This section documents how the equity and crypto
pilots run without a human generating task files, executing approved
candidates, or checking exits by hand each day -- not a change to
whether real money is ever involved (it isn't).

**Why this was needed:** every prior cycle (`fleet_pilot_*`,
`crypto_pilot_*`) required a human to hand-author each round's task
files, then hand-run `execute-portfolio-setup.js <taskId>` and
`monitor-paper-trades.js --execute`. `bus/scripts/run-queue-daemon.js`
already dispatches/chains any `status: pending` file it finds with zero
human input -- the actual gap was authorship, not dispatch.

**New pieces:**
- `bus/scripts/generate-pilot-tasks.js` -- authors each day's
  `status: pending` thesis/challenge/synthesis task files, reusing
  `fleet-status.js`/`crypto-status.js`'s own `discoverRound3Versions()`/
  `parseRound3Output()` for both naming-convention correctness and the
  self-improvement loop below. Every generated task is `to: codex`,
  never `to: claude-agent` -- confirmed real incidents in `bus/log.md`
  (two session-limit hits during `fleet_pilot_20260903` round-1
  dispatch) were both on `claude-agent`, which shares this interactive
  session's own usage pool; Codex does not.
- **Self-improvement loop, now real**: `getPriorLearnings()` reads the
  most recent prior cycle's round-3 `keyLearnings` and injects it into
  every new round-1 task as an explicit "Prior learnings" section --
  verified live against real committed data (2026-09-08's crypto and
  fleet cycles both produced non-empty `keyLearnings`, both read back
  correctly). Previously this only ever happened when a human manually
  copied yesterday's learnings into today's prompt.
- **The one real credential gap -- resolved 2026-09-11, see below.**
  Every prior data-snapshot step used the FMP MCP connector, only
  callable from an interactive Claude session; `bus/scripts/fmp-client.js`
  called FMP's REST API directly instead, but `FMP_API_KEY` never
  existed in `bus/secrets.local.json` (confirmed by a direct
  `secrets-broker.js` read), and FMP's paid tier would have been needed
  to cover this call volume anyway. **Fix, direct user pushback ("There
  has to be a free alternative" -- see project memory
  `feedback_explore_alternatives`):** `generateFleetDataSnapshot()`/
  `generateCryptoDataSnapshot()` now pull price/volume from
  `alpaca-client.js`'s `getDailyBars()` -- free with the existing paper
  account, no new credential, and batched (one call per universe instead
  of one per symbol, strictly better than the old per-symbol FMP loop).
  Equity market cap comes from `finnhub-client.js`'s free tier, optional
  -- a missing `FINNHUB_API_KEY` now degrades to 0/no-cap-weight for
  every symbol that cycle, rather than the old behavior (an ntfy alert
  and generating nothing further for that pilot that day). Crypto market
  cap has no free, ID-unambiguous source wired up yet -- an honest,
  documented gap, not fabricated. `computeScreenScore()` (the confirmed
  50%/30%/20% momentum/liquidity/scale formula from section 3q) is
  unaffected -- same formula, new inputs. FMP remains a real, working
  connector/REST path (see section 4) and stays the documented option
  for a future PAID upgrade (bulk screener, deeper fundamentals) if the
  free sources ever prove insufficient -- it just isn't what the trading
  pilots run on today.
- `bus/scripts/pilot-supervisor.js` -- the coarse "is today's cycle due"
  decision, meant to run every 30 min via Task Scheduler. Equity gates on
  Alpaca's own `/v2/clock` (no hand-rolled holiday calendar) plus
  10:00 ET; crypto gates on 02:00 UTC daily, deliberately offset from
  equity's dispatch window so load never stacks. Each pilot generates at
  most once/day (`todayCycleExists()`), then calls
  `execute-portfolio-setup.js --auto --pilot=<x>` and
  `monitor-paper-trades.js --execute` unconditionally every wake (both
  cheap no-ops when there's nothing new to do).
- **`execute-portfolio-setup.js` extended, not replaced**: new
  `--auto --pilot=fleet|crypto` path (auto-discovers the latest
  `status: done`, not-yet-executed round-3 task); a real idempotency
  guard (`alreadyExecuted()`, checks `paper-trades.jsonl` before every
  order -- applies to the manual path too, a genuine gap fixed
  regardless of autonomy); and two sizing constants,
  `AUTO_EQUITY_QTY_PER_LEG = 10` / `AUTO_CRYPTO_NOTIONAL_PER_LEG = 50`,
  used only on `--auto`, matching today's existing manual scale.
  **These two numbers need your explicit one-time sign-off before
  `--auto` is ever run on a live schedule** -- confirm them or give
  different ones.
- `run-queue-daemon.js`'s `dispatchOne()` gained real backoff: a
  rate-limit-shaped failure (429/quota/session-limit text) now requeues
  after 15 minutes (up to 3 attempts) instead of being logged and
  dropped, with an ntfy alert once retries are exhausted.
- Policy: `tasks/task_template.md`'s "never autonomous" line for
  write-enabled dispatch stays true in general; a narrow, named exception
  was added immediately below it covering exactly these two scripts.

**Host, not yet registered**: two separate Task Scheduler jobs are the
plan (`TradingPilotQueueDaemon` running `run-queue-daemon.js` at startup,
`TradingPilotSupervisor` running `pilot-supervisor.js` every 30 min, both
"run whether user is logged on or not" -- deliberately not the "logon
only" mode `AgentCommsBackbone` uses, since that wouldn't survive nobody
being logged in). Not registered yet. The data-source gap that used to
gate this (FMP) is resolved as of 2026-09-11 (see the credential-gap
bullet above) -- the remaining gate is a supervised end-to-end dry run
first.

**Verified so far (2026-09-09, this build)**: `computeScreenScore()`
ranks correctly against synthetic data; `generateThesisTask()`/
`generateChallengeTask()`/`generateSynthesisTask()` produce real task
files matching `discoverRound3Versions()`'s naming regex exactly (tested
live against a throwaway future-dated cycle, then removed); prior-cycle
`keyLearnings` read back correctly for both pilots against real
2026-09-08 data; `pilot-supervisor.js`'s market-clock and
`todayCycleExists()` gating both behave correctly against live state.
**Not yet verified (as of that build)**: a full generated cycle actually
dispatched end-to-end by `run-queue-daemon.js` (blocked on the FMP key
at the time), the idempotency guard against a real duplicate execution
attempt, and the rate-limit requeue path against a real 429.

**Update, 2026-09-11: the FMP blocker above is gone (see the
credential-gap fix earlier in this section), and full cycles now run for
real.** `fleet_pilot_20260910` and `crypto_pilot_20260910` both completed
rounds 1-3 end-to-end via `run-queue-daemon.js` with zero human
involvement, and conditional-trigger rescans have since fired live for
two fleet candidates (KO, VZ) on 2026-09-11. The idempotency guard and
rate-limit requeue path remain unexercised against a REAL
duplicate-execution attempt / real 429 specifically -- that residual gap
is about those two mechanisms, not data availability.

**Conditional triggers -- "keep passively scanning" (added 2026-09-10):**
direct user pushback on the first live run of this pilot: round-3's
decision was binary (execute now at market, or reject and nothing happens
today), and a day where every candidate rejects on genuine evidence-quality
grounds still felt like "the system should keep watching, not just stop."
The fix, and the real distinction that shapes it: a REJECT (round 2 found
an unresolved logic/arithmetic error, an undefined metric, a material data
gap) is a correct terminal outcome no price trigger can fix -- forcing a
trade there would just hide bad evidence behind a limit order. What was
actually missing was a genuine third outcome for a thesis that's sound but
whose CURRENT price isn't the right entry.

- Round-3's schema (`generateSynthesisTask()`) gained `conditionalCandidates[]`
  alongside `approvedCandidates[]`/`rejectedCandidates[]`, each carrying a
  machine-checkable `triggerPrice` (number) and `triggerType`
  (`at_or_below` | `at_or_above`) -- the prompt explicitly forbids
  defaulting rejections into this category just to avoid an empty list.
- New `bus/scripts/conditional-triggers.js`: `armNewTriggers()` discovers
  new conditional candidates from the latest round-3 (idempotent, keyed by
  `sourceTask::symbol`); `checkTriggers()` fetches a LIVE quote via
  `alpaca-client.js`'s new `getLatestQuote()` (Alpaca's own market-data API,
  `data.alpaca.markets` -- not FMP, so this works even without
  `FMP_API_KEY`, and it's the more honest source since Alpaca is the actual
  execution venue) and compares it to the trigger; on a match it does
  **NOT** execute -- it dispatches a brief rescan task and logs
  `trigger-fired`.
- **The user's explicit requirement, the core of this feature**: a trigger
  firing never fills blind. `generateRescanTask()` asks Codex a narrow
  question -- given the original thesis (injected via `dependsOnTaskId`)
  and the one new fact (live price now past the trigger), does this still
  hold up, reply `VERDICT: STILL VALID` or `VERDICT: NO LONGER VALID`.
  Honest about a real constraint: Codex has no live FMP access, so this is
  a reasoning re-check against already-known context plus its own hosted
  web-search tool (confirmed real, works under `--sandbox read-only`), not
  a fresh fundamentals pull.
- `checkRescanResults()` only calls `execute-portfolio-setup.js`'s
  `executeOne()` (now exported -- that file's `main()` was previously
  unguarded and ran on require, fixed with a `require.main === module`
  check) when the verdict is STILL VALID; NO LONGER VALID logs
  `trigger-invalidated` and executes nothing; a missing/malformed verdict
  line is left pending rather than assumed either way.
- State lives in `bus/pending-triggers.jsonl` (append-only, latest event
  per `sourceTask::symbol` is current state -- same discipline as
  `paper-trades.jsonl`, committed the same way, not gitignored).
- Wired into `pilot-supervisor.js`'s main loop (`checkConditionalTriggers()`,
  runs every wake alongside cycle generation).
- **Verified live, safely**: armed a synthetic guaranteed-to-fire trigger
  on AAPL, confirmed `checkTriggers()` fetched a real live quote and
  correctly dispatched a real rescan task; manually supplied a NO LONGER
  VALID verdict and confirmed `checkRescanResults()` logged
  `trigger-invalidated` and placed **zero** orders (`paper-trades.jsonl`
  confirmed unchanged). The STILL-VALID-executes branch was verified by
  code review, not a live test -- deliberately not exercising real order
  placement as a "test."

## Standing note: $1,000/leg-era paper P&L is not yet validation evidence (2026-09-13)

Per-trade sizing was raised from $15/leg to $1,000/leg on 2026-09-13
(direct user instruction -- transaction-cost drag was dominating the P&L
signal at $15/leg, confirmed real in `performance-scorecard.js`'s own
output). The same day, a multi-agent research stack deepened the
existing historical backtest of `computeScreenScore()`
(`bus/scripts/backtest-screen-score-v2.js`) with proper non-overlapping
statistics and real transaction-cost modeling. Formal, predeclared
verdict: **no statistically defensible, cost-surviving edge in either
asset class** -- equity's cost-adjusted excess return is actually
slightly negative at every horizon tested (5/10/20 trading days,
n=51/26/13 independent trials); crypto's stays positive but every
confidence interval spans zero (not significant).

Recording this explicitly so it can't be missed later: **do not treat
$1,000/leg-era paper P&L, however it turns out over the following weeks,
as evidence toward any real-capital decision** until either (a) the
screen formula is revalidated with a longer backtest window and/or a
real market-cap term (see the `FINNHUB_API_KEY` note elsewhere in this
doc -- enabling that key changes the live formula and would invalidate
this exact backtest's applicability until re-run with the cap term
included), or (b) the verdict above is independently re-run and comes
back clearly positive. A lucky run of $1,000-scale trades in the
meantime is not proof the screen works -- it's a run of trades on a
formula that, measured properly, hasn't shown it works. See
`bus/scripts/backtest-screen-score-v2-results.md` for the full numbers.

## 10. Layered research pipeline + vault persistence (added 2026-09-13)

**Why this was needed:** the round-1/round-2 thesis pipeline ran on a
genuinely thin real-data diet -- price/volume, a screen score, earnings
dates, and a symbol's own trading history. Direct user request: give the
trading agents richer real context to reason from *while the live
pipeline keeps trading and journaling its own outcomes* (the trade-
outcome learning loop in section 9 is untouched, this runs alongside it,
not instead of it).

**Four new layers, all in `bus/scripts/generate-pilot-tasks.js`:**
1. **Macro regime** -- trend (uptrend/downtrend/mixed) + vol regime
   (low/normal/elevated, annualized stdev of trailing-20 daily returns,
   separate thresholds for equity vs. crypto). Equity fetches one extra
   `SPY` daily-bars call; crypto reuses BTC's already-fetched bars --
   zero extra network calls.
2. **Sector/category context** -- new static `sector-map.json` (50
   equities) / `crypto-category-map.json` (32 coins), opportunistically
   overridden by live Finnhub `finnhubIndustry` for equities when a key
   is configured. Plus sector-relative performance (this cycle's
   `chgPct` vs. its own sector-group average).
3. **Technical indicators** -- RSI(14) (Wilder's formula), 50/200-day MA
   posture, 20-day support/resistance -- all computed from bars already
   in memory, no new fetches.
4. **Company/asset research** -- a real Codex web-search dispatch per
   symbol (`generateCompanyResearchTask()`), injected into **round-2**
   (the adversarial challenge), not round-1, via the existing
   multi-parent `dependsOnTaskIds` mechanism (same one `generateSynthesisTask()`
   already used for round-3 -- no new formatter code needed for the
   injection itself). It depends ONLY on the data-snapshot task, same
   parent as round-1's own thesis task, so it runs in parallel with
   round-1 and never delays cycle start -- confirmed on disk (round-1's
   task files show `dependsOnTaskId` pointing only at the snapshot task,
   never the research task). The prompt requires an inline
   `(Source: publisher, URL, date)` citation per bullet and a separate
   final `Lean: bullish/bearish/neutral/mixed` line -- verified live
   against a real dispatch, which came back with real, checkable Apple
   Newsroom URLs per finding.

**Vault persistence (`bus/scripts/vault-research-writer.js`), added the
same day after direct user clarification of what "research" means for
this project** (see project memory `feedback_agentvault_research_definition`):
a one-shot Codex search dispatch whose output only ever flowed into one
cycle's round-2 prompt, then vanished, does not meet that bar. Every
completed company-research task now gets published as a dated,
sourced snapshot note into `06 - Markets & Trading Research` (the
existing Obsidian research category from the 2026-09-03 manual batch),
following that category's own Evidence Ledger / source-tier /
observation-only conventions -- explicitly labeled lower rigor than the
manually reviewed batch (single live-web-search pass, no FMP
cross-check, no second-agent review) in every note's own Provenance
section, never silently presented as equally rigorous. A per-ticker
watchlist row is upserted (`Core Watchlist.md` for equities, a new
`Crypto Watchlist.md` for crypto); an idempotent published-ledger
(`bus/vault-research-published.jsonl`) prevents double-publishing.
`pilot-supervisor.js`'s `checkVaultResearchPublishing()` runs this every
30-min wake, same cheap/mechanical posture as `checkTradingJournal()`.

The `Lean` line is captured for logging but deliberately never written
into the vault note -- this category is observation-only, no trade
recommendations/price targets/opinions, a hard rule from the original
2026-09-03 research plan.

## 11. Migrated to a Raspberry Pi -- the pilot's permanent host (added 2026-09-13)

**The live pilot no longer runs on Windows.** Direct user request ("run
this entire operation from the Pi so my computer doesn't always have to
be on"). Both Windows Task Scheduler tasks that used to drive this
(`TradingPilotQueueDaemon`, `TradingPilotSupervisor`) are now disabled --
**deliberately**, not accidentally: running the scheduler on two
machines at once against the same real Alpaca paper account is a real
duplicate-decision risk, confirmed live during the migration itself (a
test run on the Pi, before Windows was disabled, generated a second
independent crypto research cycle for the same day; the position-
identity check correctly blocked one resulting duplicate-entry attempt,
but that's a lucky catch on one specific symbol, not a guarantee against
the general case -- see the real logged `entry-blocked`/`trigger-blocked`
rows in `bus/paper-trades.jsonl`/`bus/pending-triggers.jsonl` dated
2026-09-13T21:45).

**Host**: a Raspberry Pi (hostname `RaspPiDrive`, user `subwaycheese`),
64-bit Raspberry Pi OS Lite (headless, no desktop), reachable over the
home Wi-Fi via `ssh <user>@<pi-host>`. Confirmed real
prerequisites on this hardware: Codex CLI (`codex-cli`) and Claude Code
both ship official Linux ARM64 (aarch64) builds and run natively here --
this was the single open risk before migrating (see the pre-existing
`tasks/codex_arm_support_probe.md`, which had already answered this
question once, back on 2026-09-04, before it mattered).

**What runs where:**
- `run-queue-daemon.js` -- a systemd service
  (`/etc/systemd/system/agentvault-queue-daemon.service`), `enabled`
  (survives reboot) and `Restart=always`. Its `binary: "codex"` /
  `claude` invocations (agent configs in `bus/scripts/agents/*.json`)
  resolve by bare name via `PATH`, so the unit file sets
  `Environment="PATH=/home/subwaycheese/.local/bin:/usr/local/bin:/usr/bin:/bin"`
  explicitly -- both binaries are native installs symlinked under
  `~/.local/bin`, which only reaches `PATH` via `.profile` for
  interactive login shells, not for a systemd service or cron (a real,
  confirmed gotcha, not a hypothetical one).
- `pilot-supervisor.js` -- a user crontab entry, `*/30 * * * *`, same
  cadence as the old Windows Task Scheduler job, same explicit `PATH=`
  line for the same reason.
- Secrets: `bus/secrets.local.json` is gitignored by design (see
  section 3j) and was copied to the Pi via `scp` directly, never through
  git.
- The repo itself: a normal `git clone` of this same GitHub remote
  (`github.com/SubwayCheese/AgenticForce`, private -- SSH-key auth, not
  a password/PAT, since the Pi needs to `git pull`/`push` routinely).

**Operational note for any future session, on either machine:** this
repo's `tasks/*.md` files and several `bus/*.jsonl` logs are real,
meaningful state (not disposable build output) that both machines share
through normal git commits -- not a live/shared filesystem. A machine
that generates a new day's cycle before committing/pushing, while another
clone is also active, risks exactly the duplicate-cycle scenario above.
Windows Task Scheduler stays disabled deliberately; if it's ever
re-enabled for any reason, disable the Pi's cron/systemd first, or
vice versa -- never both live at once.

## 12. Recurring backtest layer + weekly dual-specialist validation (added
2026-09-13)

**Why this was needed:** direct user request for a "fully autonomous 24/7"
pipeline that is "constantly backtesting, learning, and executing trades...
use both codex and claude accordingly." Investigation found sections 9-11
above already deliver the execution/learning/24-7 parts in full (the queue
daemon as a systemd service, `pilot-supervisor.js` on cron generating and
executing daily cycles, `trading-journal.js`'s reflection loop) -- the one
real, confirmed gap was that nothing scheduled a recurring BACKTEST, and
Claude was entirely absent from the live loop (deliberately -- see section
9's `generateThesisTask()` note on the 2026-09-03 session-limit incident;
`claude-agent` shares this interactive Claude Code session's own usage pool,
confirmed again here via `secrets-broker.js`/`env` showing no separate
`ANTHROPIC_API_KEY`). User's explicit choices, this session: Claude stays
out of the high-frequency live loop and appears only in a new low-frequency
role; backtest results are report-only, never automatically pausing/resizing
live `--auto` execution; daily cheap + weekly deep cadence; the existing live
pilot is untouched.

**Three new files, zero edits to any existing pilot/execution file:**

- `bus/scripts/generate-backtest-tasks.js` -- generalizes the one-off
  `strategy_backtest_20260913_*` suite (NVDA/JPM/KO, hand-built and run
  manually earlier the same day to validate the pattern) into
  `generateWeeklyBacktestBatch(pilot, symbols, weekPrefix)`. Per symbol:
  one orchestrator-sourced data task (real ~2-year daily bars via
  `alpaca-client.js`'s `getDailyBars()`, walk-forward RSI14/MA50/MA200/
  support-resistance via `generate-pilot-tasks.js`'s own
  `computeRSI14()`/`computeSupportResistance()`, no lookahead), one
  `to: codex` and one `to: claude-agent` independent backtest task
  (`dependsOnTaskId` on the data task), one per-symbol fan-in synthesis
  reconciling the two. Ends with one batch-level fan-in synthesis across
  the week's symbols, `recordFact: strategy_backtest_<weekPrefix>_<pilot>_verdict`.
  This is where Claude re-enters the pipeline -- bounded to
  ~8 dispatches/week (5 equities + 3 crypto), nowhere near daily-loop
  volume.
- `bus/scripts/backtest-vault-writer.js` -- mirrors
  `vault-research-writer.js`'s exact pattern (dated note, idempotent
  ledger `bus/backtest-vault-published.jsonl`, explicit lower-rigor
  Provenance section) into a new
  `06 - Markets & Trading Research/04 - Strategy Backtests/` category, one
  subfolder for daily notes and one for weekly batch notes.
- `bus/scripts/backtest-supervisor.js` -- structured directly after
  `pilot-supervisor.js`'s `isCycleDue`/`todayCycleExists`/
  `maybeGenerateCycle` shape. Daily (idempotent per UTC date, tracked in
  new `bus/backtest-rotation-state.json`): re-runs the existing, unmodified
  `backtest-screen-score-v2.js` as a subprocess, parses its own "Direct
  verdict" heading (never re-derives it), records it via
  `memory-store.js`'s `recordFact()` called directly (a legitimate direct
  call -- this is real script output over real bars, trustworthy by
  construction, the same category `to: claude` orchestrator-sourced facts
  already get) and publishes a vault note. Weekly (gated on Sunday UTC,
  same state file): rotates a fixed-size slice through
  `fleet-universe.json` (5/week, ~10 weeks to cover all 50) and the crypto
  universe (3/week, ~11 weeks to cover all 32), deterministic and
  wraparound, calls `generate-backtest-tasks.js` per pilot. **Never calls
  `execute-portfolio-setup.js` and never touches `paper-trades.jsonl`** --
  report-only by construction, not just by convention; the already-running
  `agentvault-queue-daemon` (unmodified) dispatches the generated
  `status: pending` files itself, same as any other task file.
- New crontab line, `0 8 * * *` (08:00 UTC), deliberately off the crypto
  pilot's 02:00 UTC and equity pilot's ~10:00 ET windows so the queue
  daemon never has a live cycle and a fresh backtest batch queuing at
  once. Same explicit `PATH=` line as the existing `pilot-supervisor.js`
  entry, for the same `.profile`/cron gotcha reason (section 11).

**Verified live, the same day**: two full manual runs of
`backtest-supervisor.js` -- the first (fresh state, and the real UTC day
happened to be a Sunday) ran both the daily backtest AND generated a real
weekly batch (21 fleet + 13 crypto task files, `agentvault-queue-daemon`
picked them up and began dispatching immediately, unprompted); the second,
same-day run correctly no-op'd both jobs (idempotency confirmed). Confirmed
`bus/paper-trades.jsonl`'s SHA-256 identical before and after both runs
(report-only holds in practice, not just in code review). Confirmed the
daily fact (`backtest_daily_screen_score_verdict`) and the dated vault note
both landed correctly via `memory-query.js` and a direct file read.

## 13. Parameter-search "learning" layer (added 2026-09-13)

**Why this was needed:** direct follow-on the same day, user asked for
something closer to real "model learning" per agent. True weight-level
fine-tuning of Codex/Claude isn't feasible here -- neither CLI exposes a
custom-model path, and it would mean a whole separate training pipeline
with no guarantee of benefit. Agreed alternative: treat
`computeScreenScore()`'s weights (a hardcoded 50% chgPct / 30% avgVolume /
20% marketCap split) as parameters **fit to data** via a real grid search
against the recurring backtest -- genuine learning (optimizing parameters
against an objective), just not inside the LLMs.

**Real decisions made getting here, not assumed**: the user first asked
about TradingView as a market-cap data source -- investigated and
rejected (no legitimate public API, only unofficial scrapers of private
endpoints, a real ToS/reliability risk on an unattended box). Then asked
about free alternatives; Finnhub (already integrated, zero new
engineering) vs. SEC EDGAR's company-facts API (official, free, no
signup, but real new engineering: ticker->CIK mapping, XBRL parsing,
quarterly-refresh caching) were weighed, with the added finding that
Finnhub's profile endpoint is a live-only snapshot -- it cannot supply a
point-in-time historical market-cap series at all, which is what a
correct backtest actually needs (SEC EDGAR's quarterly filings could).
Given that engineering cost, market cap is **deferred, not built** -- this
layer ships the 2-dimensional chgPct/avgVolume search now, consistent
with this vault's existing pattern of shipping partial coverage honestly
(the pre-existing `ENABLE_MARKET_CAP_IN_SCREEN` flag already documents
the same open gap for the live formula itself).

The user chose **auto-apply, not report-only** -- if a searched
combination clears a real out-of-sample bar, the live formula updates
itself automatically. This is a materially bigger scope than section 12's
report-only layer: it can change what the live paper pilot actually
trades on. The safety mechanism is to reuse the existing rigor rather
than invent a weaker one:

- **Chronological train/test split** (70/30) of the already-fetched
  historical signal dates -- the grid search (`chgPct`/`avgVolume` in
  steps of 10, 11 combinations, `marketCap` fixed at 0) picks its winner
  using ONLY the train period, by the worst-of-three-horizons mean
  cost-adjusted excess vs. benchmark (conservative -- avoids a combination
  that only looks good on one lucky horizon).
- That exact winner is re-scored on the held-out TEST period and checked
  against `assetClassHasDefensibleEdge()` -- the **same** predeclared
  function `backtest-screen-score-v2.js` already uses for its real daily
  verdict (all three horizons' cost-adjusted, non-overlapping, paired 95%
  CI entirely above zero vs. both the full universe and the benchmark). No
  new, weaker bar was invented for this feature.
- Only a combination that clears that bar out-of-sample is written to
  `bus/scripts/screen-score-weights.json` (new, git-committed -- durable,
  meaningful state, same category as `bus/memory.jsonl`/
  `bus/paper-trades.jsonl`; its git history is the full audit trail of
  every real formula change, when, and why). Given the formula currently
  shows no edge at all, this is expected to apply nothing most weeks --
  correct, honest behavior, not a bug. Declining is published exactly
  like applying, never silently skipped.

**Files:**
- `bus/scripts/generate-pilot-tasks.js` -- `computeScreenScore(candidates,
  weights)` gained an optional second parameter, defaulting to the exact
  original 50/30/20 split (every caller that omits it is byte-for-byte
  unaffected -- verified live, see below). New `loadScreenScoreWeights(pilot)`
  reads the new weights file, falling back to the hardcoded default if
  missing. The two live call sites (`generateFleetDataSnapshot`/
  `generateCryptoDataSnapshot`) now pass `loadScreenScoreWeights(pilot)`
  instead of relying on the default.
- `bus/scripts/backtest-screen-score-v2.js` -- `replayAssetClass(config)`
  (previously one ~110-line function) split into `fetchAssetClassData(config)`
  (weight-independent: bar fetch, date alignment, per-date candidate
  features -- the expensive part, done once) and `scoreAssetClassData(data,
  weights, signalDatesSubset?)` (weight-dependent: scoring, shortlist,
  horizon returns -- cheap, pure in-memory, the part a grid search re-runs
  many times). `replayAssetClass()` is now a thin wrapper of both,
  preserving its exact original behavior. Also gained `module.exports` and
  a `require.main === module` guard -- previously `main()` ran
  unconditionally on load, which would have silently re-run the entire
  backtest as a side effect of the new `require()` this feature needed
  (the exact class of bug `execute-portfolio-setup.js`'s own `main()` had
  before its guard, this time caught before landing, not after).
- `bus/scripts/backtest-parameter-search.js` (new) -- the grid search
  itself, per pilot, as described above.
- `bus/scripts/backtest-vault-writer.js` -- new
  `publishWeightSearchNote()`, same dated/sourced/idempotent-ledger
  pattern as this file's other publish functions, into a new
  `06 - Markets & Trading Research/04 - Strategy Backtests/Weight Search
  History/` subfolder.
- `bus/scripts/backtest-supervisor.js` -- one more call in the existing
  weekly Sunday block, right after the entry/exit batch generation, its
  own try/catch so a search failure never blocks (or is blocked by) the
  batch generation.

**Verified live, the same day**: refactor safety -- saved the pre-refactor
`backtest-screen-score-v2-results.md`, re-ran the script after splitting
`replayAssetClass()`, diffed the two reports: every equity number and
every non-overlapping crypto interval identical; the one 0.01-point
difference was in crypto's live "daily/24-7" descriptive row, consistent
with real-time price drift between two live API calls minutes apart (a
still-forming candle), not a refactor defect. Ran
`backtest-parameter-search.js` for real against both pilots: fleet
(train=176/test=76 signals) and crypto (train=117/test=51 signals) each
found an in-sample winner (chgPct=30/avgVolume=70 both times) that failed
its out-of-sample check -- correctly declined, `screen-score-weights.json`
left unchanged, `loadScreenScoreWeights()` confirmed still returning the
exact original `{50, 30, 20}`, `bus/paper-trades.jsonl` SHA-256 identical
before/after. Both facts and both vault notes confirmed present and
consistent with the console output. Ran the full `backtest-supervisor.js`
weekly path end-to-end with the new step wired in -- correct no-op on a
same-day re-run.

## 14. Continuous Codex backtesting + bi-daily Claude audit (added
2026-09-14, supersedes part of section 12)

**Why this was needed:** direct user pushback the same evening --
section 12's weekly multi-agent batch (a small 5-stock/3-coin rotating
sample, once a week) wasn't what they wanted. They asked for backtesting
to run "constantly, every day all day" across every symbol in the
documented universe, not a small weekly sample.

**The real tension, surfaced and resolved before building anything**:
continuous, full-universe backtesting with BOTH specialists (the section
12 design) would have multiplied Claude usage roughly 10-50x past the
low-frequency scope already agreed that same day -- `claude-agent` shares
this interactive Claude Code session's own usage pool, and a real
session-limit incident already happened once (see `generate-pilot-tasks.js`'s
own header, section 9) from exactly this kind of high-frequency Claude
use. The user's own resolution, given directly: **Codex runs constantly,
alone**; **Claude's only role becomes a bi-daily (twice a day) audit** of
what Codex has accumulated -- a periodic quality/sanity review, not a
per-symbol parallel backtest. Cadence: every 30 minutes, matching
`pilot-supervisor.js`'s own rhythm.

**A real operational problem solved from the start, not patched in
after**: a fresh task-file pair per symbol every 30 minutes across all 82
symbols (50 equities + 32 crypto) would produce ~550+ new `.md` files/day
-- the exact class of `tasks/` clutter section 3k already had to clean up
once (`_archive_tests`). This design includes retention from day one.

**Files:**
- `bus/scripts/generate-backtest-tasks.js` -- new
  `generateContinuousBacktestBatch(pilot, symbols, tickId)`, reusing the
  same `writeDataTask()`/`writeBacktestTask()` helpers section 12 already
  built (same real-bars-plus-walk-forward data, same strategy-rule text),
  but writing only TWO files per symbol (a data task, one `to: codex`
  backtest task) instead of four -- no `claude-agent` task, no per-symbol
  synthesis, since there's only one specialist's reading now, nothing to
  reconcile. The codex task carries `recordFact: continuous_backtest_<symbol>`,
  captured automatically through the existing `recordFact`/
  `writeTaskResult()` mechanism -- no new fact-recording code needed.
  `writeBacktestTask()` gained an optional `recordFactKey` parameter to
  support this (backward compatible -- the old weekly-batch caller doesn't
  pass one, unaffected). `generateWeeklyBacktestBatch()` itself is kept,
  just no longer auto-invoked by any scheduler -- still callable manually,
  same additive-not-destructive precedent as `run-task.js` staying
  alongside `run-task-generic.js`.
- `bus/scripts/continuous-backtest-supervisor.js` (new) -- cron-driven
  every 30 minutes, state in new `bus/continuous-backtest-rotation-state.json`
  (gitignored, disposable cursor). Every wake: builds the combined
  universe fresh (50 + 32 = 82 symbols, fixed order), takes the next
  6-symbol slice via a deterministic wraparound rotation (reimplemented
  locally rather than importing `backtest-supervisor.js`'s -- these two
  supervisors stay intentionally independent, same separation as
  `pilot-supervisor.js`/`backtest-supervisor.js`), generates that slice's
  tasks. 6/tick means a full pass over all 82 symbols takes ~14 ticks
  (~7 hours) -- the whole universe gets freshly re-tested ~3-4 times/day,
  genuinely continuous without redundantly re-running the same daily bar
  data every 30 minutes for no new information. Bi-daily (gated on
  crossing the 00:00/12:00 UTC boundary since the last audit, same
  `lastRunDate`-style idempotency as section 13): generates ONE
  `to: claude-agent` audit task, its payload built from a new helper that
  reads `bus/memory.jsonl` directly (already exported as
  `memoryStore.MEMORY_PATH` -- no new bulk-read function needed in
  `memory-store.js` itself) filtered to `continuous_backtest_*` keys
  recorded since the last audit. Claude reviews for real inconsistencies/
  error patterns/notable cross-symbol findings -- it is NOT asked to
  re-backtest anything itself. Archive sweep, every wake: moves any
  `continuous_backtest_*` task file older than 24 hours AND already
  `status: done` (its fact is already durably recorded by then) into new
  `tasks/_archive_continuous_backtest/` -- move, not delete, same
  precedent as `_archive_tests`.
- `bus/scripts/run-task.js` -- `_archive_continuous_backtest` added to
  `listTaskIdsByStatus()`'s existing directory-exclusion list (alongside
  `_archive_tests`/`verification_suite`), landed BEFORE any file was ever
  moved there -- section 3k's own lesson (skipping this step makes
  archived files "live again" to the daemon's scan) applied from the
  start this time, not fixed after the fact.
- `bus/scripts/backtest-vault-writer.js` -- new
  `publishBiDailyAuditNote()`, same dated/sourced/idempotent-ledger
  pattern as this file's other publish functions, into a new
  `06 - Markets & Trading Research/04 - Strategy Backtests/Bi-Daily
  Audits/` subfolder.
- `bus/scripts/backtest-supervisor.js` -- the two
  `generateWeeklyBacktestBatch()` calls removed from
  `maybeRunWeeklyBacktest()` (this is what's being replaced); the weekly
  parameter-search call (section 13) is untouched -- pure computation, no
  LLM, not what the user's complaint was about. The now-unused rotation
  constants/state fields (`fleetIndex`/`cryptoIndex`, `EQUITY_PER_WEEK`/
  `CRYPTO_PER_WEEK`, the universe-path constants, the local `nextSlice()`)
  were removed rather than left as dead code, confirmed via grep that
  nothing else required this module's exports.
- `bus/scripts/dashboard-status.js` -- `plainDescribeTask()` gained cases
  for `continuous_backtest_*` and `bidaily_audit_*` task ids so the simple
  dashboard's activity feed (added earlier the same day) describes what
  is now the majority of real daily activity correctly instead of falling
  back to its generic sentence.
- New crontab line, `*/30 * * * *`, same explicit `PATH=` as every other
  entry.

**Honest cost note, stated plainly rather than glossed over**: this is a
real increase in Codex usage, not free -- roughly 82 symbols x ~3.4 full
passes/day is ~280 additional Codex dispatches/day on top of the existing
daily pilot cycle's own usage, in exchange for avoiding the Claude
shared-pool risk entirely.

**Verified live, the same evening**: two manual runs of
`continuous-backtest-supervisor.js` -- first run generated exactly 12
task files (6 data + 6 codex, zero `claude-agent`/synthesis files) for
the first 6 fleet symbols in rotation order, each codex task carrying the
correct `recordFact`, plus a bi-daily audit task (0 verdicts -- correct
and honest on a fresh store); second run correctly did NOT regenerate the
audit (same window) and correctly advanced to the next 6-symbol slice.
Archive sweep tested with synthetic aged/completed fixtures (an old
tick-timestamped, `status: done` pair): both files moved into
`tasks/_archive_continuous_backtest/`, and `listTaskIdsByStatus('done')`
confirmed to no longer see them -- the exclusion-list fix verified to
actually work, not just reviewed. `bus/paper-trades.jsonl` SHA-256
confirmed identical across both real runs -- report-only holds.

## 15. Closing the loop: edge-status.js (added 2026-09-14)

**Why this was needed:** direct user pushback in conversation, not a bug
report -- sections 12-14 wrote real backtest findings to vault notes and
the fact store, but nothing fed them back into a live thesis, and nothing
gave one honest, current answer to "do we have real edge yet" without
manually piecing together several vault notes. The user summarized the
pipeline as "documenting findings which get re-read the next time an
agent trades" -- true for trade-outcome learning (`trading-journal.js`'s
reflection loop), **not true** for the backtest layer, which was
confirmed to be a dead end for the live decision loop before anything was
built to fix it.

**New module, `bus/scripts/edge-status.js`**, read-only, used two ways:
- `getCurrentEdgeStatus(pilot, symbol)` -- the latest
  `backtest_daily_screen_score_verdict` fact, the latest
  `screen_score_weights_<pilot>` fact, and the latest
  `continuous_backtest_<SYMBOL>` fact for this specific symbol if one
  exists. `extractVerdictSnippet()` best-effort-extracts the sentence
  containing "verdict" from a free-text backtest result (phrasing varies
  by run/specialist, so this degrades to a truncated lead-in rather than
  guessing) -- keeps the injected section short instead of dumping a full
  multi-paragraph backtest result into every thesis prompt.
- `getOverallEdgeSummary()` -- aggregates across ALL recorded
  `continuous_backtest_*` facts (scanning `bus/memory.jsonl` directly, its
  append-only order making "last line per key" the correct latest-value
  read) into one plain-language line: how many symbols checked, how many
  showed a real trigger by heuristic text match, combined with the daily
  and weekly verdicts.

**Wired into the live thesis generation**, closing the actual gap:
`generate-pilot-tasks.js`'s new `formatEdgeStatusSection(pilot, symbol)`
follows the exact same injection pattern `formatSymbolHistorySection()`
already established (informational context appended to the round-1
thesis payload, never a hard gate -- a thesis can disagree with this
evidence, but has to reckon with it, not ignore it by omission). Verified
live against real accumulated data (42 real `continuous_backtest_*`
facts, NVDA's own real result) before considering this done -- the
injected section correctly surfaced the live screen-score verdict, the
weekly parameter-search result, and NVDA's own extracted verdict sentence
("Overall verdict: inconclusive, with 0 genuine trigger events...").

**Surfaced on the simple dashboard** (`bus/simple.html`,
`dashboard-status.js`'s `getPlainSummary()`): a new "Do we have a real
trading edge yet?" card showing `getOverallEdgeSummary()`'s plain-language
line, explicitly labeled as answered honestly rather than optimistically
-- "no" is a real, useful, expected result at this stage, not something to
hide.

**Deliberately NOT done as part of this**: this is informational only --
no live trade is gated or resized based on this evidence, and no numeric
threshold auto-flips a decision. That would be a materially bigger,
riskier change than "make the evidence visible," and wasn't asked for.

## 16. Continuous backtest freshness fix (added 2026-09-14)

**Why this was needed:** direct user follow-up after being shown the
real measured cadence of section 14's continuous track (a burst of 6
symbols every 30 min, full universe covered ~3-4x/day). Daily bars only
update once per real trading day, so most of those repeat passes were
re-analyzing input data that had not actually changed -- real Codex spend
for near-zero new information, flagged honestly rather than left as a
hidden cost.

**Fix, deliberately simple, not a live bar-date lookup:** a new
`nextFreshSlice()` in `continuous-backtest-supervisor.js` tracks, per
symbol, the last UTC calendar date it was tested
(`state.lastTestedDate[symbol]`) and skips any candidate already tested
today while scanning forward through the rotation -- wall-clock dedup
achieves the same effect as fetching each candidate's live bar date (a
symbol's daily-bar-derived series cannot have meaningfully changed within
one calendar day regardless of intraday timing), with zero extra API
calls. The cursor advances past every candidate EXAMINED (skipped or
processed), so the rotation keeps moving instead of stalling on
already-fresh-today symbols. Net effect: the full 82-symbol universe gets
tested exactly once per UTC day (~14 ticks, ~7h), then the supervisor
correctly goes idle -- cheap date comparisons only, zero new dispatches
-- until the next day's data is available, instead of cycling the same
symbols 3-4x for no new information. The old `nextSlice()` (blind,
freshness-unaware rotation) was removed as genuinely dead code, not kept
alongside -- nothing else in the file used it.

**Verified live, the same session**: ran the supervisor for real, got a
correct fresh batch (6 new symbols, `examined` count matching `picked`
count exactly since none were previously tested). Then deliberately
rewound the rotation cursor back onto that same just-tested batch and ran
again: correctly skipped all 6 (already tested today), examined 12
candidates total to find the next 6 genuinely fresh ones, and correctly
rolled over from the tail of the equity universe into the crypto universe
mid-scan -- proving the skip-and-continue logic, not just the happy path.
`bus/paper-trades.jsonl` SHA-256 confirmed identical across both runs --
still report-only.

## 17. Fixed-split growing-test-set redesign for the parameter search
(added 2026-09-14)

**Why this was needed:** direct user request to run the parameter search
every ~3 days instead of weekly. Flagged and confirmed together first:
naively shrinking the cadence on the OLD design (fresh 70/30 split of
"the most recent N days" recomputed every run) would make consecutive
runs share most of their test window -- "cleared the bar 4 times in a
row" would really be one real observation dressed up as four, the same
autocorrelation trap this vault's own non-overlapping-trial statistics
exist to avoid elsewhere.

**The fix turned out simpler than the first design considered** (a
many-small-fold walk-forward ledger, discussed and set aside).
`metricForHorizon()`'s existing non-overlapping thinning
(`observationsForSampling`, `backtest-screen-score-v2.js`: `index %
horizon === 0`) already does correct non-overlapping sampling within
whatever array it's given, stable as long as the array's start point
doesn't move. The real bug was re-picking a brand-new split every run,
sliding the start point forward each time. **Fix: stop re-splitting.**
The train/test boundary is chosen ONCE per pilot and persisted; TRAIN
stays fixed, TEST grows forward in place as real trading days accumulate
(new dates append at the END of a fixed-start array, so the existing
index-based thinning treats every future run's new days as correctly-
phased new evidence, with zero changes needed to that thinning logic).
This is also more rigorous than the old design in a second way: the
winning weight combination is now selected once from a fixed historical
window, rather than re-picked fresh against a sliding recent window every
run -- arguably closer to data-snooping in the old design.

**Honest limit, stated plainly, not hidden**: a horizon still needs real
calendar time >= its own length to produce one new non-overlapping data
point for that horizon -- 5 days for the 5-day horizon, 10 for the
10-day, 20 for the 20-day. Running every 3 days means most runs add a
new 5-day-horizon trial; 10- and 20-day evidence accumulates slower,
automatically and correctly. Every run is still genuinely informative (a
bigger, richer test set) even when only the 5-day horizon gained new
evidence that particular run.

**Deliberate scope limit**: the training window's start stays fixed
indefinitely -- no periodic re-anchoring to recent market regimes. A
real, known tradeoff, left for a future pass, kept out of this change to
stay focused on the one problem it's for.

**Files:**
- `bus/scripts/backtest-screen-score-v2.js` -- `fetchAssetClassData(config,
  extraHistoryDays = 0)` gained an optional second parameter. `0`
  (default) is byte-identical to before -- every existing caller
  (`replayAssetClass()`, the daily CLI verdict) unaffected. `> 0` (used
  only by the parameter search) requests much deeper raw history (~750
  trading days) and widens the candidate-feature loop to cover the full
  uncapped `eligibleDates`, now also returned alongside the existing,
  still-capped-at-252 `signalDates`.
- `bus/scripts/backtest-parameter-search.js` (rewritten) -- new
  `bus/scripts/backtest-search-split-state.json` (git-committed, durable,
  same category as `screen-score-weights.json`) persists `{ splitDate }`
  per pilot, set once. Every run: TRAIN = eligible dates up to
  `splitDate` (fixed), TEST = eligible dates after it (grows). Grid
  search and `assetClassHasDefensibleEdge()` check are otherwise
  unchanged -- same predeclared bar, no new weaker one invented.
- `bus/scripts/backtest-supervisor.js` -- the search moved off the
  Sunday-only weekly gate onto the EXISTING daily 08:00 UTC cron trigger
  (no new crontab entry) via a new `isSearchDue()` (>= `SEARCH_INTERVAL_DAYS`
  = 3 days elapsed, replacing the old `isWeeklyBacktestDue()`/
  `lastWeeklyRunWeek` check). `maybeRunWeeklyBacktest()` renamed to
  `maybeRunParameterSearch()` to match -- it no longer runs weekly.
- `bus/scripts/backtest-vault-writer.js` -- `publishWeightSearchNote()`
  updated to report the fixed split date and how much the test set grew
  since the last run, so notes honestly reflect a growing-in-place series
  rather than implying a fresh split each time.

**Verified live, the same session**: cold-start run correctly initialized
`splitDate` for both pilots (fleet: 2025-07-30, giving an immediate 261-
signal test set vs. the old design's ~76-116; crypto: 2026-07-06, 50
signals -- less available history for that universe, a real data
limitation, not a bug). Immediate re-run confirmed `splitDate` unchanged
and test-set size stable (no new trading day had passed) rather than
resetting. Full `backtest-supervisor.js` daily run confirmed the search
fires correctly on a fresh `lastParameterSearchRun` state field and
correctly no-ops on an immediate second run. `bus/paper-trades.jsonl`
SHA-256 confirmed identical throughout -- still report-only.

## 18. Tightened entry/exit sampling + machine-readable trigger count
(added 2026-09-15)

**Why this was needed:** the second half of a plan approved but deferred
the day before (the user asked to talk through the bigger picture
instead). Real evidence across dozens of live dispatches: the continuous
entry/exit backtest's 10-trading-day sampling interval produced **zero
genuine triggers found, ever**, across every symbol checked -- not
because the strategy has no signal, but because a 10-day-coarse sample
mostly misses the days a support/resistance level was actually touched.

**Fix**: `bus/scripts/generate-backtest-tasks.js`'s `WALKFORWARD_STEP_DAYS`
`10 -> 3`. Every prompt string already referenced this constant via
template literals (confirmed via grep before changing it -- zero
hardcoded "10" strings anywhere in the file), so this one-line change is
the entire fix; no prompt text could drift out of sync. Real, stated
tradeoff: roughly triples the injected walk-forward table's row count
(~36 -> ~116 points over the same ~500-bar window) -- a real increase in
prompt size/cost per dispatch, same single Alpaca fetch either way.

**Also added**: `backtestPayload()` now asks for one more line, a
machine-checkable `TRIGGER_COUNT: <integer>` on the final line of every
response -- matching this vault's existing `SOURCE:`/`Lean:`-line
convention instead of relying on fragile prose-parsing. `edge-status.js`'s
`getAggregateContinuousStats()` updated to prefer this exact field when
present, falling back to the original regex heuristic only for facts
recorded before this change -- verified live: all 79 real facts in
`bus/memory.jsonl` at the time of this change still parse correctly via
the fallback path (one, CVX, already showing a real signal under the old
heuristic).

**Deliberately out of scope, named so it isn't silently dropped**: the
dual-agent pitch/verify half of the original paused plan (Codex pitches,
the other specialist verifies only when a real trigger is found) -- a
named next step once this sampling fix's real effect on trigger-finding
rate is observed, not bundled in here.

## 19. The "survive" city-bank economy -- autonomous real-money growth, isolated branch (added 2026-09-15)

**A deliberate, explicit, user-directed exception to section 7's real-money
boundary, scoped to this branch only.** Direct user request, their own
framing: "I am a drill sergeant, these are soldiers sent out with fixed
supplies whose only goal is to survive and grow" -- inspired by viral
"give an AI agent $100 and survive" experiments, but built on this
project's existing multi-agent dispatch infrastructure rather than an
ad-hoc single session. The goal evolved during design into a full
self-funding economy: "an entire ecosystem with an overarching budget that
all agents contribute to... like a city with a city bank. The residents
and leaders are agents. The leaders manage funding for the citizens who go
out to find or continue work and give their money to the bank."

**This does NOT alter section 7 for the existing fleet/crypto pilots.**
`alpaca-client.js`'s hard paper-only guard is untouched, unmodified, and
never reused here. Everything below lives in new, separate files, with its
own separate real-money live client (`survive-alpaca-live-client.js`), so
the two domains can never be confused or cross-contaminated. Section 7's
boundary remains fully binding for `fleet_pilot_*`/`crypto_pilot_*` --
this section *is* the "separate, deliberate future decision" section 7
itself anticipated, exercised only for this isolated branch.

**The model.** One founding citizen ("C1") is funded with a real, hard
$50 cap -- no re-supply from the human, ever. It pursues a real-money
mechanism of its own choosing (live equity/ETF trading via Alpaca is the
only mechanism built for v1; see below). If it earns real, realized
surplus, it may deposit that surplus into the shared city bank and spawn a
new citizen, becoming that citizen's leader -- the city grows recursively,
bottom-up, from whoever actually succeeds and chooses to reinvest, not a
fixed org chart. The bank only ever re-funds an existing struggling
citizen from **real, already-realized surplus**, checked by a fail-closed
solvency gate that can never let the bank's balance go negative.

**Architectural decision made during final planning, not assumed by
either research pass that fed the design**: every citizen shares **one
real live Alpaca account** (one human KYC, one funded account) --
spawning a citizen must never require a second identity-verification
step, or the "city grows itself" premise breaks. Every citizen's balance
and open position are software-enforced sub-ledgers over that one real
account, keyed by `citizenId`, reusing the exact `lotId`-based
multi-position-tracking pattern already proven in
`execute-portfolio-setup.js`/`monitor-paper-trades.js` for tracking
several simultaneous lots against one real account.

**Not only a trading bot.** Citizens can research new revenue mechanisms
for the city on their own (`survive-mechanism-research.js`), not just
execute within the one pre-built mechanism -- trading is mechanism #1
because it's the cleanest legal option with the most reusable infra, not
a ceiling. This research-and-draft step is genuinely autonomous end to
end (web research, legal/ToS evaluation against two hard boundaries, and
drafting the actual new module's file content). One honest correction
made during build, versus the original plan's more optimistic phrasing:
`run-task-generic.js`'s write-mode dispatch is a manual `--write` CLI flag
only, never automatically run by `run-queue-daemon.js` -- a deliberate,
pre-existing safety boundary in this codebase this branch does not quietly
work around. So a drafted new mechanism module is written to a
`.proposed.js` file (never auto-loaded by `mechanism-registry.js`) with
the exact manual activation command printed -- real autonomy for research
and drafting, one small manual step to actually activate a brand-new
mechanism, same honesty standard as everything else in this document.

**The two hard boundaries, absolute regardless of "general autonomy,"
decided after real web research (not guessed)**: no mechanism whose Terms
of Service bans unsupervised automated action on every action, not just
setup (ruled out Upwork/Fiverr-shaped platforms), and no mechanism that is
illegal or geoblocked for a US-based account (ruled out Polymarket).
Every mechanism, even the legal ones, needs a one-time human-completed
identity-bound account setup that cannot be automated -- citizens can only
ever choose among mechanisms for which the human has actually provisioned
working credentials (`mechanism-registry.js`'s `listAvailableMechanisms()`,
checking secret *existence* only via `secretsBroker.hasSecret()`, never a
value).

**Files** (all new, all additive -- `bus/scripts/`):
`survive-budget-envelope.js` (the hard, never-reset per-citizen cap --
pure `bus/survive-ledger.jsonl` ledger replay, zero live-client calls by
design, since a shared account's raw equity can never be read as one
citizen's number; once a `cap-breach-shutdown` event is written, no code
path ever clears it), `survive-alpaca-live-client.js` (separate live
client, long-only, refuses to run against a paper endpoint),
`city-bank.js` + `bus/survive-city-bank.jsonl` (the shared pool --
`checkBankSolvency()` never permits a negative balance),
`city-registry.js` (citizen profiles as `memory-store.js` facts; "leader"
is never stored, only computed on read from `foundedByLeaderId` links),
`citizen-lifecycle.js` (the spawn mechanism -- written and unit-tested,
deliberately NOT wired into `survive-supervisor.js`'s live wake until a
founder has a real, audited surplus), `mechanism-registry.js` +
`mechanisms/alpaca-live-equity.js` (auto-discovery, same pattern as
`bus/scripts/agents/*.json`), `survive-executor.js` (the only thing that
ever calls the live client's `submitOrder()` -- a citizen's decision task
emits a structured JSON block, this file is the deterministic executor,
mirroring `execute-portfolio-setup.js`'s "LLM decides, code executes"
separation exactly), `survive-supervisor.js` (schedule-invoked cadence,
mirrors `pilot-supervisor.js`'s shape -- one script drives every citizen,
not one service per citizen), `survive-journal.js` (two-layer mechanical +
batched-reflection pattern, batch size 1, mirroring `trading-journal.js`),
`survive-mechanism-research.js` (weekly, city-level), `city-status.js` +
`bus/economy.html` + `/economy-status.json` (deliberately not
`bus/city.html`, which already means an unrelated 3D agent-roster view --
a real naming collision caught during design).

**Secrets**: `ALPACA_SURVIVE_LIVE_KEY`/`ALPACA_SURVIVE_LIVE_SECRET`/
`ALPACA_SURVIVE_LIVE_ENDPOINT` in `bus/secrets.local.json` -- three new
names, never the existing paper ones. `secrets.local.json.example`
documents the shape.

**Spawn autonomy, decided**: the first-ever real-money spawn requires a
one-time human confirmation (`cityBank.recordSpawnConfirmedByHuman()`) --
matching this project's established "prove a new, consequential
real-money action once, supervised, before trusting it live" pattern used
everywhere else (paper-before-live, `--rehearsal` mode). Every spawn after
that first one may proceed fully autonomously
(`citizen-lifecycle.executeSpawn({autoApprove: true, ...})`), no human
step.

**Human handoff steps, irreducible, cannot be scripted**: open and
KYC-verify one real live (non-paper) Alpaca account; fund it with exactly
$50, once; generate a live API key/secret pair; add the three
`ALPACA_SURVIVE_LIVE_*` secrets to `bus/secrets.local.json` (local + the
Pi); run the one-time genesis-funding step for the founder citizen after
confirming the deposit landed; pick a real ntfy topic (the code default is
`AgentVaultSurvive`, a placeholder, distinct from the fleet's `ClaudeTeam`
topic); `sudo` install `bus/deploy/pi/survive-supervisor.service` +
`.timer` once a supervised `--rehearsal` run has been reviewed end to
end -- NOT installed by default.

**Build status as of this writing**: every file listed above exists and
is `node -c` syntax-verified; `city-status.js`/`/economy-status.json`/
`bus/economy.html` verified live against a real (empty, not-yet-funded)
state. No live credential has ever touched this code -- no real order has
been placed. `citizen-lifecycle.js`'s spawn logic is written but not yet
exercised against a real citizen with real surplus, since none exists
yet. A full `--rehearsal` mission cycle (research -> decision -> execute
-> journal) against the real, unmodified paper Alpaca API has not yet been
run end to end -- the next real step before any live credential is added.

**Named future work, not built now**: a 3D visualization of the city --
a central hub for genesis, a new building per distinct kind of task/job a
citizen works on (shared by any citizen doing the same kind of work, or a
new one spun up), roads connecting buildings that agents are shown
traveling. The data this would need largely already exists unmodified:
`city-registry.js`'s `buildLineageTree()` is already the citizen/leader
graph; `bus/survive-missions.jsonl`'s mission lifecycle events are already
the "which building is this citizen in right now" feed. Deliberately a
new page when built, not a rewrite of `bus/city.html` (the existing,
unrelated subagent-roster visualization) or `bus/economy.html`.

**Round 6 (2026-09-16): zero approval gates.** Direct, explicit user
instruction, reversing round 2's/round 4's own decisions: "None I want 0
approval gates. Once they have their money I want 0 approval gates they
are their own entity." Removed entirely: the email send-approval gate
(`survive-email.js`'s `requestSend`/`approveSend`/`rejectSend`/
`hasApproval` machinery -- replaced by a single `sendEmail()` that drafts
and sends in one call, still fully logged for audit, just never blocked
on a human step) and the first-spawn human-confirmation gate
(`cityBank.hasFirstSpawnBeenConfirmed()`/`recordSpawnConfirmedByHuman()`,
and every `autoApprove` parameter across `citizen-lifecycle.js`/
`city-leadership.js`/`survive-leader-council.js`, all deleted rather than
left as unused dead code). **What this does NOT touch, and never was an
approval gate in the human sense**: the hard per-citizen budget cap (no
re-supply, ever), the bank's own solvency gate (can never go negative),
and the runaway-spawn guards (max active spawns per leader, cooldown
days) -- these are the system's actual financial/structural rules, not
human checkpoints, and stay exactly as they were. Also confirmed
explicitly with the user and worth recording: withdrawing real money from
Alpaca was ALWAYS human-portal-only, by Alpaca's own design (no API
exists for it) -- this was never something citizens could gate or block,
before or after this round; the user's own access to their money was
never mediated by any of this code.

**Round 7 (2026-09-16): a security layer, structurally separate from the
city.** Direct follow-on from round 6's zero-approval-gates change: the
realistic risk isn't "the model goes rogue" (no session-to-session memory
or autonomous initiative exists to make that coherent) -- it's prompt
injection, a citizen's own web research or an email reply containing
content designed to hijack its next decision. User's own framing: "a
security team for the city... separate from the city so [it] can attack
and remove whatever is causing problems," without limiting citizens'
normal abilities (round 6's zero-gate decision is unchanged).

New `bus/scripts/city-security.js`, DETERMINISTIC-FIRST/LLM-SECOND by
design -- cheap rule-based code that only checks numbers and patterns
(never reasons about arbitrary text) can't itself be prompt-injected, so
it's the primary detector; an isolated LLM review is a secondary
escalation only for cases the rules flag as ambiguous. Six rules, each
`severe` (auto-quarantine immediately, no LLM round-trip needed to
freeze) or `moderate` (flag for LLM review, quarantine only if
confirmed): `RAPID_LOSS_PCT` (>50% of pre-trade cash lost on one closed
trade -- severe), `SPEND_SPIKE_MULTIPLE` (an order >3x this citizen's own
historical average -- severe), `EMAIL_SEND_RATE_LIMIT` / `EMAIL_NEW_RECIPIENT_SPIKE`
(unusually rapid sending or a burst of never-before-emailed recipients --
moderate), `DECISION_RESEARCH_MISMATCH` (a decision's symbol never
appears in its own dependency research task's output -- a cheap,
non-gameable string check, moderate), `REPEATED_GUARD_TRIP` (a leader
hitting `checkBankSpawnGuards()`'s refusal repeatedly within 24h --
moderate).

Quarantine is the one, narrow response power: `city-registry.js` gained a
`quarantined` field plus `quarantineCitizen()` (callable by
`city-security.js`) and `unquarantineCitizen()` (**human-CLI-only**,
called from exactly one place -- `city-security.js`'s own
`node city-security.js unquarantine <citizenId> "note"` command --
verified by grep, same discipline as `city-reserve.js`'s withdrawal
function). It's a freeze, not a deletion: all ledger/mission/email
history stays intact, and every money-moving/email-sending function
checks it as its first line -- `survive-executor.js`'s
`executeEntry`/`executeExit`, `citizen-lifecycle.js`'s
`executeCloneAndPromote`/`executeBankFundedSpawn` (via
`checkBankSpawnGuards()`)/`executeTopup`, `survive-email.js`'s
`sendEmail()`. `survive-supervisor.js` runs the security sweep FIRST in
every wake, before any money-moving step, and skips quarantined citizens
in mission-authoring. A quarantine event is ntfy priority 5, matching the
existing "permanent shutdown" severity.

**Structural separation from the city's own chain of command**: not
managed by any leader, not part of the leader council, its own
append-only audit log (`bus/survive-city-security.jsonl`, separate from
every other survive ledger); one-directional -- `city-security.js` reads
every citizen's ledger/mission/email data, and nothing in
`citizen-lifecycle.js`/`survive-leader-council.js` ever calls into it
except to record its own guard-trip audit events (not a write to any
citizen's record) -- a compromised citizen or leader has no code path to
disable or influence detection.

**Verified via an isolated integration test** (real code executed, temp
paths only): a simulated 5x spend spike correctly auto-quarantined a
citizen with zero LLM dispatch involved; quarantine enforcement confirmed
across `executeTopup()` and `sendEmail()`, both refusing with the
specific quarantine reason; a simulated email-rate-limit burst correctly
flagged as moderate WITHOUT auto-quarantining; a mocked LLM review
returning `quarantineRecommended:false` correctly left the citizen
unquarantined, and a second review returning `true` correctly quarantined
it; confirmed `unquarantineCitizen()` has no caller anywhere in the
codebase except `city-security.js`'s own CLI block.

**Round 8 (2026-09-16): the real-time 3D city page.** Direct user
request, designed and built under Fable: the plain `bus/economy.html`
cards stay exactly as they were ("I like the basic and easy to read UI");
this is a SEPARATE page, `bus/survive-city-3d.html`, served at
`/survive-city-3d.html` with its own feed `/survive-city-3d-status.json`
(`city-status.js`'s new `getCity3DStatus()`; `getCityPlainSummary()` is
untouched). Same rendering approach as the unrelated `bus/city.html`
(Three.js 0.160 via CDN import map, OrbitControls, bloom, poll-moves-
targets/render-loop-eases separation, `Map<id,entry>` diff-sync) --
deliberately reused, not reinvented.

What it shows, all from real data: **one building per mechanism** (every
`bus/scripts/mechanisms/*.js` module, lit only if its credentials exist,
plus any mechanism a citizen is recorded using -- an honest capacity view,
not just occupancy); the **bank** as a central vault whose height tracks
the pooled balance; **every citizen as a figure** that walks to the
building it's working in and glows by `activityState`, derived
deterministically from `survive-missions.jsonl` (`researching` = at the
door, `in-position` = on the roof with its symbol, `blocked` = turned
away, `idle` = in the plaza, leaders on a purple council dais, crowned
and taller); a **quarantine pen** and a **KIA memorial** on the
perimeter, visible only when occupied; faint **lineage lines** from each
leader to the citizens it manages; and a live roster/HUD.

Verified: isolated integration test of `getCity3DStatus()` across all
six activity states, two mechanisms (one empty), lineage edges; every
dashboard route returns 200 after a server restart; a real headless
Chromium render on the Pi of both the live (not-yet-funded) page and a
fixture-fed populated city with zero JS errors. `bus/city.html` and
`bus/economy.html` untouched.

**Round 10 (2026-09-16): how citizens spend money on non-trading work.**
Direct user question: "how will agents get the money out of alpaca to do
what they want that doesnt involve trading." The honest answer, confirmed
and permanent: they can't, ever -- Alpaca's self-directed retail account
has no withdrawal/ACH API at all, only a human-portal transfer, the same
fact already established for the reserve. So money never needs to leave
Alpaca through code, because non-trading spend never needs to touch
Alpaca in the first place.

Two additive pieces:

1. **`city-bank.js` gained `recordHumanCapitalInjection(amountUsd, note)`**
   (CLI: `node city-bank.js fund <amountUsd> ["note"]`) -- a second, direct
   way real money enters the bank's pooled balance, independent of any
   citizen ever realizing trading profit. This is how the user seeded the
   bank with real capital ("I will provide 50 bucks to the bank") before
   Alpaca/mechanism #1 was even set up. Repeatable (unlike genesis-
   funding's once-per-citizen rule); `getBankBalanceUsd()` and
   `auditBankLedgerIntegrity()` both updated to include it.

2. **New `bus/scripts/city-spending.js`** -- a leader authorizes a real,
   spend-capped virtual card against the bank's pooled balance. Originally
   built on Privacy.com (agent-native, no business entity); the user
   rejected that design outright -- "No I do not want to link my card I
   just want a flat balance that I can put in there" -- since Privacy.com
   cards pull live against a linked personal bank account rather than
   drawing from a genuinely isolated, capped pool. Rebuilt on **Stripe
   Issuing's v2 FinancialAccount** instead, after researching non-crypto
   options specifically: a sole-proprietor/individual Stripe account (SSN,
   no LLC/EIN) has a real, isolated `type: "storage"` FinancialAccount --
   an actual stored balance, not a pull-through -- that you fund with a
   flat amount whenever you choose; cards can never spend more than what's
   actually in it.

   **Empirically confirmed against the user's real Stripe test-mode
   account this round (not assumed from docs)**: this account is on
   Stripe's v2 Financial Accounts architecture, so
   `POST /v1/issuing/cards` REQUIRES `financial_account_v2` pointing at a
   real FinancialAccount id (the "classic" single-Issuing-balance model
   some docs describe does not apply here); a default `storage`
   FinancialAccount already exists per account; a cardholder needs real
   completion before a card can be issued
   (`individual[first_name]`/`individual[last_name]`, `phone_number`,
   `individual[card_issuing][user_terms_acceptance]`) -- found by
   iterating against real Stripe 400 errors, not guessed. One real bug
   caught and fixed this way too: the module's own GET requests were
   sending a `Content-Type` header Stripe's v2 API rejects outright for
   GET (`415`) -- fixed, verified via a real `fa-status` CLI call against
   the live account.

   **Blocked on one real, human-only step, named honestly**: the
   account's FinancialAccount currently shows `status: "pending"` and
   Stripe refuses to issue a card against it until it's `"open"` -- this
   looks like standard one-time Stripe account activation (the account
   also shows `charges_enabled: false`), the same category of irreducible
   human step as Alpaca's KYC or AgentMail's signup. Check the Stripe
   Dashboard for outstanding account/Issuing requirements before trusting
   this live. Funding the FinancialAccount via the inbound-transfer API
   also isn't verified working yet (404'd in its current state) --
   confirm via the Dashboard's "Add funds" flow first.

   `checkSpendGuards()` mirrors `citizen-lifecycle.js`'s
   `checkBankSpawnGuards()` exactly (leader-role + quarantine + bank
   solvency, and calls `citySecurity.recordGuardTrip()` on refusal --
   feeds `city-security.js`'s existing `REPEATED_GUARD_TRIP` rule for
   free). `issueSpendCard()` debits the bank via `city-bank.js`'s existing
   `recordBankAllocation()` with a new `allocationKind: 'spend-card'`,
   only after the real Stripe call succeeds. **Whatever card data Stripe
   returns goes to the caller once and is NEVER persisted** -- only the
   card id, last4, and spend limit are written to
   `bus/survive-city-spending.jsonl`. Worth naming as a real (and more
   conservative) difference from Privacy.com's design: Stripe does not
   return a card's full PAN/CVV in a plain response by default (PCI
   scoping) -- `issueSpendCard()` requests the `expand` params for it, but
   this hasn't been exercised end to end yet, blocked on the
   pending-FinancialAccount issue above. Pausing/closing a card needs no
   leader gate (the safe direction, same asymmetry as everywhere else in
   this codebase).

   **What this does NOT solve, named plainly**: a card is a real payment
   instrument, not a checkout flow. Actually spending it against an
   arbitrary website still needs either that merchant's own API (when a
   non-trading mechanism integrates one) or live browser automation --
   explicitly out of scope, same reasoning as round 2.

Verified: a direct $50 human injection correctly raises the bank balance
with zero citizens or trading involved. `issueSpendCard()`'s guard logic
verified via an isolated integration test (real code, mocked `fetch`,
temp paths) -- refuses a non-leader, a quarantined target, and an
over-balance request, bank balance provably unchanged after every
refusal, each refusal recording a real `guard-trip` event; a mocked
successful issuance correctly referenced the discovered FinancialAccount,
sent the spend limit in cents with an `all_time` interval, debited the
bank by exactly the card amount, and the ledger entry was confirmed to
contain no card-number field at all; a second issuance for the same
citizen reused the cached cardholder/FinancialAccount with zero repeat
API calls. The read path (`getFinancialAccountId()`) was ALSO verified
for real against the user's live Stripe test account via the `fa-status`
CLI command, not just mocked. `bus/paper-trades.jsonl` unchanged; no real
`bus/survive-*.jsonl` files exist yet.

**Round 11 (2026-09-17): security guards, visible in the 3D city.**
Direct user framing, worth quoting: "their display/presence in the city
is essentially arbitrary since they are the second defense... it would
be cool if they went after the rogue agent" -- and, separately, that this
was worth building as a real first test specifically *because* it needs
no funding, unlike a citizen. `bus/survive-city-3d.html` gained a small,
FIXED guard population (`GUARD_COUNT = 2`) -- not tied to citizen count
or the bank balance, mirroring `city-security.js`'s own structural
separation from the economy (it reads every citizen, needs no money to
exist or act). The security station building (previously conditionally
grown only once a citizen was quarantined) is now always built alongside
the bank/city hall from the start -- the security team is permanent city
infrastructure, unlike the cemetery, which correctly still only appears
once a citizen has actually died (a real, earned event, left unchanged).
Guards patrol a short loop at the station's door when idle; when a
citizen is quarantined, the nearest free guard's target becomes a spot
beside that citizen in the security yard, so it visibly walks over and
stands watch -- "goes after the rogue agent" in the literal, visual
sense the user asked for. Assignment is 1:1 and stable by citizenId so
the same guard sticks with the same citizen rather than swapping every
poll.

One real bug caught during verification, not just visual polish: guards
initially had no starting position (defaulting to world origin/the town
square), meaning on first load they'd need roughly a minute of simulated
time to walk across town to their post before ever appearing near the
security station -- fixed by stationing them at their post from the
first frame, the same "always present, not something that has to arrive"
principle the round is about. Verified via real headless Chromium
renders (temp camera positioned at the security corner for the
screenshot only, not a permanent change) against the fixture-populated
demo: both guards render with correct navy-uniform/cap/shield-badge
styling, stationed at the station door, with a quarantined citizen
correctly present in the yard for them to respond to; zero console
errors. Also re-verified against the real, live, not-yet-funded dashboard
route: the security station now appears even with zero citizens, no
regression to `/economy.html`, `/city.html`, or either JSON endpoint.

**Reference material (2026-09-17, not part of the running system):**
`reference/TradingAgents/` is a shallow clone of
[TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents)
(107k stars, Apache 2.0, actively maintained, backed by an arXiv paper) --
pulled in as design reference after the user asked, before founding C1
for real, whether this system's single research-pass-then-decide mission
prompt was as rigorous as it could be. It isn't wired into anything;
nothing here imports or depends on it. Worth knowing why it's a genuinely
good reference, not just popular: its core loop is a structured multi-
agent DEBATE (independent fundamental/sentiment/technical analysts ->
a bull researcher and bear researcher arguing opposing cases -> a risk-
management team and portfolio manager making the final call), a more
rigorous process than this branch's current one-research-pass/one-
decision-pass mission authoring. If `authorNewMission()` is ever revised
to add an adversarial bull/bear step before a citizen's decision task,
this is the reference that prompted it -- named here so the connection
isn't lost.

**Round 12 (2026-09-17): sizing discipline, and the first real execution
proof.** Direct user concern, exact words: "50 dollars is not enough for
it to learn from" -- with no sizing rule, a citizen's very first decision
could deploy most of a lifetime stake on one trade. `survive-budget-envelope.js`
gained `MAX_POSITION_FRACTION_OF_LIFETIME_ALLOCATION = 0.4`, enforced
inside `checkLifetimeBudgetEnvelope()` (structural, not prompt-only --
the decision task's prompt states the rule too, so the LLM doesn't waste
a cycle proposing something that will be refused, but the code is what
actually stops it). Anchored to `lifetimeAllocationUsd` (genesis +
topups) deliberately, not current/shrinking cash and not current/growing
balance -- a fraction-of-remainder rule spirals toward ever-smaller
trades as cash depletes, and a fraction-of-current-balance rule would
quietly raise the risk ceiling after a lucky streak. This cap never
moves just because a citizen won or lost. Verified: a $20 order on a $50
allocation passes (exactly 40%), $21 is refused with a reason naming the
cap specifically, a $45 order (well within available cash) is still
refused, and after a simulated loss the cap stays anchored to the
original $50, not the smaller remaining cash.

**Also this round**: the first-ever real exercise of `survive-executor.js`'s
order-submission path (research/decision/journal have all been unit-
tested at the function level all session, but nothing had ever actually
called `submitOrder()` for real, not even once) -- a throwaway test
citizen, isolated ledger/registry paths (so C1's real future history
stays untouched), a hand-written decision task (the point was proving
execution mechanics, not testing LLM judgment), run for real against the
unmodified paper Alpaca API. Found and fixed a real bug this way:
Alpaca auto-cancels a plain market order it can't queue (market closed
at the time of the test) about 11-12 seconds after submission -- just
past the original 10-second fill-poll window -- and the executor was
reporting this as a generic "entry did not fill within the retry window
(fill-timeout)", which is honestly wrong; nothing timed out, Alpaca made
a real, final decision on the order. Fixed: a terminal
canceled/rejected/expired status (re-checked once, ~1s after the
executor's own cancel request, since the terminal state can land just
after the original poll window) is now named for what it is, with the
likely cause stated plainly, rather than mislabeled as a timeout.

**Honestly incomplete, not glossed over**: this proves order submission
end-to-end for real (authentication, payload shape, symbol/notional
handling, client-order-id, reaching the real paper account) -- it does
NOT yet prove a real fill, protective-stop placement after a fill, or
the exit path, since the market was closed for this entire test session.
That remains the one piece to verify once markets are open before
trusting this live.

**Round 13 (2026-09-17): adversarial bull/bear debate before every
decision.** Direct follow-through on the round-11 TradingAgents reference
(`reference/TradingAgents/`) -- the mission pipeline was one research
pass then one decision pass; now it's research -> two INDEPENDENT
reviewers (a bull case arguing FOR acting, a bear case arguing AGAINST)
dispatched in parallel, each seeing only the research, never each
other's output -- then a final decision task that fans in on BOTH and is
explicitly told to weigh them honestly rather than default to whichever
it reads first. This is a real, direct upgrade to `authorNewMission()`
in `survive-supervisor.js`, not a design note: `writeTaskFile()` gained
`dependsOnTaskIds` support (the local helper only had the single-parent
`dependsOnTaskId` before); `dependsOnTaskIds` itself is not new --
`run-task.js`'s fan-in dependency resolution has existed since 2026-09-02
for exactly this kind of multi-parent case, previously exercised by
`survive-leader-council.js`'s synthesis pattern but never by an
individual citizen's own mission. **Deliberately unchanged**: the
decision task's OUTPUT shape is identical to before (same fenced JSON
block, same fields), so `survive-executor.js`'s parsing and every
existing safety gate (budget cap, the round-12
`MAX_POSITION_FRACTION_OF_LIFETIME_ALLOCATION` sizing cap, protective
stop placement, quarantine checks) are completely untouched -- this
upgrade only makes the reasoning that PRODUCES the decision more
rigorous, it does not touch how that decision gets executed or guarded.

Bull and bear both get a real, honest out: `"stance": "no-real-case"` is
a legitimate response if the research doesn't actually support a case in
that direction -- the decision prompt explicitly treats two
`"no-real-case"` reviews as real information (default toward hold/
no-action), not a prompt-engineering failure to paper over.

Verified against the REAL `run-task.js` dependency-resolution engine
(not mocked): a throwaway test citizen's real mission was authored via
the real `authorNewMission()`; confirmed bull and bear each declare
`dependsOnTaskId` pointing ONLY at research (never at each other, and
never both `dependsOnTaskId`/`dependsOnTaskIds` on the same task, which
`run-task.js` itself refuses as ambiguous); confirmed the decision task's
fan-in correctly stays unresolved with only one of bull/bear done, and
resolves only once both are, with both real outputs verbatim in the
injected context. One real mistake caught and fixed during this test:
forgot to isolate `survive-executor.js`'s missions-log test hook, so the
first run wrote one real line into `bus/survive-missions.jsonl` --
caught immediately (only one line, from the throwaway test citizen,
never any real one), deleted, confirmed no real `survive-*.jsonl` file
exists again. `bus/paper-trades.jsonl` unchanged throughout.

**Not yet exercised for real**: no bull/bear/decision task set has ever
actually been dispatched through the live queue daemon to a real LLM --
this proves the wiring is correct, not yet what the debate actually
produces in practice. That happens the first time C1's supervisor wake
authors a real mission.

**Round 13b (2026-09-17): closing the stop-reconciliation gap named
since Phase A.** `survive-executor.js`'s own header had flagged this
honestly from the start: "unlike `monitor-paper-trades.js`'s continuous
stop-reconciliation loop for the existing fleet, this file does not yet
re-arm a 'day' stop that expires, or reconcile a position the log thinks
is open but a stop already closed." Left unaddressed, this was a real,
severe risk: a protective stop firing is Alpaca's own order engine acting
server-side, completely independent of this code -- with nothing to
reconcile it, a citizen's ledger would permanently believe the position
is still open (`executeEntry()`'s "one position at a time" rule refuses
to ever let it trade again), silently stalling the citizen forever even
though the stop worked correctly and real settled cash is sitting in the
account. Given fractional-share GTC-stop rejections falling back to a
'day' order are the observed COMMON case on the existing fleet's own
real trade log, this was a realistic, not theoretical, way for C1 to get
permanently stuck on its very first loss.

New `survive-executor.js` function `reconcilePosition({ client, citizenId })`:
no-ops if the ledger has no open position; checks the real account's real
`getPositions()` for that symbol -- still there, no-op (the normal case);
gone, searches real closed orders for the matching filled sell and
records the REAL fill price via the exact same `recordOrderFill()`/
`recordRealizedProfitSplit()`/`maybeTripPermanentShutdown()` path
`executeExit()` already uses, so a stop-closed loss still correctly
triggers no profit split, and a stop-closed profit still correctly
splits 65/20/15. If the account shows the position gone but genuinely no
matching closed order can be found, it refuses to guess a price and
fires a priority-5 ntfy alert instead -- the same "don't invent, alert a
human" discipline used everywhere else real money is involved. Wired
into `survive-supervisor.js`'s wake loop as the FIRST thing done for
each active citizen, before anything else (a fresh decision, a mission
being authored) can act on what might be a stale ledger.

Verified: two paths (no open position; position genuinely still open)
tested for real against `alpaca-client.js`'s real paper-account API,
including a fake open lot the real account genuinely has no record of --
confirmed it refuses to guess and alerts rather than inventing a close.
The full happy path (a real externally-closed position gets correctly
found and reconciled, including the correct P&L and the correct profit-
split behavior on a loss) was verified with a mocked client, documented
honestly as mocked -- the real paper account has no real filled sell
order to correlate against while markets are closed tonight; its true
first real exercise is whenever a real stop actually fires. Confirmed
reconciling twice in a row is a safe no-op, not a double-reconcile.
`bus/paper-trades.jsonl` unchanged; no real `bus/survive-*.jsonl` files
exist yet.

**Round 14 (2026-09-17): city founded for real; the Knowledge Vault
building; a live mechanism-research reprocessing bug caught and fixed.**

The city was founded for real this round via a clean, unbroken rehearsal
proof (real entry/fill/stop/exit against the paper API) -- citizen C1,
real $50, real live Alpaca account (`cash: $50, equity: $50, status:
ACTIVE`). Two real bugs were found and fixed getting there: `executeExit`
existed in `survive-executor.js` but was never added to `module.exports`
(the rehearsal script crashed calling it directly); and
`recordRealizedProfitSplit()` crashed on a sub-cent profit share (both
20%/15% cuts rounding to exactly $0.00) by unconditionally calling
`recordReserveDeposit()`/`recordBankDeposit()`, which correctly refuse a
non-positive amount -- fixed by skipping a deposit write when its rounded
cut is $0, not by loosening that refusal. C1's first three real missions
all independently, correctly resolved `no-action` on the same SGOV idea
(spread/execution costs would eat the tiny yield edge over cash) -- the
bull/bear debate working exactly as designed, not stuck or broken.

A second real bug was found live, unrelated to any of the above: the
supervisor's wake cadence was tightened from 4h to 15min (so a resolved
decision gets executed promptly instead of sitting for up to 4h -- see
`isMissionDue()`'s in-flight-mission fix earlier this round, a real
duplicate-mission bug also caught live and fixed the same way). At 15min
cadence, `survive-mechanism-research.js`'s `checkResearchResults()` was
observed re-recording the *identical* Kalshi proposal every ~16 minutes
with a fresh timestamp -- it read `survive_mechanism_research_pending_task`,
processed it if done, but never cleared it, so the same completed task
was found "done" and reprocessed forever. Fixed by recording that fact as
`null` once processed, and updating the guard to treat a null value the
same as "nothing pending."

**Knowledge Vault**: a new landmark building (`bus/survive-city-3d.html`,
southwest corner, `park2`'s old meadow lot) representing the city's real
recorded lessons/postmortems (`survive-journal.js`), planned in depth,
independently cross-reviewed (two geometry bugs and three scope gaps
caught before a line was written), then built and verified against the
real, currently-empty data state. `city-status.js` gained `getVaultStats()`
(lesson/postmortem counts + latest timestamps, sourced from
`getJournalEntriesWithLessons()`/a new `getAllPostmortems()`) and a
per-citizen `vaultConsultCount` (a real count of `mission-started` events
-- the exact moment `authorNewMission()` already, unconditionally,
consults the journal). `survive-journal.js` gained a
`_setJournalPathForTesting()` hook (the one survive-*.jsonl module that
didn't have one yet). The building is always-present (like the Bank/City
Hall, not conditionally grown like the Cemetery -- every mission-authoring
wake already consults the journal, lesson or no lesson) with a shell built
once and tablets appended incrementally as real records accrue, mirroring
the Cemetery's headstone pattern exactly.

**Two more real bugs caught by actually rendering the result, not just
reading the code** (the cross-review's own code-level check missed both,
since neither is visible without a real screenshot): a solid single-box
body (copied from `makeBank()`'s pattern) buried the shelf/tablet rack
inside opaque geometry with zero line of sight to it from any angle, ever
-- confirmed by literally placing the camera inside the building and
getting pure black. Fixed by rebuilding the body as a genuine hollow shell
(floor/ceiling/back/front/right walls + an interior light, mirroring
`makeTower()`'s lobby technique) with the left wall deliberately left open
for the glass pane. Separately, that glass pane itself was invisible from
outside because it sat 0.02 units *inside* the opaque wall's own surface,
fully occluded by it -- fixed by moving it just outside instead. Verified
after both fixes: a fixture-populated demo (7 lessons, 2 postmortems)
shows real glowing tablets through the window at night, matching this
city's existing "buildings read via lit windows after dark" visual
language exactly, not a special case.

Verified: isolated test for `getVaultStats()`/`getAllPostmortems()` (empty
baseline, lesson/postmortem counts, exclusion of an un-reflected mission,
real timestamps) and for the mechanism-research reprocessing fix (the
exact live bug scenario reproduced and confirmed fixed) -- both against
real functions with isolated fixture paths, zero real file writes.
Module syntax (`node --check` on the extracted `<script type="module">`)
clean after every edit. Live route confirmed: `vault:
{lessonCount:0, postmortemCount:0, ...}`, C1's real `vaultConsultCount`
(3) exactly matching its real historical mission count. Every existing
route (`/economy.html`, `/city.html`, `/simple.html`, etc.) still 200;
`bus/economy.html`/`bus/city.html` byte-unchanged; no real
`bus/survive-journal.jsonl` created by any test; `bus/scratch-demo/`
mirrors kept in sync.

**Round 15 (2026-09-18): grounding trading decisions in real, verified
data; genuine multi-candidate comparison.**

C1's first four real missions all resolved `no-action` on the same idea
(SGOV), each citing "unverified" cash yield / spread / fractionability --
a technicality, not analysis. Root causes, both fixed: (1) the research
prompt injected zero market data (only ledger numbers + prior lessons +
a local vault-search snippet), so every market fact was an LLM guess;
(2) even facts research DID have were lost downstream -- `run-task.js`'s
`resolveDependency()` relays only a parent's *output*, decision only ever
sees bull+bear outputs, and their JSON shapes had no field to carry real
numbers, so real transcripts show decision calling "available cash" and
"current holdings" *not supplied* when research's own payload stated
both plainly.

Built (plan cross-reviewed with live read-only API calls before a line
was written -- the review reproduced a real ~6% after-hours SCHD spread
that the first draft would have labeled "verified, not an estimate"):
`getAsset(symbol)` (`GET /v2/assets/{sym}` -> tradable/fractionable/
status) and `getClock()` added to both Alpaca clients, mirrored
independently per their no-shared-helper policy, plus `asset`/`clock`
CLI subcommands. `survive-supervisor.js`: `SURVIVE_CANDIDATE_UNIVERSE`
(SGOV, BIL, SHY, VOO, SCHD -- two risk tiers so "stay defensive" must
win an honest comparison), `fetchCandidateUniverseData(client)` (real
quote+asset per candidate through the existing `loadClient({rehearsal})`
seam, per-symbol failure isolation, a 12s bound because neither client's
`fetch()` has any timeout, a single ntfy alert on total failure) and
`formatCandidateUniverseTable()` (deterministic markdown, honest
market-closed caveat from the real clock, n/a guard on a zero mid).
`authorNewMission` is now `async`, takes `{rehearsal}`, pre-fetches and
injects the table; research is asked to compare the candidates and say
why the losers lost, with an explicit escape hatch for an outside idea
flagged as unverified; the recurring cash-yield objection is settled as
a stated assumption (near-zero idle yield for a small non-margin retail
account -- which argues FOR a T-bill ETF, the opposite of what four
decisions assumed; live-tested `GET /v2/account/activities?activity_types=INT`
returns `[]`, so a yield function would only manufacture a new dead end).
The relay fix: bull and bear output shapes gain a required
`verifiedFacts` object (bid/ask/spreadPct/fractionable/tradable/
availableCashUsd) so the exact numbers reach decision through the
unchanged multi-parent fan-in; decision is told to prefer those and never
call a figure "not supplied" that appears there. Task graph, `isMissionDue`,
`findLatestUnresolvedDecision`, `run-task.js` all untouched.

Verified: all 5 universe symbols real/tradable/fractionable/active on
both live and paper (parity confirmed, rehearsal is a true stand-in); a
bad symbol throws a real 404 as the failure path requires; isolated
tests cover per-symbol failure isolation, null-mid guard, timeout
bounding (12.0s measured), exactly-one total-failure alert, ntfy-down
resilience, a rehearsal `authorNewMission` dry run for a scratch citizen
(real table in the written research task, `verifiedFacts` in bull/bear,
unchanged dependency wiring, isolated mission log, in-flight block holds,
files cleaned up), and the relay itself -- fixture bull/bear outputs
carrying `verifiedFacts` reach a decision task's injected context
byte-for-byte through the real `resolveTaskDependencies()`. Full
`main() --rehearsal` completes after the async change. Zero test
citizens leaked into real `bus/memory.jsonl`/`survive-missions.jsonl`.
First real exercise: C1's mission005, on its normal cadence.

**Round 16 (2026-09-18): citizens live in the city -- free-roam + real-data
thought bubbles.** Asked for idle citizens to explore the whole town
(not pace a tiny loop near home) and for a small over-the-head status
bubble, visible only up close, showing what a working citizen is really
doing -- never invented text. Planned, cross-reviewed (the review ran the
new logic against citizen C1's real task files and computed the real
camera/sprite geometry, not the plan's arithmetic), then built.

`bus/survive-city-3d.html`: `idlePoiCategories()` returns front-slot
generators for every currently-built landmark and house (city hall,
bank, vault, security, every `res:N`) -- deliberately not `mech:*`
buildings, since an idle citizen at a mechanism door would read as the
researching citizen actually working there. The wander block gains one
branch for `state === 'idle'` only: pick a category, then a slot, and
`findPath` there -- the lattice already routes anywhere in town, no
pathfinding change. `researching`/`blocked` keep the tight 1.5-6 unit
loop; `in-position`/`quarantined` stay pinned as before. New
`bubbleSprite()` (same camera-facing sprite pattern as the hover name
label) at local `y=3.8`, clear of the badge (top 2.525) and name label
(top 3.3); shown only for `BUBBLE_STATES` (researching/in-position),
faded by `camera.position.distanceTo()` between 22 and 38 units; texture
rebuilt only when the string changes.

`bus/scripts/city-status.js`: `deriveWorkStatusText()` derives the stage
from which of the mission's four real task files is `done` (via
`run-task.js`'s `readTaskFile`, DI'd for tests): "Researching
options..." -> "Weighing the case..." -> "Deciding on {symbol}..."
(symbol only from bull's own structured output when it went bullish,
never guessed) -> then branches on the decision's REAL `decision` field:
"Ready to enter/exit {symbol}..." or "Wrapping up -- staying put for
now". That last branch is a cross-review fix: the draft keyed on
`symbol` alone, and during the real ~13-minute window between a
decision task finishing (05:59:12Z on mission005) and its
`mission-resolved` event (06:11:57Z), it would have shown "Ready to act
on SGOV..." for a decision that was `no-action`. `in-position` uses only
already-free data ("Holding {symbol}") -- no live Alpaca call was added
to the 2-second poll path, by design. `statusText` is `null` for every
other state.

Verified: 15 isolated checks (all four pipeline stages, all four
decision outcomes, the no-real-case honesty gap, undefined task ids, no
events) plus the real mission005 files through the real `readTaskFile`
-> "Wrapping up -- staying put for now"; module syntax clean; real
endpoint returns `statusText: null` for idle C1; fixture-populated demo
screenshots show "Weighing the case..." over the researching citizen up
close and no bubbles at the default camera; all 7 routes 200;
`bus/economy.html`/`bus/city.html` unchanged; no real mission/task
files touched; demo copy kept in sync, temporary close-up page removed.

### Round 17 (2026-09-18): concurrent research swarm

`research-swarm-cycle.js` (daily oneshot, systemd unit written, NOT
installed) fans 15 specialist research categories through a bounded async
pool (`research-swarm-worker.js`, concurrency 2, raw `child_process.spawn`
with an `'error'` handler, explicit PATH, per-task 10-minute timeout).
Tasks live in `tasks-research-swarm/survive/`, a directory the shared
`run-queue-daemon.js` watch never sees, tracked by
`bus/research-swarm-events.jsonl` (stale-cycle recovery after 2h).
`mechanism-registry.js` now ignores `*.proposed.js` so drafted proposals
are never `require()`d. The old weekly `survive-mechanism-research.js` is
retired in place.

### Round 18 (2026-09-18): codex outage detect-and-recover

`codex-health.js` probes codex only while something is stuck, alerts once
per outage transition, and `survive-supervisor.js`'s `recoverDeadMissions()`
resolves a wedged mission as a `dispatchFailure` once the probe passes
(next mission due immediately, capped at 3 consecutive failures).

### Round 19 (2026-09-19): prerequisites for safe self-improvement

No improver agents yet -- this round builds what they need first.
- **Credit-free test suite**: `bus/tests/survive/*.test.js`
  (`node bus/scripts/run-survive-tests.js`). Each test runs against a
  sandboxed COPY of `bus/scripts` in a temp dir (`_sandbox.js`), which
  re-roots every path (ledgers, `tasks/`, `agents/`, `mechanisms/`) with no
  changes to the modules under test; `ntfy.js` is stubbed and any outbound
  network attempt throws. codex is faked with a shell script through the
  real dispatch path. It cannot touch live state or spend credits.
- **Change gate**: `survive-change-gate.js --base <ref> --candidate <ref>`
  diffs refs (never the live tree), refuses (exit 3) any change touching
  `bus/protected-paths.json` (read from the BASE ref so a candidate cannot
  weaken it), then syntax-checks and runs the suite in a temporary
  worktree. Installed systemd units and the crontab are outside the repo
  and outside the gate's view.
- **Shadow scoring**: each mission appends a structured candidate snapshot
  (`bus/survive-shadow.jsonl`); `survive-shadow-score.js` (daily, no LLM;
  timer written, not installed) scores +5/+20 session forward returns from
  split/dividend-adjusted bars (`survive-market-data.js`, read-only) with a
  no-lookahead reference, comparing the citizen's actual policy to
  cash / always-SGOV / always-VOO on the same missions. The board says so
  when every decision is no-action or n is too small.
- **Dispatch budget governor**: `dispatch-budget.js` measures completed codex
  dispatches from `bus/queue-daemon.log` (+ swarm events), gates only the
  discretionary dispatchers we own (`allow('swarm')`), fails closed on a
  missing/short log or unverified codex health, and records per-window
  volume at each out-of-credits transition for calibration. Advisory: it
  cannot stop the shared daemon or the paper fleet. Known blind spots
  (probes, direct codex callers, Claude-side usage) are printed by
  `node bus/scripts/dispatch-budget.js status`.

### Round 20 (2026-09-19): Claude-driven revenue builder

`revenue-builder.js` turns a product spec (`bus/products/*.spec.json`) into a gated,
release-ready product using headless Claude (`claude-worker.js`: tools allowlist, no
Bash/web/MCP, own process group, structured rate-limit parsing; `builder-budget.js`
pauses until the window `resetsAt`). The ORCHESTRATOR gates the result
(`product-gate.js`: secrets scan, manifest/allowlist/pinning, banned constructs and host
allowlist, the product's own tests and spec-owned acceptance cases, all offline via
`unshare -rn`, failing closed). Products live in a separate repo
(`~/AgentVault-products`). `apify-publisher.js` packages a product as an Apify Actor
(generated wrapper with per-event billing) and publishes via the REST API; the human-only
prerequisite is the marketplace account/token and payout identity verification.

## Related Notes

- [[00 - Master Agent Index]] (hub)
- [[04 - Remote Codex Access (Tailscale)]] (application) -- makes the agent-comms dashboard described in section 2 reachable off the home WiFi
- [[01 - Task Dispatch & Live Sub-Agent Dashboard]] (context) -- documents the agent-comms task system this file's section 2 describes as separate/unaudited from /bus/
