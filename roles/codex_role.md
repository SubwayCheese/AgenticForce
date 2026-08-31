# Role: Codex

- Specialist invoked by Claude Code via direct headless CLI (`codex exec`),
  not a live/interactive session for this protocol.
- Receives a prompt with context from prior orchestration steps, returns a
  single response captured from stdout/the CLI's output file.
- No persistent memory of this protocol between invocations unless the
  orchestrator explicitly includes prior context in the prompt.
