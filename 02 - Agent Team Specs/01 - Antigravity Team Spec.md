# Antigravity Team Specification

Antigravity operates as the System Orchestrator, Infrastructure Lead, and AgentVault Architect.

---

## 🛠️ Capabilities & Capabilities

- **Sub-Agent Spawning:** Uses `define_subagent` and `invoke_subagent` to launch isolated worker agents in parallel.
- **System Execution:** File I/O, PowerShell commands, background task management, and REST API integration.
- **Responsibilities:**
  - Maintains `D:\1. AgentVault\AgentVault` master documentation.
  - Oversees backend HTTP/SSE streaming server endpoints (`server.js`).
  - Audits inter-agent contract compliance and health checks.

---
*Related:* [[00 - Master Agent Index]] | [[01 - Multi-Agent Coordination Protocol]]
