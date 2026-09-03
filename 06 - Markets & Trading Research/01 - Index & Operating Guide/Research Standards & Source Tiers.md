---
tier: warm
relevance: 0.6
last_accessed: 2026-09-03
type: standard
status: active
domain: markets-research
description: "Trust-tier system and Evidence Ledger format for the Markets & Trading Research category"
tags: ["markets", "research", "standards", "source-tiers"]
---
# Research Standards & Source Tiers

This category extends the `/bus/` SOURCE-tag honesty discipline
(`ARCHITECTURE.md` section 4, "Three-tier data grounding") into
persistent notes. Every claim in a company note must carry a trust
tier, visible next to the claim itself, not buried in a general
disclaimer.

## The three tiers, highest trust first

1. **FMP-verified** — a structured, deterministic figure fetched
   directly by the orchestrator (Claude) from the connected Financial
   Modeling Prep API. Task convention: `to: claude`, `source:` names
   the exact endpoint(s), `recordFact` promotes it into the durable
   memory store (`bus/memory.jsonl`).
2. **Live web, not independently verified** — a dispatched specialist
   (Codex or claude-agent) actually invoked a real web-search tool and
   is reporting what it found, with a direct publisher and URL where
   available. Genuinely live, but web search results are noisy —
   AI-summarized digests have been directly observed producing
   plausible-sounding false claims (see `ARCHITECTURE.md` section 4's
   2026-09-03 finding). Never upgrade this tier to "verified" just
   because it sounds authoritative.
3. **Training-data recall** — general background knowledge, not checked
   against any live source this session. Fine for context (what a
   company does, industry background); never fine for a numeric or
   time-sensitive claim.

A claim that came from a web search but could not be traced to a real
publisher/URL, or that reads like aggregator/AI-summarizer filler
rather than actual reporting, does not get a row in the Evidence Ledger
at all — it goes in the note's "Excluded / unconfirmed claims" section
instead, with a one-line reason.

## The Evidence Ledger format

Every company snapshot note contains a table:

| Claim ID | Claim | Trust tier | Source / retrieval |
|---|---|---|---|
| FMP-001 | ... | FMP-verified | exact endpoint + retrieval date |
| WEB-001 | ... | Live web, not independently verified | publisher name + URL + publication date |

Claim IDs are prefixed by tier (`FMP-`, `WEB-`) and numbered per note,
not globally. Conflicting claims (two sources disagree) get separate
rows each with their own source, never merged or averaged into one
"best guess" row.

## Hard rules

- **No trade recommendations, price targets, or buy/sell/hold opinions
  anywhere in this category.** This is observation-only research. A
  note found violating this should be corrected immediately, not
  merely flagged.
- Never let a lower tier contaminate a higher one -- a web-search
  finding never gets written as if it were FMP-verified, and recall
  never gets written as if it were checked live.
- Every snapshot ends with an "Open verification items" section so
  known uncertainty survives edits, rather than being silently dropped.
- A snapshot is dated (`TICKER - YYYY-MM-DD Snapshot.md`) because
  price/market-cap figures are point-in-time — publish a new dated
  snapshot for an update rather than editing an old one's numbers in
  place.
