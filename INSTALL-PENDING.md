# Pending installs and re-enables (nothing here is installed yet)

Written 2026-09-19. Run these yourself in a shell on the Pi (`ssh <your-user>@<pi-host>`, then `cd ~/AgentVault`).
`--user` units need no sudo. Check anything with `systemctl --user list-timers --all`.

## A. Revenue side (do first)
1. **Republish the 3 Apify Actors** so the new Store READMEs, SEO descriptions and output schemas go live
   (safe to repeat; rebuilds and test-runs, costs cents):
   `node bus/revenue/apify-publisher.js sec-form4-insiders` (then `sec-13f-holdings`, `treasury-yield-curve`).
   Pricing/public are already set; do NOT add flags.
2. **Upload the icons** in the Apify Console (Actor -> Settings -> Icon): `bus/products/actors/icons/<slug>.png`.
3. **Optional:** regenerate the Apify API token (it was pasted in chat) and update `APIFY_TOKEN` in `bus/secrets.local.json`.
4. **Superteam scout (read-only, no key, no model use):**
   `cp bus/deploy/pi/superteam-scout.service bus/deploy/pi/superteam-scout.timer ~/.config/systemd/user/`
   `systemctl --user daemon-reload && systemctl --user enable --now superteam-scout.timer`

5b. **Apify stats tracker (read-only, daily; first snapshot already saved):**
   `cp bus/deploy/pi/apify-stats.* ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now apify-stats.timer`
   Check any time with `node bus/revenue/apify-stats.js` (prints run/user deltas since the last snapshot).

## B. Reliability
5. **Dashboard survives reboots:** stop the hand-started one (`pkill -f serve-dashboard.js`), then
   `cp bus/deploy/pi/serve-dashboard.service ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now serve-dashboard.service`
6. **Shadow scoring (credit-free):**
   `cp bus/deploy/pi/survive-shadow-score.* ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now survive-shadow-score.timer`

## C. Codex-dependent (note: survive-supervisor.timer and research-swarm-cycle.timer are installed but DISABLED) (only when codex/usage is back and you want it)
7. **City supervisor:** `systemctl --user enable --now survive-supervisor.timer`
8. **Research swarm (15 specialists):** `systemctl --user enable --now research-swarm-cycle.timer`
9. **Queue daemon:** ALREADY a system service (`/etc/systemd/system/agentvault-queue-daemon.service`, running). Do NOT install
   `bus/deploy/pi/run-queue-daemon.service` (it would duplicate it). To stop/start it: `sudo systemctl stop|start agentvault-queue-daemon`.
   (Correction 2026-09-19: an earlier note said it was hand-started; the audit found the system unit.)
10. **Paper fleet cron (paused):** `crontab ~/crontab.backup-2026-09-19`  (restores the two commented-out lines' original state).

## D. Claude Code settings (yours to change)
- Permission rules live in `~/AgentVault/.claude/settings.json` (8 read-only rules added). I cannot edit permission
  settings myself. For no prompts, restart Claude with `claude --dangerously-skip-permissions` (see earlier notes).

## Undo any timer
`systemctl --user disable --now <name>.timer`
