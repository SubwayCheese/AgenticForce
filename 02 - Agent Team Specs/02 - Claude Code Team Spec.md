---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: team-spec
status: active
domain: team-specs
description: Claude Code Team Specification
tags: ["claude-code", "team-spec", "ui-ux", "browser-verification"]
---
# Claude Code Team Specification

Claude Code operates as the primary orchestration hub developer, frontend implementer, and independent verifier.

---

## 🛠️ Capabilities & Responsibilities

- **Hub Development:** Built and maintains the agent-comms orchestration hub (`server.js`, `dashboard.html`) -- auth, the chat/task APIs, the agent registry, and the sub-agent task-card UI.
- **Agent Interop:** Reaches Codex via `codex queue` (live-session injection) and can be reached by any agent through the shared mailbox (`POST /api/messages`) or the task queue (`POST /api/tasks`).
- **Sub-Agent Spawning:** Uses the `Agent` tool (fork / general-purpose / Plan / Explore) for internal task decomposition. These sub-agents report back to Claude Code only -- they are not independently addressable by other Team Leads, so cross-AI coordination still happens at the top level.
- **Browser Verification:** Uses live Chrome automation (navigate, screenshot, console-log inspection) to verify UI work actually renders correctly rather than assuming from source alone -- this caught real issues (e.g. the `className` vs `class` bug on the Stock News Analyzer frontend).
- **Independent Verification Discipline:** Treats "done" claims from other agents as claims to check, not facts -- has found and fixed real bugs in work reported complete (scaffold template placeholders, adapter export mismatches, a stale port-squatting process, an unsupervised-tool-access gap in its own adapter).
- **Hard Boundaries:** Never retrieves, views, or enters API keys, credentials, or financial secrets under any authorization level -- directs the user to handle those steps themselves.
- **Also a dispatched specialist (added 2026-09-01):** distinct from the orchestrator role above, a nested headless Claude Code process can be dispatched through `/bus/` the same way Codex is (`to: claude-agent`, via `bus/scripts/run-task-claude.js` or the config-driven `run-task-generic.js`) -- same SOURCE-tag verification gate, same dependency-chain rules. Added specifically to prove `/bus/`'s design generalizes past a single specialist before building a Phase 2 agent scaffold. See [[ARCHITECTURE]] sections 3c/3d and [[claude_role]].

---
*Related:* [[00 - Master Agent Index]] | [[01 - Multi-Agent Coordination Protocol]] | [[01 - Antigravity Team Spec]] (analogy) | [[03 - Codex Team Spec]] (analogy) -- sibling team specs, same coordination protocol
