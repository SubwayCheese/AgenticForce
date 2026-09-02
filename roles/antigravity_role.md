# Role: Antigravity

**Status: deferred, but the "no CLI exists" reason is now stale --
confirmed 2026-09-01, not yet acted on.** Bypassed in this protocol since
2026-08-31 for the stated reason "no CLI/API exists." A web search
(prompted by the Gemini CLI side-note below) confirms Google Antigravity
is a real, actively developed product -- "Antigravity 2.0" launched at
Google I/O 2026 as a standalone desktop app for agentic AI development,
and **now ships a CLI and SDK**, not just a GUI. This directly
contradicts this file's own long-standing "no headless entry point"
claim. Whether that CLI is actually installed on this machine, what its
real invocation flags are, and whether it can be wired into `/bus/` the
same way Codex and Claude were (see `ARCHITECTURE.md` section 3c/3d) is
**not yet tested** -- this is a confirmed lead, not a completed
integration. Treat any of this file's text below as describing the OLD,
no-CLI state until someone actually verifies the new CLI locally
(`antigravity --help` or equivalent, `file <path>` for the Windows
wrapper-vs-exe question, one live smoke-test call -- same rigor
`bus/scripts/agents/README.md` documents for Codex and Claude).

- Specialist invoked by Claude Code -- **old assumption below, now
  contradicted by the finding above**: this previously said there was no
  direct CLI/API for Antigravity, unlike Codex and the dispatched-Claude
  specialist. That's the claim the 2026-09-01 web search directly
  contradicts.
- Requests reach Antigravity by writing to a shared channel (this vault's
  /bus/inbox_antigravity.md, or the agent-comms feed) that Antigravity's
  own live session polls on its own schedule. This async/polling path
  still exists and still works; it just may no longer be the only path.
- Replies are asynchronous and voluntary from the orchestrator's
  perspective -- there is no guaranteed latency or delivery, only an
  observed pattern (roughly 1-2 minutes per round trip, validated in the
  agent-comms Prompt Force feature).

**Origin of this finding**: Gemini CLI's individual free tier ("Gemini
Code Assist for individuals") was found to be discontinued (a real error
hit while evaluating it as a possible second `/bus/` specialist,
2026-09-01) -- Google's own error message pointed users toward
"Antigravity" (antigravity.google) as the replacement. A follow-up web
search (2026-09-01, after being asked to specifically check this)
confirmed it's the same real product, now with a CLI/SDK -- not the
vague "might be related" state this note was in a few hours earlier.
