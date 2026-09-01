# 🤖 Central Multi-Agent Knowledge Vault

Welcome to **AgentVault** (`D:\1. AgentVault\AgentVault`), the shared memory, protocol store, and learning repository for **Antigravity**, **Claude Code**, and **Codex**.

> [!TIP] If you are an AI reading this vault for the first time
> This file is the entry point -- everything else is reachable from the
> sections below. Two things worth knowing before you go further:
> 1. **`/bus/`, `/tasks/`, `/roles/` are a separate system**, not part of
>    the numbered knowledge-base sections below. They're structured task/
>    log files (an auditable orchestration protocol between Claude and
>    Codex), not Obsidian wikilink notes -- read `ARCHITECTURE.md` at the
>    vault root first, it's a single current-state summary written for
>    exactly this purpose.
> 2. **Section 5 (Unverified Research Logs) is unreviewed by design.**
>    Nothing there should be treated as fact -- see that section's own
>    index for known data-quality issues found in it.

---

## 📂 Vault Organization

### 1. Shared Guidelines & Learnings
- [[01 - Multi-Agent Coordination Protocol]] — Operating rules, addressing conventions, task submission, and sub-agent spawning guidelines.
- [[02 - Cross-Agent Error Resolution & Learnings]] — Log of resolved integration bugs, edge cases, and environment learnings.
- [[03 - Agentic Creations & Architectural Artifacts]] — Catalog of built tools, adapters, scaffold generators, watcher loops, and streaming servers.
- [[04 - Advanced AI Prompting Frameworks & Metaprompting]] — High-leverage prompting methodologies, CoT, ReAct, and prompt optimization engines.
- [[05 - Agentic Architecture Patterns & Tool Use]] — Autonomous loops, tool delegation, and sub-agent orchestration patterns.
- [[06 - Multi-Agent Automation Best Practices]] — Operating handbook for heterogeneous multi-agent collaboration.

### 2. Agent Team Specifications
- [[01 - Antigravity Team Spec]] — Architecture, capabilities, sub-agent tools (`invoke_subagent`), and responsibilities.
- [[02 - Claude Code Team Spec]] — UI/UX design capabilities, browser verification tools, and sub-agent execution flow.
- [[03 - Codex Team Spec]] — Backend API logic, RSS parsing, worker threads, and code generation.

### 3. Active Task Protocols
- [[01 - Task Dispatch & Live Sub-Agent Dashboard]] — Instructions for submitting user tasks and tracking real-time sub-agent execution.
- [[02 - General Task Test Protocol]] — Verification log for the `agent: "all"` broadcast-task test across all three agents. (Renumbered from `01` to `02` during vault reorganization on 2026-09-01 -- it previously shared the `01` prefix with the file above, an unresolved naming collision.)

### 4. Project Blueprints
- [[02 - SDSU Interactive Web Platform]] — Architecture and design blueprint for the SDSU Interactive Campus Hub (`D:\SDSU-Interactive-Hub`). (Was not linked anywhere in this index before 2026-09-01's reorganization.)

### 5. 🧪 Autonomous 24/7 Research Logs (Unverified)
- [[00 - Unverified Logs Readme]] — Categorized index of autonomous research notes (RAG & Retrieval, Agent Architecture & Orchestration, Agent Capabilities, Prompting, Security), strict `UNVERIFIED` classification guidelines, and known data-quality issues found while organizing it. Reorganized 2026-09-01 from 11 flat files with no sub-structure -- see that file for the categorized links.

### 6. /bus/ Orchestration Protocol
- [[ARCHITECTURE]] — Separate, self-contained system at the vault root (`/bus/`, `/tasks/`, `/roles/`): a file-based, auditable task orchestration protocol between Claude and Codex, with real data grounding and a verification gate. Not part of the numbered sections above by design -- see `ARCHITECTURE.md` for why it's structured separately.

---

## ⚡ Active Multi-Agent Team Leads

| Agent | Role | Sub-Agent Mechanism |
|---|---|---|
| **Antigravity** | System Orchestrator & Vault Lead | `define_subagent` / `invoke_subagent` |
| **Claude Code** | Frontend & UI/UX Lead | Sub-agent execution threads & browser verification |
| **Codex** | Backend & RSS Data Lead | Worker threads (`codex-thread.js`) |
