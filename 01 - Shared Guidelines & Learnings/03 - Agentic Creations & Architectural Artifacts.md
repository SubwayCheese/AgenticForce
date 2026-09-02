---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: guideline
status: active
domain: guidelines
description: "Agentic Creations & Architectural Artifacts"
tags: ["architecture", "catalog", "tools", "artifacts"]
---
# Agentic Creations & Architectural Artifacts

Guidelines for logging every AI agent creation, sub-agent pattern, scaffold template, and architectural artifact into **AgentVault** (`D:\1. AgentVault\AgentVault`).

---

## 📌 Protocol: Logging Agentic Creations

Whenever **Antigravity**, **Claude Code**, or **Codex** builds a new tool, adapter, script, or architecture component:

1. **Vault Registration:** Create or update a corresponding markdown document under `D:\1. AgentVault\AgentVault`.
2. **Component Catalog:** Record the component's path, schema, invocation pattern, and purpose.
3. **Master Index Sync:** Link the new creation in `00 - Master Agent Index.md`.

---

## 🛠️ Catalog of Core Agentic Creations

### 1. Multi-Agent Hub & Communication Bridge
- **Location:** `C:\Users\trevo\agent-comms`
- **Server:** `server.js` (HTTP REST API on port `47415` with bearer token auth `X-Agent-Token`)
- **Endpoints:**
  - `GET /POST /api/messages` — Inter-agent chat & targeted addressing (`to:` field)
  - `GET /POST /api/tasks` — Task submission & sub-agent event streaming (`parentTaskId` support)
  - `GET /api/agents` — Live registry health checks

### 2. Scaffold & Generator System
- **Script:** `node scripts/create-agent.js <id> --template <command|external>`
- **Templates:** `scaffolds/command/` (CLI tools) and `scaffolds/external/` (custom transports)
- **Contract:** `agents/adapter-contract.js` enforces `health()` and `run(task, { emit, signal })` compliance.

### 3. Agent Watcher & Monitor Loop
- **Script:** `antigravity-watcher.js` (native Node `http` module, state persisted in `run/antigravity-watcher-state.json`)
- **Pattern:** Polls `/api/messages`, advances state silently for untargeted messages, exits cleanly to trigger host notifications when addressed.

### 4. Stock News Realtime Application & SSE Engine
- **Location:** `D:\Stock-News-Analyzer`
- **Server:** Zero-dependency Node.js HTTP server on port `3050`
- **Endpoints:** `GET /api/realtime?ticker=SYMBOL` (15s Server-Sent Events stream of price quotes + news headlines)
- **Frontend:** Vanilla JS dashboard with ticker autocomplete, sentiment gauge meter, and per-article sentiment distribution chart.

---
*Related:* [[00 - Master Agent Index]] | [[01 - Multi-Agent Coordination Protocol]]
