## schedule_website_team_plan
from: claude
to: codex
type: request
status: done
payload: You are being asked to PLAN a new project -- do NOT write any files, create any directories, or run any build/scaffolding commands yet. This is a planning-only pass; the plan you produce will be reviewed by the orchestrating Claude Code session (not a human directly) before anything gets built.

The project: an interactive schedule and task-managing website, to be built by a small team of AI specialists working through this vault's existing /bus/ task-dispatch protocol. Read tasks/task_template.md and ARCHITECTURE.md in this vault first if you need to understand that protocol (task files under tasks/, dependsOnTaskId(s) for chaining one task's output into the next, `to: codex` / `to: claude-agent` for routing, a verification gate on every dispatch).

A hard technical constraint you must respect in your plan: your own sandboxed write access (when later dispatched in write mode) is scoped ONLY to this vault directory -- nothing outside it is writable. So the new project MUST live inside this vault, as a new subfolder.

Produce a written plan covering, in order:
1. Proposed project location -- an exact relative path for a new folder under this vault (e.g. something like projects/schedule-app/).
2. Proposed tech stack. This vault's own existing tools (bus/dashboard.html, bus/agents.html) are hand-written HTML/CSS/vanilla JS served by a small zero-dependency Node http server -- a similar minimal-dependency philosophy is preferred if reasonable for an interactive app, but you may propose something else if you think it's genuinely a better fit -- state your reasoning either way.
3. A concrete feature set for an interactive schedule/task-managing website, scoped for a personal single-user tool (not an enterprise multi-tenant SaaS): what views/pages, what a task or scheduled item actually looks like, how persistence works, etc.
4. A team-based implementation plan. There are exactly two dispatched specialists available through /bus/ today: you (Codex, routed `to: codex`) and a second specialist called claude-agent (Claude, routed `to: claude-agent`). Propose how the actual build would be divided into a concrete sequence of /bus/ task dispatches between the two of you -- who does the data model, who does the frontend, who does the backend, in what order, with what dependencies between steps -- concretely enough that each phase could become a real task file with a real payload.
5. Any real risks, open questions, or things you're unsure about.

Do not pad this with generic disclaimers -- give your actual best plan.
timestamp: 2026-09-03T07:00:00Z

## Result (auto)
resolved_at: 2026-09-03T19:07:36.865Z
output:
```
SOURCE: verified live via direct file read in this pipeline  
As of: `tasks/task_template.md` and `ARCHITECTURE.md`, read 2026-09-03.

1. Proposed location

`projects/schedule-app/`

This keeps all future source, runtime data, and documentation inside the writable vault scope.

2. Proposed tech stack

Use a zero-dependency Node.js HTTP server with hand-written HTML, CSS, and vanilla JavaScript, matching the vault’s existing dashboard tools.

- Backend: Node built-in `http`, `fs`, and `path`.
- Frontend: static HTML/CSS/ES-module JavaScript; no framework or build step.
- Persistence: a single JSON data file under `projects/schedule-app/data/`, written atomically by the server.
- Testing: Node built-in test/assert scripts, plus manual browser verification.

This is a personal, local-first application with modest UI complexity. A framework/database would add tooling and deployment overhead without a clear payoff. The server should be the only writer of the JSON file, avoiding browser-side file-access limitations and keeping persistence portable.

3. Feature set

Single-page app with these primary views:

- Today: chronological agenda, overdue tasks, unscheduled task inbox, and a “next up” focus section.
- Week: seven-column calendar with scheduled task blocks and all-day items.
- Tasks: filterable list by status, due date, project/tag, and priority.
- Schedule editor: create/edit a scheduled item or drag tasks onto a calendar slot.
- Settings/data: export/import JSON and optional reset confirmation.

A task should include:

```json
{
  "id": "task_...",
  "title": "Prepare meeting notes",
  "notes": "",
  "status": "inbox | todo | in_progress | done | canceled",
  "priority": "none | low | medium | high",
  "dueDate": "YYYY-MM-DD | null",
  "scheduledStart": "ISO datetime | null",
  "scheduledEnd": "ISO datetime | null",
  "estimatedMinutes": 30,
  "project": "Personal",
  "tags": ["admin"],
  "recurrence": null,
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime",
  "completedAt": "ISO datetime | null"
}
```

Scheduled items can be tasks with start/end times, plus lightweight calendar events represented by the same model with `kind: "event"` and no completion workflow. Initial scope should include create/edit/delete, completion, rescheduling, basic drag/drop, filtering, and JSON import/export. Recurrence, notifications, syncing, authentication, and collaboration should be explicitly deferred.

Persistence endpoint surface:

- `GET /api/state`
- `PUT /api/state` with schema validation and atomic write
- Static-file serving for the app

4. Dispatch sequence

Every task below should be a real `tasks/<task_id>.md` dispatch, use `to: codex` or `to: claude-agent`, include explicit acceptance criteria in `payload`, and receive the bus verification gate before becoming `done`. Write-enabled implementation tasks should use supervised `run-task-generic.js --write`; dependency-based planning/review tasks can use normal read-only dispatch.

| Order | Task ID / routed specialist | Concrete deliverable | Dependency |
|---|---|---|---|
| 1 | `schedule_app_product_spec` → `claude-agent` | Product/UI specification: interactions, scope boundaries, acceptance criteria, and page layout. | None |
| 2 | `schedule_app_architecture` → `codex` | File layout, API contract, JSON schema, validation rules, atomic persistence approach, test plan. | `schedule_app_product_spec` |
| 3 | `schedule_app_foundation` → `codex` | Create `projects/schedule-app/`; implement server, static shell, schema/state utilities, seed data, and API persistence tests. | `schedule_app_architecture` |
| 4 | `schedule_app_ui_implementation` → `claude-agent` | Build the responsive frontend: Today, Week, Tasks, editor, filtering, and API integration against the agreed contract. | `schedule_app_foundation` |
| 5 | `schedule_app_interactions` → `codex` | Add drag/drop scheduling, task completion/reschedule behavior, import/export, and server-side validation/error handling. | `schedule_app_ui_implementation` |
| 6 | `schedule_app_review` → `claude-agent` | Read-only peer review: inspect implementation against the spec, identify concrete defects and prioritized fixes. | `schedule_app_interactions` |
| 7 | `schedule_app_hardening` → `codex` | Apply accepted review fixes; add regression tests and verify persistence, malformed-input handling, and browser flows. | `schedule_app_review` |
| 8 | `schedule_app_acceptance` → `claude-agent` | Final read-only acceptance pass with exact run instructions and a pass/fail checklist. | `schedule_app_hardening` |

The handoff tasks should use `dependsOnTaskId` so output is injected from the preceding step rather than copied manually. If the product spec and architecture are deliberately split into independent proposals, use a later fan-in task with `dependsOnTaskIds` to reconcile them before implementation.

5. Risks and open questions

- JSON-file persistence is appropriate for one local user but not concurrent writers or multi-device sync.
- Drag/drop calendar behavior is the highest UI-complexity area; begin with deterministic click-to-schedule fallback if browser drag behavior proves fragile.
- Time zones and DST need a defined local-time policy; store ISO timestamps and render in the browser’s local timezone.
- The server needs an explicit start command and a clear choice of default port.
- Import should validate the full payload before replacing saved state and preserve a recoverable backup during implementation.
- The project is local-only unless the team later decides to add authentication and remote hosting; those are out of scope for this first build.
```
