# HANDOFF -- read this first in a new session

Written 2026-09-23 ~09:45 PDT at the end of a long session. This repo already has a vault of context, so this file
is a pointer-heavy briefing: it says what to read, where we stopped, and what is unsafe. It does not repeat
`AGENTS.md` (rules, commands), `docs/DECISIONS.md` (every decision and why, newest at the BOTTOM despite its header)
or `docs/SYSTEM-MAP.md` (generated map). Read `AGENTS.md` before doing anything.

## Goal
Growth of the AgentVault project, in the owner's stated priority order (memory: `project_survive_city_goals.md`):
real growth potential first; funding a Claude Max plan from real profit is a standing goal; the 3D city is a
proof-of-life tool, not a priority. On 2026-09-22 we concluded **trading is capital-capped** (C1 has $50, and every
route to more trading capital -- leverage, Kraken Funded, Velotrade, Breakout, Amboras -- failed on API access or
trust), so **new effort goes to general revenue**. First bet: a course, "Agents That Run Themselves", marketed with
short AI-voiced videos. C1 keeps running as the proof-of-concept.

## Current state (verified 2026-09-23 09:41 PDT)
- **C1 (real-money agent, live Alpaca, $50):** running unattended. `survive-supervisor.timer` fires every 2h (Round 28);
  missions alternate codex (odd) / claude-agent (even). **As of 2026-09-23 ~11:15 PDT C1 HOLDS a real position: SGOV
  0.198672205 sh, entered by mission010 at $100.618 (cash $30, equity ~$49.99).** The executor's protective stop FAILED
  (422: it used the entry bid as the stop price) so a day stop at $100.11 (order f1003f1a..., logged as
  `manual-delegated-by-owner`) was placed by hand on the owner's delegation; it EXPIRES at the 13:00 PDT close (Alpaca only
  allows day stops on fractional qty) -- overnight the position has no stop. Mission011 (13:01 wake, after the close) will
  evaluate hold/exit. Earlier: 007 no-action; 008 (first claude-agent mission) limit entry into a closed market, canceled;
  009 no-action. **Fix APPLIED (Round 33):** `resolveStopPrice` in `survive-executor.js` (35 tests in `bus/tests/survive/stop-price.test.js`;
  record in `docs/proposals/2026-09-23-executor-stop-price.md`). Watch the first entry after it to confirm the stop lands. Check live state read-only with
  `bus/city/survive-alpaca-live-client.js` and `bus/survive-supervisor.log`.
- **Timers (user systemd):** supervisor (2h), `market-scan-cycle` (daily 09:00), `survive-shadow-score` (daily
  16:30 PDT; first run due today -- it scores past decisions against real prices, C1's "learning" data).
- **Queue daemon:** running as a hand-started process (PID from Sept 20), NOT under systemd. A Pi reboot would
  silently stop C1's pipeline.
- **Video:** `gemini-video` (Veo) CLI/MCP installed by Antigravity, wired into `video-providers.js` (Round 31); returns
  429 until billing is linked. Local-visuals versions of the 6 shorts already exist and are usable as-is.
- **Codex:** healthy. **Antigravity `agy` 1.2.9:** installed, wired as a third text specialist (see Changes).
- **Pi hardware:** Raspberry Pi 4, `get_throttled = 0x50005` -- under-voltage continuously since Sept 20 (bad power
  supply). C1's live state is on this SD card.
- **Course + shorts:** all built and committed; nothing published. 6 videos rendered in
  `~/AgentVault-products/courses/agentic-systems/media/` (git-ignored).
- **GitHub:** repo is public at github.com/SubwayCheese/AgenticForce and current as of Round 33 (README, MIT LICENSE, full
  domain layout). The course repo `AgentVault-products` is deliberately NOT published (it is the product). Alert topics are
  private: subscribe the ntfy app to the values of `NTFY_TOPIC_AGENTVAULTSURVIVE` / `NTFY_TOPIC_CLAUDETEAM` in
  `bus/secrets.local.json`. The queue daemon still uses the old ntfy code until restarted.
- **Tests:** `node bus/platform/run-survive-tests.js` = 119 passed. Both repos committed (city repo HEAD `1c3678e`; products repo `3fff4e5`).

## Active field (where work was happening)
- `~/AgentVault-products/courses/agentic-systems/` (course, starter, whop/, marketing/, PLAN.md)
- `bus/revenue/shorts-pipeline.js`, `video-providers.js`; `bus/platform/agent-engine.js`, `agents/antigravity.json`,
  `ask-agents.js`; `bus/city/survive-supervisor.js` (Rounds 27-28).
- Note: the working directory of some sessions was `~/AgentVault-products`; the city repo is `~/AgentVault`.

## Changes made (this session; details in DECISIONS.md rounds 27-31)
- **R27:** C1's candidate universe widened by a daily web-search "market scan" (cache read on the fast path, never a
  live dispatch); shadow-score now scores scanned symbols; live rehearsal caught a negative-spread bug (fixed + test).
- **R28:** mission cadence 4h -> 2h; per-mission agent alternation codex/claude-agent; dead-mission recovery no
  longer waits on codex health for claude-agent tasks. Owner installed the three timers by hand (the harness blocks
  me from installing systemd units -- see Gotchas).
- **R29:** short-video pipeline (`shorts-pipeline.js` + `video-providers.js`: local Kokoro voice, phoneme-timed
  captions, ffmpeg visuals, loudness-normalized, 2-core cap); course "Agents That Run Themselves" (9 lessons,
  runnable starter with 6 tests, Whop listing/SETUP, 6 short scripts, captions, posts, posting checklist, asset
  LICENSES). Plan was cross-reviewed by codex (reject -> fixed -> approve).
- **R30:** Antigravity as a third specialist (`to: antigravity`); `ask-agents.js` for agent-to-agent Q&A + review
  (verified both directions). `~/.gemini/antigravity-cli/settings.json` now allows ONLY
  `read_file(/home/subwaycheese/AgentVault)` (backup `settings.json.bak-2026-09-23`).
- **R31:** Veo video provider wired in via the Antigravity-built `gemini-video` CLI; per-scene prompts added; blocked on
  Gemini API billing (429 on the free tier).
- Also: AGENTS.md corrected (city is LIVE), protected-paths cleanup found unnecessary (see Failed attempts #6).

## Failed attempts and dead ends (do not repeat)
1. **More trading capital:** leveraged ETFs (needs $2,000 margin; decay); Kraken Funded (mobile-only, no API);
   Velotrade (real API but suppressed Trustpilot, false "founded 2016"); Breakout (good legitimacy, but sources say
   its terminal bans bots/EAs -- unconfirmed); Amboras (no API). Don't re-research; ask before reopening.
2. **AI video via "Vyro":** (superseded by Veo, Round 31) there is NO working Vyro key. The key the owner labelled Vyro is an Opus.pro key
   (`OPUS_PRO_API_KEY`); `VYRO_API_KEY` was never saved. An earlier "verified" claim was wrong (sent `Bearer
   undefined`; api.vyro.ai validates the request before auth). Shorts therefore use local ffmpeg visuals.
3. **edge-tts for voice:** rejected (unofficial Microsoft endpoint = commercial ToS risk). Kokoro is used.
4. **Installing systemd units / Tailscale from the agent side:** the harness's auto-mode classifier denies it
   ([Production Deploy], [Unauthorized Persistence]) regardless of owner say-so in chat. Prepare exact commands; the
   owner runs them. Do not try to route around it.
5. **agy permissions:** a `.agents/settings.json` in the working dir is ignored; bare `read_file` rules don't match;
   only `~/.gemini/antigravity-cli/settings.json` with `read_file(<abs path>)` works. `agy -p` won't read piped text
   (use stream-json). A denied tool returns status SUCCESS with an empty answer.
6. **False alarm on protected-paths:** looked stale against base ref b5c1146, but Round 27's commit had already
   remapped it. Only 38 inert `bus/scripts/*` entries remain (cosmetic).
7. **Kokoro speed:** int8 model was slower than fp32 on this Pi; only the `model-files-v1.1` export has the
   `duration` output needed for caption timing. Renders run ~11 min per 27s video on 2 cores.

8. **`gemini-video auth login` (agy's browser-login for Veo):** does not work as claimed. It borrows the Google Cloud
   SDK's public OAuth client for a device flow; Google answers `invalid_client: Invalid client type` (tested
   2026-09-23; nothing was linked or stored), and real Veo generate calls still return 429. Its docstring claim that a
   Gemini Advanced/AI Pro subscription raises API quota is unverified and contradicted by the 429 -- consumer
   subscriptions do not fund the Gemini API. Only billing on the API key's project (or a Vertex project) unlocks Veo.

## Next steps
Owner-only (I must not do these):
1. **Power supply:** official 5.1V/3A USB-C for the Pi 4.
2. **Decide** `docs/proposals/2026-09-23-executor-market-hours.md` (executor submits entries into closed markets; cancel is best-effort). `survive-executor.js` is protected -- never edit it unilaterally.
3. **Course launch:** watch the 6 shorts; create/price the Whop product (`courses/agentic-systems/whop/SETUP.md`);
   post with each platform's AI-disclosure toggle on (`marketing/POSTING-CHECKLIST.md`). Verify the suggested price
   against real market data first (it is an estimate).
4. **Unblock AI video (worked out with agy + codex, Round 32).** Your Google AI Pro plan includes **$10/month of Google Cloud
   credits** (redeem via the Google Developer Program: developers.google.com/profile/help/benefits, apply to a billing
   account); Veo 3.1 Lite is ~$0.30 per 6s clip, so $10 ~ the whole 30-scene batch. A card on the billing account is
   still needed. Then EITHER link that billing to your AI Studio project (aistudio.google.com/plan_and_billing; the existing
   key then works) OR use Vertex: put a service-account key at `~/.gemini/veo-service-account.json` and run
   `gemini-video auth set-project <project-id>`. Verify with one clip, then run
   `node bus/revenue/shorts-pipeline.js ~/AgentVault-products/courses/agentic-systems/marketing/shorts/0*.json --max-ai 30`.
   **Works today with no setup (zero cost):** paste the prompts in `marketing/veo-prompts/*.md` into the Gemini app / Flow, save
   clips as `media-in/<slug>/scene-N.mp4`, re-run the pipeline (any missing scene falls back).
5. Decide whether Antigravity joins C1's mission rotation, and whether to run the change gate on Rounds 27-31
   (protected paths were touched; gate would say human-review-required).
Agent-doable (ask first if it touches live systems):
6. Put `run-queue-daemon` under systemd (needs the owner to install the unit).
7. Count Antigravity calls in `dispatch-budget.js` (it only counts codex today).
8. After the first shadow-score run, read the scoreboard (`node bus/city/survive-shadow-score.js board`).
9. Ideas parked, not started: redesign `survive-city-3d.html` in the-delegation/autopolis style; Kraken/Breakout
   only if a bot-friendly, legit prop firm appears; MCP servers list (awesome-mcp-servers) for future integrations.

## Gotchas and rules that matter
- Hard rules are in `AGENTS.md`: never `git checkout/switch/reset --hard/clean/commit -a/add -A` in this tree; stage
  explicit paths only; never print/commit secrets (`bus/secrets.local.json`, gitignored); real-money and outward
  actions are the owner's; no fabricated results; big builds = plan -> independent (codex) review -> build.
- `bus/city/` is largely untracked by git for historical reasons; `git status` is very noisy (Phase 3 drift). Only
  ever `git add` exact paths, and check `git diff --cached --stat` before committing.
- Verify before claiming: two of my own confident claims this session were wrong (Vyro key, protected-paths).
- Codex sandbox reads are read-only, so its review may mis-report test failures.
- Memory index: `~/.claude/projects/-home-subwaycheese/memory/MEMORY.md` (auto-loaded); resume the old session with
  `claude --resume de42de84-1203-4b97-a413-7597b9815bfc` from `/home/subwaycheese` if the full transcript is needed.
