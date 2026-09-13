## crypto_pilot_20260913_thesis_r1_aave
from: claude
to: codex
type: request
status: done
payload: ROUND-1 INDEPENDENT THESIS for AAVE, generated unattended by generate-pilot-tasks.js for the 20260913 crypto cycle (see crypto_pilot_20260913_universe_consolidation, auto-injected below, for the full data).

Standing constraints for crypto theses: no fundamentals data exists for this asset class -- do not invent one. This symbol is confirmed spot/long-only on this account; a bear case means "stay out," never "short." Tag any macro/narrative claim as INTERPRETATION, never FACT.

## Prior learnings (auto-injected from crypto_pilot_20260912_synthesis_r3_portfolio's keyLearnings, cycle 20260912)
- Do not convert rounded moving averages into exact support, resistance, or stop levels without a buffer and re-verification.
- A price trigger can repair timing, but cannot repair unusable price-level data; this is why PEPE, BONK, and SHIB are rejected.
- Shared dataset limitations should reduce conviction across the batch, not automatically become candidate-specific rejection reasons.

Use these as methodological discipline for THIS thesis -- they are lessons about
how this pipeline tends to over/understate evidence, not facts about this specific
symbol unless stated as such.
timestamp: 2026-09-13T03:21:34.350Z
dependsOnTaskId: crypto_pilot_20260913_universe_consolidation

## Result (auto)
resolved_at: 2026-09-13T03:21:58.775Z
output:
```
SOURCE: supplied by orchestrator from a prior verified step  
As of: 2026-09-13 market-data snapshot supplied by the prior pipeline step.

AAVE is a technically constructive but low-conviction long-only watchlist candidate.

- FACT: AAVE/USD was $127.37, up 1.42% in the supplied snapshot.
- FACT: It traded above the supplied 50-day average ($109.26) and 200-day average ($97.14). This supports a positive trend read, though the averages are rounded and should not be treated as exact support or stop levels.
- FACT: Its 20-day average volume in the screen was 49, and its screen score was 13.1 (ranked sixth of 32). The screen lacks market-cap data and does not provide fundamentals, valuation, analyst targets, or earnings data for crypto assets.
- INTERPRETATION: The price being above both moving averages is consistent with an established upward trend rather than a fresh reversal.
- INTERPRETATION: The reported volume is thin relative to several shortlist peers, reducing confidence in execution quality and in any breakout signal.

Base case: stay constructive only while AAVE remains meaningfully above the 50-day average on refreshed, unrounded data. A pullback that holds above a re-verified trend area could offer a more favorable long entry than chasing the current price.

Bull case: continued acceptance above the current area, accompanied by stronger refreshed volume, would support trend continuation.

Bear case / invalidation: a sustained break below a refreshed 50-day trend reference, especially with weak follow-through, means stay out. This is not a short thesis.

Decision: **Watch / conditional long, not an immediate high-conviction entry.** Recheck live price levels and liquidity before any order; the supplied rounded moving averages are context, not executable thresholds.
```
