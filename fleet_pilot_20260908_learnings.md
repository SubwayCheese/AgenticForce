## fleet_pilot_20260908_learnings

Durable findings from the 2026-09-08 trading-fleet pilot: 50-stock scan -> top-15
shortlist -> round-1 (thesis) / round-2 (challenge) / round-3 (portfolio
approval), run three times over the same 15-symbol ledger the same day
(original future-gated version, v2 corrected-for-today-execution, v3 with the
same-day/multi-day mix). This file exists so what the agents actually found
and learned survives past the individual task files -- see
`fleet_pilot_20260908_synthesis_r3_portfolio_v3.md` for the full run this was
extracted from, and `ARCHITECTURE.md` section 3p for the pipeline/infra design.

### What round 2 consistently caught round 1 overstating

Round 2 repeatedly caught round 1 treating a short 20-day price trend as if it
were an earnings reaction, even when the price window began weeks after the
actual report (INTC's trend starting 2.5 weeks after its July beat is the
clearest case). **Lesson for future round-1 theses**: explicitly separate
"post-report drift over an arbitrary trailing window" from "the actual
earnings-day reaction" -- do not infer causality between an earnings result
and a price move without the return path connecting the two.

### Analyst price targets were less useful than they first looked

Target gaps (e.g. "consensus implies +26% upside") were consistently less
decision-useful than they appeared on first read, because target publication
dates, revision history, analyst counts, and dispersion shape were almost
never available in the injected data. **Lesson**: treat analyst targets as
secondary context, never as primary evidence of mispricing, unless target
recency is independently confirmed.

### What data actually carried the decisions

The most load-bearing evidence across all three passes was a CONCRETE
valuation/profitability contradiction paired with observable price risk --
not momentum, not analyst targets, not screenScore rank. The three approved
candidates each fit this pattern:
- **TSLA**: 122.60x EV/EBITDA against a 0.26% earnings yield and a real 34%
  EPS miss -- an extreme, quantifiable mismatch.
- **GOOGL**: a $9.11 actual EPS versus $2.87 estimated, immediately followed
  by a next-quarter estimate reset back down to $3.02 -- a concrete
  earnings-quality red flag, not just a qualitative worry.
- **CSCO**: a real earnings beat contradicted by an -11.03% trend, -12.33%
  drawdown, and an -8.40% single-day move -- a genuine, large price/valuation
  divergence.
**Lesson**: prioritize sourcing data that can produce this shape of evidence
(valuation-vs-profitability, or earnings-result-vs-price-reaction
contradictions) over broader but softer signals like screenScore rank or
target-price gaps.

### Short-window statistics were useful as risk descriptors, not conclusions

Volatility, up/down day counts, and max drawdown were genuinely useful for
sizing risk, but were repeatedly over-interpreted as durable behavioral or
fundamental conclusions when asserted without decomposition (e.g. calling a
move "broad-based" off an 11/9 day split, or "not one-day-dependent" without
checking what share of the total move came from the single largest day).
**Lesson**: future round-1 work should label these as window-specific
descriptors and supply the actual daily contribution/sequence data before
characterizing a move's breadth or durability.

### Specific metrics that were misused or under-contextualized

FCF yield was the single most consequential offender -- materially
uninterpretable without capital-structure and definitional context, and this
mattered most for JPM, BAC, AMZN, KO, and VZ (JPM's -16.45% FCF yield in
particular could not be distinguished from a normal bank balance-sheet
artifact vs. a real capital-generation problem). Bank-specific work
additionally needs P/TBV, credit/provisioning, capital ratios, and
capital-return data that a generic equity screen doesn't supply.

### A recurring integrity finding, not just a data gap

Multiple comparative/superlative claims ("cheapest in the batch," "highest
ROE," AAPL's trend-ranking arithmetic error) were asserted narratively rather
than checked against a shared table, and round 2 -- structurally unable to
see the other 14 symbols from inside a single-symbol dependency injection --
could not always catch these itself. Only round 3 (which sees the full
ledger) could verify or correct them. **Lesson, already partially acted on**:
round 3 must independently verify any batch-wide comparative claim rather
than trusting round 1/round 2's framing, since round 2 structurally cannot.

### Highest-value next process improvement

The single most decision-relevant addition would be a standardized evidence
packet per symbol containing: the event-day and daily return sequence (not
just window endpoints), sector/index-relative return (to separate
company-specific from market-wide moves), target and estimate revision dates,
forward (not just trailing) valuation, earnings composition/guidance detail,
and sector-appropriate financial metrics (e.g. P/TBV for banks). Several
otherwise-plausible names (NVDA, AMD, JPM, BAC) were rejected specifically
because this kind of data was missing, not because the underlying thesis was
wrong -- richer data, not more deliberation rounds, is the real lever for
surfacing more real candidates.

### Process/infra lessons from the same day, for completeness

- Placing entry and stop-loss orders as two separate, human-timed steps left
  a real ~90-minute unprotected window on the first live run -- fixed by
  `execute-portfolio-setup.js` placing both atomically in one script run.
  See ARCHITECTURE.md 3p.
- Round-3 task payloads must explicitly forbid future-dated/earnings-gated
  entry conditions -- the first portfolio-approval attempt produced
  setups that couldn't execute for 6-9 weeks, which is not what "trade
  today" means.
- Trading-session math (open/closed, next open/close) must be checked
  against Alpaca's own `/clock` endpoint before submitting orders, not
  assumed from wall-clock time alone -- this run's 3 approved setups were
  correctly held rather than submitted after the 2026-09-08 close was
  discovered.
