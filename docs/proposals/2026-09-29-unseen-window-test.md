# Proposal: one-shot out-of-sample check of the cap-$30 finding on the unseen 2016-2021 window

Status: DRAFT for independent review. Nothing runs until reviewed; then the rules below are frozen as
`bus/fleet/data/lev-backtest-prereg.v3.json` (+ `.sha256`) and run exactly once.

## Why
Cycle 3 (2026-09-29) found that at C1's real $20 per-entry cap the canonical trend rules lose to buy-and-hold QQQ,
but at a **$30 cap** both beat QQQ at roughly matched drawdown on 2021-08-06..2026-09-25 (S1 17.8% CAGR / 34.8% max DD,
S2 19.6% / 29.9%, vs QQQ 15.5% / 35.0%). That window has now been looked at many times, so it cannot confirm anything.
Cycle 4 unlocked Alpaca SIP history from 2016-01-04. The canonical rules have **never been evaluated on 2016-2021**, which
includes the Feb-2018 volatility spike, the Q4-2018 drawdown and the 2020 crash. Testing the cycle-3 hypothesis there,
unchanged, is the only honest corroboration available without new data.

## Frozen rules (v3)
- **Data:** `bus/fleet/data/lev-bars-sip/` (Alpaca SIP, adjustment=all), all bars from 2016-01-04. Same 6 pairs as v2,
  cash leg BIL, alignment by date intersection (SIP has 0 missing days).
- **Evaluation window ("unseen"):** first fill after the common 250-bar warm-up (about 2017-01) through **2021-08-05**,
  the last day before the v2 evaluation span began. Nothing after 2021-08-05 is evaluated. Also reported separately:
  calendar 2018, and 2020-02-19..2020-12-31 (crash and recovery).
- **Configs (unchanged, fixed before any look):** S1 `{n:200, bandPct:2}`, S2 `{slow:200, trailingDDPct:10}`,
  S3 `{targetVolPct:20}` (secondary). No grid search, no tuning.
- **Caps:** $20 (C1's real rule) and $30 (the hypothesis). No other caps.
- **Costs:** 5 bps/side base, 15 bps/side stress; no added expense ratio (adjusted prices). Benchmarks uncapped.
- **Primary hypothesis H (predeclared):** on QQQ->TQQQ at cap $30 and 5 bps, for BOTH S1 and S2:
  after-cost CAGR > buy-and-hold QQQ CAGR **AND** max drawdown <= buy-and-hold QQQ max drawdown + 2 percentage points.
  - **H HOLDS** if both S1 and S2 meet both conditions at 5 bps **and** at 15 bps.
  - **H PARTLY HOLDS** if it holds at 5 bps only, or for only one of S1/S2.
  - **H DOES NOT HOLD** otherwise.
- **Reported, not gating:** cap $20 results, other pairs, S3, round trips, trades/yr, worst month, ulcer index,
  deflated Sharpe (N = 2 caps x 3 configs x 6 pairs = 36), decomposition vs TQQQ buy-and-hold.
- **Verdict vocabulary:** never "PASS". Even "H HOLDS" means only "consistent with the cycle-3 finding on one more
  ~4.6-year window"; it is not evidence of a durable edge and does not by itself justify raising C1's cap.
- **One shot:** the run happens once. A rerun is allowed only to fix a code bug, with a regression test shown to fail on
  the pre-fix code, and both reports kept.

## Disclosures (verbatim into the report)
- The rules and the $30 cap were chosen before this window was examined; the cap came from a different window.
- The window has no 2008-style bear market; drawdowns are not worst-case for 3x ETFs.
- Round-trip counts are small (S1 ~1-2 trades/yr); confidence intervals would be meaningless and are not computed.
- Raising C1's cap changes `bus/city/survive-budget-envelope.js` (protected): the owner's decision, not this test's.

## Implementation (after review; test-first)
In `bus/fleet/backtest-lev-trend.js`, a `--holdout` mode that requires `prereg.mode === "holdout"` and a matching hash;
loads bars via `lev-bars-cache.loadBars(sym, {feed:'sip'})`; evaluates the fixed configs at both caps on the declared
window and sub-spans; a `judgeHoldout()` that can only return HOLDS / PARTLY HOLDS / DOES NOT HOLD; writes
`bus/fleet/data/lev-backtest-holdout-results.md`. Selftests (written first, shown to fail first): refuses any other
prereg mode; never evaluates a bar after 2021-08-05 (mutating later bars changes nothing); the judge's truth table; the
report contains every disclosure and never the word PASS.

## Review outcome (2026-09-29, antigravity answer + claude-agent verification) -- binding for v3
Verdict: approve with changes. Accepted, and part of the frozen rules:
1. **Starting equity fixed at $50** (C1's lifetime allocation); the $30 cap is meaningless without it.
2. **`warmupBars: 250`** written into the prereg (hash-locked).
3. **BIL SIP depth:** confirmed 2016-01-04..2026-09-28, 2699 bars, 0 missing days (cycle-4 fetch); stated in the prereg.
4. **Window cut before simulation:** bars after 2021-08-05 are removed BEFORE signals are computed, so no post-window
   state can leak (selftest: mutating post-window bars changes nothing). **No return is attributed before warm-up ends**
   (selftest).
5. **Run lock:** `--holdout` refuses if `bus/fleet/data/lev-backtest-holdout-results.md` already exists; the prereg v3 +
   `.sha256` are committed (and pushed to the PR branch) before the run, and the report prints that commit's SHA.
6. **Added disclosures:** (a) 2020-07-27..2021-08-05 prices (IEX) were used as indicator warm-up by the v2 runs and in
   the cycle-4 SIP-vs-IEX price comparison -- used, never scored; (b) the cycle-4 SIP fetch was a raw price pull with a
   gap/sanity check only, no signal/return/equity computed on 2016-2021; (c) hindsight: everyone involved knows how 2018
   and 2020 played out, and 200-day trend rules are known to have sidestepped parts of both; the configs are canonical,
   which limits but does not remove this bias.
Rejected with evidence: none of the reviewer's Draft-A points were rejected; its QQQ 2020 drawdown figure is irrelevant
to the design (the tolerance is relative to whatever QQQ's measured drawdown is).
