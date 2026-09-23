# HANDOFF -- read this first in a new session

Last refreshed 2026-09-23 ~12:10 PDT. This repo already has a vault of context, so this file is a pointer-heavy briefing:
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

## Current state (verified 2026-09-23 ~12:05 PDT)
- **C1 (live Alpaca, $50 account):** running unattended, `survive-supervisor.timer` every 2h (Round 28), missions alternate
  codex (odd) / claude-agent (even). **It HOLDS a real position: SGOV 0.198672205 sh, entered at $100.618 by mission010
  (cash $30, equity ~$49.99).** The executor's own stop failed (it used the entry bid as the stop; 422). A day stop at
  $100.11 was placed by hand on the owner's delegation and **expires at the 13:00 PDT close** (Alpaca allows only day stops
  on fractional qty), so overnight the position has no stop. Next wake 13:01 PDT (mission011, after the close) will judge
  hold/exit. The executor stop bug is FIXED (Round 33, `resolveStopPrice`, 35 tests) and takes effect on C1's next entry --
  **watch that entry's stop lands.** History: 007 no-action; 008 (first claude-agent mission) limit entry into a closed market,
  canceled, no money moved; 009 no-action; 010 entered SGOV. Check read-only: `bus/survive-supervisor.log` and
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
- **Course + shorts:** built and committed, nothing published or priced. 9 lessons (~6,000 words), a runnable starter (6
  tests), Whop listing + owner SETUP, 6 rendered vertical shorts (`media/`, git-ignored), captions, posts, posting checklist.
  Gaps: no Whop product exists, nothing posted, no landing page, no video lessons, demand and price unvalidated.
- **AI video:** blocked on Google billing (see Next steps #4). The shorts use local ffmpeg text-card visuals and are usable as-is.
- **Agents:** Codex healthy; Claude headless (`to: claude-agent`); Antigravity `agy` 1.2.9 wired as a third text specialist.
- **Tests:** `node bus/platform/run-survive-tests.js` = 119 passed. City repo HEAD is pushed; products repo is local only.

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

## Failed attempts and dead ends (do not repeat)
1. **More trading capital:** leveraged ETFs (needs $2,000 margin; decay); Kraken Funded (mobile-only, no API); Velotrade (real
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
3. **Course launch:** create/price the Whop product (`courses/agentic-systems/whop/SETUP.md`; check comparable prices first),
   watch the 6 shorts, post with each platform's AI-disclosure toggle on (`marketing/POSTING-CHECKLIST.md`).
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
11. Course landing page (once a Whop link exists). Parked: 3D city redesign in the-delegation/autopolis style; MCP servers list.

## Gotchas and rules that matter
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
