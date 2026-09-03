## market_20260903_batch_review
from: claude
to: claude-agent
type: request
status: done
payload: You are the quality-review gate for a batch of four research packets (AAPL, MSFT, NVDA, JPM) injected below, before they get published as new notes in this vault. Review all four together and report:

1. For EACH ticker: does every row in its Evidence ledger table trace to a real FMP figure or a real cited web source (not an invented number, not a merged/upgraded trust tier)? Flag any row that looks off.
2. Does any packet contain a trade recommendation, price target, or buy/sell/hold opinion of any kind? This is strictly forbidden -- flag it explicitly if present, quote the offending text.
3. Do all four packets follow the same structure/schema (Overview, Evidence ledger, Excluded/unconfirmed claims, Open verification items)? Flag any structural inconsistency.
4. Cross-ticker check: do any of the four packets contradict each other on a shared fact (e.g. sector classification conventions, date formats)? Note anything worth reconciling before publication.
5. Final verdict per ticker: APPROVED (ready to publish as-is), APPROVED WITH NOTES (publishable, minor issues noted), or NEEDS REVISION (a real problem found in step 1-4 above) -- be specific about which ticker(s), if any, need revision and exactly why.

Be a real reviewer, not a rubber stamp -- if all four are genuinely clean, say so plainly, but actually check each one.
timestamp: 2026-09-03T20:30:00Z
dependsOnTaskIds: market_20260903_AAPL_research_packet, market_20260903_MSFT_research_packet, market_20260903_NVDA_research_packet, market_20260903_JPM_research_packet

## Result (auto)
resolved_at: 2026-09-03T21:41:12.108Z
output:
```
SOURCE: supplied by orchestrator from a prior verified step
As-of: FMP retrievals dated 2026-09-03 for all four tickers; web research conducted 2026-09-03 (AAPL/MSFT news through ~Aug 2026, NVDA through Sept 2, JPM through Sept 2).

Note on process: this is a pure content/format review of data already supplied in full above — no code exploration or file edits were needed, so I'm answering directly rather than routing this through an implementation-planning workflow.

## 1. Evidence ledger traceability, per ticker

**AAPL** — Clean. FMP-001–010 are all tagged FMP-verified with plausible internal math (net income $112.01B ÷ EPS $7.46 ≈ 15.0B diluted shares; gross margin ~46.9% — consistent with Apple's profile). WEB-001–003 all cite direct Apple Newsroom URLs and are correctly tiered "Live web, not independently verified" — none upgraded to FMP-verified. FMP-001 (CEO: John Ternus) is also internally consistent with WEB-003 (succession effective Sept 1, 2026) rather than contradicting it. No row looks invented or mistiered.

**MSFT** — Clean. FMP-001–011 check out (net income $133.749B ÷ EPS $17.95 ≈ 7.45B diluted shares — matches MSFT's real share count order of magnitude; gross margin ~67.9%, operating margin ~46.8% — both plausible for MSFT's mix). WEB-001–003 cite Microsoft's own newsroom and are correctly kept at "Live web, not independently verified." No mistiering.

**NVDA** — Numbers that are present check out (net income $120.067B ÷ EPS $4.90 ≈ 24.5B diluted shares vs. market cap $5.544T ÷ price $228.90 ≈ 24.2B shares — consistent), and WEB-001–003 cite multiple named, credible outlets (NVIDIA Blog, Bloomberg, SEC EDGAR 8-K, CNBC), correctly tiered. **But: the evidence ledger is missing CEO, Sector/Industry, and full-time-employee rows entirely.** AAPL, MSFT, and JPM all lead their ledgers with FMP-verified CEO/Sector/Employees claims; NVDA jumps straight to price/financials. The "semiconductor sector" / product description for NVDA appears only in the untagged intro paragraph, explicitly marked as drawing on general knowledge — not FMP-verified, unlike the equivalent claim in the other three packets. This is a real gap, not an invented number, but it's a genuine inconsistency worth flagging.

**JPM** — FMP-001–013 check out (net income attributable $55.681B ÷ EPS $20.05 ≈ 2.78B shares — right order of magnitude for JPM). One thing worth a second look: FMP-010 "operating income" and FMP-011 "net income" plus a separate FMP-012 "net income attributable / bottom line" is a three-tier income breakdown not used in any other packet. It isn't wrong (banks commonly report net income vs. net income applicable to common after preferred dividends/minority interest), but "gross profit" ($167.607B) is a non-standard concept for a diversified bank — that's almost certainly just FMP's standardized income-statement template rather than an error, but a human should confirm what that field actually represents before publishing it as a headline figure. WEB-001–003 cite multiple named outlets, correctly tiered.

## 2. Trade recommendations / price targets / buy-sell-hold opinions

None found in any of the four packets. All four packets confine themselves to sourced facts, quotes, and "Open Verification Items" — no price target, no directional call, no buy/sell/hold language anywhere. This gate passes cleanly across the board.

## 3. Structural/schema consistency

Not consistent. Two different sub-formats are in use:
- **AAPL** and **MSFT** both have: a title heading, "1. Overview," "2. Evidence Ledger/ledger," "3. Excluded/unconfirmed claims," "4. Open verification items" — numbered sections throughout. (Minor nit: AAPL uses `##` for the title and `###` for sections; MSFT uses `#` for the title and `##` for sections — different heading levels, cosmetic only.)
- **NVDA** and **JPM** both **omit the title heading entirely**, drop straight into an unlabeled overview paragraph (no "Overview" heading, no "1."), and their subsequent sections ("Evidence ledger," "Excluded / unconfirmed claims," "Open verification items") are unnumbered, unlike AAPL/MSFT's "2./3./4."

This is a real, fixable formatting inconsistency across the batch — worth normalizing before publishing so all four notes read as one coherent series.

## 4. Cross-ticker contradictions

- No factual contradictions between packets on shared conventions. Date formatting (ISO `YYYY-MM-DD` for data fields, prose dates for narrative items) is consistent across all four.
- AAPL's as-of line notes that Microsoft-related findings surfaced during AAPL's own web research were deliberately excluded from the AAPL packet — this is good practice (avoiding cross-contamination), not a contradiction, and it's consistent with MSFT having its own independently sourced WEB items.
- The one real cross-ticker inconsistency is the one flagged in #1/#3: NVDA lacks the FMP-verified CEO/Sector/Employees rows that AAPL, MSFT, and JPM all include, and NVDA/JPM share the missing-header/missing-numbering structural gap that AAPL/MSFT don't have.

## 5. Final verdicts

- **AAPL — APPROVED.** Ledger is fully sourced and internally consistent, correct trust tiers, no forbidden content, matches its own stated schema.
- **MSFT — APPROVED.** Same as AAPL; only a cosmetic heading-level difference (`#` vs `##`) that doesn't rise to a real issue.
- **NVDA — APPROVED WITH NOTES.** Content is accurate and appropriately tiered, but (a) missing FMP-verified CEO/Sector/Employees rows that its sibling packets include, and (b) missing title heading + section numbering. Fix before or shortly after publication; not a factual defect.
- **JPM — APPROVED WITH NOTES.** Same structural gap as NVDA (no title heading, no section numbering). Additionally, flag the "gross profit" line for a bank as a definition worth double-checking against the underlying FMP field mapping before treating it as a headline metric.

None of the four require a hold for factual/sourcing problems — the only "NEEDS REVISION"-caliber issue would be if NVDA's missing identity fields were being passed off as sourced when they aren't, but since the intro paragraph is honestly labeled "general knowledge," that's a completeness/formatting gap rather than a misrepresentation. Recommend normalizing all four to the AAPL/MSFT header structure and backfilling NVDA's CEO/Sector/Employees rows from the same FMP profile-symbol endpoint before publishing the batch.
```
