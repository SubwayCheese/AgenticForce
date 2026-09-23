# Proposal (needs owner review -- protected file): don't submit entries while the market is closed

**File:** `bus/city/survive-executor.js` (protected; this is a proposal, NOT applied).
**Found:** 2026-09-23, reading the executor after mission008 (the first claude-agent mission) decided
`enter SGOV, limit $100.65, $20` at ~00:58 PDT with the market closed. The decision itself says "place the order
only during regular trading hours", but nothing in code enforces that.

## What happens today when a decision resolves outside market hours
`executeEntry` submits a `timeInForce: 'day'` order immediately, polls ~10s, then (best-effort) cancels it and
resolves the mission as `error`. Outcomes:
1. Usual: the order is canceled or rejected -> no money moves, but the mission is wasted and a 2h cooldown starts.
2. Rare but real: the cancel call throws (it's wrapped in `try { } catch (_) {}`), the day order stays queued, fills
   at the next open, and the ledger says `error` -> the real account holds a position the ledger doesn't know about.
   The existing reconciliation only covers the opposite gap (ledger open, account closed).

## Proposed change (small, in `executeEntry`, before `client.submitOrder`)
```js
// Don't submit an entry into a closed market: defer instead of resolving, so the next wake retries
// once the market is open. Decisions older than MAX_DECISION_AGE_HOURS expire instead of executing stale.
let clock = null;
try { clock = await client.getClock(); } catch (_) { /* unknown -> treat as closed, fail safe */ }
if (!clock || !clock.is_open) {
  const ageH = (Date.now() - Date.parse(decisionResolvedAt)) / 3600000;
  if (ageH > MAX_DECISION_AGE_HOURS) {
    appendMissionEvent({ type: 'mission-resolved', citizenId, missionId, outcome: 'expired', reason: `decision is ${ageH.toFixed(1)}h old and the market never opened in time` });
    return { outcome: 'expired' };
  }
  return { outcome: 'deferred', reason: 'market closed' }; // NOT resolved: findLatestUnresolvedDecision picks it up next wake
}
```
Plus: make the post-poll cancel failure loud instead of silent -- if `cancelOrder` throws, send an ntfy alert
naming the order id and mark the citizen as needing reconciliation.

Needs, before merging: `decisionResolvedAt` passed in from the decision task's `resolved_at`; a
`MAX_DECISION_AGE_HOURS` (suggest 18 -- covers an overnight decision executed at the next open); `isMissionDue`
already treats an unresolved mission as in flight, so no new mission is authored while one is deferred; tests for
closed->deferred, open->submits, stale->expired, cancel-throws->alert.

## Why not applied autonomously
Protected real-money path (change gate: human-review-required). Also changes live trading behavior: a deferred
decision will execute at the next open wake, which is a real order.
