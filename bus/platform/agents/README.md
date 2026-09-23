# Agent configs

Each `<id>.json` here defines one specialist agent that `agent-engine.js`
can dispatch to via `run-task-generic.js`. This is the actual Phase 2
scaffold artifact -- see `ARCHITECTURE.md` section 3d for the full
history of why it exists (short version: Codex, then Claude, were each
hand-built as near-duplicate ~150-line scripts before this exists; the
scaffold's job is to make agent #3+ a config, not another script).

## Adding a new agent: the real checklist, not a guess

Every step below was a real mistake or a real finding while adding
Claude as the second agent (2026-09-01) -- this isn't hypothetical
caution, it's what actually went wrong once already.

1. **Check the binary's real invocation flags. Don't assume they match
   an existing config.** Run `<binary> --help` yourself. Codex and Claude
   both have a headless/non-interactive flag and *some* kind of sandbox
   or permission-mode concept, but the actual flag names, mode names, and
   semantics differ (`--sandbox read-only/workspace-write/
   danger-full-access` vs `--permission-mode plan/acceptEdits/
   bypassPermissions/...`). Do not port Codex's flag names to a new
   agent on the assumption they'll roughly correspond.

2. **Check whether the binary is a real executable or a wrapper script.**
   On Windows: `file <path-to-binary>`. A `.cmd`/`.bat` wrapper (codex.exe
   is one) needs `isWindowsCmdWrapper: true`, which makes
   `agent-engine.js` pass `shell: true` to `execFileSync` -- and
   `shell: true` does NOT escape array args with spaces, which broke
   `run-task-collab.js`'s first draft. A real executable (claude.exe is
   one) needs `isWindowsCmdWrapper: false` and has no such risk. Verify,
   don't guess -- guessing wrong either breaks the binary resolution
   entirely or silently reintroduces the exact quoting bug already fixed
   once.

3. **Run one live smoke-test call by hand before writing the config** --
   e.g. `echo "test" | <binary> <headless-flag>`. Confirms auth/
   connectivity issues (Gemini CLI's free tier being discontinued was
   caught exactly this way, before any code was written around it) and
   confirms stdin-piping actually works for this binary (plain stdin works
   for codex and claude-agent; Antigravity's `agy` only accepts stdin as a
   stream-json envelope, so `promptDelivery` now supports `"stdin"` and
   `"stdin-stream-json"` --
   `dispatch()` asserts this explicitly and throws otherwise, found and
   fixed 2026-09-01 after noticing the field was validated and documented
   but never actually read by the dispatch code. A binary needing
   positional-arg prompt delivery needs real `agent-engine.js` work, not
   just a new config value -- the assertion exists so that need surfaces
   as a loud error, not a silently-ignored config field).

4. **Decide `boundaryTestMethod` by understanding the permission model,
   not by copying the nearest existing config.** Found 2026-09-01: a raw
   shell-command write attempt is the right test for an agent whose
   sandbox governs shell execution uniformly (Codex). It is the WRONG
   test for an agent that gates Bash and its native file-write tools
   through separate permission checks (Claude) -- it only proves the
   Bash gate holds, not the actual file-write boundary. Test both ways
   if you're not sure which applies; trust whichever one actually
   exercises the write path being scoped.

5. **Write the config**, run `node validate-agent-config.js <id>` (fast,
   no live call -- catches shape mistakes: missing fields, an
   `outputMethod`/`boundaryTestMethod` the engine/suite doesn't recognize,
   a `{outputFile}` placeholder missing when `outputMethod: "file"`, an
   `id` that doesn't match the filename).

6. **Dispatch one real task** via `run-task-generic.js <task_id>`
   (read-only) before trusting anything else. Confirm the response
   actually passes `verifyOutput()` -- add the new `to:` value to
   `run-task.js`'s `DISPATCHED_SPECIALISTS` set if this agent should get
   the SOURCE-tag requirement (it should, unless the agent genuinely has
   live data access, which none has so far).

7. **Run `node run-verification-suite.js`** -- with the config in place,
   `testAgentConfigShapes`, `testEnginePerAgentDispatch`, and
   `testEngineSandboxBoundaries` all cover the new agent automatically,
   no new test code needed. This is the actual point of the config-driven
   design -- if you found yourself writing a new test function for the
   new agent, something about the config or the engine is under-general
   and worth fixing at that level instead.

## Current configs

- `codex.json` -- Codex, via `codex exec`. `.cmd` wrapper,
  file-based output capture, shell-uniform sandbox.
- `claude-agent.json` -- a nested headless Claude Code process, via
  `claude -p`. Real executable, stdout output capture, tool-category-
  gated permissions (Bash vs. native Write/Edit are separate checks).
- `antigravity.json` -- Google Antigravity CLI, via `agy` (added
  2026-09-23). Real ARM64 executable. `promptDelivery: "stdin-stream-json"`
  (one NDJSON `{"event":"user","message":{"content":...}}` line) and
  `outputMethod: "stream-json-result"` (the last `{"event":"result"}`
  line; an EMPTY response counts as a failure). Permissions are NOT
  controlled by `--mode`: headless `agy` auto-denies every tool that is not
  allowed in `~/.gemini/antigravity-cli/settings.json` (a `.agents/`
  settings file in the working directory is not read). That file allows
  only `read_file(/home/subwaycheese/AgentVault)`; web search needs no rule.
  A denied tool (e.g. a write) ends the turn with an empty answer instead
  of letting the model continue, so the dispatch fails loudly rather than
  writing anything.

## Talking between agents

`node bus/platform/ask-agents.js --to <agent> [--review-by <agent>] [--wait] "question"`
writes an answer task and, optionally, a reviewer task that depends on it
(so the reviewer receives the first agent's output through the normal
dependency relay). `run-queue-daemon.js` dispatches both like any other task.
Verified live 2026-09-23 in both directions (antigravity -> codex review,
codex -> antigravity review).
