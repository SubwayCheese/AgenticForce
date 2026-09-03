## trading_fleet_scoping_plan
from: claude
to: codex
type: request
status: done
payload: You are being asked to SCOPE a major future capability -- do NOT write any files, search the web, or build anything yet. This is a planning-only pass for a goal the user explicitly said will NOT be completed today; it is a multi-session target. The plan you produce will be reviewed by the orchestrating Claude Code session before any real work begins, possibly not for a while.

The user's own words, verbatim: "What I want is a very big multi agent team that scans a very large number of stocks through trading view (both you and codex) those agents will then take their top contenders for a trade that day and talk to each other to find an optimal trade. This needs to be on a big scale with a lot of agents."

Real facts about this vault's current infrastructure you must design around -- read ARCHITECTURE.md and tasks/stock_research_team_plan.md first if you want the full detail, but the load-bearing facts are:

1. The `/bus/` protocol is entirely orchestrator-hub-mediated today: Claude dispatches one task, reads its result, dispatches the next. There is NO existing mechanism for two dispatched specialists to talk directly to each other -- every "conversation" passes through the orchestrator. The user's "talk to each other to find an optimal trade" requirement needs either (a) a genuinely new peer-to-peer or shared-blackboard coordination mechanism, or (b) an honest orchestrator-simulated approximation (e.g. a structured multi-round negotiation loop where each agent's output becomes the next agent's input via chained dependsOnTaskId tasks, repeated for N rounds, orchestrated by Claude but designed to feel like real deliberation). Propose which, and why -- do not hand-wave this as a solved problem.
2. Only two real specialists exist today: Codex (you) and claude-agent (a nested Claude Code instance), both dispatched as fresh, disposable subprocesses per task -- there are no persistent named agent "identities" between dispatches, only task-scoped instances. "A lot of agents" in this system today means "a lot of concurrent or sequential task dispatches to these two specialist TYPES," not many distinctly-configured personas, unless you propose otherwise.
3. Both you and claude-agent have confirmed real web-search access (found live this session), but TradingView itself does not have a confirmed public API for bulk stock scanning/screening -- do not assume one exists; note it as something that needs real investigation, or propose using the already-connected Financial Modeling Prep (FMP) API (which the orchestrator can call directly, with screener/quote/directory-type endpoints) as the actual scanning data source instead, with TradingView's role being what it already is in this vault: the embedded chart UI (bus/markets.html), not a scanning backend.
4. The existing stock research work in this vault (tasks/stock_research_team_plan.md, and the published "06 - Markets & Trading Research" category) is explicitly observation-only -- no trade recommendations, no price targets, no buy/sell/hold opinions, enforced by a review gate. This new goal ("find an optimal trade") genuinely crosses that boundary into decision-support. Address this directly: propose where the line should be for this new capability, and note explicitly that the orchestrating Claude Code session cannot execute a trade autonomously under any design -- whatever this becomes must terminate in a recommendation a human acts on, never an autonomous execution path.
5. Real dispatch cost: each specialist dispatch is a real subprocess call (several seconds to over a minute for a real web-search-backed task). "A very large number of stocks" scanned by "a lot of agents" has a real time/cost budget implication -- do not propose an unbounded design; propose a concrete, staged scale (e.g. a pilot batch size, then how it could grow) rather than "scan everything."

Produce a written plan covering, in order:

1. **Architecture for the scanning phase**: how would a large batch of stocks actually get distributed across many dispatches? What's the real data source per stock (FMP fields, e.g.)? What does one scanning agent's task actually look like (payload, output format)? How do "top contenders" get selected and by what criteria (technical signal? volume? volatility? your call, but be concrete and be honest that any signal you propose is exactly the kind of qualitative/interpretive claim this vault's SOURCE-tag discipline requires being tagged honestly, not presented as verified fact).
2. **Architecture for the negotiation phase**: your answer to point 1 above (real mechanism vs. simulated), worked out concretely -- what does a "round" look like as real task files, how many rounds, how does it terminate at one recommendation, how do disagreements between agents actually get resolved (majority? one agent designated as final arbiter? something else?).
3. **Scale plan**: a concrete pilot size (e.g. N stocks, M agents) for a first real test of this pipeline, and how it could grow from there -- not the full "very large number" on day one.
4. **Safety/scope boundary**: where exactly the observation-only -> decision-support line sits for this capability, and what output format keeps that boundary honest and visible (similar in spirit to the Evidence Ledger / trust-tier work already established for the research category).
5. **Real risks and open questions**: be specific -- include the ones already named above (peer-to-peer mechanism, TradingView scanning API, dispatch cost/time at scale, decision-support boundary) plus anything else you genuinely see.

This is a scoping document for a future multi-session effort, not a build task -- be concrete and honest about what's hard, not just what would be nice to have.
timestamp: 2026-09-03T22:00:00Z

## Result (auto)
resolved_at: 2026-09-03T22:18:54.024Z
output:
```
SOURCE: supplied by orchestrator from a prior verified step  
As of: vault infrastructure facts supplied in this planning brief, 2026-09-03.

The premise is achievable as a human-in-the-loop research and decision-support workflow, but not as direct autonomous agent-to-agent discussion or automated trade execution with the current vault. TradingView bulk scanning is also unverified and must not be assumed.

## 1. Scanning-phase architecture

Use FMP as the initial bulk-data source; retain TradingView as the chart-review surface in `bus/markets.html`.

A coordinator creates one immutable universe snapshot for the run: symbol, exchange, timestamp, screen configuration, and FMP data responses. It then partitions symbols into fixed batches and dispatches batch-scanning tasks to the existing two specialist types—Codex and `claude-agent`. “Many agents” initially means many task-scoped instances of those two types, not persistent personas.

Suggested initial task contract:

```json
{
  "runId": "2026-09-03-us-liquid-v1",
  "batchId": "batch-07",
  "symbols": ["..."],
  "asOf": "market-data timestamp",
  "screenRules": {
    "minPrice": 5,
    "minAverageVolume": 1000000,
    "minMarketCap": 300000000,
    "excludeEarningsWithinDays": 2
  },
  "requiredFmpFields": [
    "price", "change", "volume", "averageVolume",
    "marketCap", "sector", "industry",
    "dayHigh", "dayLow", "yearHigh", "yearLow",
    "historical OHLCV", "earnings-calendar"
  ]
}
```

Each scanning task returns machine-readable records, not prose-first research:

```json
{
  "symbol": "XYZ",
  "dataTimestamp": "...",
  "liquidity": {"volume": 0, "averageVolume": 0},
  "signals": {
    "relativeVolume": 0,
    "rangeExpansion": false,
    "trendState": "up|down|mixed",
    "volatilityState": "low|normal|elevated",
    "eventRisk": ["earnings"]
  },
  "screenScore": 0,
  "evidence": [{"field": "averageVolume", "value": 0, "source": "FMP"}],
  "interpretations": [
    {"claim": "...", "tag": "INTERPRETATION", "basis": ["..."]}
  ],
  "disqualifiers": [],
  "confidence": "low|medium|high"
}
```

Selection should be deterministic before interpretive review. For example: require liquidity and price thresholds, rank qualifying symbols by a documented weighted screen using relative volume, trend/range state, and volatility suitability; then advance the top 10–20 candidates. Any “signal quality,” chart-pattern, or catalyst interpretation is not a verified market fact: it must carry the vault’s SOURCE/interpretation discipline, preserve underlying values and timestamps, and remain contestable.

Avoid letting agents choose from different live data snapshots. The coordinator should fetch and freeze the input dataset once per run, then provide the same data to all batch tasks.

## 2. Negotiation-phase architecture

For the first implementation, use an orchestrator-simulated structured deliberation loop, not peer-to-peer communication.

This fits the actual `/bus/` architecture, is auditable, works with disposable specialists, and avoids prematurely building a shared-state/concurrency system. It should be described honestly as mediated deliberation, not direct agent conversation.

Proposed task sequence:

1. `scan-batch-*` tasks produce scored candidate records.
2. `candidate-consolidation` validates schema, deduplicates, and selects a shortlist.
3. `thesis-round-1-*` tasks independently review assigned or shared shortlist candidates and submit a structured case for/against each.
4. `challenge-round-2-*` tasks receive the anonymized round-one ledger, identify unsupported claims, data gaps, conflicts, event risks, and counterarguments.
5. `synthesis-round-3` receives the complete ledger and produces a ranked recommendation packet plus abstention/no-trade outcome where justified.
6. A mandatory human review gate accepts, rejects, or requests another research round.

Each task is a normal orchestrated task file linked by `dependsOnTaskId`. “Conversation” is the bounded sequence of prior structured outputs passed into later tasks. Use three rounds initially; more rounds should require a concrete reason, such as unresolved disagreement or changed data.

Do not resolve disagreement by raw majority alone. Use a deterministic decision rule:

- Reject candidates with unresolved data conflicts, insufficient liquidity, imminent predefined event risk, or inadequate evidence.
- Rank remaining candidates using the documented screen score plus independently supported thesis quality.
- Treat material dissent as a required section in the final packet.
- Permit the synthesis task to return `NO_ACTIONABLE_CANDIDATE`; it must not force a single trade idea.
- The synthesis task is an arbiter of evidence quality and rule adherence, not an authority that may invent certainty.

A later, separate project could propose a true shared blackboard or peer messaging protocol. It would need task identity, scoped write permissions, event ordering, locking/versioning, retention, audit logs, failure recovery, and controls against agents reading or overwriting untrusted state. That is substantial infrastructure work and is not needed to validate the research pipeline first.

## 3. Scale plan

Start deliberately small:

| Stage | Universe | Concurrent scanning tasks | Shortlist | Negotiation |
|---|---:|---:|---:|---|
| Pilot | 50 liquid US stocks | 4–6 | 5 | 3 rounds |
| Early expansion | 250 stocks | 10–20, throttled | 10–15 | 3 rounds |
| Mature batch operation | 1,000 stocks | 25–50, queue-controlled | 15–25 | 3 rounds plus exceptions |

The pilot should use a fixed, liquid universe—not “the market”—and measure runtime, subprocess failure rate, FMP limits/cost, schema compliance, disagreement rate, and human-review usefulness.

Do not scale dispatch count linearly without a budget model. Each task has startup latency and potentially web/data costs. Prefer one batch task per 10–25 symbols where quantitative screening is deterministic; reserve expensive specialist reasoning and chart review for the shortlist. This is how a 1,000-symbol universe remains plausible without pretending that 1,000 deep-research agents are economical.

## 4. Safety and scope boundary

The current category remains observation-only. This new capability would be a distinct, explicitly labeled decision-support workflow.

The boundary is:

- Observation-only: factual market data, historical behavior, company/event context, chart descriptions, and uncertainty.
- Decision-support: a conditional, time-bounded proposed trade setup selected from alternatives, including entry conditions, invalidation conditions, risk constraints, and reasons not to act.
- Prohibited: autonomous brokerage access, order creation/submission, portfolio allocation, individualized suitability claims, guarantees, or presenting model output as a command to trade.

Every final output should be a “Human Review Trade Research Packet,” containing:

- Run timestamp and frozen-data timestamp
- Universe and exclusions
- Candidate ranking and deterministic criteria
- One conditional setup, or `NO_ACTIONABLE_CANDIDATE`
- Bull case, bear case, material dissent, and invalidation conditions
- Evidence Ledger with source, timestamp, fact/interpretation labels, and confidence
- Risk/event/liquidity warnings
- Prominent statement: “Research decision-support only. A human must independently decide whether to act; this system cannot execute trades.”

The review gate should remain mandatory and should be strengthened for this category, not bypassed because the workflow has many agents.

## 5. Risks and open questions

- **No direct agent communication exists.** The mediated negotiation loop is feasible now; genuine peer coordination requires new shared-state protocol design and operational controls.
- **TradingView bulk-screening access is unverified.** Investigate its supported API/automation terms before relying on it. FMP is the practical assumed scanning backend for the pilot; TradingView remains a human-facing chart layer.
- **Task identities are disposable.** Persistent analyst personas, memory, and reputation scoring do not exist today. If wanted, they require explicit profiles and externally stored, auditable state.
- **Scale has real cost and latency.** Establish concurrency limits, timeouts, retry policy, token/cost budgets, FMP rate-limit handling, and a run cancellation mechanism before expansion.
- **Data freshness and market timing matter.** Define whether runs are pre-market, intraday, or end-of-day; freeze inputs; identify delayed versus real-time data; and invalidate stale packets.
- **Signal design can overfit.** Weighted technical rules need historical evaluation and paper-trading-style review before they are treated as useful. A high score is a screening heuristic, not evidence of future returns.
- **Corporate actions and events can break naïve data.** Splits, halted symbols, earnings, news, sector concentration, and shortable/borrow constraints need explicit handling.
- **Conflicting outputs and fabricated claims remain possible.** Require structured schemas, validation, source timestamps, claim tags, and explicit “unknown” fields. Never let a synthesizer silently convert an unsupported interpretation into fact.
- **Decision-support changes the governance burden.** Define who is authorized to review outputs, what disclosures are required, how outputs are retained, and whether legal/compliance review is needed for the intended users and jurisdiction.
- **No autonomous execution under any design.** The pipeline must end at a human-readable recommendation packet and a human decision; no brokerage integration or execution path should be in scope.
```
