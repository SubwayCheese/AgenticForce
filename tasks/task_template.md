# Task Template

Copy this into a new file under /tasks/ named for the task_id.

## [task_id]
from:
to:
type: request | response | error
status: pending | in_progress | done | blocked
payload:
timestamp:
dependsOnTaskId: (optional -- see below)

## Mandatory prompt suffix (Codex tasks, added 2026-08-31)

Every prompt actually sent to Codex for this task must end with this block
verbatim -- see /roles/codex_role.md for why:

  Before answering: state the as-of date/period your answer is anchored
  to (you have no live data lookup, so say what your knowledge reflects).
  If anything about this request's premise looks wrong, outdated, or
  unanswerable, say so plainly as the first line of your response instead
  of answering around it.

This suffix is appended automatically by bus/scripts/run-task.js -- do not
duplicate it in `payload:` by hand.

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

## Result (auto)

Do not create this section by hand. bus/scripts/run-task.js appends it
after running a task: `resolved_at`, `blocked_reason` (if blocked), and
the exact captured `output:` (if dispatched), fenced verbatim so later
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
