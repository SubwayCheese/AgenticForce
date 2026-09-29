# Proposal (needs owner review -- protected paths): C1's cadence is 4h per mission, not 2h

**Status: PROPOSED, not applied.** Recommendation: **Option A (fix the wording, change no behaviour).** The patch covers Option A only.
`bus/deploy/**` is on `bus/protected-paths.json`, so even a comment-only change needs the owner. Checked with `patch --dry-run` only.

## What happens (verified from the code and from `bus/survive-supervisor.log`)
- `bus/deploy/pi/survive-supervisor.timer:1-2` says the timer "fires every 2 hours, matching ... MISSION_COOLDOWN_HOURS"
  (`OnUnitActiveSec=2h` at l.18). `docs/HANDOFF.md` ("every 2h", "cadence 4h -> 2h") and `AGENTS.md:12` ("2h cadence") repeat it.
- In `main()` (`bus/city/survive-supervisor.js:497-507`), when a decision has resolved the wake executes it and then
  `continue`s (`:506`, "don't also author a new mission in the same wake"). `authorNewMission` (`:514-516`) therefore only runs
  on a wake with no finished decision waiting. One wake authors, the next executes.
- The log shows exactly that since 2026-09-22: `Wake, Authored, Wake, executing, Wake, Authored, ...` with no exception (checked
  by scanning every line since 09-22; the only other event is the mission006 recovery).
- `MISSION_COOLDOWN_HOURS = 2` (`:45`) is measured from the last `mission-resolved` (`:139-140`), which is written at execution
  time, so the cooldown is satisfied by exactly one timer interval. It never binds; the wake alternation is what sets the rate.
  (It only passes by ~58 s: resolve is stamped ~2 s after the wake starts and wakes are 2h01m apart in the log. If the timer ever
  fired on an exact 2h boundary, authoring would slip a whole wake, i.e. 6h. Cause of the +1 min drift not verified.)
- Result: one mission about every 4h (~6 per day, ~24 LLM dispatches per day), and each finished decision waits up to 2h to be
  executed. Nothing is lost, but the docs promise twice the rate.

## Option A -- correct the wording (recommended)
Comment-only patch to the repo copy of the timer explaining the real rhythm. No behaviour change, no restart, and no re-install: the
installed unit in `~/.config/systemd/user/` is a separate copy and its `[Timer]` values are untouched by the patch.

Why A: the 4h rate is already what C1 has been running, and there is no evidence that more missions help. Since mission010 every
decision has been `hold`/`no-action` (15 of 15 resolved after it), the research prompt has no price history (diagnosis finding 3),
the position cap is $20 (finding 4), and nothing feeds outcomes back (finding 2). Doubling the missions doubles model spend
(codex and claude-agent alternate) for the same decision. C1 is a proof-of-life tool by the owner's own priority order.

## Option B -- author a mission in the same wake after executing (not recommended now)
What it would take, so the trade-off is concrete:
1. In `main()`, replace the `continue` at `:506` with a fall-through (skip only if the execution result says the citizen was
   blocked or shut down).
2. That alone does nothing: `isMissionDue` would see a `mission-resolved` ~0 s old and the 2h cooldown would refuse. So the cooldown
   must be measured from the last `mission-started` (authoring time) instead of the last `mission-resolved`, or the same-wake case
   must bypass it. Either way the `isMissionDue` tests (`bus/tests/survive/supervisor.test.js:5-47`, which also still say "4h cooldown")
   must change.
3. Steady state: one new mission per 2h wake (~12 per day, ~48 dispatches per day), each executed one wake later.

Risks of B:
- **Doubles spend and dispatch load** for no evidenced benefit; half goes to codex, whose status the docs disagree on
  (`AGENTS.md` rule 4 "paused" vs HANDOFF "healthy" vs odd missions completing). A codex outage then costs twice as many dead missions.
- **Fresh authoring right after a fresh execution**: a research prompt built while an order or stop is still settling, and after
  an execution error (closed-market cancel, exceptions) an immediate new mission with no pause.
- **More entries into closed markets.** Decisions still execute up to 2h after they are written; twice as many decisions means
  twice as many chances to hit the after-hours problem in `docs/proposals/2026-09-23-executor-market-hours.md`.
- Correlated samples: two missions 2h apart see almost the same prices, so shadow scoring gains little independent data.
- Changes three protected surfaces (supervisor, its test file, the timer text) and the cooldown semantics of live money code.

If the owner does want faster reaction: the lever with actual value is executing the decision sooner after it completes (or
deferring it until the market opens, per the market-hours proposal), not authoring more missions.

## Files (this folder: `docs/proposals/supervisor-cadence/`)
- `survive-supervisor.timer.patch` -- comment-only change to `bus/deploy/pi/survive-supervisor.timer` (use `-p1`)

## What I ran (real results, 2026-09-26)
```
cd ~/AgentVault && patch -p1 --dry-run < docs/proposals/supervisor-cadence/survive-supervisor.timer.patch
  -> checking file bus/deploy/pi/survive-supervisor.timer   (clean)
sha256sum -c (before/after)  -> live timer file unchanged (OK)
# scratch copy: patch applies; only lines starting with '#' differ; [Unit]/[Timer]/[Install] sections identical
```
`node --check` does not apply (not JavaScript). The other proposals' patches also apply cleanly on top of the same scratch tree.

## Follow-ups NOT included (other owners or protected; wording only)
- `docs/HANDOFF.md` ("every 2h", "cadence 4h -> 2h") and `AGENTS.md:12`: say "wakes every 2h, one mission about every 4h".
- `bus/city/survive-supervisor.js:45` comment ("4h -> 2h") and `bus/tests/survive/supervisor.test.js:14` ("within 4h cooldown").

## To apply (owner)
```bash
cd ~/AgentVault
patch -p1 --dry-run < docs/proposals/supervisor-cadence/survive-supervisor.timer.patch
patch -p1 < docs/proposals/supervisor-cadence/survive-supervisor.timer.patch
git add bus/deploy/pi/survive-supervisor.timer && git diff --cached --stat
```
No `systemctl` action is needed (comments only).
