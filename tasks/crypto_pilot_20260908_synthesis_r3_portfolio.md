## crypto_pilot_20260908_synthesis_r3_portfolio
from: claude
to: codex
type: request
status: done
payload: ROUND-3 PORTFOLIO SYNTHESIS for the crypto pilot (BTC, ETH, XRP -- 3 fixed symbols, no universe-scan/shortlist funnel). You are receiving the COMPLETE ledger: all 3 round-1 independent theses AND all 3 round-2 adversarial challenges, auto-injected below via multi-parent dependency.

**This uses the SAME portfolio-approval design as the equity pipeline** (see fleet_pilot_20260908_synthesis_r3_portfolio_v3 for the pattern this is modeled on): independently approve or reject EACH of the 3 candidates on its own merits, not a forced single winner. Entries must be actionable TODAY at current price (no future-dated gates). Unlike equities, there is no 3-5 approval cap here -- with only 3 symbols total, evaluate each honestly and approve however many (0 to 3) genuinely clear the bar.

**Real, structural differences from the equity pipeline you must apply:**
1. **No fundamentals-equivalent evidence exists for crypto** -- no earnings, no valuation multiples, no analyst targets. Do NOT apply the equity evidence-quality bar as if crypto could clear it the same way. Evaluate each candidate against what crypto data can actually establish: price action, volatility regime, trend persistence, volume confirmation (where available), drawdown-to-gain ratio. The maximum achievable confidence tier is lower than equities' ceiling BY DESIGN, not as a penalty -- do not manufacture certainty the thin evidence base cannot support.
2. **Reject or downgrade any candidate whose case leans on an INTERPRETATION-tagged narrative claim as if it were load-bearing evidence**, rather than clearly-flagged color. All 3 round-1/round-2 pairs correctly avoided inventing fundamentals and mostly kept narrative claims labeled -- round 2 caught XRP round-1's one narrative-labeling drift (an unlabeled reference to "XRP's known history of narrative-driven moves") and a real invalidation-ordering error (round 1 had the 50-day/200-day moving average relationship backwards for XRP -- the 200-day average is actually ABOVE the 50-day average, so correct any invalidation-level ordering that assumed otherwise). Round 2 on ETH also found ~95.8% of ETH's entire 30-day dollar gain occurred in the single Aug 18-21 correlated surge, with the remaining 26 days netting close to zero -- weigh this properly rather than treating the headline 30-day return as evenly-earned. Round 2 on BTC found its nearest bearish invalidation trigger sits inside a single average day's volatility (a very thin buffer) and that a couple of its FACT bullets blend in unlabeled evaluative language.
3. **BTC/ETH/XRP are confirmed live as spot, cash-settled, long-only on this Alpaca account (shortable:false)** -- if you approve a candidate, `conditionalSetup.direction` MUST be "long". Never propose "short" for any of these three; a bear case means reject/stay-out, not short.
4. **Entries must trade TODAY at or near current price** -- use the live quote prices in the injected data snapshot (BTC ~$78,863.69, ETH ~$2,498.92, XRP ~$1.4224) as the reference, not a future condition.
5. **Time-based exit must be phrased in HOURS, not trading sessions** -- crypto trades 24/7, "trading session" doesn't apply. Use phrasing like "...or exit after 48 hours if not triggered" (pick a real number based on your own judgment of the position's intended holding period, not necessarily 48 -- state your reasoning).
6. **`conditionalSetup.symbol` MUST be the Alpaca order-format symbol with a slash** (`BTC/USD`, `ETH/USD`, `XRP/USD`), never the no-slash FMP research format (`BTCUSD`) -- this is what gets executed directly.
7. **Output MUST include a single fenced ```json code block containing the full structured result** (not prose-only) -- the execution script parses this format directly, unlike the equity pipeline's dashboard, which has a prose fallback that this pipeline does not yet have.

## Deterministic decision rule, in order
1. For EACH of BTC/ETH/XRP independently: REJECT if round 2 found unresolved substantive issues round 1 didn't overcome (a real arithmetic/logic error, an unlabeled narrative claim, or a data-gap material enough that the conclusion can't be trusted).
2. Among survivors, assess genuine conviction under the recalibrated crypto evidence bar (point 1 above) -- surviving round 2's challenge is not the same as having a real edge.
3. Approve however many (0-3) genuinely clear the bar. Do not force a pick, and do not reject everything reflexively either -- if the price/volatility evidence genuinely supports a specific, falsifiable long thesis for a coin, approve it.
4. For each approved candidate, produce a conditionalSetup per points 3-6 above.
5. Preserve material dissent per-coin, including the specific round-2 findings named in point 2 above.

## Required output schema (as the single JSON block, see point 7)
```json
{
  "runTimestamp": "...", "frozenDataTimestamp": "...",
  "approvedCandidates": [
    { "symbol": "BTC", "stance": "bull|neutral-insufficient-edge",
      "conditionalSetup": { "symbol": "BTC/USD", "direction": "long", "entryCondition": "...", "invalidationCondition": "price stop AND '...or exit after N hours if not triggered'", "timeHorizon": "N hours" },
      "bullCase": "...", "bearCase": "...", "oneLineRationale": "..." }
  ],
  "rejectedCandidates": [ { "symbol": "...", "reason": "..." } ],
  "materialDissent": { "BTC": "...", "ETH": "...", "XRP": "..." },
  "evidenceLedgerSummary": { "...": { "facts": "...", "interpretation": "...", "confidence": "..." } },
  "riskWarnings": ["..."],
  "keyLearnings": ["..."],
  "comparisonToPriorRuns": "This is the crypto pipeline's first run -- no prior version to compare against. Note whatever is genuinely comparable/different versus the equity pipeline's approach.",
  "disclaimer": "Research decision-support only. A human must independently decide whether to act; this system cannot execute trades."
}
```

## Hard boundaries
- This is round 3 of 3 for the crypto pilot's first run.
- Never propose direction:"short" for BTC/ETH/XRP -- no short side exists on this account.
- Do not propose position sizing, dollar amounts, or quantity -- crypto positions size by dollar notional, decided separately by the human operator via execute-portfolio-setup.js's --notionalPerLeg argument, outside this pipeline.
- No autonomous execution exists in this pipeline; this task's output is research/decision-support input a human will review before any real order is placed.
- If you find yourself inventing certainty the thin crypto evidence base doesn't support, reject that candidate rather than force an approval.
timestamp: 2026-09-08T22:05:00Z
dependsOnTaskIds: crypto_pilot_20260908_thesis_r1_btc, crypto_pilot_20260908_thesis_r1_eth, crypto_pilot_20260908_thesis_r1_xrp, crypto_pilot_20260908_challenge_r2_btc, crypto_pilot_20260908_challenge_r2_eth, crypto_pilot_20260908_challenge_r2_xrp

## Result (auto)
resolved_at: 2026-09-09T01:21:14.576Z
output:
````
SOURCE: supplied by orchestrator from a prior verified step  
As of: 2026-09-08; 30-day close window 2026-08-10 to 2026-09-08.

```json
{
  "runTimestamp": "2026-09-08",
  "frozenDataTimestamp": "2026-09-08; 30-day close window 2026-08-10 to 2026-09-08",
  "approvedCandidates": [],
  "rejectedCandidates": [
    {
      "symbol": "BTC",
      "reason": "Reject/stay out. BTC remains above its 50-day ($69,694.32) and 200-day ($69,814.41) averages after a +23.29% 30-day gain, with a relatively shallow -3.70% maximum drawdown. But nearly all gain came in the Aug. 18-21 +21.1% surge, while Aug. 21 to Sep. 8 was only about +0.6%. The nearest surge-zone failure level, $78,325, is only about 0.6% below the $78,863.69 live quote—inside one 2.53% average daily move. No volume, derivatives-positioning, or catalyst data establishes a continuation edge."
    },
    {
      "symbol": "ETH",
      "reason": "Reject/stay out. ETH has the batch's best drawdown-to-gain ratio (14.9%) and highest up-day ratio (18/29, 62.1%), while remaining above its 50-day ($2,115.43) and 200-day ($2,041.59) averages. However, about 95.8% of its 30-day dollar gain occurred during the Aug. 18-21 correlated surge; the other 26 days netted roughly $26.34. At $2,498.92, the evidence does not establish that current-price entry has a durable continuation edge, particularly with no volume or market-positioning confirmation."
    },
    {
      "symbol": "XRP",
      "reason": "Reject/stay out. XRP delivered the largest 30-day return (+40.49%) and remains above both moving averages, but it also had the highest stated daily volatility (4.83%) and deepest maximum drawdown (-11.17%). Round 2 identified a material moving-average invalidation-ordering error: the 200-day average ($1.274) is above the 50-day average ($1.191), so the original hierarchy was backwards. The dataset also cannot establish that the move was merely shared-market beta or that it reflected XRP-specific demand; no volume, correlation, liquidity, event, or positioning evidence resolves that uncertainty."
    }
  ],
  "materialDissent": {
    "BTC": "The omitted +7.28% maximum up day and price above both moving averages support a possible bullish continuation reading. But the original thesis blended some evaluative language into FACT bullets, partly double-counted surge concentration and shallow drawdown, and understated how easily normal daily volatility could break the $78,325 surge-zone reference.",
    "ETH": "ETH's best-in-batch drawdown-to-gain ratio and 62.1% up-day ratio are genuine favorable evidence. They do not overcome the stronger concentration concern: approximately 95.8% of its 30-day dollar gain occurred in the three-day Aug. 18-21 move, with no volume or catalyst evidence to establish persistence.",
    "XRP": "A bullish continuation remains possible: XRP was the strongest 30-day performer, trades above both averages, and is near its $1.4541 local high. But the original technical invalidation ordering was wrong, and neither a shared-beta explanation nor an XRP-specific-demand explanation is testable from this thin snapshot. The prior unlabeled reference to XRP's narrative-driven history is excluded from this decision."
  },
  "evidenceLedgerSummary": {
    "BTC": {
      "facts": "+23.29% over the window ($63,911.88 to $78,799.99); live quote $78,863.69; 50-day $69,694.32; 200-day $69,814.41; -3.70% maximum drawdown; 2.53% daily-return standard deviation; +7.28% maximum up day; -3.03% maximum down day; Aug. 18-21 gain +21.1%.",
      "interpretation": "The technical backdrop is positive, but the post-surge evidence is too fragile at current price to establish a long-only continuation edge.",
      "confidence": "low"
    },
    "ETH": {
      "facts": "+33.42% over the window ($1,871.44 to $2,496.86); live quote $2,498.92; 50-day $2,115.43; 200-day $2,041.59; -4.97% maximum drawdown; 3.93% daily volatility; 18 up and 11 down days; approximately 95.8% of 30-day dollar gain occurred Aug. 18-21; drawdown-to-gain ratio 14.9%.",
      "interpretation": "ETH has relatively favorable downside containment within this three-coin batch, but the gain concentration and absent confirmation leave no actionable current-price edge.",
      "confidence": "low"
    },
    "XRP": {
      "facts": "+40.49% over the window ($1.0114 to $1.4209); live quote $1.4224; 50-day $1.191; 200-day $1.274; -11.17% maximum drawdown; 4.83% daily volatility; +14.70% maximum up day; -4.78% maximum down day; Aug. 18-21 gain +45.2%.",
      "interpretation": "The trend continuation case is possible but unverified. High realized volatility and drawdown, combined with unresolved data gaps and the corrected moving-average ordering, do not support a current-price long.",
      "confidence": "low"
    }
  },
  "riskWarnings": [
    "All three returns are substantially shaped by the same Aug. 18-21 surge; parallel moves alone do not prove correlation, causation, or coin-specific demand.",
    "No volume, liquidity-depth, derivatives funding/open-interest, on-chain, sentiment, or event dataset is available to validate continuation or distinguish broad-market flow from asset-specific demand.",
    "Crypto spot positions are long-only on this account; bearish evidence supports staying out, not shorting.",
    "The stated data supports only low-confidence technical inference; no traditional fundamentals-equivalent evidence is available."
  ],
  "keyLearnings": [
    "For crypto, a high headline 30-day return should be decomposed by time concentration before being treated as trend persistence.",
    "Drawdown-to-gain ratio and up-day frequency add useful context, but neither substitutes for volume or positioning confirmation.",
    "Technical invalidation levels must be ordered by their actual price values; XRP's 200-day average ($1.274) is above its 50-day average ($1.191).",
    "Narrative explanations must remain clearly labeled interpretation when the snapshot lacks causal evidence."
  ],
  "comparisonToPriorRuns": "This is the crypto pipeline's first run -- no prior version to compare against. Unlike the equity pipeline, this review does not require earnings, valuation, or analyst evidence; it uses price action, volatility, trend persistence, and drawdown-to-gain characteristics. The lower confidence ceiling is structural, and no candidate currently clears the actionable long-only bar.",
  "disclaimer": "Research decision-support only. A human must independently decide whether to act; this system cannot execute trades."
}
```
````
