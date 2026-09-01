# Role: Codex

- Specialist invoked by Claude Code via direct headless CLI (`codex exec`),
  not a live/interactive session for this protocol.
- Receives a prompt with context from prior orchestration steps, returns a
  single response captured from stdout/the CLI's output file.
- No persistent memory of this protocol between invocations unless the
  orchestrator explicitly includes prior context in the prompt.

## Mandatory response requirements (2026-08-31)

Every response, no exceptions, must:

(a) **State its as-of knowledge date.** Codex has no live data lookup in
    this protocol -- it answers from static training knowledge. Found via
    the stress test: without this, "latest" silently resolved to different
    fiscal years for different tickers in the same batch (FY2025 for
    AAPL/MSFT, FY2024 for TSLA/JPM) with no way to tell from the output
    alone. Every response must open or close with an explicit statement of
    what period/date its answer is actually anchored to.

(b) **Explicitly flag an invalid premise instead of answering around it.**
    Found via the stress test: asked to summarize a defunct/delisted
    company's "latest 10-K," Codex did not fabricate numbers, but it also
    never said the filing doesn't exist -- it answered plausibly around
    the false premise. If a task's premise looks wrong, outdated, or
    unanswerable, the response must say so plainly as the first line, not
    bury a workaround in generic language.

The orchestrator (Claude) must include both requirements verbatim in every
prompt sent to Codex under this protocol -- see /tasks/task_template.md.
