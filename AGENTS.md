# AgentVault: instructions for AI agents (Claude Code, Codex)

Raspberry Pi project, ~one owner. Read this first (short on purpose). Then read `docs/HANDOFF.md` (current state, dead ends, next steps). Detail lives in `docs/SYSTEM-MAP.md`
(generated, always current), `docs/DECISIONS.md` (what we tried, dropped and why) and `INSTALL-PENDING.md`.

## What is in the repo
Code is organized by system, one folder each under `bus/` (registry: `bus/components.json`; generated map: `docs/SYSTEM-MAP.md`).
`bus/scripts/` holds ONLY compatibility symlinks for things outside the repo that still name old paths (see `compatSymlinks`); never add real code there.
- **platform** (`bus/platform/`) shared infra: task queue daemon, `run-task*.js`, `secrets-broker`, `ntfy`, `memory-store`, gates, tests.
- **ops** (`bus/ops/`) dashboard/status aggregators (port 8877).
- **fleet** (`bus/fleet/`, data in `bus/fleet/data/`) paper-trading fleet. PAUSED (owner redirected effort to revenue).
- **city** (`bus/city/`, plugins in `bus/city/mechanisms/`) real-money agent "survive" branch (C1, live Alpaca $50). LIVE again since 2026-09-22 (Rounds 27-28: 2h cadence, codex/claude-agent alternating; timers enabled).
- **swarm** (`bus/swarm/`) research swarm (15 codex specialists). PAUSED.
- **revenue** (`bus/revenue/`) ACTIVE: Claude-driven product builder, Apify Actors (3 live, public, priced), Superteam scout, stats tracker.
Products live in a separate repo `~/AgentVault-products`. Knowledge vault = the numbered folders at repo root (`06 - Markets ...`).

## Commands (all read-only unless noted)
- Tests (credit-free, network-blocked, sandboxed): `node bus/platform/run-survive-tests.js`
- What should be running vs what is: `node bus/platform/check-schedules.js`
- Apify usage deltas: `node bus/revenue/apify-stats.js`   |   Bounty scout: `node bus/revenue/superteam-scout.js --no-notify`
- Regenerate the map after adding/removing a script: `node bus/platform/build-system-map.js --write`
- Ask one agent, have another review (codex | claude-agent | antigravity; spends model usage): `node bus/platform/ask-agents.js --to antigravity --review-by codex --wait "question"`
- Publish/update an Apify Actor (WRITES to the owner's account; owner runs it): `node bus/revenue/apify-publisher.js <slug>`

## Hard rules
1. **Never run `git checkout`, `git switch`, `git reset --hard`, `git clean`, `git commit -a` or `git add -A` in this working tree.**
   It holds live files; on 2026-09-19 that reverted and deleted real state. Stage explicit paths only. Test git flows in a
   `git clone --no-hardlinks` throwaway and verify `pwd` first. Live state (`bus/*.jsonl`, `bus/log.md`, ledgers) is untracked and ignored.
2. **Real-money and outward actions are the owner's to execute** (funding, live orders, publishing/pricing on their accounts, sending
   email). Do not attempt them yourself; prepare and hand over the exact command.
3. **Secrets:** never print, log or commit them. They live in `bus/secrets.local.json` (gitignored, read via `secrets-broker`).
4. **Codex is paused** (usage exhausted) and the paper fleet is paused. Do not dispatch codex tasks or probes unless told.
5. **Do not edit permission/settings files or protected paths** (`bus/protected-paths.json`) to grant yourself access.
6. **No fabricated results.** Verify by running things; report failures plainly. Prefer honest low estimates over hype.
7. Big builds: write a plan, get an independent cross-review, then build (owner's standing rule).

## Conventions
- New script in `bus/<domain>/`: register it in `bus/components.json` (domain + status) and add tests under `bus/tests/survive/`.
  The architecture test fails on unregistered files, forbidden cross-domain imports, live->legacy dependencies and stale map.
- Tests use `bus/tests/survive/_sandbox.js` (a temp copy of the code dirs, ntfy stubbed, network blocked); never point tests at live files.
- Keep files small; one system per change; do not rename files and change behaviour in the same change.
- Paths: import `bus/lib/paths.js` (`avPaths.ROOT`, `.BUS`, `.bus(...)`, `.script(name)`, `.fleetData(name)`) instead of deriving the repo root from `__dirname` (a test enforces this).
- State/logs are never read whole (`bus/log.md` is 18 MB): grep it or read the tail.
