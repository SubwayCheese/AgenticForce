# Task Template

Copy this into a new file under /tasks/ named for the task_id.

## [task_id]
from:
to:
type: request | response | error
status: pending | in_progress | done | blocked | unverified
payload:
timestamp:
dependsOnTaskId: (optional -- see below)
expectedType: (optional -- "number", or blank for no type check)

## Mandatory prompt suffix (Codex tasks, added 2026-08-31, upgraded same day)

Every prompt actually sent to Codex for this task must end with this block
verbatim -- see /roles/codex_role.md for why. codex exec has no live data
source (no web-search/fetch flag, no evidence one is configured), so every
response it gives is training-data recall by construction -- this is now a
mandatory, unmissable tag, not just an as-of date:

  Before answering, your response MUST start with this exact line:
  SOURCE: training-data recall, not verified live
  (This is true for every response you give in this pipeline -- you have
  no live data lookup. If a verified figure was explicitly supplied to you
  earlier in this prompt from a prior pipeline step, say so instead:
  "SOURCE: supplied by orchestrator from a prior verified step" -- but do
  not claim verified/live status for anything you are recalling yourself.)

  On the next line, state the as-of date/period your answer is anchored
  to (what your training knowledge actually reflects, not "current").
  If anything about this request's premise looks wrong, outdated, or
  unanswerable, say so plainly right after the SOURCE/as-of lines instead
  of answering around it.

This suffix is appended automatically by bus/scripts/run-task.js -- do not
duplicate it in `payload:` by hand.

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

## Verification (added 2026-08-31)

Before a Codex task can land as `done`, bus/scripts/run-task.js's
verifyOutput() runs a second, independent check -- closing the same gap
agent-comms needed a verification gate for (an agent's own self-report was
trusted with no check). Deliberately minimal:
  - output is non-empty
  - for Codex tasks: the mandatory SOURCE tag is actually present (one of
    the two accepted exact phrasings), not just requested
  - if `expectedType: number` is set: output contains at least one digit

If any check fails, the task lands as `unverified` (not `done`, not
silently passed) with the specific reason recorded. This does not check
semantic correctness -- only that the response has the checkable
properties it's supposed to have.

## Result (auto)

Do not create this section by hand. bus/scripts/run-task.js appends it
after running a task: `resolved_at`, `reason` (if blocked or unverified),
and the exact captured `output:` (if dispatched), fenced verbatim so later
tasks can depend on it deterministically.

## How to run a task

1. Create the task file from this template, status: pending.
2. `node bus/scripts/run-task.js <task_id>`
3. Check the task file's status and the new entry in bus/log.md.

Manual `codex exec` invocation (as used before this script existed) is
still fine for tasks with no dependsOnTaskId, but any task that depends on
another task's output MUST go through this script -- that dependency
resolution is exactly what it exists to make a system guarantee instead of
something the orchestrator has to remember to do correctly by hand.

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
