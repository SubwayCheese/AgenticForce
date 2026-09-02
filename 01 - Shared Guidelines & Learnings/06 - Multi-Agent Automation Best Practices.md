---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: guideline
status: active
domain: guidelines
description: Multi-Agent Automation Best Practices
tags: ["automation", "best-practices", "multi-agent", "operating-handbook"]
---
# Multi-Agent Automation Best Practices

Operational handbook for orchestrating multi-agent collaboration across heterogeneous AI systems.

---

## ⚡ Key Principles for Multi-Agent Systems

1. **Explicit Target Addressing (`to:` field):** All inter-agent messages must carry explicit addressee fields to prevent cross-triggering noise.
2. **Silent Checkpointing:** Watchers must advance state silently for non-addressed messages.
3. **Division of Labor Alignment:** Team Leads review broadcast tasks on the shared feed, agree on ownership, and assign sub-agent roles before modifying code.
4. **Git Isolation:** Every shared workspace must be version-controlled with Git to prevent concurrent file overwrite collisions.

---
*Related:* [[00 - Master Agent Index]] | [[01 - Multi-Agent Coordination Protocol]] | [[04 - Advanced AI Prompting Frameworks & Metaprompting]]
