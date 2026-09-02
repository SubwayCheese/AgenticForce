# Task Template

Copy this into a new file under /tasks/ named for the task_id.

## [task_id]
from:
to:
type: request | response | error
status: pending | in_progress | done | blocked | unverified | unverified_new
payload:
timestamp:
dependsOnTaskId: (optional -- see below)
expectedType: (optional -- "number", or blank for no type check)
enrichWithSearch: (optional -- "true" to auto-prepend top-3 vault search
  results to the prompt via run-task-generic.js; see below. Omit/blank
  for no enrichment, which is the default -- this is opt-in, never
  applied automatically.)

## Which agent, and how to dispatch (updated 2026-09-01)

`to:` accepts three kinds of values, each meaning something different:

- `to: codex` -- dispatch to Codex. Run via `node bus/scripts/run-task.js <task_id>`
  (read-only, autonomous-safe) or `run-task-generic.js <task_id>` (same
  thing, via the config-driven engine).
- `to: claude-agent` -- dispatch to a second, nested headless Claude Code
  process (NOT the orchestrator running this session). Run via
  `node bus/scripts/run-task-claude.js <task_id>` or
  `run-task-generic.js <task_id>`. Added 2026-09-01 specifically to prove
  `/bus/`'s design generalizes past a single specialist -- see
  `ARCHITECTURE.md` sections 3c/3d.
- `to: claude` -- reserved for orchestrator-sourced tasks (see that
  section below). NOT dispatched to any process; the orchestrator writes
  the `Result` block by hand. Do not confuse with `claude-agent`.

`run-task-generic.js [--write]` is the config-driven path (see
`bus/scripts/agents/README.md`): it reads `to:`, loads the matching
`bus/scripts/agents/<to>.json`, and dispatches through
`agent-engine.js`. This is where a third agent would be added --
a new JSON config, not a new script.

## Mandatory prompt suffix (added 2026-08-31, generalized 2026-09-01,
made per-specialist 2026-09-02)

Every prompt actually sent to a dispatched specialist (Codex or
claude-agent -- see `run-task.js`'s `DISPATCHED_SPECIALISTS` set) for
this task must end with the block `run-task.js`'s `getMandatorySuffix(to)`
returns for that specialist -- see /roles/codex_role.md and
/roles/claude_role.md for why.

As of 2026-09-02, **both** real dispatched specialists get the same
three-way honest variant (they're both in `LIVE_FILE_READ_CAPABLE`,
confirmed by real evidence, not assumed -- see `ARCHITECTURE.md`
section 3e/6):

  Before answering, your response MUST start with exactly one of these
  three lines -- pick whichever is actually true for how you produced
  this specific answer:

  SOURCE: training-data recall, not verified live
  (use this only if you answered from what you already know, without
  opening any file in this vault to check)

  SOURCE: supplied by orchestrator from a prior verified step
  (use this only if a verified figure was explicitly supplied to you
  earlier in this prompt from a prior pipeline step -- not for anything
  you looked up yourself)

  SOURCE: verified live via direct file read in this pipeline
  (use this if you actually opened a file in this vault to answer --
  whether via a native file-reading tool or a real shell command like
  cat/Get-Content -- you retain that access, scoped to this vault
  directory, even in this read-only dispatch. Name the exact file
  path(s) you read on the next line.)

  On the line after your SOURCE tag, state the as-of date/period your
  answer is anchored to. If anything about this request's premise looks
  wrong, outdated, or unanswerable, say so plainly right after the
  SOURCE/as-of lines instead of answering around it.

The plain two-tag suffix (`MANDATORY_SUFFIX`, no live-read option) still
exists in `run-task.js` as `getMandatorySuffix()`'s default for anything
NOT in `LIVE_FILE_READ_CAPABLE` -- currently nothing, since both real
specialists were verified live-read-capable, but it stays ready for a
future specialist genuinely without local file access (a pure API-only
call with no shell/tool access to the filesystem).

This suffix is appended automatically by bus/scripts/run-task.js (via
`getMandatorySuffix()`, consumed by run-task-claude.js and
run-task-generic.js too) -- do not duplicate it in `payload:` by hand.

WHY THIS EXISTS (found 2026-08-31): the same "AAPL latest revenue" query
returned $391.0B in one run and $416.2B in another. Both were real,
correct figures -- for FY2024 and FY2025 respectively -- but nothing
labeled which, so the drift looked like an error rather than what it
actually was: two different years, neither one marked as unverified
recall. The SOURCE tag doesn't prevent recall from varying; it makes sure
nothing downstream can mistake that recall for a checked fact.

## dependsOnTaskId (added 2026-08-31)

Set this field to another task's task_id to make this task's dispatch
depend on that task's actual output. Leave blank/omit for an independent
task.

When set, running this task via `node bus/scripts/run-task.js <task_id>`
will, before doing anything else:
  1. Look up the dependency task's file and its status.
  2. Refuse to dispatch (mark this task `blocked` with a stated reason,
     never guess) if the dependency is missing, not yet `done`, or `done`
     with no parseable `output:` field.
  3. Otherwise inject the dependency's `output:` field verbatim into this
     task's prompt, with an explicit instruction not to substitute a
     different recalled value.

Do not hand-copy a prior task's output into `payload:` yourself when
dependsOnTaskId is available -- that reintroduces the exact manual-habit
failure mode this field exists to close.

## enrichWithSearch (added 2026-09-01, opt-in only)

Set to `true` to have `run-task-generic.js` (read-only mode only --
not write mode) search the vault using the task's own `payload:` as the
query, and prepend the top 3 results to the prompt before the mandatory
SOURCE-tag suffix, clearly labeled as unverified auto-search context the
agent should use its own judgment about. Deliberately opt-in, never
applied to every task by default -- most tasks don't need vault context,
and auto-enriching everything would make prompts harder to reason about
for no benefit in the common case. Degrades silently (task still
dispatches normally, just without the enrichment) if search is
unavailable.

**Caveat worth knowing before relying on this**: for the Claude
specialist specifically, this may be redundant -- dispatched read-only,
Claude retains its own native Read/Grep/Glob tools scoped to the vault
directory and has been observed using them directly instead of (or
alongside) this enrichment. See `ARCHITECTURE.md` section 3e/6 for the
full finding. **Fixed 2026-09-02**: this used to also mean
`MANDATORY_SUFFIX`'s "no live data lookup" claim was inaccurate for
Claude -- closed by giving claude-agent its own suffix variant with a
third, honest SOURCE tag (see the "Mandatory prompt suffix" section
above) instead of forcing it to misdescribe a real file read as recall.

## Verification (added 2026-08-31, generalized 2026-09-01)

Before a dispatched task can land as `done`, `run-task.js`'s
verifyOutput() runs a second, independent check -- closing the same gap
agent-comms needed a verification gate for (an agent's own self-report was
trusted with no check). Deliberately minimal:
  - output is non-empty
  - for dispatched specialists (`to:` in `DISPATCHED_SPECIALISTS` --
    today, `codex` and `claude-agent`): the mandatory SOURCE tag is
    actually present (one of the two accepted exact phrasings), not just
    requested
  - if `expectedType: number` is set: output contains at least one digit

If any check fails, the task lands as `unverified` (not `done`, not
silently passed) with the specific reason recorded. This does not check
semantic correctness -- only that the response has the checkable
properties it's supposed to have.

**`unverified_new` is a different thing** (added 2026-08-31, see
tasks/unverified_entry_template.md): it means an entry was never
submitted for verification at all, by design -- background research crew
output, queued for deliberate human review. Do not confuse the two:
`unverified` = failed a real check; `unverified_new` = not checked yet on
purpose.

## Result (auto)

Do not create this section by hand. bus/scripts/run-task.js appends it
after running a task: `resolved_at`, `reason` (if blocked or unverified),
and the exact captured `output:` (if dispatched), fenced verbatim so later
tasks can depend on it deterministically.

## How to run a task

1. Create the task file from this template, status: pending.
2. `node bus/scripts/run-task.js <task_id>` (Codex), `run-task-claude.js
   <task_id>` (claude-agent), or `run-task-generic.js <task_id>` (either,
   config-driven -- reads `to:` automatically).
3. Check the task file's status and the new entry in bus/log.md.

Manual direct CLI invocation (as used before these scripts existed) is
still fine for tasks with no dependsOnTaskId, but any task that depends on
another task's output MUST go through one of the scripts above -- that
dependency resolution is exactly what they exist to make a system
guarantee instead of something the orchestrator has to remember to do
correctly by hand.

**Write-enabled dispatch** (manual, supervised sessions only -- never
autonomous): `run-task-collab.js <task_id>` (Codex) or
`run-task-generic.js <task_id> --write` (either agent, config-driven).
Does not support `dependsOnTaskId`. See `ARCHITECTURE.md` sections 3a/3d.

## Orchestrator-sourced tasks (real grounding, added 2026-08-31)

For a verifiable numeric fact (revenue, price, filing date, etc.), prefer
this pattern over asking Codex to recall it:

  from: claude
  to: claude
  type: response
  status: done
  source: <exact API/endpoint/symbol/period/date(s) used>

Claude fetches the value directly from a connected real data source (e.g.
the FMP financial-data connector) during orchestration and writes the
`output:` field itself, citing the source. This is NOT something
run-task.js or codex exec can do on their own -- there is no API
credential available to hand to a standalone script, and none should be
sought out. A task written this way is consumed by downstream
dependsOnTaskId tasks exactly the same as a Codex-produced one; no change
needed on the consuming side.

Use this for facts a real API can answer (financial statements, prices,
filing metadata). Still use Codex (with the mandatory SOURCE tag above)
for reasoning, summarization, and qualitative analysis that no structured
API can verify -- and never claim "SOURCE: verified live" for something
that was actually recalled.
