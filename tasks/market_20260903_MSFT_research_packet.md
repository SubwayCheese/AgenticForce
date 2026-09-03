## market_20260903_MSFT_research_packet
from: claude
to: claude-agent
type: request
status: done
payload: You are producing a publication-ready research packet for Microsoft Corporation (MSFT) for a new vault category, combining two inputs injected below: (1) verified financial data from FMP, and (2) live web research covering BOTH Apple and Microsoft -- use ONLY the Microsoft/MSFT section of that web research, ignore the Apple section entirely.

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
dependsOnTaskIds: market_20260903_MSFT_fmp, market_20260903_web_aapl_msft

## Result (auto)
resolved_at: 2026-09-03T21:38:12.883Z
output:
```
SOURCE: supplied by orchestrator from a prior verified step
As-of: FMP data retrieved 2026-09-03 (FY2026 ended 2026-06-30, filed 2026-07-29); web research conducted as of September 3, 2026.

---

# Microsoft Corporation (MSFT) — Research Packet

## 1. Overview

Microsoft Corporation is a Redmond, Washington-based technology company and one of the largest software and cloud infrastructure providers in the world, trading on the NASDAQ Global Select Market under the ticker MSFT. Its core businesses span enterprise and consumer software (Windows, Office/Microsoft 365), cloud computing and infrastructure (Azure), professional and social networking (LinkedIn), gaming (Xbox), and, increasingly, artificial intelligence products and services built in part on its investment in and partnership with OpenAI. *(This paragraph draws on general/training knowledge, not the supplied FMP or web data, and is tagged as such.)*

## 2. Evidence ledger

| Claim ID | Claim | Trust tier | Source / retrieval |
|---|---|---|---|
| FMP-001 | CEO is Satya Nadella | FMP-verified | FMP profile endpoint, retrieved 2026-09-03 |
| FMP-002 | Sector/Industry: Technology / Software - Infrastructure | FMP-verified | FMP profile endpoint, retrieved 2026-09-03 |
| FMP-003 | Full-time employees: 223,000 | FMP-verified | FMP profile endpoint, retrieved 2026-09-03 |
| FMP-004 | Price at retrieval: $510.89, day change +14.07 (+2.83%) | FMP-verified | FMP profile endpoint, retrieved 2026-09-03 |
| FMP-005 | 52-week(-ish) range: $349.20–$553.72 | FMP-verified | FMP profile endpoint, retrieved 2026-09-03 |
| FMP-006 | Market cap: $3,793,639,239,500 | FMP-verified | FMP profile endpoint, retrieved 2026-09-03 |
| FMP-007 | Revenue (FY ended 2026-06-30): $331,839,000,000 | FMP-verified | FMP income-statement endpoint, filed 2026-07-29, retrieved 2026-09-03 |
| FMP-008 | Gross profit (FY ended 2026-06-30): $225,465,000,000 | FMP-verified | FMP income-statement endpoint, filed 2026-07-29, retrieved 2026-09-03 |
| FMP-009 | Operating income (FY ended 2026-06-30): $155,237,000,000 | FMP-verified | FMP income-statement endpoint, filed 2026-07-29, retrieved 2026-09-03 |
| FMP-010 | Net income (FY ended 2026-06-30): $133,749,000,000 | FMP-verified | FMP income-statement endpoint, filed 2026-07-29, retrieved 2026-09-03 |
| FMP-011 | EPS (diluted, FY ended 2026-06-30): $17.95 | FMP-verified | FMP income-statement endpoint, filed 2026-07-29, retrieved 2026-09-03 |
| WEB-001 | July 29, 2026 — Microsoft reported fiscal Q4 results and highlighted cloud/AI momentum, Copilot adoption, and its OpenAI investment's effect in its presentation (no figures reproduced) | Live web, not independently verified | Microsoft Source — https://news.microsoft.com/source/2026/07/29/microsoft-cloud-and-ai-strength-fuels-fourth-quarter-results-4/ (published July 29, 2026) |
| WEB-002 | July 15, 2026 — Microsoft and 3M announced a strategic partnership to deploy 3M optical technology in Azure datacenters and use Microsoft AI/digital platforms in 3M's enterprise transformation | Live web, not independently verified | Microsoft Source — https://news.microsoft.com/source/2026/07/15/3m-and-microsoft-announce-strategic-partnership-to-advance-ai-data-center-infrastructure-and-enterprise-transformation/ (published July 15, 2026) |
| WEB-003 | June 2–3, 2026 — Microsoft Build announcements included Microsoft Discovery becoming generally available, new in-house AI models, Foundry updates, and Windows 365 for Agents | Live web, not independently verified | Microsoft Source (Build 2026 live blog) — https://news.microsoft.com/build-2026-live-blog/ (published June 2–3, 2026) |

## 3. Excluded / unconfirmed claims

- **"Microsoft Scout" allegedly built on "OpenClaw"** (surfaced in the Build 2026 live-blog search result) — excluded because it was a live-blog summary rather than a separately verified/dedicated product announcement; unusual naming warrants independent corroboration before treating as fact.
- **Reddit-sourced claims of a Microsoft/OpenAI and Stellantis partnership** — excluded because no direct primary-source report was found in the search results, only reposts.

## 4. Open verification items

- Confirm FY2026 income-statement figures (revenue, gross profit, operating income, net income, EPS) against Microsoft's actual 10-K/8-K filing once available, independent of the FMP endpoint.
- The price/market-cap snapshot (FMP-004, FMP-005, FMP-006) is a point-in-time retrieval and will be stale by the time this packet is read; re-verify current price before any downstream use.
- WEB-001 (July 29 earnings) references "cloud/AI momentum" and "Copilot adoption" qualitatively only — a human reviewer should pull the actual reported figures from the primary release or the FMP filing rather than assuming alignment with the FMP financials above.
- WEB-003's specific product claims (Microsoft Discovery GA, new AI models, Foundry updates, Windows 365 for Agents) should be cross-checked against dedicated Microsoft product documentation, not just the live-blog recap.
- Verify whether the "Microsoft Scout / OpenClaw" mention (excluded above) reflects a real, differently-named product, a misattribution, or an artifact of noisy search aggregation — it was not resolved in this pass.
```
