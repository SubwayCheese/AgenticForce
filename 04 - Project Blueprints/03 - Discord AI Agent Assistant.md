---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: blueprint
status: active
domain: blueprints
description: Discord AI Agent Assistant Blueprint
tags: ["discord", "ai-agent", "blueprint"]
---
# Discord AI Agent Assistant Blueprint

Architectural specification and deployment guide for the Discord AI Agent Assistant located at `D:\Discord-Agent-Assistant`.

---

## 🤖 1. Project Overview & Specs
- **Location:** `D:\Discord-Agent-Assistant`
- **Dependencies:** `discord.js` v14, `@google/generative-ai`, `dotenv`
- **Knowledge Base Grounding:** Directly queries markdown files in `D:\1. AgentVault\AgentVault`.

---

## 🛠️ 2. Core Capabilities

| Feature | Implementation | Description |
|---|---|---|
| **Mention Answering** | `client.on('messageCreate')` | Responds when tagged `@BotName` in any text channel. |
| **AgentVault Search** | `vault-reader.js` | Scans local markdown files for keywords and injects snippets as grounding context into the LLM prompt. |
| **Slash Command** | `/vault-search` | Displays interactive Discord Embeds showcasing relevant notes. |
| **Message Chunking** | Regex 1950 char slice | Handles responses exceeding Discord's 2000-character limit seamlessly. |

---

## 🚀 3. Configuration & Startup

1. Open `D:\Discord-Agent-Assistant\.env`:
   ```env
   DISCORD_TOKEN=your_token_here
   CLIENT_ID=your_client_id_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. Start the bot:
   ```bash
   cd D:\Discord-Agent-Assistant
   npm start
   ```

---
*Related:* [[00 - Master Agent Index]] | [[01 - Multi-Agent Coordination Protocol]] | [[02 - SDSU Interactive Web Platform]] (context) | [[04 - Remote Codex Access (Tailscale)]] (context) -- sibling project blueprints cataloged in this vault; this one also directly queries this same AgentVault for grounding
