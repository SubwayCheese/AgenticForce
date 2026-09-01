# Unverified Entry Template (lighter-weight, added 2026-08-31)

For entries produced by the background research crew
(bus/scripts/run-research-crew.js). These land in /tasks/UNVERIFIED_Cl/,
one file per entry.

**`unverified_new` is not the same as `unverified`.** `unverified` (see
task_template.md) means a task WAS submitted to the shape-verification
gate and FAILED it. `unverified_new` means an entry was never submitted
for verification at all, by design -- it's raw crew output, sitting in a
queue for deliberate human review. Nothing here should be treated as
checked or trusted until reviewed.

The SOURCE-tagging rule is NOT relaxed for this lighter format -- every
entry still requires a real `source:` line, exactly as strict as a normal
task's mandatory SOURCE tag. An entry with no source line is a bug, not a
valid unverified_new entry.

## [entry_id]
from: codex | claude
to: research-crew
type: response
status: unverified_new
topic: <ticker or category this entry is about>
timestamp: <ISO 8601>
source: <the exact SOURCE tag line from a Codex response, OR an FMP
  citation in the same style as other orchestrator-sourced tasks>
summary: <one line, human-scannable, what this entry actually says>

## Result (auto)
output:
```
<full captured text -- the complete Codex response or fetched data>
```
