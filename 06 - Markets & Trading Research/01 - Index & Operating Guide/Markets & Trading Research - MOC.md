---
tier: warm
relevance: 0.6
last_accessed: 2026-09-03
type: moc
status: active
domain: markets-research
description: "Map of Content for the Markets & Trading Research category"
tags: ["markets", "trading", "research", "moc"]
---
# Markets & Trading Research — Map of Content

This category holds observation-only market/stock research produced by
the `/bus/` multi-agent team (Claude orchestrator + Codex + claude-agent
specialists) documented in `ARCHITECTURE.md`. It is designed to grow
into many kinds of stock/trading-related information over time, not
just the first batch below — see [[Research Standards & Source
Tiers]] before adding anything new to this category.

**Explicit boundary, inherited from the approved research plan
(`tasks/stock_research_team_plan.md`): this category is strictly
observation-only.** No trade recommendations, price targets, or buy/
sell/hold opinions belong here, ever -- every note in this category is
reviewed against that rule before publication.

## Structure

- **[[Research Standards & Source Tiers]]** — the trust-tier system
  (FMP-verified / live web / training recall) and the Evidence Ledger
  format every company note follows. Read this first.
- **02 - Watchlists & Investment Theses/** — [[Core Watchlist]] and
  (future) thesis-tracking notes.
- **03 - Companies/** — one folder per ticker, `TICKER - Company Name/`,
  containing dated snapshot notes.
- **04 - Sectors & Themes/** — (not yet populated; add sector rollups
  here as coverage grows).
- **05 - Market Digests/** — (not yet populated; candidate for
  daily/weekly digest notes once this becomes a recurring, not one-off,
  capability).
- **06 - Reference & Glossary/** — (not yet populated).

## Current coverage (first batch, 2026-09-03)

Four companies, chosen as a small, real, cross-sector starting scope:

- [[AAPL - 2026-09-03 Snapshot]] — Apple Inc. (Technology / Consumer
  Electronics)
- [[MSFT - 2026-09-03 Snapshot]] — Microsoft Corporation (Technology /
  Software - Infrastructure)
- [[NVDA - 2026-09-03 Snapshot]] — NVIDIA Corporation (Technology /
  Semiconductors)
- [[JPM - 2026-09-03 Snapshot]] — JPMorgan Chase & Co. (Financial
  Services / Banks - Diversified)

## How this batch was produced

Full task-by-task provenance lives in `bus/log.md` and the task files
under `tasks/market_20260903_*`. Summary of the real pipeline used, not
a hypothetical one:

1. Claude (orchestrator) fetched verified financial data for all four
   tickers directly from the connected FMP API (`market_20260903_
   <TICKER>_fmp` tasks, `to: claude`, `recordFact` into the durable
   memory store).
2. Codex and claude-agent split live web research across the four
   tickers (`market_20260903_web_aapl_msft` → Codex,
   `market_20260903_web_nvda_jpm` → claude-agent), each using a real,
   confirmed-live web-search tool.
3. Each ticker's FMP data and applicable web research were synthesized
   into a source-tagged packet by the specialist who did NOT research
   that ticker (a deliberate cross-check, not a rubber stamp) via
   `dependsOnTaskIds` fan-in.
4. A batch review (`market_20260903_batch_review`, claude-agent)
   checked all four packets together for traceability, forbidden
   content (none found), and structural consistency before publication.
5. This note and the four company snapshots were published by the
   orchestrator directly from the reviewed packets, correcting two
   structural gaps the review caught (see the affected snapshots' own
   provenance sections).

## Next steps (not yet done, tracked here for continuity)

- Populate sector rollups once more than one company per sector exists
  (currently: 3 Technology, 1 Financial Services — not enough for a
  meaningful rollup yet).
- Decide on a recurring cadence (manual batches for 2-3 more cycles
  before considering `run-queue-daemon.js`, per the approved plan's own
  recommendation — the daemon does not dispatch `to: claude` tasks, so
  a future recurring flow needs the FMP-fetch step done separately
  from the daemon-dispatched specialist steps).
