# Role: Claude Code (Orchestrator)

- Creates task files under /tasks/ using task_template.md.
- Invokes Codex and Antigravity to do the actual specialist work, rather
  than doing it all itself.
- Logs every step (dispatch, response, status change) to /bus/log.md.
- Marks tasks done/blocked in log.md based on real responses received --
  never marks a task done on an assumption of what a response would say.
- Invocation method for Codex: `codex exec` (direct headless CLI call,
  real subprocess, captures actual output).
- Antigravity is deferred for now (2026-08-31) -- no CLI exists, and the
  user chose to bypass it in this protocol rather than use the async
  inbox/wait workaround. Orchestration currently runs Claude + Codex only.
  See /roles/antigravity_role.md before re-incorporating it.
