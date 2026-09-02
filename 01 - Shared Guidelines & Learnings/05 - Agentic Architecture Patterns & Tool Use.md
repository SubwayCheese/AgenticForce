---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: guideline
status: active
domain: guidelines
description: "Agentic Architecture Patterns, Loops & Tool Security"
tags: ["architecture-patterns", "tool-use", "autonomous-loops"]
---
# Agentic Architecture Patterns, Loops & Tool Security

Detailed architectural guide covering AI agent loop mechanics, multi-agent frameworks, hybrid memory topologies, self-healing code loops, and tool security execution layers.

---

## 🔄 1. Agent Reasoning Loop Mechanics

```
                  +-----------------------------------+
                  |           User Request            |
                  +-----------------------------------+
                                    |
                                    v
                       +-------------------------+
                       |      Planner / LLM      |
                       +-------------------------+
                         /          |          \
                        /           |           \
                       v            v            v
           [ ReAct Loop ]   [ Plan & Solve ]  [ Reflection / LATS ]
            Reason->Act        Decompose        MCTS / Critique
                 |                  |                  |
                 v                  v                  v
         +--------------------------------------------------+
         |           Environment / Tool Execution           |
         +--------------------------------------------------+
```

### A. ReAct (Reasoning + Acting)
- **Cycle:** Interleaved sequence of **Thought** $\to$ **Action** $\to$ **Observation**.
- **Execution:** LLM produces internal thought, emits structured tool arguments, host executes tool, feeds observation back to LLM.
- **Use Case:** Dynamic short-horizon tasks ($<10$ steps).

### B. Plan-and-Solve (P&S)
- **Phase 1 (Macro-Planner):** Decomposes goal into sub-task list $T = [t_1, t_2, \dots, t_n]$.
- **Phase 2 (Executor):** Runs micro-loops per step, dynamically updating plan if assumptions fail.
- **Benefit:** Eliminates execution drift and token waste on long tasks.

### C. Reflexion (Episodic Reflection)
- Uses **Actor**, **Evaluator**, and **Self-Reflection Model**.
- Failed execution trajectories generate natural language critiques ($r_t$), which are stored in episodic memory and injected into context for trial $t+1$.

### D. Language Agent Tree Search (LATS)
- Adapts Monte Carlo Tree Search (MCTS) to agent trajectory decision trees (Selection, Expansion, Evaluation via LLM Value Function, Backpropagation).
- Best for complex code generation and theorem proving.

---

## 📊 2. Multi-Agent Framework Comparison

| Dimension | Microsoft AutoGen | CrewAI | LangChain LangGraph |
|---|---|---|---|
| **Core Paradigm** | Conversational / Event Bus | Role-Based Hierarchical Crew | Finite State Machine (DAG / Cyclical Graph) |
| **State Management** | Distributed Conversation History | Role Context & Shared Task Memory | Explicit Centralized State (`TypedDict` / Pydantic) |
| **Orchestration** | Dynamic Message Passing | Sequential / Manager Execution | Explicit State Graph (Nodes, Edges, Reducers) |
| **Human-in-the-Loop** | Native Message Interception | Task Input Approval | First-Class Graph Checkpoints & Interrupt Nodes |
| **Production Fit** | Dynamic Multi-Agent Dialogue | Role-based Autonomous Emulation | Enterprise Core Workflows & Deterministic Loops |

---

## 🧠 3. Hybrid Agent Memory Topologies

```
                          +-----------------------------------+
                          |        AGENT MEMORY ENGINE        |
                          +-----------------------------------+
                                            |
         +------------------+---------------+------------------+------------------+
         |                  |                                  |                  |
         v                  v                                  v                  v
  [ Working Memory ]  [ Episodic Memory ]             [ Semantic Memory ]   [ Procedural Memory ]
  - Active Context    - Timestamped Logs              - Vector Embeddings   - System Prompts
  - Attention Buffer  - Reflexion Critiques           - Knowledge Graphs    - Skill Files (SKILL.md)
  - Tool Call Traces  - Causal Fix Trails             - Hybrid BM25+Dense   - Dynamic Tool Schemas
```

- **Working Memory:** Sliding context window, active system prompt, current tool schemas.
- **Episodic Memory:** Chronological logs of execution trajectories, failure critiques, and fix strategies.
- **Semantic Memory:** Hybrid Vector Search (dense embeddings) + Knowledge Graphs (relational triples `(Entity)-[Relation]->(Entity)`) with Reciprocal Rank Fusion (RRF).
- **Procedural Memory:** Standard operating procedures, system skills (`SKILL.md`), and reusable scripts.

### Context Compaction (WSCI Pattern)
To eliminate **Context Rot** and the **"Lost in the Middle"** bug:
1. **Write:** Log raw tool outputs to scratchpad memory.
2. **Select:** Extract required keys from JSON payloads.
3. **Compress:** Pass tool outputs through lightweight model summaries.
4. **Isolate:** Isolate tool execution sub-dialogues from main dialogue history.

---

## 🛡️ 4. Error Recovery & Tool Security

```
+-----------------------------------------------------------------------------------+
|                            SECURE AGENT EXECUTION LOOP                            |
|                                                                                   |
|  +--------------+    Schema Guard    +----------------+    Sandbox Host    +---+  |
|  | LLM Action   | -----------------> | Pydantic / AST | -----------------> | gV|  |
|  | Generation   | <----------------- | Validator      | <----------------- | Do|  |
|  +--------------+   Exception Inject +----------------+   Execution Output +---+  |
|                                                                                   |
|                                     HITL Gate                                     |
|                                 [ High Risk Action ]                              |
|                                         |                                         |
|                                         v                                         |
|                              ( Human Approval Required )                          |
+-----------------------------------------------------------------------------------+
```

### Self-Healing Execution Loops
- **AST Pre-Validation:** Pass generated code through `ast.parse` before execution to catch syntax bugs immediately.
- **Sanitized Exception Feedback:** Inject sanitized error stack traces back into prompt context for single-turn self-healing.
- **Causal Fix Caching:** Store `(Error_Pattern -> Fix_Strategy)` in episodic memory to fix recurring bugs instantly.

### Security Execution Layer
1. **Execution Sandboxing:** Execute untrusted agent code strictly inside Docker containers, gVisor microVMs, or WebAssembly (Wasm) runtimes.
2. **Strict Schema Guardrails:** Validate function arguments using Pydantic schemas and regex parameter whitelists.
3. **Human-in-the-Loop (HITL) Gates:** High-risk actions (file deletion, deployment, privilege escalation) trigger graph interrupts requiring explicit human confirmation.
4. **Principle of Least Privilege (PoLP):** Scope API keys strictly to required endpoints with short-lived OAuth tokens.

---
*Related:* [[00 - Master Agent Index]] | [[04 - Advanced AI Prompting Frameworks & Metaprompting]] | [[06 - Multi-Agent Automation Best Practices]]
