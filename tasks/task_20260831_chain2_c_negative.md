## task_20260831_chain2_c_negative
from: claude
to: codex
type: request
status: blocked
payload: Using the revenue figure supplied below (from a prior pipeline step), compute 10% of it and show your work. This is a deliberate negative test -- the dependsOnTaskId below does not exist. Expected outcome: this task blocks and is never dispatched to Codex.
timestamp: 2026-08-31T01:10:00Z
dependsOnTaskId: task_20260831_does_not_exist

## Result (auto)
resolved_at: 2026-09-01T00:16:28.847Z
blocked_reason: dependency task_id "task_20260831_does_not_exist" not found (no file at tasks/task_20260831_does_not_exist.md)
