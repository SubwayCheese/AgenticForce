## market_20260903_AAPL_research_packet
from: claude
to: claude-agent
type: request
status: done
payload: You are producing a publication-ready research packet for Apple Inc (AAPL) for a new vault category, combining two inputs injected below: (1) verified financial data from FMP, and (2) live web research covering BOTH Apple and Microsoft -- use ONLY the Apple/AAPL section of that web research, ignore the Microsoft section entirely.

Produce the packet as this exact structure:

1. A one-paragraph plain-language overview (company, sector, what it does) -- may draw on general knowledge, tagged as such if so.
2. An "Evidence ledger" markdown table with columns: Claim ID | Claim | Trust tier | Source / retrieval. Populate it with:
   - One row per key financial figure from the FMP data (trust tier: "FMP-verified"), IDs like FMP-001, FMP-002.
   - One row per confirmed development/catalyst from the web research (trust tier: "Live web, not independently verified"), IDs like WEB-001, WEB-002, including the actual publisher name and URL from the injected research -- do not invent or clean up a citation that wasn't actually provided.
   - Do NOT include the "claims to treat cautiously" items from the web research as confirmed rows -- list them separately under a final "Excluded / unconfirmed claims" section instead, with a one-line reason each.
3. Do not merge, average, or upgrade the trust tier of any claim. Do not add a trade recommendation, price target, or buy/sell/hold opinion of any kind -- this is an observation-only research note.
4. End with an "Open verification items" section noting anything a human reviewer should double check.

This is read-only -- you are producing the packet content in your response, not writing any file.
timestamp: 2026-09-03T20:15:00Z
dependsOnTaskIds: market_20260903_AAPL_fmp, market_20260903_web_aapl_msft

## Result (auto)
resolved_at: 2026-09-03T21:38:25.706Z
output:
```
SOURCE: supplied by orchestrator from a prior verified step
As of: FMP data retrieved 2026-09-03 (profile-symbol / income-statement endpoints); web research as of September 3, 2026 (Apple Newsroom sources only — Microsoft-related findings from that same web research step are excluded per instructions).

---

## Apple Inc. (AAPL) — Research Packet

### 1. Overview

Apple Inc. is a U.S. technology company (NASDAQ: AAPL) in the consumer electronics sector, best known for the iPhone, Mac, iPad, and wearables hardware lines alongside a growing services business (App Store, iCloud, Apple Music, etc.). *(General knowledge, not independently verified in this packet.)*

### 2. Evidence Ledger

| Claim ID | Claim | Trust tier | Source / retrieval |
|---|---|---|---|
| FMP-001 | CEO is John Ternus | FMP-verified | FMP profile-symbol endpoint, retrieved 2026-09-03 |
| FMP-002 | Sector/Industry: Technology / Consumer Electronics | FMP-verified | FMP profile-symbol endpoint, retrieved 2026-09-03 |
| FMP-003 | Full-time employees: 166,000 | FMP-verified | FMP profile-symbol endpoint, retrieved 2026-09-03 |
| FMP-004 | Price at retrieval: $327.91, day change +2.95 (+0.91%); 52wk-ish range $225.95–$344.57 | FMP-verified | FMP profile-symbol endpoint, retrieved 2026-09-03 |
| FMP-005 | Market cap: $4,816,130,905,960 | FMP-verified | FMP profile-symbol endpoint, retrieved 2026-09-03 |
| FMP-006 | FY2025 (ended 2025-09-27, filed 2025-10-31) Revenue: $416,161,000,000 | FMP-verified | FMP income-statement endpoint, retrieved 2026-09-03 |
| FMP-007 | FY2025 Gross profit: $195,201,000,000 | FMP-verified | FMP income-statement endpoint, retrieved 2026-09-03 |
| FMP-008 | FY2025 Operating income: $133,050,000,000 | FMP-verified | FMP income-statement endpoint, retrieved 2026-09-03 |
| FMP-009 | FY2025 Net income: $112,010,000,000 | FMP-verified | FMP income-statement endpoint, retrieved 2026-09-03 |
| FMP-010 | FY2025 EPS (diluted): $7.46 | FMP-verified | FMP income-statement endpoint, retrieved 2026-09-03 |
| WEB-001 | July 8, 2026 — Apple announced a multiyear agreement with Broadcom covering custom silicon and wireless-connectivity technologies, including expansion of Broadcom's Fort Collins manufacturing facility | Live web, not independently verified | Apple Newsroom, https://www.apple.com/newsroom/2026/07/apple-to-increase-spend-with-broadcom-to-produce-billions-more-us-chips/ (published July 8, 2026) |
| WEB-002 | June 8, 2026 — At WWDC26, Apple previewed the next generation of Apple Intelligence and a new "Siri AI," plus forthcoming OS updates and parental-control features | Live web, not independently verified | Apple Newsroom, https://www.apple.com/newsroom/2026/06/apple-unveils-next-generation-of-apple-intelligence-siri-ai-and-more/ (published June 8, 2026) |
| WEB-003 | April 20, 2026 — Apple announced a CEO succession plan: Tim Cook to become executive chairman and John Ternus to become CEO, effective September 1, subject to Apple's stated forward-looking-statement risks | Live web, not independently verified | Apple Newsroom, https://www.apple.com/newsroom/2026/04/tim-cook-to-become-apple-executive-chairman-john-ternus-to-become-apple-ceo/ (published April 20, 2026) |

### 3. Excluded / Unconfirmed Claims

- **Reuters-via-Investing.com claim** that Apple raised device prices due to memory-chip costs and was in talks with Intel on U.S. chip manufacturing — excluded because it was not corroborated by any direct Apple Newsroom release reviewed in the underlying web research.
- **AI-generated-looking finance PDFs and Reddit reposts** surfaced in the same search results — excluded as unsuitable, unverifiable sources.

### 4. Open Verification Items

- Confirm Tim Cook's new title ("executive chairman") and the exact effective date of the CEO transition (WEB-003 says Sept 1, 2026) against a second primary source, since only Apple's own release was checked.
- The Broadcom agreement (WEB-001) description is qualitative only — no dollar figures were provided in the source material; verify financial terms before citing this as a quantified catalyst.
- Apple Intelligence / "Siri AI" (WEB-002) availability by geography/language and regulatory constraints were flagged as material but unresolved in the source research — verify rollout scope before treating as a near-term revenue driver.
- The FMP price/market-cap snapshot (FMP-004, FMP-005) is a point-in-time retrieval as of 2026-09-03 and will already be stale by the time this packet is read — confirm against a live quote if used for anything time-sensitive.
- The FMP source itself labels the 52-week range as "52wk-ish" — confirm the exact 52-week high/low from the underlying FMP data before publishing that figure precisely.
- The excluded Reuters/Investing.com claims (device price increases, Intel manufacturing talks) could be materially relevant if true — recommend an independent check against a primary Reuters or Apple source rather than treating them as ruled out.
```
