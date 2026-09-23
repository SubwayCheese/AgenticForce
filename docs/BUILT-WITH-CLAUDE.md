# How this repo is built with Claude

AgentVault is developed by one person directing [Claude Code](https://claude.com/claude-code) as the primary builder.
This page describes the working method, because the method is the interesting part.

## The loop
1. **Plan first.** For any non-trivial change Claude writes a plan (see `docs/DECISIONS.md` for the rounds that followed it).
2. **Independent review.** A different model (Codex, and Google's Antigravity CLI through `bus/platform/ask-agents.js`) reviews
   the plan or patch against the real files. Reviews have rejected plans outright and repeatedly found real bugs in patches
   (for example, three rounds of review on the executor's stop-price fix, each reproducing a new failure).
3. **Build with free, sandboxed tests.** `bus/platform/run-survive-tests.js` copies the code to a temp dir, blocks the network
   and stubs notifications, so a test can never touch live accounts or secrets.
4. **Protected paths.** Money-moving code and the safety mechanisms themselves are on `bus/protected-paths.json`; a change gate
   that reads its rules from the *base* commit flags any change touching them for human review.
5. **Write down what went wrong.** Wrong claims and dead ends are logged, not hidden.

## Mistakes Claude made in this repo that the process caught
- Declared an API key "verified" from a test that never loaded the key (the request literally sent `Bearer undefined`).
- Raised an alarm that protected-path rules were stale by diffing against a commit from before its own fix.
- A "spread under 2%" filter let a -100% spread through because the check had no lower bound.
- The first draft of a stop-loss fix compared against the wrong price; the reviewing model reproduced the failure.

## Where Claude is used as a runtime component
`to: claude-agent` tasks run a headless Claude Code instance as a specialist (research, bull/bear review, decisions) for the
live agent "C1", alternating with Codex. A model only ever *proposes*; deterministic code enforces limits.

Details: `README.md`, `AGENTS.md` (the rules every agent here must follow), `docs/HANDOFF.md`.
