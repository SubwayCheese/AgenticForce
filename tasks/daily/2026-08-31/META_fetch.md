## daily/2026-08-31/META_fetch
from: claude
to: claude
type: response
status: done
payload: Backlog demo item, orchestrator-sourced fetch for META. Fetch latest verified annual revenue and latest quote/price via FMP.
timestamp: 2026-08-31T10:00:00Z
dependsOnTaskId:
source: Financial Modeling Prep API, endpoint income-statement (symbol META, period annual, fiscalYear 2025, filingDate 2026-01-29) and endpoint quote (symbol META)

## Result (auto)
resolved_at: 2026-08-31T10:00:15Z
output:
```
SOURCE: verified live (FMP API, not training-data recall)
TICKER: META

REVENUE: FY2025 (fiscal year ended 2025-12-31) total revenue = $200,966,000,000 ($200.966B). Filed 2026-01-29 (accepted 2026-01-28 19:13:46 UTC), CIK 0001326801.

QUOTE (as of timestamp 1788206401): price=$572.34, change=-5.68 (-0.98%), open=$576.77, previousClose=$578.02, dayLow=$569.1386, dayHigh=$578.675, 50-day avg=$592.0466, 200-day avg=$622.44775, 52-week range=$520.26-$790.80, volume=13,275,274, marketCap=$1,458,028,463,474.
```
