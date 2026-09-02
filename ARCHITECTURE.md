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
way `verification_suite/` already was.

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

**A real, not-fully-closed finding surfaced by this same live test**:
when the injected value's own embedded SOURCE/as-of preamble happens to
be well-formed, it has exactly the shape of a complete, valid response
-- and a specialist sometimes copies the WHOLE quoted block verbatim
(embedded SOURCE tag included) instead of producing its own honest
"supplied by orchestrator" tag around it. Two prompt-wording-only fixes
failed against this in real dispatched tests; `wrapInjectedValue()`'s
blockquote-prefixing (`"| "` on every line, breaking the literal
"line starts with SOURCE:" shape) measured 4/5 correct against the
exact shape that broke both earlier fixes -- a real, substantial
improvement, not a complete fix. Tracked honestly as an open item in
section 6 rather than claimed solved.

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

- [ ] A dependency value's own embedded SOURCE/as-of preamble, when
      well-formed, can look exactly like a complete valid response --
      a specialist sometimes copies the whole quoted block verbatim
      (its embedded SOURCE tag included) instead of stating its own
      honest "supplied by orchestrator" tag. Found 2026-09-02 via the
      memory layer's live `dependsOnFact` test (section 3i). Three
      interventions tried the same day, in order: a trailing warning
      (failed), a leading + delimited warning (failed against the exact
      well-formed shape), blockquote-prefixing every line of the quoted
      value (`wrapInjectedValue()` -- 4/5 correct against that same
      shape, a real improvement, not a complete fix). Affects every
      injection path (`dependsOnTaskId`, `dependsOnTaskIds`,
      `dependsOnFact` alike, since all three go through
      `wrapInjectedValue()`). Not chased further this round -- this
      reads as genuine LLM instruction-following variance on a subtle
      case, the same category as the accepted `engine dispatch
      (Claude)` arithmetic flake below, not a code bug with a clean
      fix. `verifyOutput()` still correctly accepts only honest tags in
      an absolute sense (the response isn't fabricating anything, just
      mislabeling provenance) -- this is a real, worth-fixing-eventually
      polish item, not a safety hole.
- [x] ~~`MANDATORY_SUFFIX`'s claim "you have no live data lookup... this is
      true for every response you give in this pipeline" is not actually
      true for the Claude specialist~~ -- **closed 2026-09-02.** Found
      2026-09-01 while testing opt-in search enrichment (section 3e).
      Fixed via `getMandatorySuffix(to)` + `LIVE_FILE_READ_CAPABLE` (see
      section 3e's 2026-09-02 update for the full design). Whether
      Codex's `--sandbox read-only` has the same read-but-not-write
      property remains untested -- deliberately NOT added to
      `LIVE_FILE_READ_CAPABLE` without that verification, tracked as its
      own new open item directly below.
- [x] ~~Whether Codex's `--sandbox read-only` invocation actually has the
      same read-but-not-write property Claude's `--permission-mode plan`
      does~~ -- **closed 2026-09-02, same day.** Tested directly: dispatched
      `tasks/verify_codex_live_read.md`, instructing Codex to
      `Get-Content` a live vault file (`roles/antigravity_role.md`) via a
      real shell command. It returned the correct content (vault-specific
      text -- "Antigravity" -- with no plausible training-data-recall
      explanation), but still opened with "SOURCE: training-data recall,
      not verified live," simply parroting the then-blanket suffix rather
      than catching the contradiction the way Claude did. Codex's
      self-report was NOT trusted alone -- cross-checked against
      `~/.codex/.sandbox/sandbox.*.log`, which recorded the literal
      `Get-Content -LiteralPath 'roles/antigravity_role.md'` PowerShell
      call actually executing at the matching timestamp, with no
      denial/error logged around it. Confirmed: yes, same property.
      `codex` added to `LIVE_FILE_READ_CAPABLE` alongside `claude-agent`;
      `MANDATORY_SUFFIX`'s old blanket claim now has no real dispatched
      specialist it's actually true for (it remains `getMandatorySuffix()`'s
      default for a future specialist without local file access, not
      deleted).

      **A second real bug found immediately after, re-verifying this
      fix**: `tasks/verify_codex_live_read2.md` re-ran the same live-read
      test expecting the new three-way tag -- and Codex still opened with
      the old two-tag line, this time visibly confused by the
      contradiction ("Premise wrong: I read the local file directly."
      instead of actually answering). Not a model failure: `run-task.js`'s
      own `main()` (the direct `node run-task.js <task_id>` path used by
      both this test and the suite's `runFullTask()`) had been missed
      when `getMandatorySuffix()` was introduced and still hardcoded the
      flat `MANDATORY_SUFFIX`. A vault-wide sweep for every remaining
      flat-suffix call site turned up three more real, still-live ones
      with the same staleness -- `run-research-crew.js`,
      `run-backlog.js`, `watch-inbox.js` -- all fixed the same way.
      `tasks/verify_codex_live_read3.md` then confirmed the actual fix:
      `SOURCE: verified live via direct file read in this pipeline` /
      `As of: roles/antigravity_role.md` / `Antigravity` -- correct tag,
      correct file cited, correct answer.
- [x] ~~`verifyOutput()`'s `expectedType: number` check scans the entire
      response for any digit, not specifically the answer~~ -- **closed
      2026-09-01.** Tightened to check only the last non-empty line
      (matching every task's own "reply with ONLY the number on its own
      line" convention), after verifying the change against all 16 real
      dispatched responses recorded so far that day -- old and new logic
      agreed on every one, confirming the tightening only affects the
      actual false-positive shape, not real traffic. A regression case
      for exactly this (digit only in the as-of preamble, non-numeric
      last line) is now permanent in `run-verification-suite.js`.
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
      deferred (deliberately set aside 2026-09-01 in favor of proving the
      Phase 2 scaffold against a second real agent -- Claude, via
      `run-task-claude.js`/section 3c -- instead of a third stub).
      **Update 2026-09-01 (confirmed, not yet acted on):** the Gemini
      CLI side-note below turned out to matter. Explicitly asked to
      check it -- a web search confirms Google Antigravity is real and
      current ("Antigravity 2.0," launched at Google I/O 2026, a
      standalone desktop app for agentic AI) and **now ships a CLI and
      SDK**, not just a GUI. This directly contradicts
      [[antigravity_role]]'s long-standing "no CLI/API exists"
      claim -- that file has been updated to say so. Still NOT tested:
      whether the CLI is actually installed on this machine, its real
      flags, or whether it can be wired into `/bus/` the same way Codex
      and Claude were (section 3c/3d's playbook). This is a confirmed
      lead, not a completed integration -- a fourth `/bus/` specialist
      is a real, separate decision, not something to build from a
      one-paragraph web search result.
      Original side-note: Gemini CLI's free tier ("Gemini Code Assist
      for individuals") is no longer supported -- Google's own error
      message points users toward "Antigravity" (antigravity.google) as
      the replacement.
- [x] ~~Dependency chains tested only for a single linear hop~~ -- **closed
      2026-09-01.** Ran a 3-task linear chain (`task_20260901_chain_a` ->
      `_b` -> `_c`): a hand-authored seed value (137, deliberately
      non-round), then two Codex steps each doing a deterministic
      transformation (+15, then x2). Final result landed exactly 304 --
      the mathematically correct value, not a plausible-looking guess --
      confirming injected values propagate losslessly across two hops, even
      though step C had to parse the real number out of step B's full
      SOURCE-tagged output blob rather than a clean value. Both steps'
      verification gate passed correctly. **Still open:** true fan-in (one
      task depending on multiple parents) isn't testable because it isn't
      implemented -- `dependsOnTaskId` is a single scalar field in the task
      schema, not a list.
      **Chain length beyond 3 hops: closed 2026-09-01.** Ran a 5-hop
      chain (`task_20260901_longchain_a` -> `f`), alternating Claude and
      Codex at every hop (seed 7 -> +5[Claude]=12 -> x3[Codex]=36 ->
      +8[Claude]=44 -> x2[Codex]=88 -> +19[Claude]=107), dispatched
      entirely through `run-task-generic.js`. Landed exactly 107 -- zero
      drift across 5 hops and 3 agent switches. Nothing in the mechanism
      turned out to be hop-count-sensitive, confirming the earlier
      suspicion with actual evidence instead of leaving it open.
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

## Related Notes

- [[00 - Master Agent Index]] (hub)
- [[04 - Remote Codex Access (Tailscale)]] (application) -- makes the agent-comms dashboard described in section 2 reachable off the home WiFi
- [[01 - Task Dispatch & Live Sub-Agent Dashboard]] (context) -- documents the agent-comms task system this file's section 2 describes as separate/unaudited from /bus/
