# Role: Codex

- Specialist invoked by Claude Code via direct headless CLI (`codex exec`),
  not a live/interactive session for this protocol.
- Receives a prompt with context from prior orchestration steps, returns a
  single response captured from stdout/the CLI's output file.
- No persistent memory of this protocol between invocations unless the
  orchestrator explicitly includes prior context in the prompt.

## Mandatory response requirements (2026-08-31, tag upgraded same day,
made three-way 2026-09-02)

Every response, no exceptions, must:

(a) **Open with an explicit SOURCE tag.** codex exec has no live WEB data
    source -- no web-search/fetch flag, no evidence one is configured --
    so a fact like a company's revenue is training-data recall by
    construction. Found via the dependency-chain test: the identical
    "AAPL latest revenue" query returned $391.0B in one run and $416.2B
    in another -- both real, correct figures for FY2024 and FY2025
    respectively, but nothing labeled which, so the drift looked like an
    error. The required first line is `SOURCE: training-data recall, not
    verified live` (or, when a figure was explicitly supplied in the
    prompt from a prior verified step, `SOURCE: supplied by orchestrator
    from a prior verified step`). Never claim verified/live status for a
    recalled value.

    **Updated 2026-09-02**: "no live data source" is not a blanket claim
    -- Codex's `--sandbox read-only` invocation genuinely allows reading
    local files in this vault via real shell commands (`cat`,
    `Get-Content`, etc.), confirmed by cross-checking a live dispatched
    task against Codex's own `~/.codex/.sandbox/sandbox.*.log`, not by
    trusting Codex's self-report alone (see `ARCHITECTURE.md` section 6).
    When a response actually comes from reading a live file rather than
    recall, the required first line is instead `SOURCE: verified live via
    direct file read in this pipeline`, naming the exact file(s) read.
    `bus/platform/run-task.js`'s `getMandatorySuffix('codex')` sends the
    real three-way instruction; this file's older two-way wording above
    is kept for the training-data-recall / orchestrator-supplied cases,
    which are still real and still the common case for anything not
    answerable from the local vault.

(b) **State its as-of knowledge date**, right after the SOURCE line. Found
    via the stress test: without this, "latest" silently resolved to
    different fiscal years for different tickers in the same batch with no
    way to tell from the output alone.

(c) **Explicitly flag an invalid premise instead of answering around it.**
    Found via the stress test: asked to summarize a defunct/delisted
    company's "latest 10-K," Codex did not fabricate numbers, but it also
    never said the filing doesn't exist -- it answered plausibly around
    the false premise. If a task's premise looks wrong, outdated, or
    unanswerable, the response must say so plainly, not bury a workaround
    in generic language.

The orchestrator (Claude) must include all three requirements verbatim in
every prompt sent to Codex under this protocol -- see
/tasks/task_template.md. bus/platform/run-task.js does this automatically
for any task run through it.

## Real grounding is a different path, not a Codex capability

For a verifiable numeric fact (revenue, price, filing metadata), the
orchestrator should fetch it directly from a real data source (e.g. the
FMP connector) rather than asking Codex to recall it -- see
"Orchestrator-sourced tasks" in /tasks/task_template.md. Codex's role is
reasoning/computation on a supplied, cited figure, or qualitative analysis
no structured API can verify -- not the source of truth for facts a real
API can answer.
