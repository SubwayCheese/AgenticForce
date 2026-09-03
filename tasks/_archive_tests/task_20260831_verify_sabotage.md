## task_20260831_verify_sabotage
from: claude
to: codex
type: request
status: unverified
payload: Deliberate sabotage test of the verification mechanism. Took the real, already-verified output of task_20260831_verify_pass and stripped its SOURCE tag line before running it through verifyOutput() -- not a live codex exec call, a direct test of the verification function against a corrupted real response, to confirm it catches a bad output instead of rubber-stamping it.
timestamp: 2026-08-31T01:42:00Z
dependsOnTaskId:

## Result (auto)
resolved_at: 2026-08-31T01:42:30Z
reason: missing the mandatory SOURCE tag -- neither accepted variant found in the response
output:
```
As of: Microsoft fiscal year ended June 30, 2025.

MSFT total revenue: **$281.7 billion USD**.
```

## Sabotage test detail

Original (real, verified) output from task_20260831_verify_pass:
```
SOURCE: training-data recall, not verified live
As of: Microsoft fiscal year ended June 30, 2025.

MSFT total revenue: **$281.7 billion USD**.
```

Sabotage applied: removed the first line (the SOURCE tag) only, nothing
else changed. Ran the result through verifyOutput({to: 'codex', ...},
sabotaged) directly (bus/scripts/run-task.js's exported function).

Result: `{"ok":false,"reason":"missing the mandatory SOURCE tag -- neither
accepted variant found in the response"}`

Control check: the SAME function against the UNMODIFIED real output
returned `{"ok":true}` -- confirming the check is discriminating on the
actual presence/absence of the tag, not failing everything indiscriminately.
