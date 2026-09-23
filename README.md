# AgentVault

A working lab for **autonomous multi-agent systems**, run 24/7 on a Raspberry Pi and built almost entirely with
[Claude Code](https://claude.com/claude-code). It is not a product; it is a real system with real failures, kept honest in
writing (`docs/DECISIONS.md`).

## What runs here
- **A task queue and specialist agents.** Work is written as plain task files; a daemon dispatches them to specialists
  (Codex, a headless Claude agent, Google's Antigravity CLI) with dependency chains, output verification and logging.
- **"C1", a small live-money agent.** Every 2 hours a supervisor authors a research -> bull case -> bear case -> decision
  chain; plain code (not the model) decides whether the decision may act, under hard caps. It holds a **$50 live account**.
  Its first real trade happened on 2026-09-23. It has made **no profit**, and nothing here claims otherwise.
- **A revenue lab** (`bus/revenue/`): a Claude-driven product builder with an orchestrator-owned acceptance gate, and a
  short-video pipeline (local voice, captions, ffmpeg) used to market a course about building systems like this.

## Design principles (each one came from a real incident, all logged)
- **Models propose, code disposes.** Model output is a small JSON decision; deterministic, tested code enforces limits.
- **Safety rails outside the model.** `bus/protected-paths.json` + a change gate that reads its rules from the *base*
  commit, so a change cannot loosen its own review. Money-moving code is human-review-only.
- **Free, sandboxed tests.** `node bus/platform/run-survive-tests.js` copies the code into a temp dir, blocks the
  network, stubs notifications, and never touches live state or secrets.
- **Independent cross-review.** Plans and risky patches are reviewed by a second model before they are built or applied.
- **Honest failure logs.** The wedge that froze C1 for 20 hours, a stop-loss that used the entry price, a "verified" API key
  that was never loaded: all written down with the fix (`docs/DECISIONS.md`).

## Layout
| Path | What |
|---|---|
| `bus/platform/` | queue daemon, agent engine, secrets broker, change gate, tests runner |
| `bus/city/` | the live-money agent (supervisor, executor, budget envelope, shadow scoring) |
| `bus/revenue/` | product builder, Apify tooling, short-video pipeline |
| `bus/fleet/`, `bus/swarm/` | paper-trading fleet and research swarm (paused) |
| `bus/org/` | organization-layer primitives (evidence ladder, authority tiers, treasury) |
| `docs/` | `SYSTEM-MAP.md` (generated), `DECISIONS.md`, `HANDOFF.md`, proposals |
| `AGENTS.md` | the rules any AI agent working in this repo must follow |

## Try it
```bash
node bus/platform/run-survive-tests.js     # credit-free, network-blocked, ~1 minute
node bus/platform/build-system-map.js      # regenerate docs/SYSTEM-MAP.md
```
Nothing runs against real accounts unless you supply your own keys in `bus/secrets.local.json` (gitignored; see
`bus/secrets.local.json.example`).

## Status and limits
A personal research project on modest hardware. Some parts are paused, some are proposals awaiting review
(`docs/proposals/`), and the live agent trades a tiny account. Read `docs/HANDOFF.md` for the current state.
