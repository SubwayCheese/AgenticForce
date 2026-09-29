# Research loop status (auto-updated every cycle)

Last updated: 2026-09-29 ~12:00 PDT, after cycle 4 (SIP data), both reviews, and creating the cloud routine. Full history:
`bus/fleet/data/research-loop-log.jsonl`. Loop mechanics and boundaries: `docs/HANDOFF.md`.

## Bottom line right now
- **The $20 cap, not the trend rules, is why S1/S2 "failed."** At C1's real $20 per-entry cap both lose to plain
  buy-and-hold QQQ on CAGR (13.9% / 15.2% vs 15.5%). At a **$30 cap** they win at *matched risk*: S1 17.8% CAGR with a
  34.8% max drawdown (QQQ: 15.5%, 35.0%); S2 19.6% (18.1% at 15 bps costs) with ~30% drawdown. Higher caps return more but
  with more drawdown than QQQ. Reports: `bus/fleet/data/lev-backtest-descriptive-results.cap{30,40,50}.md`.
- **Why this is not yet a recommendation:** one ~5-year sample whose edge comes mostly from sidestepping 2022; S1 made 3
  trades, S2 113 (cost-sensitive); 3 caps were tried (mild data-snooping); deflated Sharpe ~0.2-0.3 (not significant);
  no 2008-style stress in the data. Raising C1's cap changes the protected budget envelope: the owner's call, and only
  after longer data confirms it.

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
- The one-shot out-of-sample test on 2016-01-04..2021-08-05 (docs/proposals/2026-09-29-unseen-window-test.md).
- Refreshing SIP/IEX price caches (needs the Pi's keys) and pushing them to the PR branch.
- Reading each cloud run (RemoteTrigger list_runs / get_run_log), re-verifying it, applying unprotected changes after
  tests pass here, sending protected ones to the owner.

## Boundaries unchanged
No live orders. Protected files only via owner-reviewed proposals. The cloud side has no secrets and cannot trade.
