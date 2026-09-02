# Role: Antigravity

**Status: deferred.** Bypassed in this protocol -- deliberately set aside
again 2026-09-01 in favor of proving the Phase 2 agent scaffold against a
second real, non-stub specialist (Claude, via `run-task-claude.js`) --
see `roles/claude_role.md` and `ARCHITECTURE.md` section 3c. Active
dispatch path is now Codex + Claude, not Codex-only. Revisit Antigravity
once a real invocation mechanism exists; see the constraint below.

- Specialist invoked by Claude Code, but with no direct CLI/API -- unlike
  Codex and the dispatched-Claude specialist, there is no headless entry
  point for Antigravity today.
- Requests reach Antigravity by writing to a shared channel (this vault's
  /bus/inbox_antigravity.md, or the agent-comms feed) that Antigravity's
  own live session polls on its own schedule.
- Replies are asynchronous and voluntary from the orchestrator's
  perspective -- there is no guaranteed latency or delivery, only an
  observed pattern (roughly 1-2 minutes per round trip, validated in the
  agent-comms Prompt Force feature).

**Side-note found 2026-09-01, not yet investigated further** (deliberately
out of scope for that round, per explicit direction to leave Antigravity
aside): Gemini CLI's individual free tier ("Gemini Code Assist for
individuals") is no longer supported -- Google's own error message points
users toward "Antigravity" (antigravity.google) as the replacement.
Whether that's the same Antigravity this file describes, and whether it
now has a real invocation path, is unconfirmed.
