## crypto_pilot_20260911_synthesis_r3_portfolio
from: claude
to: codex
type: request
status: done
payload: ROUND-3 PORTFOLIO SYNTHESIS for the crypto pilot (PEPE, POL, ARB, CRV, ONDO, DOT, UNI, SKY, HYPE, YFI). You are receiving the COMPLETE ledger: every round-1 thesis and round-2 challenge for this cycle, auto-injected below via multi-parent dependency.

Independently sort EACH candidate into exactly one of THREE outcomes -- not a forced single winner, and not a forced binary:

1. **approvedCandidates** -- actionable TODAY at current price, no future-dated gates. Use when the evidence genuinely supports acting right now.
2. **conditionalCandidates** -- the thesis itself is sound and the evidence quality clears the bar, but the CURRENT price is not the right entry -- a specific, checkable price level would confirm it (a pullback to support, a breakout above resistance, a rebound off a stated level). This is a real third outcome, not a consolation prize: only use it when round 2 did NOT find unresolved evidence-quality problems (a real logic/arithmetic error, an undefined/non-comparable metric, a data gap material enough to undermine the conclusion) -- if round 2 found problems like that, the candidate is REJECTED, not conditional, because a price trigger cannot fix bad evidence.
3. **rejectedCandidates** -- round 2 found a genuine, CANDIDATE-SPECIFIC disqualifying issue, or there is no real edge at any price for this name specifically.

**Critical distinction, read this before sorting anyone -- this is the single most common mistake in this decision**: round 2 was instructed to challenge EVERY thesis hard, so it will almost always surface something. Before treating a round-2 finding as grounds to reject, ask: does this finding apply ONLY to this candidate, or does the SAME limitation appear in round 2's critique of most/all of the other candidates too (e.g. "no forward growth estimates," "no peer-relative benchmarking," an undefined valuation-metric label, "cannot independently verify the raw daily series")? If it's a limitation of the INJECTED DATASET ITSELF -- true equally for every symbol in this batch because they were all built from the same enrichment pass -- it is NOT valid grounds to reject one candidate and not another. Rejecting every candidate for the same generic data-completeness caveat is not 15 independent judgments, it is one structural bias wearing 15 different names -- catch this actively, do not let it happen by default. A real disqualifier is something that differentiates THIS candidate from the others: an unexplained price event specific to this symbol, an actual arithmetic/logic error in THIS thesis, a fact this specific stance contradicts. Reserve rejectedCandidates for that.

Do NOT default everything into conditionalCandidates just to avoid an empty approvedCandidates/rejectedCandidates list -- sort honestly. A day where every candidate genuinely belongs in rejectedCandidates for real, candidate-specific reasons is a correct outcome. A day where every candidate gets the same generic-data-limitation reasoning is very likely the bias above, not a real finding -- if you notice that pattern forming, stop and re-sort using the distinction above before finalizing.

All symbols here are confirmed spot/long-only -- any approved or conditional conditionalSetup.direction MUST be "long". Time-based exit must be phrased in HOURS, not trading sessions -- crypto trades 24/7. Use the Alpaca order-format symbol with a slash (e.g. BTC/USD) in conditionalSetup.symbol.

Deterministic decision rule: (1) reject a candidate ONLY where round 2 found a genuine candidate-specific disqualifying issue (see the distinction above -- not a generic data-completeness caveat shared across the batch); (2) among survivors, assess genuine conviction; (3) if current price already supports entry, approve; (4) if the thesis is sound but needs a specific price confirmation first, mark conditional with an exact triggerPrice; (5) for each approved OR conditional candidate produce a conditionalSetup (symbol, direction, entryCondition, invalidationCondition, timeHorizon); (6) preserve material dissent per-symbol.

conditionalCandidates entries need TWO fields the other categories do not: **triggerPrice** (a single number, the exact price that confirms entry) and **triggerType** (`"at_or_below"` if you are waiting for a pullback/breakdown-confirmed entry, `"at_or_above"` if you are waiting for a breakout/strength-confirmed entry). These are checked automatically against live price, so they must be exact numbers, not a range or a prose description. When triggerType fires, an automated re-verification (a brief rescan, not full re-research) checks whether the thesis still holds before anything is executed -- so state the ORIGINAL reasoning clearly enough that a future check against it makes sense.

Output MUST include a single fenced json code block containing: runTimestamp, frozenDataTimestamp, approvedCandidates[] (symbol/stance/conditionalSetup/bullCase/bearCase/oneLineRationale), conditionalCandidates[] (symbol/stance/triggerPrice/triggerType/conditionalSetup/bullCase/bearCase/oneLineRationale), rejectedCandidates[] (symbol/reason), materialDissent{}, evidenceLedgerSummary{}, riskWarnings[], keyLearnings[], comparisonToPriorRuns, disclaimer.

## Prior learnings (auto-injected from crypto_pilot_20260910_synthesis_r3_portfolio_v2's keyLearnings, cycle 20260910)
- A concentrated headline move should not be treated as proof of exhaustion without the daily path and comparative data.
- Generic dataset limitations must be applied consistently, rather than used to reject individual symbols selectively.
- ETH has the cleanest supported current trend; BTC needs renewed strength confirmation, while XRP warrants a more favorable support-based entry.

Use these as methodological discipline for THIS thesis -- they are lessons about
how this pipeline tends to over/understate evidence, not facts about this specific
symbol unless stated as such.
timestamp: 2026-09-11T09:12:21.650Z
dependsOnTaskIds: crypto_pilot_20260911_thesis_r1_pepe, crypto_pilot_20260911_thesis_r1_pol, crypto_pilot_20260911_thesis_r1_arb, crypto_pilot_20260911_thesis_r1_crv, crypto_pilot_20260911_thesis_r1_ondo, crypto_pilot_20260911_thesis_r1_dot, crypto_pilot_20260911_thesis_r1_uni, crypto_pilot_20260911_thesis_r1_sky, crypto_pilot_20260911_thesis_r1_hype, crypto_pilot_20260911_thesis_r1_yfi, crypto_pilot_20260911_challenge_r2_pepe, crypto_pilot_20260911_challenge_r2_pol, crypto_pilot_20260911_challenge_r2_arb, crypto_pilot_20260911_challenge_r2_crv, crypto_pilot_20260911_challenge_r2_ondo, crypto_pilot_20260911_challenge_r2_dot, crypto_pilot_20260911_challenge_r2_uni, crypto_pilot_20260911_challenge_r2_sky, crypto_pilot_20260911_challenge_r2_hype, crypto_pilot_20260911_challenge_r2_yfi

## Result (auto)
resolved_at: 2026-09-11T09:20:07.516Z
output:
````
SOURCE: supplied by orchestrator from a prior verified step  
As of: 2026-09-11 supplied screen snapshots and Round-2 challenges.

```json
{
  "runTimestamp": "2026-09-11",
  "frozenDataTimestamp": "2026-09-11T09:12:21.042Z",
  "approvedCandidates": [],
  "conditionalCandidates": [
    {
      "symbol": "POL/USD",
      "stance": "conditional long",
      "triggerPrice": 0.1,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "POL/USD",
        "direction": "long",
        "entryCondition": "Enter only after price reaches $0.10 or higher and the automated re-verification confirms it remains above the supplied $0.09 moving-average zone.",
        "invalidationCondition": "Exit or do not enter if price is below $0.09 after entry.",
        "timeHorizon": "168 hours"
      },
      "bullCase": "POL is above both displayed $0.09 averages and led the supplied screen on reported daily change.",
      "bearCase": "The averages are rounded and the screen methodology is unavailable, so the current $0.09461675 price is not sufficient confirmation.",
      "oneLineRationale": "Round 2 upheld the cautious thesis; require a measurable move through $0.10 rather than buying the incomplete snapshot."
    },
    {
      "symbol": "DOT/USD",
      "stance": "conditional long",
      "triggerPrice": 1.13,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "DOT/USD",
        "direction": "long",
        "entryCondition": "Enter only after price reaches $1.13 or higher and re-verification confirms the recovery remains above the supplied $1.10 200-day reference.",
        "invalidationCondition": "Exit or do not enter if price is below $1.10 after entry.",
        "timeHorizon": "168 hours"
      },
      "bullCase": "DOT is above both supplied averages and can convert its narrow position above the $1.10 200-day reference into a confirmed recovery.",
      "bearCase": "The current price is only about 1.8% above the 200-day average, so ordinary volatility could negate the apparent strength.",
      "oneLineRationale": "Round 2 upheld the conditional stance; $1.13 provides an exact strength confirmation beyond the current $1.12004 snapshot."
    },
    {
      "symbol": "SKY/USD",
      "stance": "conditional long",
      "triggerPrice": 0.07,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "SKY/USD",
        "direction": "long",
        "entryCondition": "Enter only after price reaches $0.07 or higher and re-verification confirms that the longer-horizon recovery premise remains intact.",
        "invalidationCondition": "Exit or do not enter if price is below $0.06 after entry.",
        "timeHorizon": "168 hours"
      },
      "bullCase": "SKY is slightly above its $0.06 50-day average and a reclaim of $0.07 would restore the missing long-horizon confirmation.",
      "bearCase": "At $0.0608861 it remains about 13% below its 200-day average, and the reported move may be noise.",
      "oneLineRationale": "The Round-2 challenge retained the original wait-for-$0.07 thesis; no current entry is justified."
    },
    {
      "symbol": "YFI/USD",
      "stance": "conditional long",
      "triggerPrice": 2311.14,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "YFI/USD",
        "direction": "long",
        "entryCondition": "Enter only after price reaches $2311.14 or higher and re-verification confirms the price remains above both supplied moving-average references.",
        "invalidationCondition": "Exit or do not enter if price is below $2133.91 after entry.",
        "timeHorizon": "168 hours"
      },
      "bullCase": "YFI is already above its 50-day average and a reclaim of the 200-day average would confirm the proposed recovery filter.",
      "bearCase": "The supplied zero volume field is unusable and price remains below the $2311.14 200-day reference.",
      "oneLineRationale": "Round 2 upheld the conditional framework, while correctly treating the reported zero volume as a likely data-field problem rather than a liquidity conclusion."
    }
  ],
  "rejectedCandidates": [
    {
      "symbol": "PEPE/USD",
      "reason": "The candidate-specific signal is materially distorted: raw token-unit volume is non-comparable for a very low-priced token, both displayed moving averages lose all usable precision, and no independent trend or price-structure evidence remains."
    },
    {
      "symbol": "ARB/USD",
      "reason": "Its proposed bullish setup and invalidation both rely on the same coincident, rounded $0.10 moving-average display; that is an internally weak support thesis, not a validated price edge."
    },
    {
      "symbol": "CRV/USD",
      "reason": "The thesis converts a large distance above moving averages into an established momentum/support setup without evidence that either average is support; the proposed entry logic is not validated by the supplied data."
    },
    {
      "symbol": "ONDO/USD",
      "reason": "The long premise depends on $0.33 functioning as support despite no evidence that ONDO has respected it, while price is still below the $0.36 50-day reference; a price trigger alone cannot repair that unsupported support claim."
    },
    {
      "symbol": "UNI/USD",
      "reason": "UNI is already 34% above its 50-day average, but the only proposed pullback level is an unvalidated reference roughly 25% below spot; the supplied data offers no defined favorable entry edge."
    },
    {
      "symbol": "HYPE/USD",
      "reason": "HYPE is materially extended above both lagging averages, and Round 2 found no evidence that a hold above the 50-day average is a reliable continuation rule for this token."
    }
  ],
  "materialDissent": {
    "POL/USD": "A $0.10 trigger could miss an early move, but its exact confirmation is preferable to relying on rounded $0.09 averages.",
    "DOT/USD": "The $1.10 level is not proven support; the trigger is a disciplined confirmation filter, not evidence that the level will hold.",
    "SKY/USD": "Waiting for $0.07 sacrifices possible early-reversal upside, but avoids buying before longer-horizon recovery is visible.",
    "YFI/USD": "A move above the 50-day average may already be an early reversal, but the 200-day reclaim remains the only clearly stated confirmation level.",
    "PEPE/USD": "High reported token volume may reflect genuine activity, but it cannot be treated as comparable liquidity in this screen.",
    "ARB/USD": "Price may still be trending higher, but the rounded-average support premise is too coarse for an actionable setup.",
    "CRV/USD": "Aligned averages are directionally constructive, but they do not validate an entry or support level.",
    "ONDO/USD": "A breakout above $0.36 could work, but the thesis did not establish that level as meaningful resistance or provide confirmation quality.",
    "UNI/USD": "The moving-average position may reflect strength, but the data cannot distinguish continuation from a late extension.",
    "HYPE/USD": "The trend observation is positive, but extension and missing volatility context prevent a supported fresh-long rule."
  },
  "evidenceLedgerSummary": {
    "survivingTheses": "POL, DOT, SKY, and YFI were the only candidates whose Round-2 verdicts explicitly upheld their cautious conditional frameworks.",
    "candidateSpecificFailures": "PEPE has unusable nominal-price moving-average display and non-comparable token-volume dependence; ARB relies on a rounded shared level as both support and invalidation; CRV, ONDO, UNI, and HYPE each lacked a validated entry premise specific to their stated setup.",
    "genericLimitationsAppliedConsistently": "Missing raw price paths, volume normalization, volatility, benchmark-relative performance, and score methodology were treated as dataset-wide limitations, not standalone selective rejection reasons."
  },
  "riskWarnings": [
    "No candidate is approved for immediate entry at the supplied prices.",
    "All levels are anchored to the 2026-09-11 frozen dataset, not a live quote.",
    "Automated re-verification must occur when a conditional trigger fires; a trigger alone does not establish execution quality, liquidity, or continuing trend validity.",
    "Crypto is highly volatile and spot-long exposure can incur rapid, substantial losses."
  ],
  "keyLearnings": [
    "Do not infer liquidity from raw token-unit volume across differently priced assets.",
    "Rounded moving averages can be usable as broad context but not as precise support, resistance, or stop levels unless the thesis survives that precision limitation.",
    "A conditional setup is appropriate only where Round 2 preserved a coherent thesis and an exact price confirmation can be stated."
  ],
  "comparisonToPriorRuns": "Consistent with the prior-cycle discipline, this synthesis does not treat a single headline gain as proof of exhaustion or continuation, and it applies shared dataset limitations consistently. Unlike the prior BTC/ETH/XRP cycle, none of this batch has enough supported current-price evidence for immediate approval.",
  "disclaimer": "This is a constrained, educational portfolio-screen synthesis based solely on supplied frozen pipeline data, not investment advice. It is not a live market assessment or a recommendation to buy, sell, or hold any asset."
}
```
````
