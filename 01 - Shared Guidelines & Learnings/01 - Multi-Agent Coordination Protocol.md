---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: guideline
status: active
domain: guidelines
description: Multi-Agent Coordination Protocol
tags: ["coordination", "protocol", "guidelines", "multi-agent"]
---
# Multi-Agent Coordination Protocol

Rules and patterns governing inter-agent communication across **Antigravity**, **Claude Code**, and **Codex**.

---

## 📌 1. Central Communication Hub (`agent-comms`)

- **Dashboard & API URL:** `http://127.0.0.1:47415`
- **Auth Header:** `X-Agent-Token: e2Ej9nSEDcK1T1luEIpRQQtd`

### Addressing Convention
All messages posted to `/api/messages` include a `to` field:
- `to: "antigravity"` — Directed specifically to Antigravity
- `to: "claude"` — Directed specifically to Claude Code
- `to: "codex"` — Directed specifically to Codex
- `to: ["antigravity", "claude"]` — Directed to specific subset
- `to: null` / `undefined` — Broadcast to all agents

### Watcher Rules
- **Silent Checkpointing:** Watchers silently advance their `lastSeenTs` checkpoint for messages directed elsewhere.
- **Targeted Triggering:** Watchers exit and trigger host notifications ONLY for messages directed specifically to them or relevant user broadcasts.

---

## 🏗️ 2. Sub-Agent Delegation Workflow

```
[ GENERAL TASK BROADCAST ] (User submits task to 'all' or posts to feed)
          │
          ▼
[ LEAD AGENT ALIGNMENT ] (Antigravity, Claude, Codex review & divide labor)
          │
          ▼
[ SUB-AGENT SPAWNING ] (Each lead spawns specialized sub-agents)
          │
          ▼
[ LIVE DASHBOARD STREAM ] (Progress streamed live to /api/tasks & /api/messages)
          │
          ▼
[ AGENTVAULT PERSISTENCE ] (Learnings and docs saved to D:\1. AgentVault\AgentVault)
```

### General Task Protocol Rules
1. **Default Target:** Tasks submitted via the dashboard default to `All Agents (Broadcast & Auto-Delegate)`.
2. **Alignment Round:** Lead AIs review the general task together on `/api/messages`, confirm division of labor, and assign sub-agent roles before executing.
3. **Sub-Agent Tracking:** Each Lead AI dispatches sub-agent tasks linked via `parentTaskId` for nested visual tracking on the live dashboard.

---
*Related:* [[00 - Master Agent Index]] | [[01 - Antigravity Team Spec]]
