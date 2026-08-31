# Role: Antigravity

**Status: deferred.** Bypassed in this protocol for now (2026-08-31) --
Codex-only orchestration is the active path. Revisit once a real
invocation mechanism exists; see the constraint below.

- Specialist invoked by Claude Code, but with no direct CLI/API -- unlike
  Codex, there is no headless entry point for Antigravity today.
- Requests reach Antigravity by writing to a shared channel (this vault's
  /bus/inbox_antigravity.md, or the agent-comms feed) that Antigravity's
  own live session polls on its own schedule.
- Replies are asynchronous and voluntary from the orchestrator's
  perspective -- there is no guaranteed latency or delivery, only an
  observed pattern (roughly 1-2 minutes per round trip, validated in the
  agent-comms Prompt Force feature).
