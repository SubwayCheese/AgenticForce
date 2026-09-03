## schedule_app_product_spec
from: claude
to: claude-agent
type: request
status: done
payload: This is step 1 of an approved 8-step plan to build an interactive schedule/task-managing website inside this vault, at projects/schedule-app/ (see tasks/schedule_website_team_plan.md for the full approved plan if you want the complete context -- you have read access to this vault). You are NOT writing any code or files in this task -- this is a product/UI specification pass only. Your output becomes the input other specialists build from.

Produce a concrete product/UI specification covering:

1. Page layout for each of the four views agreed in the plan: Today, Week, Tasks, and the Schedule editor. For each, describe the actual layout (what's in the header, what's in the main content area, what's persistent nav) at a level of detail a frontend implementer could work from directly -- not just a feature list.

2. Interaction details: how does a user create a task (from which view, what form fields, in what order)? How does drag-to-schedule actually work (drag a task from the inbox onto a Week-view time slot -- what does the drop target look like, what happens on drop)? How does marking something done work? How does editing an existing scheduled item work?

3. Explicit scope boundaries: restate what's IN scope for this first build (create/edit/delete, completion, rescheduling, basic drag/drop, filtering, JSON import/export) and what's explicitly OUT (recurrence, notifications, sync, auth, collaboration) -- and note any UI you should therefore NOT design for yet (e.g. no login screen, no multi-user anything).

4. Acceptance criteria: a concrete, checkable list of "this view/interaction is done when X" statements that a later review pass (step 6 of the plan) can actually verify against.

5. Visual style guidance: this vault already has two live pages with a deliberate, well-established dark-terminal aesthetic (IBM Plex Mono, near-black surface scale, hairline borders, restrained accent colors) -- bus/dashboard.html and bus/agents.html, both readable from this vault if you want a reference. Recommend whether this new app should match that visual identity or have its own -- your call, with reasoning.

Be concrete and specific -- this spec needs to be usable by the next specialist without them having to guess or invent missing details.
timestamp: 2026-09-03T19:20:00Z

## Result (auto)
resolved_at: 2026-09-03T19:24:07.117Z
output:
```
SOURCE: verified live via direct file read in this pipeline
Files read: `bus/dashboard.html`, `bus/agents.html`, `tasks/schedule_website_team_plan.md`, `tasks/schedule_app_product_spec.md` — read 2026-09-03.

As-of: current vault state, 2026-09-03. Note on premise: `tasks/schedule_app_product_spec.md` already shows one prior `status: pending` attempt at this exact task that was rejected by the verification gate for two reasons — it wrote its answer into a Claude Code plan file instead of the task response, and it omitted the mandatory SOURCE tag. This response is a direct replacement: the full specification below, with no plan-file indirection.

---

# Schedule App — Product/UI Specification (Step 1 of 8)

Baseline data model and API surface below are taken as given from the approved plan in `tasks/schedule_website_team_plan.md` (the `task_...` JSON shape, `GET/PUT /api/state`) — this spec does not redefine them, only how the UI exposes them.

## 0. Global shell (applies to all four views)

Single persistent top bar, present on every view, 56px tall:

- **Left**: app title `schedule` (13px, `--ink`), IBM Plex Mono, same weight/tracking as `dashboard.html`'s `h1`.
- **Center-left**: four nav tabs, plain text links styled like `.navlink` in `dashboard.html` (border hairline pill, `--dim` default, `--ink` + `--line-strong` border on hover/active): `Today` · `Week` · `Tasks`. (Schedule editor is **not** a fifth tab — see 1.4, it's a contextual overlay.)
- **Right**: a single `+ New Task` button (primary action, filled with a thin `--line-strong` border and `--ink` text — no bright fill, consistent with the existing restrained-accent aesthetic) and a small gear icon opening the Settings/Data panel (import/export JSON, reset) as a slide-over from the right. Settings/Data is in-scope (import/export) but is not one of the four views this spec details — it's one form: a file-picker for import, a "Download JSON" link for export, and a reset button behind a confirmation.
- Active tab indicated by `--amber` bottom border (2px), matching the amber-as-active-state convention already used for `.lane.active` in `dashboard.html`.
- No breadcrumbs, no search bar, no user/account menu (see Scope §3).

Below the top bar, each view renders full-width in a `max-width: 1100px` centered column (wider than `dashboard.html`'s 960px since Week needs 7 columns of real estate), `padding: 24px 30px`.

## 1. Page layouts

### 1.1 Today

**Header row** (below global top bar, inside content column): left side shows the current date in full (`Thursday, September 3, 2026`, 15px `--ink`) with a `subtitle`-style line under it showing counts, e.g. `3 overdue · 5 due today · 2 done`. Right side of this row: nothing extra — no view-specific controls needed.

**Main content**, top to bottom, three stacked sections (each its own `.panel`-style card — `--panel` background, 1px `--line` border, 5px radius, matching `dashboard.html`'s `.lane`/`.panel` treatment):

1. **Overdue** (only rendered if non-empty; card omitted entirely otherwise — no "0 overdue" empty state clutter). Each row: checkbox-style circle icon (unchecked ring) on the left, title, a small `--red` "3d overdue" tag on the right, due date under the title in `--dim-2`.
2. **Today's agenda** — chronological list of everything with a `scheduledStart` falling today, ordered by time. Each row: time on the left in a fixed-width column (`9:00 AM`), a vertical hairline divider, then title + project/tag chips, then a trailing checkbox circle. Rows for events (`kind: "event"`) render identically but with no checkbox, just a small calendar-glyph icon instead, since events have no completion workflow.
3. **Unscheduled inbox** — tasks with `status: "inbox"` or `"todo"` and no `scheduledStart`, in reverse-chronological creation order. Each row: title, project chip, and nothing else — this list exists to be **dragged from** into a Week slot (see §2.2) or scheduled via the editor. A "Schedule" link/icon on the far right of each row opens the Schedule editor overlay pre-filled with that task instead of requiring drag.

If all three sections are empty, show a single centered `--dim` line: `nothing scheduled today`.

### 1.2 Week

**Header row**: left shows the week range (`Sep 1 – Sep 7, 2026`) with `‹` `›` arrows to page weeks and a `Today` text-button to jump back to the current week. Right side: nothing else — no view toggles (day/month) in this first build.

**Main content**, two-region layout:

- **Left rail (fixed ~220px)**: the same "unscheduled inbox" list as Today §1.1.3, always visible here since it's the drag source for scheduling. Header label: `Inbox`. Same row treatment (title + project chip).
- **Right region (flex-fill)**: a 7-column grid, one column per day (`Mon`–`Sun` headers, each showing day number, today's column highlighted with a subtle `--panel-2` background tint), rows representing hourly time slots from 6 AM–10 PM (16 rows), each slot 40px tall with a 1px `--line` bottom border. Scheduled items render as absolutely-positioned blocks within their day column, top offset and height computed from `scheduledStart`/`scheduledEnd`, background `--panel-2` with a left 3px accent bar colored by project (see §5), title text truncated to fit, and a small time range label. All-day items (if `scheduledStart`/`scheduledEnd` are date-only with no time, or a future `allDay: true` flag — flag this as an open question for the architecture step since the current schema doesn't have one) render in a thin all-day row pinned above the hourly grid rather than in the timed area.
- Clicking an empty slot opens the Schedule editor overlay pre-filled with that day/time as a fallback to dragging (per the approved plan's risk note that drag/drop is the highest-complexity area and should have a deterministic click fallback).
- Clicking an existing block opens the Schedule editor overlay pre-filled with that item (edit mode).

### 1.3 Tasks

**Header row**: left shows `Tasks` with a live count (`24 tasks`). Right side holds the filter controls, inline, no separate filter panel: a status multi-select (chips: `Inbox` `To do` `In progress` `Done` `Canceled`, toggle on/off, `--teal` outline when active), a project dropdown, a priority dropdown, and a due-date range (`Any` / `Overdue` / `This week` / `No date`). Filters combine with AND logic. An active-filter count badge and a `Clear` text-link appear only when at least one filter is set.

**Main content**: a flat table/list (not grouped by default), columns: checkbox · title (with project + tag chips inline, truncated) · due date · priority (colored dot: `--red` high, `--amber` medium, `--dim` low/none) · status. Sortable by clicking column headers (due date and priority only — title/status sort add little value here and are skipped for v1). Row click (anywhere except the checkbox) opens the Schedule editor overlay in edit mode for that task. Checkbox click toggles completion in place without opening the editor (see §2.3). Empty state when filters match nothing: `--dim` centered line `no tasks match these filters`.

### 1.4 Schedule editor

Not a nav destination — a **right-side slide-over panel** (~420px wide, full viewport height, `--panel` background, `--line-strong` left border, sliding in over the current view with a semi-transparent scrim behind it that closes the panel on click). This is deliberate: it lets the editor be opened from Today, Week, or Tasks without a navigation round-trip, and matches the low-chrome, single-purpose-panel pattern already used for `agents.html`'s `.infopanel`.

Layout top to bottom:
- **Header**: `New Task` or the task title (edit mode) + a close `×` (top right, styled like `agents.html`'s `.infopanel .close`).
- **Form body**, fields in this exact order (see §2.1 for why this order):
  1. Title (single-line text input, autofocused, required)
  2. Project (dropdown, includes an inline "+ new project" option)
  3. Tags (free-text chip input, comma or Enter to add)
  4. Priority (segmented control: None / Low / Medium / High)
  5. Due date (date picker, optional)
  6. Schedule (start date+time, end date+time OR estimated-minutes duration toggle — picking a start + duration auto-computes end) — optional; leaving this blank keeps the task in the unscheduled inbox
  7. Notes (multi-line textarea, optional)
- **Footer** (sticky at panel bottom): `Save` (primary), `Delete` (only shown in edit mode, `--red` text, requires a second confirm click — click once to arm it for 3s showing `Confirm delete?`, click again to execute, or it auto-disarms), `Cancel`.

There is no separate "create" vs "edit" page — same panel, same field order, populated or empty.

## 2. Interaction details

### 2.1 Creating a task

Entry points: the global `+ New Task` button (any view), the Today inbox's implicit "add" (a `+ add task` row pinned at the bottom of the inbox list itself, not just the global button), or clicking an empty Week slot (which pre-fills schedule fields). In every case the same slide-over from §1.4 opens. Field order is title → classification (project/tags/priority) → time-bound fields (due date, then schedule) → free text (notes) last — this mirrors how a user actually thinks about a task (what is it → how do I categorize it → when → any extra detail), and keeps the two optional time fields (due date vs. scheduled time — a task can have either, both, or neither) adjacent so their relationship is visible. Saving with only a title filled is valid — everything else defaults (`status: "inbox"`, `priority: "none"`, dates `null`).

### 2.2 Drag-to-schedule

Source: any row in an "unscheduled inbox" list (Today §1.1.3 or Week's left rail §1.2). The row becomes `draggable`; on `dragstart` it gets a `dragging` class (reduce opacity to ~0.4, keep it in place in the source list — don't remove it until drop succeeds).

Drop target: the Week grid's hourly cells. On `dragover` over a valid cell, that cell (and only that cell — snapped to its 40px row = the nearest half-hour, since each hourly row should itself be visually divided at the 30-min mark by a fainter internal line to allow half-hour snapping) gets a highlight state: `--teal` 1px inset outline + a faint `--teal` tint background, showing exactly where the item will land, including a ghost preview of the block at its default duration (task's `estimatedMinutes`, or 30 min if unset).

On `drop`: the task's `scheduledStart` is set to that day/time, `scheduledEnd` computed from `estimatedMinutes` (default 30 min), a `PUT /api/state` fires, the ghost is replaced by the real rendered block, and the row is removed from the inbox list it came from. If the `PUT` fails, the block reverts and the row reappears in the inbox with a brief inline error (`--red` text: `couldn't save — try again`) — no modal, no toast stack.

Non-drag fallback (required per the approved plan's risk note): dragging is optional, never the only path. Every inbox row also has a `Schedule` icon/link (§1.1.3) that opens the editor overlay directly to the schedule fields, achieving the identical end state via form fields + Save instead of a drag gesture.

Existing scheduled blocks are also draggable within the Week grid to reschedule (same snap/highlight behavior), and this is a distinct interaction from creating — dragging an already-placed block just updates its times, it doesn't duplicate it.

### 2.3 Marking something done

A checkbox-style circle to the left of any task row (Today agenda, Tasks list) toggles completion directly, in place, with no confirmation and no navigation to the editor:
- Click → circle animates to a filled check (reuse `dashboard.html`'s `.check-mark` stroke-draw animation, `--green`) → `status` becomes `"done"`, `completedAt` set to now → row gets `opacity: 0.6` and title gets a strikethrough, matching `.lane.done` in `dashboard.html`.
- Click again on a done item → un-does completion (`status` reverts to `"todo"`, `completedAt` cleared) — no separate "reopen" affordance needed, the same control is the toggle.
- Events (`kind: "event"`) never show this control — they are not completable (§3).

### 2.4 Editing an existing scheduled item

Two entry points, same result: clicking a block in the Week grid, or clicking a row (outside its checkbox) in the Tasks list or Today agenda. Both open the §1.4 slide-over in edit mode, fields pre-populated from the item's current values. Saving does a full `PUT /api/state` with the updated item; canceling or clicking the scrim discards changes with no autosave/draft state — the form doesn't mutate the underlying task until Save is pressed.

## 3. Scope boundaries

**IN scope for this build** (restated from the approved plan, now UI-explicit):
- Create / edit / delete tasks and events, via the single Schedule editor slide-over.
- Completion toggling (checkbox, in place, both directions).
- Rescheduling: editing an item's schedule fields, or dragging an existing block to a new slot.
- Basic drag/drop: inbox → Week slot, and block → block (reschedule), both with a non-drag fallback.
- Filtering: status, project, priority, due-date range, on the Tasks view only (Today and Week are not filterable in v1 — they're already scoped by time).
- JSON import/export via the Settings/Data slide-over (§0).

**OUT of scope — do not design UI for these:**
- Recurrence: no "repeat" field anywhere in the editor, no recurrence-rule picker, even though the data model reserves a `recurrence` field for later.
- Notifications/reminders: no reminder-time field, no notification permission prompt, no toast/alert system beyond the inline save-error text in §2.2.
- Sync/multi-device: no "last synced" indicator, no conflict-resolution UI, no offline banner.
- Auth/collaboration: **no login screen, no account/profile menu, no user avatar, no sharing/invite UI, no multi-user presence indicators anywhere.** The app assumes exactly one local user at all times.
- Search: no global search bar — Tasks-view filtering is the only discovery mechanism in v1.
- Month view or day view: Week is the only calendar granularity.

## 4. Acceptance criteria (for step 6's review pass)

**Today**
- [ ] Overdue section renders only when ≥1 overdue task exists; absent otherwise.
- [ ] Agenda items are sorted strictly by `scheduledStart` ascending.
- [ ] Events render without a checkbox; tasks render with one.
- [ ] Inbox shows only items with no `scheduledStart` and status in `inbox`/`todo`.

**Week**
- [ ] Week header correctly labels the displayed Mon–Sun range and `‹`/`›` navigate by exactly 7 days.
- [ ] `Today` button returns to the week containing the current date and highlights today's column.
- [ ] A block's vertical position/height is proportional to its `scheduledStart`/`scheduledEnd` within the 6 AM–10 PM grid.
- [ ] Clicking an empty slot opens the editor pre-filled with that slot's day and time.
- [ ] Clicking an existing block opens the editor in edit mode with all fields correctly pre-populated.

**Tasks**
- [ ] All four filter types (status, project, priority, due-date range) are combinable and update the list with AND logic.
- [ ] Clearing filters (`Clear` link) restores the full unfiltered list and the link disappears.
- [ ] Checkbox click toggles completion without opening the editor; row click elsewhere opens the editor.
- [ ] Empty-filter-result state shows the specified message, not a blank list.

**Schedule editor**
- [ ] Field order matches §1.4 exactly (title → project → tags → priority → due date → schedule → notes).
- [ ] Saving with only a title produces a valid task with correct defaults (`status: inbox`, `priority: none`, null dates).
- [ ] Delete requires two clicks (arm, then confirm) and is unreachable in create mode.
- [ ] Canceling or clicking the scrim discards all edits — reopening the item shows pre-edit values.

**Drag/drop**
- [ ] Dragging an inbox item over a valid Week cell shows the snap highlight + ghost preview before drop.
- [ ] Drop sets `scheduledStart`/computed `scheduledEnd` correctly and removes the item from the inbox list.
- [ ] A failed save reverts the UI (block removed, item restored to inbox) and shows the inline error text.
- [ ] Every drag-based action (schedule, reschedule) has a working non-drag equivalent reachable without a mouse-drag gesture.

**Global**
- [ ] No UI element exists for login, accounts, recurrence rules, notifications, or sync status anywhere in the app.
- [ ] The four nav tabs and active-tab indicator work from every view; `+ New Task` opens an empty editor from every view.

## 5. Visual style guidance

**Recommendation: reuse `bus/dashboard.html`'s visual identity verbatim** — same CSS custom-property palette (`--bg #0b0e13`, `--panel #12161d`, `--line`/`--line-strong` hairline borders, `--ink`/`--dim`/`--dim-2` text scale, `--amber`/`--teal`/`--red`/`--green` as the only accent colors), same IBM Plex Mono / SF Mono / Consolas font stack, same card treatment (1px hairline border + `--top-hi` inset highlight + 5px radius), same restrained motion language (the `check-mark` stroke-draw, the `pulse` keyframe reused for active/highlighted states).

Reasoning:
- This is one person's personal tool living in the same vault as `dashboard.html`/`agents.html`, opened in the same contexts by the same user — a distinct visual identity would read as an inconsistency, not a deliberate choice, since there's no product/brand reason for these to look different.
- The existing palette's semantic colors already map cleanly onto this app's states: `--green` for done, `--red` for overdue/high-priority, `--amber` for active/in-progress and drag-target highlights (note: §2.2 above uses `--teal` for drag highlight instead, to keep amber reserved for "urgent/active" and avoid collision with the priority-dot red/amber/dim scheme in Tasks — teal is otherwise idle in this app and free to mean "valid drop target").
- Reuse is cheap and lower-risk: the architecture/implementation specialists inherit a working, already-tested set of CSS tokens and animation primitives instead of inventing and QA'ing a second design language.

One necessary addition, since the existing two-page palette only carries 4 semantic colors (amber/teal/red/green) and this app needs to visually distinguish an open-ended, user-created set of **projects** (the Week grid's per-block accent bar in §1.2, and project chips throughout): add a small fixed categorical palette of 6 muted, desaturated hues (rotate through them by project-creation order or a hash of the project name) — kept low-saturation enough to sit quietly next to the existing 4 semantic colors without competing with them for attention. The exact hex values are a small implementation-time decision, not something this spec needs to fix in advance.
```
