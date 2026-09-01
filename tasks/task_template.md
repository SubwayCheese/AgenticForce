# Task Template

Copy this into a new file under /tasks/ named for the task_id.

## [task_id]
from:
to:
type: request | response | error
status: pending | in_progress | done | blocked
payload:
timestamp:

## Mandatory prompt suffix (Codex tasks, added 2026-08-31)

Every prompt actually sent to Codex for this task must end with this block
verbatim -- see /roles/codex_role.md for why:

  Before answering: state the as-of date/period your answer is anchored
  to (you have no live data lookup, so say what your knowledge reflects).
  If anything about this request's premise looks wrong, outdated, or
  unanswerable, say so plainly as the first line of your response instead
  of answering around it.
