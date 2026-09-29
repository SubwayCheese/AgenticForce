# HANDOFF -- read this first in a new session

Last refreshed 2026-09-23 ~15:50 PDT. This repo already has a vault of context, so this file is a pointer-heavy briefing:
where we are, what is unsafe, what is next. It does not repeat `AGENTS.md` (rules, commands), `docs/DECISIONS.md` (every
decision and why; newest at the BOTTOM despite its header), or `docs/SYSTEM-MAP.md` (generated map). Read `AGENTS.md` first.
**First action in a new session: check C1's live state (below) before doing anything else.**

## Goal
Growth of the project in the owner's priority order (memory `project_survive_city_goals.md`): real growth potential first;
funding a Claude Max plan from real profit is a standing goal; the 3D city is a proof-of-life tool, not a priority. On
2026-09-22 we concluded **trading is capital-capped** ($50; every route to more trading capital failed on API access or trust),
so **new effort goes to general revenue**: first a course ("Agents That Run Themselves") marketed with AI-voiced shorts. C1
keeps running as the proof-of-concept. The owner wants a Claude Max plan; the only avenue they found (Claude for Open Source)
does not fit this repo -- see Failed attempts #9 and Next steps #5.

## Current state (verified 2026-09-23 ~15:05 PDT)
- **C1 (live Alpaca, $50 account):** running unattended, `survive-supervisor.timer` every 2h (Round 28), missions alternate
  codex (odd) / claude-agent (even). **It HOLDS a real position: SGOV 0.198672205 sh, entered at $100.618 by mission010
  (cash $30, equity ~$49.99).** The executor's own stop failed (it used the entry bid as the stop; 422). A day stop at
  $100.11 was placed by hand on the owner's delegation; **it EXPIRED at the 13:00 PDT close (Alpaca allows only day stops on
  fractional qty), so the position currently has NO stop** (0 open orders, market closed, verified 15:02 PDT). Mission011
  (authored 13:02, executed 15:03) decided HOLD. The executor stop bug is FIXED (Round 33, `resolveStopPrice`, 35 tests) and
  takes effect on C1's next entry -- **watch that entry's stop lands.** History: 007 no-action; 008 (first claude-agent mission) limit entry into a closed market,
  canceled, no money moved; 009 no-action; 010 entered SGOV; 011 hold. Check read-only: `bus/survive-supervisor.log` and
  `bus/city/survive-alpaca-live-client.js` (never place orders yourself; see rule 2).
- **Timers (user systemd):** supervisor (2h), `market-scan-cycle` (daily 09:00), `survive-shadow-score` (daily 16:30 PDT; first
  run due today -- it scores past decisions against real prices, C1's "learning" data).
- **Queue daemon:** a hand-started process (PID from Sept 20), NOT under systemd; a Pi reboot would silently stop C1's
  pipeline. It still runs the OLD `ntfy.js` (loaded before Round 33), so ITS failure alerts still use the legacy public
  `ClaudeTeam` topic until it is restarted.
- **Alerts:** ntfy topics are now private. The names in code are logical; real ones are in `bus/secrets.local.json` as
  `NTFY_TOPIC_AGENTVAULTSURVIVE` and `NTFY_TOPIC_CLAUDETEAM`. **The owner must subscribe the ntfy phone app to those two
  values** (test messages were sent) or they will miss C1 alerts. Never print the values into the repo.
- **Pi hardware:** Raspberry Pi 4, `get_throttled = 0x50005`, under-voltage continuously since Sept 20 (weak power supply);
  C1's live state is on this SD card. Renders are capped to 2 cores. Owner action: official 5.1V/3A USB-C supply.
- **GitHub:** `github.com/SubwayCheese/AgenticForce` is PUBLIC and current (README, MIT LICENSE, domain layout, 119 tests pass in
  a fresh clone). The course repo `~/AgentVault-products` is deliberately NOT published (it is the product being sold).
- **Course + shorts:** course LIVE on Whop (below); shorts not posted yet. 9 lessons, starter (6 tests), 6 shorts.
  Round 34 (2026-09-23): codex reviewed the lessons (24 issues) and antigravity did a second pass (3 more); all fixed.
  Price set at $19 launch / $29 later (research in `whop/listing.md`). Landing page `landing/index.html` (private preview
  https://claude.ai/artifact/MKzSakTaAGTe4r29jdepVi; `STORE_URL` set to the live store). `marketing/AUDIENCE-PLAN.md`
  (2-week launch sequence) and a dev.to draft (`marketing/posts/devto-failure-stories.md`).
  **LIVE ON WHOP since 2026-09-23 16:03 PDT:** https://whop.com/biz_PPKuEPjr6iEsPB/agents-that-run-themselves/ ($19 one-time,
  plan `plan_QqPQ5RSVI3txk`, business "Workforce"; 9 chapters / 10 lessons, verified by read-back). Published by
  `bus/revenue/whop-publisher.js`; ids in `bus/whop-publish-state.json`. Gotchas found: the key's business is GET /accounts/me
  (NOT /companies/me, which answers with a different business, "Me" -- that caused every 403); POST /products silently
  ignores plan_options/experience_ids (use /plans and /experiences/{id}/attach); new courses get a seed "Chapter 1".
  **Shorts (2026-09-23 evening):** re-rendered with typed-terminal visuals (v1 text cards kept in `media/v1-textcards/`).
  Posting plan = by hand, one a day (`marketing/POSTING-SCHEDULE.md`). Automation checked: `bus/revenue/opus-poster.js`
  (upload untouched -> schedule; codex-reviewed, 5 fixes) works, BUT the Opus account is TRIAL tier: forced watermark and
  it burned its own captions over ours (poster now sends enableCaption:false). YouTube Data API: unaudited projects upload
  private-only. Upload-Post: free 10/mo without TikTok, young company with mixed trust signals -- owner's call.
- **AI video:** blocked on Google billing (see Next steps #4). The shorts use local ffmpeg text-card visuals and are usable as-is.
- **Agents:** Codex healthy; Claude headless (`to: claude-agent`); Antigravity `agy` 1.2.9 wired as a third text specialist.
  On 2026-09-23 the owner asked for broader agent shell access: agy now also reads `~/AgentVault-products` and may run
  read-only commands (cat/head/tail/grep/wc/find/stat/diff/jq...; no git/rm/node). Codex left as-is (its read-only sandbox
  already runs any command; `write` mode exists).
- **Tests:** `node bus/platform/run-survive-tests.js` = 128 passed. City repo HEAD is pushed; products repo is local only.

## Active field (where work was happening)
- `~/AgentVault-products/courses/agentic-systems/` (course, starter, whop/, marketing/, PLAN.md)
- `bus/revenue/shorts-pipeline.js`, `video-providers.js`; `bus/platform/agent-engine.js`, `agents/antigravity.json`,
  `ask-agents.js`, `ntfy.js`; `bus/city/survive-supervisor.js`, `survive-executor.js`
- Two repos: the system is `~/AgentVault`; products are `~/AgentVault-products`. Sessions sometimes start in the latter.

## Changes made (rounds 27-33; details in DECISIONS.md)
- **R27:** daily web-search market scan widens C1's candidates; shadow-score handles scanned symbols; a live rehearsal caught a
  negative-spread bug.
- **R28:** cadence 4h -> 2h; per-mission codex/claude-agent alternation; dead-mission recovery no longer waits on codex health for
  claude-agent tasks. The owner installed the timers by hand (the harness blocks me from installing systemd units).
- **R29:** short-video pipeline (local Kokoro voice, phoneme-timed captions, ffmpeg, loudness-normalized); the course; the plan was
  cross-reviewed by codex (reject -> fixed -> approve).
- **R30:** Antigravity as a third specialist; `ask-agents.js` (one agent answers, another reviews; verified both directions).
  `~/.gemini/antigravity-cli/settings.json` allows: read the vault, `cp`/`ls` commands, `read_url` on Google docs domains.
- **R31-32:** Veo provider (via the Antigravity-built `gemini-video` CLI) + zero-cost manual clip ingest + prompt packs;
  `gemini-video` auth now supports Application Default Credentials / `~/.gemini/veo-service-account.json`.
- **R33:** repo published; Phase 3 reorganization committed; executor stop-price fix applied; private alert topics; README,
  LICENSE, `docs/BUILT-WITH-CLAUDE.md`; git-identity fix.

## Strategy lesson (2026-09-23): demand, not agents, is the bottleneck
The owner asked why "an AI agent raised $30M" (Polsia) is possible when this project keeps hitting walls. Checked: the raise is
real (Fortune, Pulse 2.0), but it is a PLATFORM sold to ~7,600 customers ($49/mo + 20% of revenue); the "$10M ARR" is a 30-day
run-rate that includes one-off payments and customers' ad spend; churn is ~50% in month one, ~94% of the ~120,000 "companies"
created are abandoned, the best customer business earned ~$3-4k, Trustpilot 2.9/5. The money comes from selling "AI runs your
company" to hopeful founders, not from an agent autonomously earning. What transfers: distribution and a clear promise. Our
Apify products and the course share the same bottleneck (building is easy; getting people to want and pay is hard), so the
course only matters if it reaches buyers -- a landing page and an audience plan come before more content.

## Failed attempts and dead ends (do not repeat)
1. **More trading capital:** leveraged ETFs (CORRECTED 2026-09-26: buying them long with cash needs no margin; only margin/shorting/2x-4x buying power need $2,000. Real issues: daily-reset decay, unverified fractionability and cash-account settlement rules); Kraken Funded (mobile-only, no API); Velotrade (real
   API, suppressed Trustpilot, false "founded 2016"); Breakout (good legitimacy, bots reportedly banned); Amboras (no API).
2. **"Vyro" video key:** NO working key exists; the key labelled Vyro is an Opus.pro key (`OPUS_PRO_API_KEY`). An earlier "verified"
   claim was wrong (sent `Bearer undefined`; api.vyro.ai validates before auth).
3. **edge-tts for voice:** rejected (unofficial Microsoft endpoint = commercial ToS risk). Kokoro is used.
4. **Installing systemd units / Tailscale from the agent side:** the harness's auto-mode classifier denies it regardless of
   in-chat say-so. Prepare exact commands; the owner runs them.
5. **agy permissions:** only `~/.gemini/antigravity-cli/settings.json` counts (`read_file(<abs path>)`, `read_url(<host>)`,
   `command(<cmd>)`); a `.agents/settings.json` is ignored. `agy -p` won't read piped text (use stream-json). A denied tool ends
   the turn with a truncated SUCCESS; the engine now fails such runs loudly.
6. **False alarm on protected-paths:** looked stale against base ref b5c1146, but Round 27 had already remapped it.
7. **Kokoro speed:** int8 slower than fp32 here; only the `model-files-v1.1` export has the duration output needed for captions.
8. **`gemini-video auth login`** (agy's browser login for Veo): dead. It borrows the gcloud public OAuth client and Google answers
   `invalid_client`; Veo calls still return 429. A Pro subscription does not fund the Gemini API.
9. **Claude for Open Source program:** needs 500+ dependents / 100+ merged PRs elsewhere / 20+ external contributors / criticality
   0.4+ (official page); this repo has 0 stars and no dependents. Its form error "couldn't find any public repositories you've
   contributed to" was a git-identity problem (see Gotchas), now fixed, but eligibility is the real barrier.
10. **Claude Startups program:** credits need institutional equity funding; API credits, not Max. **Ambassadors:** API credits,
    needs a community track record. Neither gives a Max plan.

## Next steps
Owner-only (I must not do these):
1. **Subscribe the ntfy app** to the two private topics (values in `bus/secrets.local.json`).
2. **Power supply:** official 5.1V/3A USB-C for the Pi 4.
3. **Course launch (course is live):** set the 7-day refund policy and check payouts/verification for "Workforce" in the Whop
   dashboard; delete the unused Whop keys `apik_YmLY`, `apik_4x1J`, `apik_3yQ7` (pasted in chat; "Agentic work" is the one used).
   Connect social accounts in Opus.pro, or post the shorts by hand
   (`marketing/POSTING-CHECKLIST.md`). HN/Reddit posts must come from the owner (`marketing/AUDIENCE-PLAN.md`).
4. **Unblock AI video (worked out with agy + codex):** Google AI Pro includes $10/month of Google Cloud credits (Developer
   Program; redeem to a billing account; card needed); Veo 3.1 Lite ~$0.30 per 6s clip, so ~$10 covers the whole 30-scene batch.
   Link that billing to the AI Studio project (aistudio.google.com/plan_and_billing) or use Vertex with a service-account key at
   `~/.gemini/veo-service-account.json` + `gemini-video auth set-project <id>`; verify one clip, then
   `node bus/revenue/shorts-pipeline.js ~/AgentVault-products/courses/agentic-systems/marketing/shorts/0*.json --max-ai 30`.
   Free today: paste `marketing/veo-prompts/*.md` into the Gemini app, save clips as `media-in/<slug>/scene-N.mp4`, re-run.
5. **Claude Max:** the OSS program does not fit. Realistic routes: watch for Anthropic "Built with Claude" hackathons (top
   applicants got a month of Max 20x + credits; individuals welcome; none verified open on 2026-09-23), or fund Max ($100/mo for
   5x) from course revenue. Offered but not started: a weekly hackathon watch (alerts to the private ntfy topic) and a
   ready-to-submit pitch built from `docs/BUILT-WITH-CLAUDE.md`. A small installable tool (e.g. the starter kit as an npm package)
   is the only path to the OSS program and would take time.
6. Decide `docs/proposals/2026-09-23-executor-market-hours.md` (the executor submits entries into closed markets; the cancel is
   best-effort). Decide whether Antigravity joins C1's mission rotation. Optionally run the change gate over Rounds 27-33
   (protected paths were touched; the gate would say human-review-required). Optional: add a description to the GitHub repo page.
Agent-doable (ask first if it touches live systems):
7. Put `run-queue-daemon` under systemd (needs the owner to install the unit); that also picks up the new ntfy code.
8. Re-arm/whole-share sizing for stops: fractional stops are day-only, so a held position is unprotected overnight.
9. Count Antigravity calls in `dispatch-budget.js` (it only counts codex).
10. After the first shadow-score run, read `node bus/city/survive-shadow-score.js board`.
11. Host the landing page (GitHub Pages needs enabling in repo settings, or another host) once the Whop link exists. Parked: 3D city redesign in the-delegation/autopolis style; MCP servers list.

## 2026-09-26 to 09-29: C1 diagnosis + leveraged-ETF trend backtest -- fixes APPLIED, backtest run
Approved plan: `docs/proposals/2026-09-26-c1-leveraged-backtest-plan.md`. Diagnosis: `docs/C1-diagnosis-2026-09-26.md`.

**C1 live-code fixes: APPLIED 2026-09-29** (owner said "fix anything you can"; 2 independent reviews first; 161/161 tests
pass incl. 3 new proposed test files copied into `bus/tests/survive/`; `build-system-map.js --write` run). Patched:
`bus/city/survive-executor.js` (try/catch around submitOrder/getOrder -- the real wedge bug -- + entry-symbol allow-list
derived from the mission's shadow snapshot), `bus/city/survive-alpaca-live-client.js` (getOrderByClientOrderId, fetch
timeouts), `bus/deploy/pi/survive-supervisor.timer` (comment fix, cadence is really ~4h not 2h). Any error that isn't a
definite 4xx refusal now QUARANTINES C1 and sends a priority-5 ntfy (unknown order outcome -- could be a real unrecorded
fill). **If C1 alerts and quarantines: exits are blocked while quarantined and the SGOV position still has NO stop --
reconcile against the live Alpaca account promptly; find the unquarantine command in city-registry/city-lifecycle before
running it.** Originals are recoverable via `git diff`/`git show` (not committed). Known gap: `executeExit` has the same
try/catch gap as entry did; not yet patched (out of scope, noted in the proposal).

**Backtest: run, SUPERSEDED twice same day -- see `docs/RESEARCH-LOOP-STATUS.md` for the current, corrected result.**
`bus/fleet/lev-*.js`, `backtest-lev-trend.js` (registered; 35/35 + 161/161 pass). Alpaca free IEX history only starts
**2020-07-27**, so the original tune/test prereg (`lev-backtest-prereg.json` v1) was invalid and is archived
(`lev-backtest-prereg.v1-archived.json`). Stooq blocks scripts (bot check; do not bypass). Owner could not get a Tiingo
key, so a **descriptive-only** prereg v2 was built instead (fixed canonical configs, no tuning, verdict can only be
INCONCLUSIVE/FAIL, never PASS). Two wrong readings, both corrected same day by the research loop's own cycle 2:
(1) "moot for C1, can't even buy" -- WRONG, fractionability confirmed live 2026-09-29 (read-only `getAsset` check,
`docs/research/2026-09-29-fractionable-leveraged-etfs.md`); C1 already trades notional/fractional, not whole shares.
(2) "INCONCLUSIVE, both strategies beat their benchmarks" -- ALSO WRONG: `lev-backtest-engine.js`'s fractional sizing
silently ignored the $20 cap entirely (verified empirically: a $1000 account with cap=20 bought the full $1000), and
the first fix attempt then wrongly capped the buy-and-hold BENCHMARK too. Both fixed 2026-09-29, 2 new regression tests
(35/35, each confirmed to fail against the pre-fix code in a scratch copy). **Corrected result: FAIL** -- S1 (200d
trend) and S2 (10%-trailing fast exit) on QQQ->TQQQ both beat TQQQ buy-and-hold on drawdown/Calmar but do NOT beat
plain buy-and-hold QQQ on after-cost CAGR (13.9%/15.2% vs 15.5%) once sizing correctly reflects C1's real $20 cap
against a correctly-uncapped benchmark. TIINGO_API_KEY is still not set. `bus/lib/locations.json` was regenerated by
`build-system-map.js` (protected path).

## 2026-09-29: autonomous research loop is RUNNING -- do not re-derive strategy conclusions from memory
The loop (see next section) is mid-cycle and actively re-testing/correcting findings; a NEW session should read
`docs/RESEARCH-LOOP-STATUS.md` first for the current bottom line before trusting anything about the leveraged-ETF
backtest written elsewhere in this file, including the paragraph directly above (kept for the audit trail of what was
wrong and why, not as the current answer).

## 2026-09-29: autonomous research/revenue loop started -- READ THIS IN A NEW CHAT
Owner directive (2026-09-29, verbatim intent): revenue from this trading pipeline IS the goal, keep finding paths to it,
do not report a dead end as final. "you will act as me, and you will create agents that act like you, you prompt the
agents ... they give plans that are tested ... you give them the go ahead to execute the plan, this cycle can run
indefinitely while I work on other things."

**What this is:** a `/loop` (dynamic, self-paced) running in THIS Claude Code session. Each cycle: read this file +
`docs/DECISIONS.md` + `bus/fleet/data/research-loop-log.jsonl` (history), pick one rotating angle (new instrument/venue
to dodge the $20-cap problem; a new strategy family for `bus/fleet/lev-backtest-engine.js`; a free data source that
doesn't need a signup, since the owner couldn't get a `TIINGO_API_KEY`; an engineering fix to C1; or productizing this
backtest/agent pipeline itself, separate from the course), spawn a planner subagent on it, cross-review anything
nontrivial (antigravity + claude-agent, not codex), build+test what's approved, log the cycle, self-pace the next wake.

**Hard boundary, unchanged:** live orders and protected-file edits (`bus/protected-paths.json`) still go through the
owner as proposals -- this loop does not weaken that rule, it just runs the research/build/test part unsupervised.

**Now two loops (2026-09-29, owner-approved plan `/home/subwaycheese/.claude/plans/inherited-crunching-emerson.md`):**
- **Cloud routine (durable):** `trig_01JMgBjoMcLdiBHEjdFXevU7`, daily 7:17 AM PDT (`17 14 * * *` UTC), claude-sonnet-5,
  no connectors (creating with an empty list still auto-attached all six; `clear_mcp_connections: true` fixed it --
  re-check with RemoteTrigger `get` after any update). Pause/delete: https://claude.ai/code/routines/trig_01JMgBjoMcLdiBHEjdFXevU7.
  It takes the first unfinished item from the 'Cloud queue' in `docs/RESEARCH-LOOP-STATUS.md` on the GitHub copy
  (origin/master once PR `cloud-sync-2026-09-29` is merged, that branch until then), has no secrets, cannot fetch
  arbitrary HTTPS or push, and reports a diff + log line in its transcript and a phone notification. Probe facts and the
  full prompt: `docs/proposals/2026-09-29-cloud-research-routine.md`.
- **Local /loop (this Pi, session-only: stops if the terminal closes):** fresh data (it has the keys), the one-shot
  out-of-sample test, and applying cloud runs: read them with RemoteTrigger `list_runs`/`get_run_log`, re-verify, apply
  unprotected changes (bus/fleet, docs) only after tests pass here; anything touching bus/city/ or protected paths goes
  to the owner as a proposal. Pushes go to the PR branch only, from a `git clone --no-hardlinks` throwaway, never master.
  If this loop is not running, nothing applies the cloud's output -- a new session should read the latest runs first.

**To pick this up cold in a new chat:** read `docs/RESEARCH-LOOP-STATUS.md` (30-second status) and
`bus/fleet/data/research-loop-log.jsonl` (one JSON line per cycle), then list the cloud routine's recent runs.

## Gotchas and rules that matter
- **Several chats talking to each other:** how to open a chat in tmux the owner can attach to, message it, and run a 3-way
  discussion is in `docs/MULTI-SESSION.md` (verified 2026-09-24). Only touch sessions the owner names.
- **Hard rules are in `AGENTS.md`:** never `git checkout/switch/reset --hard/clean/commit -a/add -A` in this tree (it holds live
  files); stage explicit paths only and check `git diff --cached --stat`; never print or commit secrets; real-money and outward
  actions are the owner's; no fabricated results; big builds = plan -> independent (codex) review -> build.
- **Git identity:** this Pi's config says `agent-comms <agent-comms@localhost>`, which GitHub cannot map to any account, so the
  first 109 commits credit nobody. Commit as the owner: `git -c user.name=SubwayCheese -c
  user.email=70560270+SubwayCheese@users.noreply.github.com commit ...`. Re-attributing old commits would need a history rewrite
  and force push (owner's call). Pushing to `origin` is publishing on the owner's account: get a clear go-ahead, and audit first.
- **Publishing audit that was done (repeat it before any push):** all history + staged files against the values in
  `bus/secrets.local.json` and key patterns; emails, private IPs. `bus/city/` etc. are committed; runtime state, logs, `tasks/`
  files and vault notes are intentionally untracked (`git status` shows ~700 `??`).
- **Verify before claiming:** several confident claims this session were wrong (the Vyro key, protected-paths, agy's "video works",
  a stop-price patch that compared against the wrong price). Read the code, run it, have another model check it.
- Queue-daemon quirk: a failed task whose text contains "429"/"quota" is treated as rate-limited and requeued 15 min later;
  neutralize such tasks by setting `to: claude` in the task file.
- The harness blocks or auto-denies some actions in unattended mode (systemd installs, network installs); do not route around it.
- Memory index: `~/.claude/projects/-home-subwaycheese/memory/MEMORY.md` (auto-loaded). Resume the last session with
  `claude --resume 2a30f474-b678-4563-8cbd-e8b610c05697` from `/home/subwaycheese` if the transcript is needed.
