## crypto_pilot_20260912_synthesis_r3_portfolio
from: claude
to: codex
type: request
status: done
payload: ROUND-3 PORTFOLIO SYNTHESIS for the crypto pilot (XTZ, PEPE, FIL, BONK, ARB, WIF, SHIB, DOT, SKY, LTC). You are receiving the COMPLETE ledger: every round-1 thesis and round-2 challenge for this cycle, auto-injected below via multi-parent dependency.

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

## Prior learnings (auto-injected from crypto_pilot_20260911_synthesis_r3_portfolio's keyLearnings, cycle 20260911)
- Do not infer liquidity from raw token-unit volume across differently priced assets.
- Rounded moving averages can be usable as broad context but not as precise support, resistance, or stop levels unless the thesis survives that precision limitation.
- A conditional setup is appropriate only where Round 2 preserved a coherent thesis and an exact price confirmation can be stated.

Use these as methodological discipline for THIS thesis -- they are lessons about
how this pipeline tends to over/understate evidence, not facts about this specific
symbol unless stated as such.
timestamp: 2026-09-12T02:12:21.357Z
dependsOnTaskIds: crypto_pilot_20260912_thesis_r1_xtz, crypto_pilot_20260912_thesis_r1_pepe, crypto_pilot_20260912_thesis_r1_fil, crypto_pilot_20260912_thesis_r1_bonk, crypto_pilot_20260912_thesis_r1_arb, crypto_pilot_20260912_thesis_r1_wif, crypto_pilot_20260912_thesis_r1_shib, crypto_pilot_20260912_thesis_r1_dot, crypto_pilot_20260912_thesis_r1_sky, crypto_pilot_20260912_thesis_r1_ltc, crypto_pilot_20260912_challenge_r2_xtz, crypto_pilot_20260912_challenge_r2_pepe, crypto_pilot_20260912_challenge_r2_fil, crypto_pilot_20260912_challenge_r2_bonk, crypto_pilot_20260912_challenge_r2_arb, crypto_pilot_20260912_challenge_r2_wif, crypto_pilot_20260912_challenge_r2_shib, crypto_pilot_20260912_challenge_r2_dot, crypto_pilot_20260912_challenge_r2_sky, crypto_pilot_20260912_challenge_r2_ltc

## Result (auto)
resolved_at: 2026-09-12T02:19:54.323Z
output:
````
SOURCE: supplied by orchestrator from a prior verified step  
As of: frozen supplied screen snapshot, 2026-09-12T02:12:21.128Z.  
The frozen data is future-dated relative to this dispatch (2026-09-11), so no entry should execute without a fresh quote and brief re-verification.

```json
{
  "runTimestamp": "2026-09-11T00:00:00-07:00",
  "frozenDataTimestamp": "2026-09-12T02:12:21.128Z",
  "approvedCandidates": [
    {
      "symbol": "ARB",
      "stance": "approved long",
      "conditionalSetup": {
        "symbol": "ARB/USD",
        "direction": "long",
        "entryCondition": "The frozen $0.1419 price is accepted for entry because it is materially above both displayed $0.10 trend references; revalidate the spot quote immediately before ordering.",
        "invalidationCondition": "Exit or decline entry if re-verification shows ARB no longer above both newly calculated 50-day and 200-day averages.",
        "timeHorizon": "72 hours"
      },
      "bullCase": "ARB is above both displayed moving-average contexts and was up 1.71% in the supplied snapshot.",
      "bearCase": "This is only a favorable snapshot; opaque ranking, rounded averages, and unknown liquidity prevent a high-conviction trend claim.",
      "oneLineRationale": "Of the supplied names, ARB has one of the clearest already-positive broad trend configurations."
    },
    {
      "symbol": "WIF",
      "stance": "approved long",
      "conditionalSetup": {
        "symbol": "WIF/USD",
        "direction": "long",
        "entryCondition": "The frozen $0.19488 price is accepted for entry because it is above both displayed $0.17 and $0.18 trend references; revalidate the spot quote immediately before ordering.",
        "invalidationCondition": "Exit or decline entry if re-verification shows WIF has fallen back below its newly calculated 200-day average.",
        "timeHorizon": "48 hours"
      },
      "bullCase": "WIF was up 1.59% and nominally above both broad moving-average references.",
      "bearCase": "The positive case rests on one snapshot and is vulnerable to sentiment-driven reversal; no precise historical breakout or liquidity evidence is supplied.",
      "oneLineRationale": "Current price already clears both available broad trend references, supporting a small, tightly monitored long."
    },
    {
      "symbol": "LTC",
      "stance": "approved long",
      "conditionalSetup": {
        "symbol": "LTC/USD",
        "direction": "long",
        "entryCondition": "The frozen $53.8675 price is accepted for entry because it is above the displayed $48.21 50-day and $50.43 200-day averages; revalidate the spot quote immediately before ordering.",
        "invalidationCondition": "Exit or decline entry if re-verification shows LTC has lost its newly calculated 200-day average.",
        "timeHorizon": "96 hours"
      },
      "bullCase": "LTC is about 11.7% above the displayed 50-day average and 6.8% above the displayed 200-day average, with a positive daily move.",
      "bearCase": "The displayed 50-day average remains below the 200-day average, and no breakout, liquidity, or relative-strength history is available.",
      "oneLineRationale": "LTC has the strongest supplied price-versus-average cushion among the actionable broad-trend setups."
    }
  ],
  "conditionalCandidates": [
    {
      "symbol": "XTZ",
      "stance": "conditional long",
      "triggerPrice": 0.3,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "XTZ/USD",
        "direction": "long",
        "entryCondition": "Enter only after XTZ reaches $0.30 or higher and the re-verification confirms a genuine reclaim above its exact 200-day average.",
        "invalidationCondition": "Do not enter, or exit, if re-verification finds the move failed to hold above the exact 200-day average.",
        "timeHorizon": "72 hours"
      },
      "bullCase": "XTZ led the supplied screen, rose 3.06%, and was above the displayed 50-day average.",
      "bearCase": "It remains below the displayed 200-day average; the recovery interpretation is not established from a single snapshot.",
      "oneLineRationale": "A $0.30 breakout creates a buffer above the rounded $0.29 long-term reference rather than treating that rounded figure as an execution level."
    },
    {
      "symbol": "FIL",
      "stance": "conditional long",
      "triggerPrice": 0.86,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "FIL/USD",
        "direction": "long",
        "entryCondition": "Enter only after FIL reaches $0.86 or higher and the re-verification confirms price above the exact 200-day average.",
        "invalidationCondition": "Do not enter, or exit, if re-verification finds FIL has failed back below its exact 200-day average.",
        "timeHorizon": "72 hours"
      },
      "bullCase": "FIL was above the displayed 50-day average, up 1.72%, and ranked third in the supplied screen.",
      "bearCase": "The current $0.7988685 price remains below the displayed $0.85 200-day context and may be only a transient bounce.",
      "oneLineRationale": "A $0.86 confirmation would clear the coarse long-term hurdle with a modest rounding buffer."
    },
    {
      "symbol": "DOT",
      "stance": "conditional long",
      "triggerPrice": 1.11,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "DOT/USD",
        "direction": "long",
        "entryCondition": "Enter only after DOT reaches $1.11 or higher and re-verification confirms a reclaim of its exact 200-day average.",
        "invalidationCondition": "Do not enter, or exit, if re-verification shows DOT is back below its exact 200-day average.",
        "timeHorizon": "96 hours"
      },
      "bullCase": "DOT is above the displayed 50-day average and only modestly below the displayed 200-day context.",
      "bearCase": "The supplied evidence cannot establish persistence, risk/reward, or the meaning of its screen rank.",
      "oneLineRationale": "A $1.11 breakout is a checkable confirmation above the displayed $1.10 hurdle without relying on it as a precise level."
    },
    {
      "symbol": "SKY",
      "stance": "conditional long",
      "triggerPrice": 0.08,
      "triggerType": "at_or_above",
      "conditionalSetup": {
        "symbol": "SKY/USD",
        "direction": "long",
        "entryCondition": "Enter only after SKY reaches $0.08 or higher and re-verification confirms a sustained price above the exact 200-day average.",
        "invalidationCondition": "Do not enter, or exit, if re-verification shows SKY has not held above its exact 200-day average.",
        "timeHorizon": "72 hours"
      },
      "bullCase": "SKY was positive and above the displayed 50-day average.",
      "bearCase": "At $0.062281 it remains below the displayed $0.07 200-day reference; trend durability is unproven.",
      "oneLineRationale": "The larger $0.08 buffer is needed because the supplied moving-average precision is especially coarse for SKY."
    }
  ],
  "rejectedCandidates": [
    {
      "symbol": "PEPE",
      "reason": "Both displayed moving averages are $0.00, leaving no usable candidate-specific trend context or exact evidence-supported confirmation level."
    },
    {
      "symbol": "BONK",
      "reason": "Both displayed moving averages are $0.00 and Round 2 specifically downgraded the positive watchlist framing to an unverified screen observation."
    },
    {
      "symbol": "SHIB",
      "reason": "Both displayed moving averages are $0.00; the remaining +0.58% move and opaque screen rank do not create a real long edge at any stated price."
    }
  ],
  "materialDissent": {
    "XTZ": "Round 2 judged the recovery/watchlist language weaker than the thesis implied; the $0.30 trigger is therefore deliberately stricter than the displayed $0.29 reference.",
    "FIL": "The strongest dissent is that waiting for a 200-day reclaim could miss an early recovery; the supplied data still cannot justify entry before confirmation.",
    "ARB": "Round 2 says the evidence supports only a favorable snapshot, not persistent momentum; approval is low-conviction and requires fresh quote validation.",
    "WIF": "Round 2 argued the evidence may be insufficient even for meaningful watchlist status; approval relies only on current price already being above both broad references.",
    "LTC": "The positive price configuration conflicts with the prior bearish framing; approval follows the direct supplied price evidence, not the opaque screen rank.",
    "DOT": "Round 2 correctly weakens any claim that DOT is in a negative long-term trend; it remains conditional because it has not cleared the displayed long-term reference.",
    "SKY": "The 1.24% move cannot be judged meaningful without volatility data; the high trigger avoids treating a rounded $0.07 average as exact.",
    "PEPE": "A positive daily move and high rank could justify monitoring, but cannot overcome the unusable price-level data.",
    "BONK": "A fourth-place ranking may be useful for future research, but its unknown construction cannot support a long setup.",
    "SHIB": "Monitoring may be reasonable operationally, but there is no executable evidence-supported long thesis in this ledger."
  },
  "evidenceLedgerSummary": {
    "survivingPositiveEvidence": "ARB, WIF, and LTC are already above both displayed broad moving-average references; XTZ, FIL, DOT, and SKY have plausible recovery structures but remain below displayed 200-day context.",
    "candidateSpecificDisqualifiers": "PEPE, BONK, and SHIB uniquely have both moving averages displayed as $0.00, preventing any meaningful technical threshold from this ledger.",
    "sharedLimitationsNotUsedAsBlanketRejection": "Opaque screen methodology, raw token-unit volume, missing OHLC/volatility/depth data, and the future-dated snapshot affect the batch broadly and were not treated as symbol-specific disqualifiers."
  },
  "riskWarnings": [
    "All frozen figures are dated after the dispatch date; verify live quote, venue availability, and exact moving averages before any order.",
    "Raw token-unit volume must not be used for cross-asset liquidity comparisons or position sizing.",
    "Rounded moving averages are broad context only; exact execution and invalidation decisions require the re-verification step.",
    "This is a concentrated, high-volatility crypto basket; use small sizing and avoid assuming independently supplied signals are uncorrelated."
  ],
  "keyLearnings": [
    "Do not convert rounded moving averages into exact support, resistance, or stop levels without a buffer and re-verification.",
    "A price trigger can repair timing, but cannot repair unusable price-level data; this is why PEPE, BONK, and SHIB are rejected.",
    "Shared dataset limitations should reduce conviction across the batch, not automatically become candidate-specific rejection reasons."
  ],
  "comparisonToPriorRuns": "Consistent with the prior methodological learnings, this synthesis avoids inferring liquidity from token-unit volume and uses conditional status only where a buffered, checkable price confirmation remains coherent after Round 2.",
  "disclaimer": "Research synthesis only, not investment advice. Crypto assets can move sharply and the supplied snapshot is not a live quote."
}
```
````
