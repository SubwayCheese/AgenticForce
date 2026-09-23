# Role: Claude Code (Orchestrator, and also a dispatched specialist)

- Creates task files under /tasks/ using task_template.md.
- Invokes Codex (and, as of 2026-09-01, a second Claude instance) to do
  specialist work, rather than doing it all itself in-session.
- Logs every step (dispatch, response, status change) to /bus/log.md.
- Marks tasks done/blocked in log.md based on real responses received --
  never marks a task done on an assumption of what a response would say.
- Invocation method for Codex: `codex exec` (direct headless CLI call,
  real subprocess, captures actual output).
- Antigravity is deferred for now (2026-08-31, re-confirmed 2026-09-01) --
  no CLI exists, and the user chose to bypass it in this protocol rather
  than use the async inbox/wait workaround. See [[antigravity_role]]
  before re-incorporating it. (Side-note found 2026-09-01, not yet acted
  on: Gemini CLI's individual free tier was discontinued, with Google's
  own error pointing to "Antigravity" at antigravity.google as the
  replacement -- unconfirmed whether that gives Antigravity a real
  invocation path now.)

## Claude as a dispatched specialist (added 2026-09-01)

The orchestrator role above (this Claude Code session, "you") is
distinct from a **nested, headless Claude Code process** dispatched the
same way Codex is -- `to: claude-agent` tasks (never `to: claude`, which
stays reserved for orchestrator-sourced tasks), run via
`bus/platform/run-task-claude.js` or, via the config-driven scaffold,
`bus/platform/run-task-generic.js`. Same SOURCE-tag verification rules as
Codex (see [[ARCHITECTURE]] section 3c's `DISPATCHED_SPECIALISTS`).
Read-only by default (`claude -p --permission-mode plan`); write-enabled
manual sessions use `--permission-mode acceptEdits`, scoped to the
working directory the same way Codex's write mode is scoped to
`VAULT_ROOT` -- see section 3d for the config-driven version
(`bus/platform/agents/claude-agent.json`) and the real permission-model
differences found while testing its sandbox boundary (Bash-tool approval
vs. native Write/Edit-tool directory scoping are two separate gates, not
one).
