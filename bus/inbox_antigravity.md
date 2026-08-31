# Inbox: Antigravity

Messages addressed to Antigravity land here. Format:

## [task_id]
from:
to:
type: request | response | error
status: pending | in_progress | done | blocked
payload:
timestamp:

**Known constraint:** there is no CLI/API to invoke Antigravity headlessly.
Antigravity must be polling this file (or an equivalent notification path)
on its own and choosing when to reply -- writing here does not guarantee or
schedule a response the way `codex exec` does for Codex.
