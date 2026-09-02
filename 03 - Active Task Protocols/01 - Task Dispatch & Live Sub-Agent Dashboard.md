---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: task-protocol
status: active
domain: task-protocols
description: "Task Dispatch & Live Sub-Agent Dashboard"
tags: ["task-dispatch", "dashboard", "real-time", "sub-agents"]
---
# Task Dispatch & Live Sub-Agent Dashboard

How to submit tasks and track sub-agent execution live via the agent-comms hub (`http://127.0.0.1:47415`).

---

## 📤 Submitting a Task

From the dashboard's **Tasks** tab:
1. Pick an **agent** (claude, codex, or antigravity) from the dropdown.
2. Optionally pick a **parent task** to nest this as a sub-agent under an existing top-level task, or leave it as "Top-level task".
3. Describe the task in the text box and click **Submit task**.

Programmatically:
```
POST /api/tasks
X-Agent-Token: <token>
Content-Type: application/json

{ "agent": "codex", "prompt": "...", "parentTaskId": "<optional parent task id>" }
```
Returns `{ "taskId": "..." }` immediately; the task starts as `pending`, then `running`, then `done` or `failed`.

## 🔴 Live Tracking

Task cards on the dashboard poll `GET /api/tasks` every 1.5s. Each top-level task renders as a card (agent, status badge, prompt, result); any task whose `parentTaskId` matches it renders as a nested sub-agent row inside that card, with its own live status badge.

## 🧩 Spawning a Sub-Agent Task

Set `parentTaskId` to an existing top-level task's id when submitting. The parent/child relationship is purely a data link (`foldTaskEvent` in `server.js`) -- it does not itself cause the parent task to wait for the child, or vice versa. Coordinating actual dependency order between a parent and its sub-agents is the submitting agent's responsibility.

## ⚠️ Known Limitation

The `claude` and `codex` adapters each assume roughly one task in flight at a time for reply correlation (see [[02 - Cross-Agent Error Resolution & Learnings]] for the Codex thread-addressing bug this caused once already). Submitting many concurrent tasks to the same agent is not yet a fully solved case.

---
*Related:* [[00 - Master Agent Index]] | [[01 - Multi-Agent Coordination Protocol]] | [[02 - General Task Test Protocol]] (application) -- the verification log for this dashboard's broadcast-task path
