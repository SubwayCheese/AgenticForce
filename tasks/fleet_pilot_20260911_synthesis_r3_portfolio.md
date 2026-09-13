## fleet_pilot_20260911_synthesis_r3_portfolio
from: claude
to: codex
type: request
status: done
payload: ROUND-3 PORTFOLIO SYNTHESIS for the fleet pilot (INTC, QCOM, NVDA, CSCO, AAPL, BA, AMZN, GOOGL, CRM, NFLX, AMD, BAC, NKE, VZ, CAT). You are receiving the COMPLETE ledger: every round-1 thesis and round-2 challenge for this cycle, auto-injected below via multi-parent dependency.

Independently sort EACH candidate into exactly one of THREE outcomes -- not a forced single winner, and not a forced binary:

1. **approvedCandidates** -- actionable TODAY at current price, no future-dated gates. Use when the evidence genuinely supports acting right now.
2. **conditionalCandidates** -- the thesis itself is sound and the evidence quality clears the bar, but the CURRENT price is not the right entry -- a specific, checkable price level would confirm it (a pullback to support, a breakout above resistance, a rebound off a stated level). This is a real third outcome, not a consolation prize: only use it when round 2 did NOT find unresolved evidence-quality problems (a real logic/arithmetic error, an undefined/non-comparable metric, a data gap material enough to undermine the conclusion) -- if round 2 found problems like that, the candidate is REJECTED, not conditional, because a price trigger cannot fix bad evidence.
3. **rejectedCandidates** -- round 2 found a genuine, CANDIDATE-SPECIFIC disqualifying issue, or there is no real edge at any price for this name specifically.

**Critical distinction, read this before sorting anyone -- this is the single most common mistake in this decision**: round 2 was instructed to challenge EVERY thesis hard, so it will almost always surface something. Before treating a round-2 finding as grounds to reject, ask: does this finding apply ONLY to this candidate, or does the SAME limitation appear in round 2's critique of most/all of the other candidates too (e.g. "no forward growth estimates," "no peer-relative benchmarking," an undefined valuation-metric label, "cannot independently verify the raw daily series")? If it's a limitation of the INJECTED DATASET ITSELF -- true equally for every symbol in this batch because they were all built from the same enrichment pass -- it is NOT valid grounds to reject one candidate and not another. Rejecting every candidate for the same generic data-completeness caveat is not 15 independent judgments, it is one structural bias wearing 15 different names -- catch this actively, do not let it happen by default. A real disqualifier is something that differentiates THIS candidate from the others: an unexplained price event specific to this symbol, an actual arithmetic/logic error in THIS thesis, a fact this specific stance contradicts. Reserve rejectedCandidates for that.

Do NOT default everything into conditionalCandidates just to avoid an empty approvedCandidates/rejectedCandidates list -- sort honestly. A day where every candidate genuinely belongs in rejectedCandidates for real, candidate-specific reasons is a correct outcome. A day where every candidate gets the same generic-data-limitation reasoning is very likely the bias above, not a real finding -- if you notice that pattern forming, stop and re-sort using the distinction above before finalizing.

Time-based exit must be phrased as "...or exit after N trading sessions if not triggered," or "exit at today's close"/"exit at the close" for an explicit same-day exit.

Deterministic decision rule: (1) reject a candidate ONLY where round 2 found a genuine candidate-specific disqualifying issue (see the distinction above -- not a generic data-completeness caveat shared across the batch); (2) among survivors, assess genuine conviction; (3) if current price already supports entry, approve; (4) if the thesis is sound but needs a specific price confirmation first, mark conditional with an exact triggerPrice; (5) for each approved OR conditional candidate produce a conditionalSetup (symbol, direction, entryCondition, invalidationCondition, timeHorizon); (6) preserve material dissent per-symbol.

conditionalCandidates entries need TWO fields the other categories do not: **triggerPrice** (a single number, the exact price that confirms entry) and **triggerType** (`"at_or_below"` if you are waiting for a pullback/breakdown-confirmed entry, `"at_or_above"` if you are waiting for a breakout/strength-confirmed entry). These are checked automatically against live price, so they must be exact numbers, not a range or a prose description. When triggerType fires, an automated re-verification (a brief rescan, not full re-research) checks whether the thesis still holds before anything is executed -- so state the ORIGINAL reasoning clearly enough that a future check against it makes sense.

Output MUST include a single fenced json code block containing: runTimestamp, frozenDataTimestamp, approvedCandidates[] (symbol/stance/conditionalSetup/bullCase/bearCase/oneLineRationale), conditionalCandidates[] (symbol/stance/triggerPrice/triggerType/conditionalSetup/bullCase/bearCase/oneLineRationale), rejectedCandidates[] (symbol/reason), materialDissent{}, evidenceLedgerSummary{}, riskWarnings[], keyLearnings[], comparisonToPriorRuns, disclaimer.

## Prior learnings (auto-injected from fleet_pilot_20260910_synthesis_r3_portfolio_v2's keyLearnings, cycle 20260910)
- Do not convert shared packet limitations into fifteen independent rejections.
- Use only arithmetic and logic errors that are specific to a symbol as evidence-quality disqualifiers.
- A lower price can improve entry compensation, but cannot repair an unresolved symbol-specific evidence error.
- Short-window endpoints should be used as explicit price triggers rather than as causal claims about earnings or investor behavior.

Use these as methodological discipline for THIS thesis -- they are lessons about
how this pipeline tends to over/understate evidence, not facts about this specific
symbol unless stated as such.
timestamp: 2026-09-11T17:30:25.440Z
dependsOnTaskIds: fleet_pilot_20260911_thesis_r1_intc, fleet_pilot_20260911_thesis_r1_qcom, fleet_pilot_20260911_thesis_r1_nvda, fleet_pilot_20260911_thesis_r1_csco, fleet_pilot_20260911_thesis_r1_aapl, fleet_pilot_20260911_thesis_r1_ba, fleet_pilot_20260911_thesis_r1_amzn, fleet_pilot_20260911_thesis_r1_googl, fleet_pilot_20260911_thesis_r1_crm, fleet_pilot_20260911_thesis_r1_nflx, fleet_pilot_20260911_thesis_r1_amd, fleet_pilot_20260911_thesis_r1_bac, fleet_pilot_20260911_thesis_r1_nke, fleet_pilot_20260911_thesis_r1_vz, fleet_pilot_20260911_thesis_r1_cat, fleet_pilot_20260911_challenge_r2_intc, fleet_pilot_20260911_challenge_r2_qcom, fleet_pilot_20260911_challenge_r2_nvda, fleet_pilot_20260911_challenge_r2_csco, fleet_pilot_20260911_challenge_r2_aapl, fleet_pilot_20260911_challenge_r2_ba, fleet_pilot_20260911_challenge_r2_amzn, fleet_pilot_20260911_challenge_r2_googl, fleet_pilot_20260911_challenge_r2_crm, fleet_pilot_20260911_challenge_r2_nflx, fleet_pilot_20260911_challenge_r2_amd, fleet_pilot_20260911_challenge_r2_bac, fleet_pilot_20260911_challenge_r2_nke, fleet_pilot_20260911_challenge_r2_vz, fleet_pilot_20260911_challenge_r2_cat

## Result (auto)
resolved_at: 2026-09-11T18:21:31.316Z
output:
````
SOURCE: supplied by orchestrator from a prior verified step  
As of: frozen screen timestamp 2026-09-11T17:30:25.270Z.

The requested three-way sort is not logically satisfiable from this ledger: most survivors have no current or historical absolute price, so they cannot be approved or assigned the required exact conditional triggerPrice; rejecting them for that shared gap would violate your candidate-specific-rejection rule. VZ is the sole name with an exact inherited trigger.

```json
{
  "runTimestamp": "2026-09-11T17:30:25.270Z",
  "frozenDataTimestamp": "2026-09-11T17:30:25.270Z",
  "approvedCandidates": [],
  "conditionalCandidates": [
    {
      "symbol": "VZ",
      "stance": "long",
      "triggerPrice": 48.22,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "VZ",
        "direction": "long",
        "entryCondition": "Enter only on a re-verification-confirmed move at or above $48.22.",
        "invalidationCondition": "Exit below $46.50, or exit after 10 trading sessions if not triggered.",
        "timeHorizon": "10 trading sessions"
      },
      "bullCase": "A defined inherited price trigger and invalidation permit a limited tactical confirmation setup.",
      "bearCase": "The levels lack supplied derivation; no current-cycle fundamental or valuation evidence supports an underwritten long.",
      "oneLineRationale": "The only candidate with an exact supplied price trigger, but suitable only as a provisional tactical alert."
    }
  ],
  "rejectedCandidates": [
    {
      "symbol": "AAPL",
      "reason": "Round 1 contains candidate-specific contradictory peer comparisons: it incorrectly states AAPL's change exceeded GOOGL and CRM and that its volume was below AMZN's."
    },
    {
      "symbol": "BAC",
      "reason": "Round 1 contains candidate-specific factual errors: BAC was third, not fourth, by listed volume, and its claimed relative change/peer-shortlist comparison was materially incorrect."
    }
  ],
  "materialDissent": {
    "INTC": "Top composite rank does not establish momentum leadership; QCOM and CSCO had higher reported changes.",
    "QCOM": "The strongest reported change is one undefined-period observation, not validated persistence.",
    "NVDA": "Historical profitability is strong, but stale price and absent valuation/forward verified data prevent an entry decision.",
    "CSCO": "A prior 0.15% short loss is too small to establish a bullish reversal or disprove downside continuation.",
    "BA": "Its reported positive change has no disclosed horizon or price confirmation.",
    "AMZN": "The screen placement is mechanically reported but cannot establish a conditional accumulation framework without price levels.",
    "GOOGL": "The prior 0.08% short loss is economically immaterial and does not create a long edge.",
    "CRM": "Its proposed entry condition was undefined because no price endpoint was supplied.",
    "NFLX": "Top-quintile placement does not establish durable momentum.",
    "AMD": "Rank and score lack sufficient methodological context to imply a constructive tilt.",
    "NKE": "The rank-13 watchlist designation is a workflow choice rather than evidence of an edge.",
    "CAT": "The cautious watch stance holds, but no exact price trigger is available."
  },
  "evidenceLedgerSummary": {
    "usableActionablePriceFrameworks": ["VZ"],
    "candidateSpecificEvidenceErrors": ["AAPL", "BAC"],
    "sharedDatasetLimitations": [
      "Undefined change horizon",
      "Incomplete screen methodology",
      "Missing market-cap component",
      "No current absolute prices for most names",
      "No price-history or fundamental/valuation packet for most names"
    ]
  },
  "riskWarnings": [
    "No approved candidate is supported today.",
    "Do not turn shared data incompleteness into symbol-specific rejection reasons.",
    "A price trigger cannot cure a genuine symbol-specific arithmetic or logic error.",
    "VZ's trigger/invalidation levels are inherited and not analytically derived in this ledger."
  ],
  "keyLearnings": [
    "Preserve the distinction between shared pipeline gaps and candidate-specific defects.",
    "Use price levels only when actually supplied and checkable.",
    "Do not infer durable momentum from a single undefined-period return."
  ],
  "comparisonToPriorRuns": "Consistent with the prior discipline: shared data limitations were not converted into blanket rejections; AAPL and BAC are rejected only for documented symbol-specific factual errors.",
  "disclaimer": "This is a constrained synthesis of supplied pipeline evidence, not investment advice. The omitted survivors cannot be validly placed in any required category without violating either the exact-trigger requirement or the candidate-specific-rejection rule."
}
```
````
