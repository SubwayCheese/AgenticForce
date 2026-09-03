## stock_research_team_plan
from: claude
to: codex
type: request
status: done
payload: You are being asked to PLAN a new ongoing capability for this vault -- do NOT search the web, write any files, or create any directories yet. This is a planning-only pass; the plan you produce will be reviewed by the orchestrating Claude Code session before anything gets built.

The goal: a multi-agent team that continuously researches stocks/trading information and populates a new category in this vault, starting small but explicitly designed to grow into "many different types of stock or trading related information" over time (the user's own words) -- not a one-off report.

Real capabilities you must design around, confirmed live today (not assumed):
- Both you (codex) and the other specialist (claude-agent) have genuine, working web-search tools. Confirmed by direct dispatch tests where each was instructed to actually invoke a real search and report back -- both did.
- Web search results are noisy: the same confirming test caught an AI-summarized digest stating a specific, plausible but false/unconfirmed claim as fact. Any task you design that uses web search MUST be tagged (this vault enforces a SOURCE-tag honesty system already) and should explicitly ask the specialist to flag anything in its search results that looks unconfirmed rather than repeating it as settled fact.
- Separately, the orchestrator (Claude, not you) has a DIFFERENT, higher-trust data source: a connected Financial Modeling Prep (FMP) API for real numeric financial data (quotes, income statements, company financials) -- deterministic and verified, not a web search. You cannot call this yourself; only the orchestrator can, via a task with `to: claude` (a different, reserved routing than `to: claude-agent`).
- Your own sandboxed write access (when dispatched in write mode) is scoped only to this vault directory.

Produce a written plan covering, in order:

1. Vault category structure: propose a concrete folder layout for a new "Stocks" (or better name, your call) category at the vault root, designed to scale -- subfolders/naming convention for different information types (e.g. per-ticker notes, sector overviews, watchlists, daily/weekly digests, glossary/reference material). Look at how this vault's existing top-level folders (e.g. `01 - Shared Guidelines & Learnings`, `04 - Project Blueprints`, `05 - Unverified Research Logs`) are organized and follow consistent conventions rather than inventing an unrelated style.

2. Trust-tiering in the actual file format: propose how a note in this new category visibly distinguishes FMP-verified numbers (highest trust) from live-web-search findings (real but "not independently verified") from either specialist's own training-data recall (lowest trust) -- this vault's SOURCE-tag discipline needs to survive being written into a persistent note, not just exist in a task's ephemeral output.

3. A concrete multi-agent task sequence for the FIRST real batch of research (pick a small, real starting scope -- e.g. 3-5 well-known tickers -- not "all stocks"): who searches what, who writes/formats the actual vault notes, in what order, using `dependsOnTaskId`/`dependsOnTaskIds` for real handoffs the way this vault's other multi-step builds do. Specify whether any step should be an orchestrator-sourced (`to: claude`) FMP fetch versus a specialist web-search task, and why.

4. How this scales into an ongoing capability rather than a one-off: should future batches be manually dispatched, or is this a candidate for `run-queue-daemon.js` / a scheduled recurring dispatch later? Your recommendation, with reasoning -- this doesn't need to be built now, just planned for.

5. Real risks and open questions: be specific about the hallucination risk demonstrated in today's capability test, source reliability, how conflicting information from different searches should be handled, and anything else you're genuinely unsure about.

Be concrete -- this needs to be usable by the orchestrator to actually dispatch the first real batch without having to invent missing details.
timestamp: 2026-09-03T19:50:00Z

## Result (auto)
resolved_at: 2026-09-03T19:50:48.076Z
output:
```
SOURCE: verified live via direct file read in this pipeline
As of 2026-09-03: read `ARCHITECTURE.md`, `tasks/task_template.md`, `tasks/stock_research_team_plan.md`, `tasks/unverified_entry_template.md`, `bus/scripts/run-queue-daemon.js`, `tasks/daily/2026-08-31/AAPL_fetch.md`, `tasks/UNVERIFIED_Cl/2026-09-01_AAPL_risk_note_7ce6cd.md`, and existing top-level folder listings.

1. Category structure

Create a numbered root category consistent with the existing vault:

```text
06 - Markets & Trading Research/
  01 - Index & Operating Guide/
    Markets & Trading Research - MOC.md
    Research Standards & Source Tiers.md
  02 - Watchlists & Investment Theses/
    Core Watchlist.md
    Thesis Status Board.md
  03 - Companies/
    AAPL - Apple/
      AAPL - Company Overview.md
      AAPL - 2026-09-03 Snapshot.md
    MSFT - Microsoft/
    NVDA - NVIDIA/
    JPM - JPMorgan Chase/
  04 - Sectors & Themes/
    Information Technology.md
    Semiconductors.md
    Financial Services.md
  05 - Market Digests/
    Daily/
      2026-09-03 - Market Digest.md
    Weekly/
      2026-W36 - Weekly Digest.md
  06 - Reference & Glossary/
    Metrics Glossary.md
    Research Method.md
```

Use `TICKER - Company` folders and date-stamped snapshot notes. Keep the company overview relatively durable; put time-sensitive claims, quotes, financial periods, and catalysts in snapshots. The MOC is the category entry point and should link to the watchlist, sectors, companies, and recent digests.

Do not create a second raw-research repository under this category. Continue using the existing `05 - Unverified Research Logs` / `tasks/UNVERIFIED_Cl` pattern for unreviewed material; curated company notes should link to a research-log entry or task ID when applicable.

2. Persistent trust tiers

Every published company snapshot should carry consistent frontmatter:

```yaml
---
type: market_snapshot
ticker: AAPL
company: Apple Inc.
as_of: 2026-09-03
status: reviewed
source_tiers_present: [fmp_verified, web_unverified]
related: ["[[AAPL - Apple]]", "[[Core Watchlist]]"]
---
```

Within the note, retain the tier next to each claim—not merely in a general disclaimer:

```markdown
## Evidence ledger

| Claim ID | Claim | Trust tier | Source / retrieval |
|---|---|---|---|
| FMP-001 | FY2025 revenue: $… | FMP-verified | `SOURCE: verified live (FMP API, not training-data recall)`; endpoint, fiscal period, filing date, retrieval timestamp |
| WEB-001 | Reported product/catalyst development | Live web, not independently verified | `SOURCE: web search performed live in this pipeline, not independently verified`; direct publisher URL, publication date, retrieved timestamp |
| REC-001 | General analytical framing | Training-data recall | `SOURCE: training-data recall, not verified live`; no numeric or time-sensitive assertion |
```

Rules:

- All price, market-cap, volume, financial-statement, and period-specific numeric claims come from FMP in the initial design—not web search or recall.
- Web claims must identify the original publisher and URL, not only a search-result digest. The note must state “not independently verified” unless corroborated by another named primary source.
- Training-data recall may supply neutral context only; it cannot fill missing facts, establish a catalyst, or be merged into a verified statement.
- Conflicting claims remain separate ledger rows with their sources and are marked `conflicted`; publication does not resolve them by averaging or choosing the more plausible version.
- A snapshot concludes with a short “Open verification items” section so uncertainty survives later edits.

3. First research batch

Start with four liquid, well-known, cross-sector tickers: `AAPL`, `MSFT`, `NVDA`, and `JPM`. This is small enough to review carefully while testing technology, semiconductor, and financial-company research patterns.

| Order | Task ID / route | Work | Dependency |
|---|---|---|---|
| 1a–1d | `market_20260903_<TICKER>_fmp` / `to: claude` | Orchestrator fetches quote plus latest annual and latest quarterly income-statement figures from FMP. Output must name endpoints, fiscal period, filing date, quote timestamp, and symbols. Set `recordFact` keys such as `market:AAPL:fmp:2026-09-03`. | None |
| 2a | `market_20260903_web_aapl_msft` / `to: codex` | Live-web research on dated company developments, risks, and catalysts for AAPL/MSFT. Require direct-source links, retrieval/publication dates, and a separate list of any unconfirmed or AI-digest-looking claims. | None |
| 2b | `market_20260903_web_nvda_jpm` / `to: claude-agent` | Same web-research standard for NVDA/JPM. | None |
| 3a–3d | `market_20260903_<TICKER>_research_packet` / alternating specialists | Normalize each ticker’s FMP result plus the applicable web output into a source-tagged, read-only publication packet. It must not invent figures, merge web claims into FMP facts, or make trade recommendations. | `dependsOnTaskIds`: that ticker’s FMP task and applicable web task |
| 4 | `market_20260903_batch_review` / `to: claude-agent` | Cross-ticker quality review: verify that every numerical claim traces to FMP, every web claim is labeled, duplicate/conflicting claims are called out, and the four packets follow one schema. | `dependsOnTaskIds`: all four research packets |
| 5 | `market_20260903_publish_notes` / supervised write-mode `to: codex` | Create the MOC, watchlist, four company overview/snapshot notes, and sector stubs from the approved packets. Preserve the evidence ledger verbatim. | Manual handoff of the approved batch-review output |

Step 5 is intentionally a supervised write task rather than a dependency-dispatched task: this vault’s write mode rejects `dependsOnTaskId(s)`. The orchestrator should run it only after manually placing the approved packet/review material into its payload; the task should be limited to writing those supplied facts, not researching or interpreting anew.

The FMP tasks are orchestrator-sourced because structured numeric facts are exactly what the higher-trust connector is for. Specialist web tasks are limited to qualitative, dated developments and must explicitly flag questionable search output.

4. Ongoing capability

Begin with manually dispatched weekly batches for two or three cycles. This validates the note template, conflict handling, workload, and whether the chosen source mix produces useful notes rather than a noisy stream.

After that, it is a good candidate for `run-queue-daemon.js`, with an important boundary: the daemon deliberately skips `to: claude` FMP tasks. A later recurring workflow therefore needs two lanes:

- Orchestrator-scheduled FMP tasks completed first.
- Daemon-dispatched specialist web, synthesis, and review tasks that depend on those completed FMP tasks.

Keep publishing manual/supervised until the category’s quality standard proves stable. Fully unattended writes would otherwise turn noisy web findings into durable vault content too easily.

5. Risks and open questions

- Today’s test already demonstrated the key failure mode: a plausible AI-generated search digest can be false. Search snippets are leads, never evidence; specialists must open and cite the underlying publisher or flag the item as unconfirmed.
- FMP is higher trust for supported numeric fields, but timestamps, market-session status, fiscal periods, restatements, and adjusted versus reported values still need explicit labeling.
- Multiple web sources can repeat the same original error. “Two sources agree” is not independent corroboration unless their provenance is genuinely separate.
- The category needs an explicit policy for analyst opinions, social-media claims, paywalled reports, and news corrections. Initial policy: exclude social claims and paywalled assertions unless a primary filing/company release independently supports them.
- Define retention and staleness rules before scale: snapshots should never silently overwrite old quotes or theses; add `as_of` dates and publish a new snapshot.
- Decide whether this is strictly research/education or may ever produce portfolio actions. The existing observation-only daily chain is a sensible initial boundary: no recommendations, price targets, or trade signals.
```
