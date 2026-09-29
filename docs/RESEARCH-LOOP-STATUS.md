# Research loop status (auto-updated every cycle)

Last updated: 2026-09-29 ~11:40 PDT, after cycle 3 + the cloud capability probe. Full history:
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
- Step 1 done: branch `cloud-sync-2026-09-29` pushed (2 commits: research infra; protected C1 fixes). **Owner creates the
  PR**: https://github.com/SubwayCheese/AgenticForce/pull/new/cloud-sync-2026-09-29 (gh CLI not installed on the Pi).
- Step 2 done (probe): cloud routines CAN clone, run node and our selftests (35/35, 11/11, 14/14; suite 159/161, the 2
  failures are no-ffmpeg-in-container), and use WebSearch. They CANNOT fetch arbitrary HTTPS (egress-blocked), CANNOT
  git push (denied by the cloud harness), and show no spend info. So the recurring routine reports in its transcript +
  a push notification, and a local Pi session applies any code changes.
- Next: Step 3 design adjusted for transcript-only handback, cross-review (Step 4), then create the recurring routine.

## Queued angles
1. **Longer data (unblocks everything above):** test the FMP connector (already attached to the owner's account and to
   cloud routines) for adjusted daily history of QQQ/TQQQ/SPY back to 2010+, cross-checked against the Alpaca cache.
2. A third strategy family with fewer trades than S2 but more than S1.
3. `executeExit` try/catch gap (same bug class fixed on the entry side 2026-09-29), as a proposal.
4. Productizing the backtest/research pipeline as its own offering.

## Boundaries unchanged
No live orders. Protected files only via owner-reviewed proposals. The cloud side has no secrets and cannot trade.
