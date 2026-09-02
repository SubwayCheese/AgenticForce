---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: guideline
status: active
domain: guidelines
description: "Cross-Agent Error Resolution & Learnings"
tags: ["error-resolution", "learnings", "debugging", "cross-agent"]
---
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

### Research daemon data-quality issues found during vault reorganization
Antigravity's 24/7 research daemon dropped 11 flat `[UNVERIFIED]` files into `05 - Unverified Research Logs` (numbered `04` at the time, later renumbered -- see the folder-collision fix below) with no sub-organization, no cross-linking into the master index, and (found while sorting them) real internal quality issues: two files ("Multi-Agent Design Patterns" and "Multi-Agent Systems") turned out to be the identical 5-source search result set generated twice ~20 minutes apart under different titles, and one file ("Prompt Engineering") has a `search_query` field naming DSPy/MIPROv2 but retrieved content with zero DSPy mentions -- a real search-to-topic mismatch, not just an unlucky title. Caught by actually reading file contents rather than trusting titles/search_query fields at face value. This was also a real (not narrated) cross-AI collaboration: Claude proposed a merge for the two duplicate-looking files over the shared agent-comms feed, Codex pushed back that the titles could represent a legitimate patterns-vs-implementations split and shouldn't be auto-merged without checking -- checking the actual content confirmed Claude's original read was right this time, but Codex's caution was the correct default instinct. **Lesson:** a second AI's skepticism is useful even when it turns out to be wrong on the specific case -- it forces verification instead of assumption either way.

### `write_text()` silently truncating a file mid-crash (autograph, 2026-09-01)
A third-party vault-organizing tool (`autograph`) crashed partway through bootstrapping frontmatter on this vault's files -- `write_text()` calls had no explicit `encoding='utf-8'`, defaulting to Windows' cp1252, which can't represent this vault's own 🤖 emoji. The crash happened *while* rewriting `00 - Master Agent Index.md`, truncating it to empty before the encoding error was hit. A second, fixed run (`PYTHONUTF8=1`) then saw "no frontmatter" on the now-empty file, treated it as fresh, and wrote valid-looking frontmatter onto nothing -- so the file looked structurally fine (real frontmatter, right shape) while its entire body was gone. Caught because the vault's own health checker flagged the file as having zero outgoing links, which made no sense for a hub file with dozens of real links; traced back, confirmed via a body-length scan that no other file was affected, restored the real content from conversation context. **Lesson:** a crash mid-write can leave a file in a state that looks *more* valid on the next pass, not less -- "has frontmatter" was the wrong signal to trust; only checking actual body content caught it.

### Two more real, Windows-only portability bugs in the same tool
Same session, same tool: (1) `Path.relative_to().__str__()` returns backslash-separated paths on Windows, but the tool's own domain-matching logic and its wikilink suffix-index (`rp_noext.split('/')`) both assumed forward slashes -- silently broke domain inference *and* link resolution on this OS, not just for this vault's schema. (2) A path-hint matcher lowercased the path being checked but not the pattern from the config, so any mixed-case hint (nearly all of them) never matched -- files were classified via an untested fallback path instead of the real per-folder rules, which looked like it was "working" (a type got assigned) while actually being wrong. **Lesson:** a tool developed and tested on macOS/Linux can have real, silent behavior differences on Windows that never surface as an error -- they surface as a plausible-looking wrong answer. Test cross-platform assumptions directly (a real path, a real mixed-case string), don't infer them from the tool working at all.

### A dispatch script that never checked which agent a task was actually for
`run-task.js` and `run-task-collab.js` (this vault's own `/bus/` scripts) both unconditionally dispatched to Codex, with no check that the task's `to:` field actually said `codex`. Harmless for weeks, by construction -- Codex was the only dispatch target that had ever existed, so there was nothing to get wrong. The moment a second agent (`claude-agent`) became real, this became a live footgun: running the wrong script on a task would silently send it to the wrong agent, no error, and a generic-enough prompt could even pass verification -- making the mistake invisible rather than loud. Found in a deliberate self-review pass, not by a test failing. **Lesson:** a check that's redundant today because there's only one possible value can become a real gap the moment a second value exists -- "there's only one option so it doesn't matter" is a claim worth re-examining specifically when you're about to add a second option, not after something breaks from skipping it.

### A config field that was validated and documented but never actually read
Building a config-driven dispatch engine for two agents, a `promptDelivery` field got added to each agent's config (`"stdin"`), documented in the schema, and checked by a config-shape validator -- but the actual dispatch code never branched on it; it always piped via stdin regardless of what the field said. Harmless today because both real configs happen to say `"stdin"`. Would have been a silent, hard-to-diagnose failure for a future agent whose CLI needed the prompt passed a different way (e.g. as a positional argument) -- the config would validate cleanly, dispatch would run, and the target process would just never receive its actual prompt. Fixed by asserting the field's value explicitly at dispatch time rather than leaving it decorative. **Lesson:** a config field that's *validated* is not the same as a config field that's *used* -- check that every field your validator requires is actually read somewhere in the code path it configures, not just present and well-typed.

### Security boundary tests need to match how the specific agent's permissions actually work
Testing that a second AI agent (Claude, dispatched headlessly) couldn't write outside its assigned working directory, the first attempt used the same test that worked for the first agent (Codex): ask it to run a shell command attempting the write. It got blocked -- but by the Bash-tool approval gate, not the file-write permission boundary being tested; Claude Code's permission model gates shell execution and its native file-write tools through *separate* checks, unlike Codex's sandbox, which governs shell execution uniformly. The right test asked the agent to use its own native file-writing tool directly, which surfaced the actual boundary ("outside the session's approved working directories"). **Lesson:** a security test that passes doesn't automatically mean it tested the right thing -- when porting a boundary test from one system to a structurally different one, verify which specific mechanism the test is actually exercising, not just that it produced a "blocked" result.

---
*Related:* [[00 - Master Agent Index]] | [[03 - Agentic Creations & Architectural Artifacts]] | [[00 - Unverified Logs Readme|05 - Unverified Research Logs]]
