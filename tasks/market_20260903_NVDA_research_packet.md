## market_20260903_NVDA_research_packet
from: claude
to: codex
type: request
status: done
payload: You are producing a publication-ready research packet for NVIDIA Corporation (NVDA) for a new vault category, combining two inputs injected below: (1) verified financial data from FMP, and (2) live web research covering BOTH NVIDIA and JPMorgan Chase -- use ONLY the NVIDIA/NVDA section of that web research, ignore the JPMorgan section entirely.

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
dependsOnTaskIds: market_20260903_NVDA_fmp, market_20260903_web_nvda_jpm

## Result (auto)
resolved_at: 2026-09-03T21:38:17.320Z
output:
```
SOURCE: supplied by orchestrator from a prior verified step  
As of: FMP data retrieved 2026-09-03; supplied live-web research conducted 2026-09-03 (Aug–Sep 2026 results).

NVIDIA Corporation (NVDA) is a technology company in the semiconductor sector. It designs accelerated-computing hardware and related software used for AI, data centers, graphics, gaming, professional visualization, and automotive applications. This plain-language description draws on general knowledge.

## Evidence ledger

| Claim ID | Claim | Trust tier | Source / retrieval |
|---|---|---|---|
| FMP-001 | Price at retrieval: $228.90; day change: +$4.49 (+2.00%). | FMP-verified | Supplied by orchestrator from prior verified FMP profile-symbol retrieval, 2026-09-03. |
| FMP-002 | Reported range: $164.07–$236.54. | FMP-verified | Supplied by orchestrator from prior verified FMP profile-symbol retrieval, 2026-09-03. |
| FMP-003 | Market capitalization: $5,544,186,900,000. | FMP-verified | Supplied by orchestrator from prior verified FMP profile-symbol retrieval, 2026-09-03. |
| FMP-004 | Fiscal-year revenue was $215,938,000,000 for the year ended 2026-01-25. | FMP-verified | Supplied by orchestrator from prior verified FMP income-statement retrieval; filing dated 2026-02-25. |
| FMP-005 | Fiscal-year gross profit was $153,463,000,000 for the year ended 2026-01-25. | FMP-verified | Supplied by orchestrator from prior verified FMP income-statement retrieval; filing dated 2026-02-25. |
| FMP-006 | Fiscal-year operating income was $130,387,000,000 for the year ended 2026-01-25. | FMP-verified | Supplied by orchestrator from prior verified FMP income-statement retrieval; filing dated 2026-02-25. |
| FMP-007 | Fiscal-year net income was $120,067,000,000 for the year ended 2026-01-25. | FMP-verified | Supplied by orchestrator from prior verified FMP income-statement retrieval; filing dated 2026-02-25. |
| FMP-008 | Diluted EPS was $4.90 for the year ended 2026-01-25. | FMP-verified | Supplied by orchestrator from prior verified FMP income-statement retrieval; filing dated 2026-02-25. |
| WEB-001 | NVIDIA reportedly entered a definitive agreement on 2026-09-02 to acquire Hugging Face for approximately $12.9–13 billion, subject to regulatory approval and expected to close in H1 2027. | Live web, not independently verified | Supplied research cites [NVIDIA Blog](https://blogs.nvidia.com/blog/nvidia-to-acquire-hugging-face/), [Bloomberg](https://www.bloomberg.com/news/articles/2026-09-03/nvidia-agrees-to-13-billion-deal-for-ai-platform-hugging-face), [SEC EDGAR Form 8-K](https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000078/nvda-20260902.htm), and [CNBC](https://www.cnbc.com/2026/09/03/nvidia-agrees-to-buy-hugging-face-for-almost-13-billion-ai-expansion.html). |
| WEB-002 | NVIDIA reported fiscal Q2 FY2027 results on 2026-08-26; supplied research states Data Center revenue was up 117% year over year and that following-quarter guidance was approximately $108 billion ±2%. | Live web, not independently verified | Supplied research cites [NVIDIA Newsroom](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027), [SEC EDGAR Form 8-K](https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000073/q2fy27pr.htm), and [CNBC](https://www.cnbc.com/2026/08/26/nvidia-nvda-earnings-report-q2-2027-live-updates.html). |
| WEB-003 | Supplied research characterized China export controls as an ongoing uncertainty: GB300-class chips reportedly remained under a presumption-of-denial posture as of August 2026, alongside discussion of access through Southeast Asian data centers and proposed U.S. legislation. | Live web, not independently verified | Supplied research cites [CNBC](https://www.cnbc.com/2026/08/19/china-ai-nvidia-chips-us-export-controls.html). |

## Excluded / unconfirmed claims

- A purported $20 billion NVIDIA acquisition of Groq assets was excluded because the supplied research found no independent corroboration and characterized it as likely aggregator/AI-summarizer filler.
- Commentary from top1markets.com, Motley Fool “prediction” pieces, and calendarial.com was excluded because it was identified as speculative secondary material rather than confirmed reporting.

## Open verification items

- Confirm the Hugging Face transaction terms, closing conditions, and timing directly against the cited NVIDIA and SEC materials.
- Recheck the Q2 FY2027 Data Center growth and next-quarter guidance against the cited earnings release and filing.
- Verify the precise scope and current status of China export-control restrictions and any proposed remote-access legislation.
- Confirm whether the reported price/range labels and market capitalization remain appropriate for the intended publication date; they are point-in-time FMP figures from 2026-09-03.
```
