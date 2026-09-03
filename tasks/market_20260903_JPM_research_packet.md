## market_20260903_JPM_research_packet
from: claude
to: codex
type: request
status: done
payload: You are producing a publication-ready research packet for JPMorgan Chase & Co (JPM) for a new vault category, combining two inputs injected below: (1) verified financial data from FMP, and (2) live web research covering BOTH NVIDIA and JPMorgan Chase -- use ONLY the JPMorgan/JPM section of that web research, ignore the NVIDIA section entirely.

Produce the packet as this exact structure:

1. A one-paragraph plain-language overview (company, sector, what it does) -- may draw on general knowledge, tagged as such if so.
2. An "Evidence ledger" markdown table with columns: Claim ID | Claim | Trust tier | Source / retrieval. Populate it with:
   - One row per key financial figure from the FMP data (trust tier: "FMP-verified"), IDs like FMP-001, FMP-002.
   - One row per confirmed development/catalyst from the web research (trust tier: "Live web, not independently verified"), IDs like WEB-001, WEB-002, including the actual publisher name and URL from the injected research -- do not invent or clean up a citation that wasn't actually provided.
   - Do NOT include the "unconfirmed/suspicious claims" items from the web research as confirmed rows -- list them separately under a final "Excluded / unconfirmed claims" section instead, with a one-line reason each.
3. Do not merge, average, or upgrade the trust tier of any claim. Do not add a trade recommendation, price target, or buy/sell/hold opinion of any kind -- this is an observation-only research note.
4. End with an "Open verification items" section noting anything a human reviewer should double check.

This is read-only -- you are producing the packet content in your response, not writing any file.
timestamp: 2026-09-03T20:15:00Z
dependsOnTaskIds: market_20260903_JPM_fmp, market_20260903_web_nvda_jpm

## Result (auto)
resolved_at: 2026-09-03T21:38:25.287Z
output:
```
SOURCE: supplied by orchestrator from a prior verified step  
As of: FMP data retrieved 2026-09-03; latest annual results fiscal year ended 2025-12-31 (filed 2026-02-13); supplied web research conducted 2026-09-03.

JPMorgan Chase & Co. (NYSE: JPM) is a diversified U.S. financial-services company in the Financial Services / Banks—Diversified sector, led by CEO Jamie Dimon. In plain terms, it provides consumer and commercial banking, credit cards, lending, investment banking, asset and wealth management, payments, and markets services. This business description is general-knowledge context; the figures and developments below retain their supplied trust tiers.

## Evidence ledger

| Claim ID | Claim | Trust tier | Source / retrieval |
|---|---|---|---|
| FMP-001 | CEO: Jamie Dimon. | FMP-verified | Supplied by orchestrator from FMP profile-symbol endpoint; retrieved 2026-09-03. |
| FMP-002 | Sector / industry: Financial Services / Banks - Diversified. | FMP-verified | Supplied by orchestrator from FMP profile-symbol endpoint; retrieved 2026-09-03. |
| FMP-003 | Full-time employees: 320,560. | FMP-verified | Supplied by orchestrator from FMP profile-symbol endpoint; retrieved 2026-09-03. |
| FMP-004 | Price at retrieval: $362.18. | FMP-verified | Supplied by orchestrator from FMP profile-symbol endpoint; retrieved 2026-09-03. |
| FMP-005 | Day change at retrieval: +$5.96 (+1.67%). | FMP-verified | Supplied by orchestrator from FMP profile-symbol endpoint; retrieved 2026-09-03. |
| FMP-006 | 52-week-ish range at retrieval: $279.10–$366.50. | FMP-verified | Supplied by orchestrator from FMP profile-symbol endpoint; retrieved 2026-09-03. |
| FMP-007 | Market capitalization: $970,464,931,800. | FMP-verified | Supplied by orchestrator from FMP profile-symbol endpoint; retrieved 2026-09-03. |
| FMP-008 | Fiscal 2025 revenue: $279,745,000,000. | FMP-verified | Supplied by orchestrator from FMP income-statement endpoint; fiscal year ended 2025-12-31, filed 2026-02-13. |
| FMP-009 | Fiscal 2025 gross profit: $167,607,000,000. | FMP-verified | Supplied by orchestrator from FMP income-statement endpoint; fiscal year ended 2025-12-31, filed 2026-02-13. |
| FMP-010 | Fiscal 2025 operating income: $72,595,000,000. | FMP-verified | Supplied by orchestrator from FMP income-statement endpoint; fiscal year ended 2025-12-31, filed 2026-02-13. |
| FMP-011 | Fiscal 2025 net income: $57,048,000,000. | FMP-verified | Supplied by orchestrator from FMP income-statement endpoint; fiscal year ended 2025-12-31, filed 2026-02-13. |
| FMP-012 | Fiscal 2025 net income attributable / bottom line: $55,681,000,000. | FMP-verified | Supplied by orchestrator from FMP income-statement endpoint; fiscal year ended 2025-12-31, filed 2026-02-13. |
| FMP-013 | Fiscal 2025 diluted EPS: $20.05. | FMP-verified | Supplied by orchestrator from FMP income-statement endpoint; fiscal year ended 2025-12-31, filed 2026-02-13. |
| WEB-001 | Southwest Airlines announced a first-ever airport-lounge network, beginning in 2027, with JPMorgan Chase participation tied to a new Chase-issued co-branded premium Rapid Rewards card. The supplied research states initial locations are Austin, Baltimore/BWI, Nashville, and Honolulu, with seven or more additional lounges planned. | Live web, not independently verified | [Skift](https://skift.com/2026/09/02/southwest-to-launch-airport-lounges-in-2027/), 2026-09-02; [Fox Business](https://www.foxbusiness.com/lifestyle/southwest-open-first-ever-airport-lounges-premium-push). |
| WEB-002 | J.P. Morgan Payments reportedly had its “best quarter of all time” in Q2 2026, described as its sixth consecutive record quarter. The supplied research further reports that Kinexys had processed more than $4 trillion cumulatively, averaged about $7 billion daily, and expanded to eight supported currencies during 2026. | Live web, not independently verified | [J.P. Morgan Payments Q2 2026 Earnings Highlights](https://www.jpmorgan.com/payments/newsroom/payments-2026-q2-earnings); [Kinexys 2026 Milestones](https://www.jpmorgan.com/payments/newsroom/kinexys-milestones-2026); [CoinDesk](https://www.coindesk.com/business/2026/06/29/j-p-morgan-broadens-blockchain-settlement-network-as-banks-modernize-cross-border-payments), 2026-06-29. |
| WEB-003 | The supplied research reports CEO-succession developments as of June 2026: Marianne Lake announced retirement; Doug Petno and Troy Rohrbaugh were elevated to co-presidents; Jennifer Piepszak reportedly did not want the CEO role; and Dimon said his exit timetable was “not five years anymore.” | Live web, not independently verified | [Fortune](https://fortune.com/2026/06/30/jp-morgan-succession-ceo-factory-fortune-500-retention-bank/), 2026-06-30; [Yahoo Finance](https://finance.yahoo.com/markets/article/jpmorgan-loses-a-key-figure-in-the-race-to-succeed-ceo-jamie-dimon-123901072.html). |

## Excluded / unconfirmed claims

- JPMorgan being “the world’s largest bank by market capitalization as of 2026,” alongside claims about rising G-SIB buffers and buyback/dividend expansion: excluded because it came from a blended, non-dated aggregator summary rather than a traceable primary filing or named, bylined source.

## Open verification items

- Confirm the Southwest/JPMorgan card and lounge-partnership terms directly with JPMorgan Chase, Southwest, or regulatory/card-program disclosures.
- Validate the Q2 2026 Payments and Kinexys metrics against the linked J.P. Morgan primary pages and establish the precise reporting period and definitions.
- Verify personnel titles, Marianne Lake’s retirement timing, and all CEO-succession statements against JPMorgan filings or official announcements.
- Recheck market price, daily change, range, and market capitalization before publication, as they are retrieval-date-specific.
```
