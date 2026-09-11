# Raspberry Pi setup checklist -- 24/7 trading-pilot host

Written 2026-09-10, before the Pi physically exists -- this is
everything confirmed ready or flagged as still-needed, so setup is
mechanical once the hardware is in hand. Nothing here has been run on
real Pi hardware yet; test each step for real once it exists rather
than assuming this doc is infallible.

## What's already confirmed ready

- **Code portability audited directly** (a real read-only agent pass over
  all 13 trading-pilot scripts): nothing in `run-queue-daemon.js`,
  `pilot-supervisor.js`, `conditional-triggers.js`, `trading-journal.js`,
  `generate-pilot-tasks.js`, `execute-portfolio-setup.js`,
  `monitor-paper-trades.js`, `alpaca-client.js`, `fmp-client.js`,
  `secrets-broker.js`, `run-task.js`, `run-task-generic.js`, `ntfy.js`
  would fail on Linux/ARM64 -- no hardcoded Windows paths, no
  Windows-only APIs, no `package.json` dependency that's OS-restricted.
  Two Windows-motivated (but functionally harmless on Linux) `shell:true`
  uses were tightened to check `process.platform === 'win32'` explicitly
  (`run-task.js`'s `runCodex()`, `agent-engine.js`'s Codex dispatch) so
  the code is honest about being Windows-specific there, not just
  accidentally safe.
- **Git remote exists**: `https://github.com/SubwayCheese/AgenticForce`
  (private). The Pi clones from here; `git-sync.js` (see below) pushes
  results back so the Windows/Obsidian side can `git pull` and see them.
- **systemd units written** (this directory): `trading-pilot-queue-daemon.service`
  (long-lived, run-queue-daemon.js), `trading-pilot-supervisor.service`
  + `.timer` (every 30 min, pilot-supervisor.js), `vault-git-sync.service`
  + `.timer` (every 15 min, git-sync.js). Each file documents its own
  install commands.

## What still needs a human step once the Pi exists

1. **Flash Raspberry Pi OS (64-bit)** -- ARM64 is required for the Codex
   CLI's official Linux build; the 32-bit image won't work.
2. **Install Node.js (a current LTS)** -- the apt-provided Node on
   Raspberry Pi OS is often old; use NodeSource's setup script or `nvm`
   to get a recent version, matching what this vault's scripts were
   built/tested against (Node 24 on this machine, though any reasonably
   current LTS should work -- nothing here uses bleeding-edge syntax).
3. **Install the Codex CLI** -- confirmed in an earlier session that
   Codex CLI ships an official Linux ARM64 build (research-only
   confirmation, never installed on real hardware yet). Follow Codex's
   own install instructions for Linux ARM64.
4. **`git clone https://github.com/SubwayCheese/AgenticForce.git`** into
   wherever the systemd units' `WorkingDirectory=` should point (this
   doc assumes `/home/pi/AgentVault` -- edit the unit files if different).
5. **Copy `bus/secrets.local.json` over manually** -- it's gitignored on
   purpose (real credentials: `ALPACA_API_KEY`, `ALPACA_API_SECRET`,
   `ALPACA_ENDPOINT`, and eventually `FMP_API_KEY` once that's added --
   see below) and will NOT come through `git clone`. Copy it via `scp`
   or a USB drive, never through a committed file.
6. **Set up git push auth on the Pi** -- a GitHub personal access token
   or SSH deploy key with write access to the repo, configured via git's
   credential helper or an SSH key added to the GitHub repo's deploy
   keys. `git-sync.js` needs this to actually push; without it, syncing
   silently fails at the push step (it logs and retries next cycle
   rather than crashing, but nothing reaches GitHub until this is set up).
7. **Edit each `.service` file's `User=`/`WorkingDirectory=`/`ExecStart=`**
   to match the real username and clone path, then install per each
   file's own header comment (`daemon-reload`, `enable --now`).
8. **The two blockers that exist regardless of host, unchanged by moving
   to the Pi** (see `ARCHITECTURE.md` section 9):
   - `FMP_API_KEY` still isn't configured -- without it,
     `generate-pilot-tasks.js`'s data-snapshot step degrades gracefully
     (skips + alerts) rather than generating a fresh research cycle.
     Get a standalone FMP REST key (same provider as the existing MCP
     connector) and add it to `bus/secrets.local.json` on the Pi.
   - Sizing is no longer a pending sign-off item -- $15/leg micro sizing
     (`AUTO_MICRO_NOTIONAL_PER_LEG` in `execute-portfolio-setup.js`) was
     confirmed and shipped 2026-09-10, matching the "many small learning
     trades" direction. Revisit only if that number should change.

## Verification, once hardware exists

1. `node -e "require('./bus/scripts/alpaca-client.js').getAccount().then(console.log)"`
   -- confirms the paper API credentials work from the Pi's own network
   path (a different egress IP than this Windows machine; Alpaca
   shouldn't care, but verify rather than assume).
2. Start `run-queue-daemon.js` and `pilot-supervisor.js` manually first
   (foreground, watch the output) before installing the systemd units --
   same "supervised first run" discipline as the rest of this pipeline's
   verification history.
3. Confirm `git-sync.js` actually pushes: make a trivial change, run it
   by hand, confirm it shows up on GitHub, confirm a `git pull` on the
   Windows machine picks it up.
4. Only then install and enable the systemd units for real 24/7,
   unattended operation.
