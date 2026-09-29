# Plan: diagnose C1, propose fixes, backtest a leveraged-ETF trend strategy

## Context
Owner (2026-09-26) asked for a multi-agent diagnosis of C1 (live $50 Alpaca cash account, long-only), optimizations,
and "high-confidence, high-leverage" trading that C1 can practice and that is backtested. Exploration (3 agents, then a
planning agent; key claims re-checked in code) found:
- **Cadence:** timer fires every 2h but missions author every ~4h: the wake that executes a decision `continue`s past
  authoring (`bus/city/survive-supervisor.js:506`). Docs say "2h".
- **Live bug:** `survive-executor.js:293` (`submitOrder`) and `:301` (`getOrder` poll) have no try/catch. A rejection or
  transient failure leaves the mission unresolved; the next wake retries with the same deterministic clientOrderId
  (`survive-${citizenId}-${missionId}-entry`), which Alpaca rejects, so C1 wedges. Worse case: order placed, poll throws,
  fill never recorded in the ledger.
- **Shadow-score 0 is correct:** horizons are 5/20 trading sessions; first score after the 2026-09-29 close. Shadow data
  is never fed back to prompts. C1 has never closed a trade, so its lesson feed is empty (reflection is hard-wired `to: codex`, paused).
- **No market data in prompts** (only web search + bid/ask table); entry symbol not allow-listed; no fetch timeouts;
  fractional stops are day-only; $20 max position, so dollar outcomes are cents.
- **Leverage:** long cash buys of leveraged ETFs need no margin (HANDOFF's "needs $2,000 margin" overstates; margin/shorting
  do). Fractionability, cash-account settlement/good-faith rules are UNVERIFIED. No leveraged ETF exists anywhere in the repo.
- **Backtest infra:** no cached prices anywhere. Template: `bus/fleet/backtest-screen-score-v2.js`. Paper fleet found no
  cost-surviving edge (v2, 2026-09-18). Fleet may not import from city (duplicate small helpers, per precedent).

Owner decisions (2026-09-26): practice = **forward signal log, no orders**; C1 fixes = **proposals only**; data = **Alpaca only**.

## Hard constraints
No live orders, no edits to protected files (`bus/protected-paths.json`: survive-supervisor/executor/market-data/shadow*, `bus/tests/**`, `bus/lib/**`).
Never `git checkout/switch/reset --hard/clean/commit -a/add -A`; stage explicit paths; no commit unless asked. No secrets
printed (keys via `secrets-broker`). Codex paused: cross-review with `node bus/platform/ask-agents.js --to antigravity --review-by claude-agent --wait ...`.
Honest reporting: a likely outcome (~60-70%) is "no defensible edge"; publish a FAIL plainly.

## Phase A: diagnosis + proposals (no gate)
- `docs/C1-diagnosis-2026-09-26.md`: the findings above with file:line.
- Proposals + `.patch` files under `docs/proposals/` (format of `2026-09-23-executor-stop-price.md`), NOT applied:
  1. `2026-09-26-executor-submit-try-catch.md` (priority: wraps `submitOrder`/`getOrder`, resolves mission with `outcome:'error'`, reconciles a possibly-filled order by clientOrderId).
  2. `...-entry-symbol-allowlist.md`, `...-fetch-timeouts.md`, `...-supervisor-cadence.md` (fix docs wording, or author-then-execute).
  3. One-line ranking added for the existing `2026-09-23-executor-market-hours.md`.
- Correct the HANDOFF leveraged-ETF line (docs are unprotected).
- Gate A: owner reviews proposals.

## Phase B: backtest engine (unprotected `bus/fleet`)
| File | Purpose |
|---|---|
| `bus/fleet/lev-bars-cache.js` | Fetch `adjustment=all` daily bars (IEX, paper keys via secrets-broker, timeouts, pagination) for QQQ, SPY, TQQQ, UPRO, SOXL, SGOV, SHY, BIL; cache to `bus/fleet/data/lev-bars/<SYM>.json` with fetch date; assert gaps/sanity (single-day |return| bound). Fleet-local copy of the adjusted-bars logic (reference: `bus/city/survive-market-data.js`, `bus/fleet/alpaca-client.js`). |
| `bus/fleet/lev-backtest-engine.js` | Pure functions: SMA, signals on the underlying's close, fills at NEXT open, costs, metrics. |
| `bus/fleet/backtest-lev-trend.js` | CLI: prereg check, run, verdict report. Model on `backtest-screen-score-v2.js` (non-overlapping thinning, paired-t/bootstrap CIs). |
| `bus/fleet/lev-backtest-selftest.js` | Plain-node self-checks with injected bars (lookahead, next-open fill, costs, split boundary). |
| `bus/fleet/data/lev-backtest-prereg.json` | FROZEN before any test-window run. |
| `bus/fleet/data/lev-backtest-results.md` | PASS/FAIL report. |
Register the four scripts in `bus/components.json` (domain fleet, status manual), header comments, paths via `avPaths.fleetData`,
then `node bus/platform/build-system-map.js --write`. A proposed `bus/tests/survive/lev-backtest.test.js` is handed to the owner (protected dir).

Prereg (frozen): strategies (1) 200d SMA + 2% band on QQQ -> TQQQ else cash (SGOV); (2) 50>200 dual-SMA with exit on
close<50d or 10% trailing DD; (3) vol-targeted gated by 200d (expect weak fit); (4) same rules on 2x/1x controls;
(5) buy-and-hold TQQQ, QQQ benchmarks; (6) optional RSI(2) last. Grid SMA 150-250, band 0-3%, every variant counted
(multiple-testing haircut / deflated Sharpe). Split: tune on data up to 2021-12-31, freeze, test 2022 onward.
Costs: ~0.9%/yr expense + 5 bp/side slippage. Report idealized-fractional AND whole-share $50 variants.
Pass rule (test window only): beats TQQQ buy-and-hold on max drawdown and Calmar; beats QQQ buy-and-hold on CAGR after
costs; >=15 round trips over the full sample; excess-return CI excludes 0; stable across neighbouring parameters.
Report max drawdown, worst month, ulcer index, trades/year. State the CI; no "high confidence" claim from ~10y / ~30 trades.
Gate B: independent cross-review (antigravity + claude-agent) of this plan and of the frozen prereg BEFORE any test-window run.

## Phase C: C1 "practice" = forward signal log (no orders)
- `bus/fleet/lev-trend-paper.js` (new, registered): daily, computes the frozen signal from fresh bars and appends
  `{date, signal, target, hypothetical next-open fill, equity}` to `bus/fleet/data/lev-trend-forward.jsonl`. Places no orders.
  Replays history through the same code path. Timer only if owner approves (pattern: `survive-shadow-score` timer; owner installs).
- Built only after Gate B and only if Phase B passes. Gate C: >=60 trading days of forward log compared honestly to the backtest.

## Phase D: feeding C1 (owner-gated, proposals only, only if B and C pass)
Proposal patches in order: (1) read-only feature/signal file read at `fetchCandidateUniverseData`/`formatCandidateUniverseTable`
(`survive-supervisor.js` ~229/264); (2) pure `bus/city/survive-strategy-trend.js` + executor `validateDecision` hooks (`survive-executor.js` 68-92);
(3) deterministic short-circuit last. Exit policy = strategy's own daily-close rule via a supervised job, not broker stops
(fractional stops are day-only; overnight exposure stays as today).

## Multi-agent execution (non-overlapping ownership)
1. Data engineer: `lev-bars-cache.js`, `lev-bars/`.  2. Strategy implementer: engine, CLI, selftest.
3. Statistician/reviewer: prereg, red-team read-only.  4. Proposal writer: diagnosis doc + `docs/proposals/2026-09-26-*`.
5. Forward-log agent: `lev-trend-paper.js` (after Gate B). Run Gate B reviews via `ask-agents.js` (no codex).

## Risks / do not
No tuning on the test window; no raw (unadjusted) bars; no same-bar signal+fill; no survivorship cherry-picking of ETFs
(predeclared list); reverse splits (SQQQ/UVXY) excluded; do not assume unlimited day trading on a cash account; check
`getAsset` fractionable for TQQQ/UPRO before any sizing claim; expected dollars on $50 are cents either way, so the
deliverable is a validated pipeline and an honest verdict.

## Verification
- `node bus/fleet/lev-backtest-selftest.js` passes; `node bus/platform/run-survive-tests.js` still 128 passed.
- `node bus/platform/build-system-map.js --write`, then re-run tests (architecture test: registration, imports, stale map).
- `node bus/platform/survive-change-gate.js --base <ref> --candidate <ref>`: expect NO protected-path hits (proposals are docs only).
- Data checks: no gaps, no |daily return| beyond bound, first date per symbol recorded; cross-check TQQQ vs 3x QQQ daily-return tracking error on overlap.
- Report exact commands run and results in `docs/C1-diagnosis-2026-09-26.md` and `lev-backtest-results.md`, including failures.

## Amendments after independent cross-review (2026-09-26, antigravity answer + claude-agent review)
Verdict was "approve with changes". Accepted, and now encoded in `bus/fleet/data/lev-backtest-prereg.json` (frozen, sha256 in `lev-backtest-prereg.sha256`):
- SMA warm-up skips signals until a full window exists; selftest asserts it, plus `bars[i+1].open` fills.
- Pass rule counts round trips in the TEST window (>=5, else INCONCLUSIVE); bootstrap CI is reported, not gating.
- "Stable" defined: one-step grid neighbours' test-window Sharpe within 0.15. Frozen config chosen on the tune window only.
- Cost model: NO added expense ratio (adjusted prices already net it; the original 0.9% would double-count). Slippage 5 bp base and 15 bp stress.
- Cash leg is BIL for the whole period (SGOV only trades from 2020). Universe changed to QQQ/SPY, TQQQ/QLD/UPRO/SSO, BIL, SHY.
- Deflated-Sharpe formula, N=186 and grid steps written into the prereg. Primary pass claims limited to S1 and S2 on QQQ->TQQQ.
- Data sanity check compares each ETF to leverage x underlying (fixed 0.35 cap rejected: TQQQ fell ~35% on 2020-03-16).
- Cash-account rule: engine forbids same-day open+close round trips. A forced 1-day wait between sell and next buy was rejected (a same-open swap is legal; the real rule is not selling on unsettled funds). Alpaca's actual handling is unverified.
- Trailing drawdown is measured on the underlying's close. `lev-trend-paper.js` must not import any order path (selftest asserts). Key values redacted from errors (headers are APCA-API-KEY-ID / APCA-API-SECRET-KEY). Gate C needs >=1 completed round trip or an owner waiver.
- Disclosed: 2008-2009 stress absent; a pre-2016 synthetic 3x QQQ run was raised by the reviewers but the owner chose Alpaca-only data, so it is out of scope.
Confirmed: `bus/components.json` is not in `bus/protected-paths.json`.
