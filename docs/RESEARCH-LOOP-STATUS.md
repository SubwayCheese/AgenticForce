# Research loop status (auto-updated every cycle)

Last updated: 2026-09-29 ~1:05 PM PDT, after cycle 5 (the one-shot out-of-sample test). Full history:
`bus/fleet/data/research-loop-log.jsonl`. Loop mechanics and boundaries: `docs/HANDOFF.md`.

## RESUMED 2026-09-29 ~5:50 PM PDT (owner said resume): routine re-enabled, `claude-paused` deleted, local loop wakes 8:14 AM PDT 9/30. Stop-guard fixes built (see HANDOFF). History of the pause below.
## (was) PAUSED (owner, 2026-09-29 ~4:20 PM PDT): no Claude usage until the owner says resume
- Cloud routine trig_01JMgBjoMcLdiBHEjdFXevU7 DISABLED (re-enable: RemoteTrigger update {"enabled": true}).
- Local loop stopped; its 8:14 AM wake deleted.
- C1 keeps running: while `bus/city-state/claude-paused` exists every mission goes to codex (delete the file to resume
  the codex/claude-agent alternation).
- Stop re-armer: built + rehearsed (dry run on the live account: stop at $100.11 for the SGOV lot), NOT enabled. Round-3
  review fixes pending (codex reject: shared OS lock with the supervisor, quote freshness, decision-lookup errors,
  dead-order check). Partial lock module parked at
  /tmp/claude-1000/-home-subwaycheese/2a30f474-b678-4563-8cbd-e8b610c05697/scratchpad/c1-execution-lock.partial.js.
  Review texts: same scratchpad, review3-*.txt. Resume = finish those fixes test-first, codex re-review, owner installs timer.

## Bottom line right now (after cycle 5, 2026-09-29)
- **The leveraged-ETF trend idea did not survive its out-of-sample test.** On the never-examined 2016-12-29..2021-08-05
  window (Alpaca SIP, prereg v3, run once), at a $30 cap: S1 (200-day trend) returned 34.1%/yr vs QQQ's 28.7% but with a
  31.0% max drawdown vs QQQ's 28.6% (limit 30.6%, missed by 0.4pp); S2 (fast exit) returned only 21.3%/yr. Verdict per
  the frozen rules: **DOES NOT HOLD**. Report: `bus/fleet/data/lev-backtest-holdout-results.md`.
- **Honest reading:** S1 looks like leveraged QQQ with a trend exit -- more return for about QQQ-level drawdown -- not a
  risk-adjusted edge. The earlier in-sample "$30 cap beats QQQ at matched risk" (cycle 3) did not replicate, especially
  for S2. **Do not raise C1's $20 cap on this evidence.** The 2016-2021 window is now spent as out-of-sample.
- **Where the revenue search goes next:** the cloud queue below (exit-side bug fix, a third strategy family, S2's
  whipsaw, and whether this research pipeline is sellable as its own product).

## Cloud schedule (plan approved 2026-09-29, `/home/subwaycheese/.claude/plans/inherited-crunching-emerson.md`)
- Step 1 done: branch `cloud-sync-2026-09-29` pushed (2 commits: research infra; protected C1 fixes). PR created by the owner
  2026-09-29 (not merged yet; the cloud routine falls back to this branch until it is).
- Step 2 done (probe): cloud routines CAN clone, run node and our selftests (35/35, 11/11, 14/14; suite 159/161, the 2
  failures are no-ffmpeg-in-container), and use WebSearch. They CANNOT fetch arbitrary HTTPS (egress-blocked), CANNOT
  git push (denied by the cloud harness), and show no spend info. So the recurring routine reports in its transcript +
  a push notification, and a local Pi session applies any code changes.
- Steps 3-4 done: reviewed and created daily routine `trig_01JMgBjoMcLdiBHEjdFXevU7` (7:17 AM PDT, no connectors).
- Cycle 4: FMP rejected (free plan gates ETFs/dates); Alpaca SIP history from 2016-01-04 now cached in `bus/fleet/data/lev-bars-sip/`.

## Cloud queue (the daily cloud routine takes the FIRST item the log does not show as done)
1. **executeExit error-handling gap (PROPOSAL only, bus/city is protected).** `bus/city/survive-executor.js` executeExit has
   the same unwrapped submitOrder/getOrder class of bug the entry side had (fixed 2026-09-29, see
   docs/proposals/2026-09-26-executor-submit-try-catch.md). Write the patch as a PROPOSAL diff plus a proposed test file
   that fails on the current code and passes on the patch.
2. **A third strategy family** with fewer trades than S2 (113 round trips) but more than S1 (3): design it, implement it
   in bus/fleet/lev-backtest-engine.js with test-first selftests, and evaluate it ONLY on 2021-08-06 onward, labelled
   exploratory/in-sample. Never on the reserved 2016-01-04..2021-08-05 window.
3. **Why S2 whipsaws:** measure how much of S2's cost drag comes from quick re-entries; test a re-entry cooldown / minimum
   hold variant on 2021-08-06 onward only, labelled as tuned in-sample.
4. **Productizing (research + written proposal only):** is there real demand for this backtest/research pipeline as its
   own product, distinct from the course? Use WebSearch for evidence (competitors, prices, communities); write
   docs/proposals/<date>-pipeline-product.md with honest demand evidence and risks. No publishing, no accounts.

## Local-only work (this Pi; the cloud must not do these)
- DONE 2026-09-29 (cycle 5): the one-shot out-of-sample test -- H DOES NOT HOLD. Never rerun it or tune on that window.
- Refreshing SIP/IEX price caches (needs the Pi's keys) and pushing them to the PR branch.
- Reading each cloud run (RemoteTrigger list_runs / get_run_log), re-verifying it, applying unprotected changes after
  tests pass here, sending protected ones to the owner.

## Boundaries unchanged
No live orders. Protected files only via owner-reviewed proposals. The cloud side has no secrets and cannot trade.
