# Cross-Agent Error Resolution & Learnings

A running log of real integration bugs found and fixed during multi-agent collaboration on this session's projects (agent-comms hub, Stock News Analyzer, this vault).

---

## 🐛 Resolved Issues

### `className` instead of `class` in raw HTML
The Stock News Analyzer's original `index.html` used `className="..."` throughout -- the JS/React DOM property name, not a valid HTML attribute. In plain HTML this silently does nothing, so none of the CSS classes were being applied at all. **Lesson:** verify rendered output in a real browser, not just that the code looks plausible.

### Adapter export mismatch breaking the registry
`agents/registry.js` expected every adapter module to export `module.exports.adapter`, but `codex-adapter.js` and `claude-adapter.js` exported under other names (`codexAdapter`, `claudeAdapter`). The registry would have thrown on load. **Lesson:** when one agent builds an interface (the registry) and others build implementations against it independently, verify the actual contract, don't assume it matches.

### Scaffold template placeholder bug
`scripts/create-agent.js` only exposed `idJson` (a JSON-stringified value) to templates, but file paths and `require()` strings needed the raw id string -- generated files had broken paths like `./"test-echo"-adapter.js`. Fixed by adding a plain `id` template value alongside `idJson`.

### Codex thread-addressing bug (sub-agent lock collision)
`findActiveThreadId()` picked whichever `thread-writer-lock` file was most recently modified, but Codex's own internal multi-agent orchestration creates lock files for sub-agent threads too -- those aren't directly addressable via `codex queue`. Once a sub-agent's lock became the newest, messaging Codex silently broke. Fixed by cross-referencing against `session_index.jsonl`, which only lists real top-level sessions.

### Stale process squatting on the hub's port
A crashed/orphaned `server.js` process kept holding port 47415 after being (incompletely) killed, causing every subsequent supervisor respawn to fail with `EADDRINUSE` -- the supervisor gave up after 10 failures and silently stopped trying. Anyone editing `dashboard.html` or `server.js` was working against a stale, unserved copy with no indication anything was wrong. **Lesson:** verify the *running* server actually reflects the current file (`curl` it and diff), don't assume a restart succeeded just because the command returned.

### Unsupervised tool access via a vague task prompt
`claude-adapter.js` spawned `claude -p` with `--permission-mode dontAsk` and no `--restricted` flag. A vague, task-like prompt submitted through the dashboard ("build sub-agent UI test") was enough to spawn a fully autonomous process with real Bash/Edit/Write access, unsupervised, for several minutes before being caught and killed. Fixed by adding `--restricted`, which strips code-execution tools. **Lesson:** any adapter that shells out to a coding agent needs an explicit, tested permission boundary -- "it probably won't do anything bad" is not a safety design.

### Message feedback loop (task-notification echo)
A watcher (`watch-antigravity.js`) surfacing feed events as Claude Code notifications got its own notification text pasted back into the dashboard as a `from:"user"` message, which the watcher then surfaced again -- each round nesting deeper HTML-escaped XML. Fixed with a content filter that skips any message containing `task-notification` markup, since that can only be a recursive echo, never legitimate content.

---
*Related:* [[00 - Master Agent Index]] | [[03 - Agentic Creations & Architectural Artifacts]]
