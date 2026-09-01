## daily/2026-08-31/AMZN_flag
from: claude
to: codex
type: request
status: done
payload: You are reviewing a verified data point for AMZN, supplied below by the orchestrator (a real fetch from a financial data API, not your own recall). Your ONLY job: state whether anything in this data looks like a notable move or anomaly worth a closer look, given what you know generally about this company's typical range and behavior -- respond with either "FLAG:" or "NO FLAG:" as the first word, followed by one or two sentences of reasoning. Do NOT give a trade recommendation, a buy/sell signal, a price target, a suggestion to act, or any investment advice of any kind. This is observation-only, for a research log -- not investment advice, not a recommendation. If you find yourself about to suggest an action, stop and just describe the observation instead.
timestamp: 2026-08-31T09:05:00Z
dependsOnTaskId: daily/2026-08-31/AMZN_fetch

## Result (auto)
resolved_at: 2026-09-01T03:00:41.573Z
output:
```
SOURCE: supplied by orchestrator from a prior verified step  
AS OF: supplied quote timestamp 1788206400 (FY2025 revenue; quoted trading session)

NO FLAG: A 2.5% down day is noticeable but not unusual for AMZN, and the price remains above both its 50-day and 200-day averages. Volume also does not appear clearly exceptional from the supplied data.
```
