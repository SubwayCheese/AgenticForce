## crypto_pilot_20260913_synthesis_r3_portfolio
from: claude
to: codex
type: request
status: done
payload: ROUND-3 PORTFOLIO SYNTHESIS for the crypto pilot (BAT, PEPE, GRT, BONK, SHIB, AAVE, CRV, XTZ, FIL, YFI). You are receiving the COMPLETE ledger: every round-1 thesis and round-2 challenge for this cycle, auto-injected below via multi-parent dependency.

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

## Prior learnings (auto-injected from crypto_pilot_20260912_synthesis_r3_portfolio's keyLearnings, cycle 20260912)
- Do not convert rounded moving averages into exact support, resistance, or stop levels without a buffer and re-verification.
- A price trigger can repair timing, but cannot repair unusable price-level data; this is why PEPE, BONK, and SHIB are rejected.
- Shared dataset limitations should reduce conviction across the batch, not automatically become candidate-specific rejection reasons.

Use these as methodological discipline for THIS thesis -- they are lessons about
how this pipeline tends to over/understate evidence, not facts about this specific
symbol unless stated as such.
timestamp: 2026-09-13T03:21:34.783Z
dependsOnTaskIds: crypto_pilot_20260913_thesis_r1_bat, crypto_pilot_20260913_thesis_r1_pepe, crypto_pilot_20260913_thesis_r1_grt, crypto_pilot_20260913_thesis_r1_bonk, crypto_pilot_20260913_thesis_r1_shib, crypto_pilot_20260913_thesis_r1_aave, crypto_pilot_20260913_thesis_r1_crv, crypto_pilot_20260913_thesis_r1_xtz, crypto_pilot_20260913_thesis_r1_fil, crypto_pilot_20260913_thesis_r1_yfi, crypto_pilot_20260913_challenge_r2_bat, crypto_pilot_20260913_challenge_r2_pepe, crypto_pilot_20260913_challenge_r2_grt, crypto_pilot_20260913_challenge_r2_bonk, crypto_pilot_20260913_challenge_r2_shib, crypto_pilot_20260913_challenge_r2_aave, crypto_pilot_20260913_challenge_r2_crv, crypto_pilot_20260913_challenge_r2_xtz, crypto_pilot_20260913_challenge_r2_fil, crypto_pilot_20260913_challenge_r2_yfi

## Result (auto)
resolved_at: 2026-09-13T03:31:27.519Z
output:
````
SOURCE: supplied by orchestrator from a prior verified step  
As of: supplied 2026-09-13 screen snapshot; no live re-check was performed.

```json
{
  "runTimestamp": "2026-09-12T00:00:00-07:00",
  "frozenDataTimestamp": "2026-09-13T03:21:33.701Z",
  "approvedCandidates": [],
  "conditionalCandidates": [
    {
      "symbol": "BAT",
      "stance": "conditional long",
      "triggerPrice": 0.07870775,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "BAT/USD",
        "direction": "long",
        "entryCondition": "Re-verify that price has held at or above $0.07870775 with executable liquidity before entry.",
        "invalidationCondition": "Do not enter if refreshed data shows rejection below the trigger or inadequate executable liquidity.",
        "timeHorizon": "Reassess within 72 hours of trigger."
      },
      "bullCase": "BAT led the supplied screen and was above its displayed 50-day average, indicating possible short-term strength.",
      "bearCase": "The move may be a one-period spike and price remained below the displayed 200-day average.",
      "oneLineRationale": "Potential momentum continuation, but the opaque screen and unqualified volume data require trigger-time verification."
    },
    {
      "symbol": "AAVE",
      "stance": "conditional long",
      "triggerPrice": 127.37,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "AAVE/USD",
        "direction": "long",
        "entryCondition": "Re-verify continued acceptance at or above $127.37, including executable liquidity, before entry.",
        "invalidationCondition": "Do not enter if refreshed data shows price no longer above the verified medium- and long-term trend references or liquidity is inadequate.",
        "timeHorizon": "Reassess within 72 hours of trigger."
      },
      "bullCase": "Price was above both supplied moving-average references, the strongest displayed trend alignment in this group.",
      "bearCase": "The price may be extended versus the 50-day reference, while the reported volume figure cannot establish liquidity.",
      "oneLineRationale": "Constructive positioning survives the challenge, but it is not sufficiently validated to chase without fresh confirmation."
    },
    {
      "symbol": "CRV",
      "stance": "conditional long",
      "triggerPrice": 0.33733,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "CRV/USD",
        "direction": "long",
        "entryCondition": "Re-verify acceptance at or above $0.33733 and usable execution conditions before entry.",
        "invalidationCondition": "Do not enter if refreshed data shows the move has failed or price is no longer above verified medium- and long-term trend references.",
        "timeHorizon": "Reassess within 72 hours of trigger."
      },
      "bullCase": "CRV was positive and above both displayed moving averages.",
      "bearCase": "The supplied snapshot does not establish moving-average slope, durable trend quality, or current volume confirmation.",
      "oneLineRationale": "Relative-strength evidence supports a long watch, but the trigger must be revalidated because the displayed reference is not proven resistance."
    },
    {
      "symbol": "XTZ",
      "stance": "conditional long",
      "triggerPrice": 0.29,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "XTZ/USD",
        "direction": "long",
        "entryCondition": "Re-verify a sustained move at or above $0.29 with usable liquidity before entry.",
        "invalidationCondition": "Do not enter if refreshed data shows failure to hold the verified long-term trend area.",
        "timeHorizon": "Reassess within 72 hours of trigger."
      },
      "bullCase": "XTZ was materially above the supplied 50-day reference and relatively close to the 200-day reference.",
      "bearCase": "The 200-day figure is rounded and the supplied volume measure cannot confirm execution quality.",
      "oneLineRationale": "Early-recovery potential is plausible, but long-term confirmation is required and the exact level must be checked anew."
    },
    {
      "symbol": "FIL",
      "stance": "conditional long",
      "triggerPrice": 0.84,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "FIL/USD",
        "direction": "long",
        "entryCondition": "Re-verify a hold at or above $0.84 using precise price history and executable liquidity before entry.",
        "invalidationCondition": "Do not enter if the refreshed series shows failure to hold the verified long-term trend area.",
        "timeHorizon": "Reassess within 72 hours of trigger."
      },
      "bullCase": "FIL was above the supplied 50-day reference and only modestly below the displayed 200-day reference.",
      "bearCase": "The reported 200-day value is rounded, and neither volume nor the score validates a breakout.",
      "oneLineRationale": "A potential reversal setup survives, but $0.84 is only an automated re-verification gate, not an executable level by itself."
    },
    {
      "symbol": "YFI",
      "stance": "conditional long",
      "triggerPrice": 2306.03,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "YFI/USD",
        "direction": "long",
        "entryCondition": "Re-verify a hold at or above $2306.03 with independently usable volume and execution data before entry.",
        "invalidationCondition": "Do not enter if refreshed data cannot validate liquidity or shows failure above the verified long-term trend reference.",
        "timeHorizon": "Reassess within 72 hours of trigger."
      },
      "bullCase": "YFI was above the 50-day reference and near the displayed 200-day reference, consistent with a possible recovery.",
      "bearCase": "Its supplied 20-day volume was zero, making this screen's volume field specifically unusable for YFI confirmation.",
      "oneLineRationale": "Potential recovery is not disproven, but YFI requires a verified long-term reclaim and usable volume before any long."
    }
  ],
  "rejectedCandidates": [
    {
      "symbol": "PEPE",
      "reason": "The supplied moving-average display is $0.00 for both references, leaving no usable price-level basis for a disciplined entry and invalidation in this cycle; a trigger alone cannot repair that record."
    },
    {
      "symbol": "GRT",
      "reason": "Both displayed moving averages are $0.02 while spot is $0.01881165, so rounding can reverse the apparent relationship; the candidate-specific technical premise is therefore non-comparable and cannot support a long setup."
    },
    {
      "symbol": "BONK",
      "reason": "Both supplied moving-average references display as $0.00, so the candidate has no usable technical level or defined invalidation for this cycle."
    },
    {
      "symbol": "SHIB",
      "reason": "Both supplied moving-average references display as $0.00, so the candidate has no usable technical level or defined invalidation for this cycle."
    }
  ],
  "materialDissent": {
    "BAT": "Round 2 argued that opaque ranking, one-period strength, and unvalidated liquidity do not earn a directional bias.",
    "PEPE": "Round 2 viewed the precision failure as a display problem rather than adverse asset evidence; rejection is limited to this cycle's unusable record.",
    "GRT": "Round 2 found no affirmative reason to prioritize GRT and noted its rounded averages may lie on either side of price.",
    "BONK": "Round 2 favored 'monitor pending usable data' rather than an asset-level negative conclusion.",
    "SHIB": "Round 2 similarly characterized the issue as insufficiently specified data rather than bearish evidence.",
    "AAVE": "Round 2 warned that price above two moving averages may be a late rebound and that the liquidity comparison was unsupported.",
    "CRV": "Round 2 found the original same-price confirmation rule arbitrary, so the stated trigger is only a re-verification gate.",
    "XTZ": "Round 2 noted that a 200-day reclaim could be late confirmation and that the rounded level is not an executable threshold.",
    "FIL": "Round 2 accepted deferral but rejected treating the rounded $0.84 reference as a precise breakout level.",
    "YFI": "Round 2 noted the zero volume field undermines the screen's data integrity, though it is not negative evidence about YFI."
  },
  "evidenceLedgerSummary": {
    "survivingPositiveEvidence": "AAVE and CRV were above both displayed moving-average references; BAT, XTZ, FIL, and YFI showed possible recovery or momentum positioning.",
    "sharedLimitations": "All candidates rely on a supplied snapshot with opaque score methodology, unspecified volume units, rounded moving averages, and no broader crypto-specific fundamental context. These reduce conviction across the batch rather than independently rejecting each survivor.",
    "candidateSpecificFailures": "PEPE, BONK, and SHIB have $0.00 moving-average displays; GRT's rounded $0.02 references are too close to its spot price to establish even directional positioning; YFI's zero-volume field requires extra trigger-time validation."
  },
  "riskWarnings": [
    "No candidate is approved today because the supplied evidence does not establish trade-ready execution, risk/reward, or durable trend persistence.",
    "Trigger prices derived from rounded moving-average displays are re-verification gates only; they must not be treated as exact support, resistance, or stops.",
    "Crypto is volatile and trades continuously; reassessment windows are expressed in hours and may require cancellation if conditions change."
  ],
  "keyLearnings": [
    "Shared data gaps should lower conviction across the portfolio, not become repetitive candidate-specific rejection rationales.",
    "A price trigger can improve timing but cannot cure unusable price-level evidence.",
    "For low-priced assets, display precision is itself decision-critical: rounded figures can erase or invert the apparent technical relationship."
  ],
  "comparisonToPriorRuns": "Consistent with the prior-cycle discipline, PEPE, BONK, and SHIB remain rejected for unusable price-level records. This run additionally rejects GRT because its rounded averages are directly non-comparable to spot, while retaining the remaining names as conditional rather than converting generic dataset limitations into blanket rejections.",
  "disclaimer": "This is a constrained synthesis of supplied pipeline data, not live market research, investment advice, or an instruction to trade. Automated trigger firing requires the stated re-verification before any execution."
}
```
````
