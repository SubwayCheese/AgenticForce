## 🤖 CodexAgent — how to use this bot

Three commands, all typed with `/`:

**`/ask question: <your question>`**
Ask for engineering or technical help, writing help, or general questions. It can search the live web when needed (current docs, recent releases, current events), not just answer from memory.

> Tip: **pin** any reference document in this channel (`.txt`, `.md`, `.pdf`, `.docx`, `.csv`, `.json`) and `/ask` will automatically read it and use it as context for your question — no need to re-attach or re-explain it each time. Unpin it when it's no longer relevant.

**`/save file: <attachment> destination: <Google Drive | OneDrive>`**
Attach a file to this command and pick where to save it. Confirms with the saved filename and a link.

**`/fetch name: <search text> destination: <Google Drive | OneDrive>`**
Searches that drive for a file matching the name and posts it back into this channel (or gives you a link if it's too large to post directly).

**`/summarize file: <PDF or DOCX attachment>`**
Attach a meeting transcript or notes file and get back a structured summary — overview, key discussion points, decisions made, action items (with owner/due-date only when actually stated), and open questions — plus a downloadable `.md` file to save or forward.

> Tip: attach the raw transcript/notes rather than something already summarized — Codex is instructed to never invent attendees, owners, or due dates that aren't explicitly in the source, so more real material means a more complete summary.

**`/summarize all: true`**
Summarizes every meeting note in the configured Drive folder (up to 5 at a time) — one `.md` file per meeting plus a short index.

**`/summarize query: <your question>`**
Searches your Drive meeting notes for whatever's relevant and answers your question directly, citing which meeting(s) it came from.

---
**Notes**
- Every command runs independently — there's no ongoing memory between separate `/ask` calls, aside from whatever's currently pinned in the channel.
- `/save` and `/fetch` only move files between Discord and your two drives — nothing touches your computer's local files.
- `/summarize` only accepts `.pdf` and `.docx` files up to 15MB, and needs a real text layer (scanned/image-only PDFs won't work). Provide exactly one of `file`, `query`, or `all:true`.
- Very long transcripts (over ~60,000 characters extracted) are truncated before summarizing — you'll see an explicit warning if that happens.
- `/summarize all:true` needs a Drive folder configured first (ask whoever runs the bot to set `GOOGLE_DRIVE_MEETING_FOLDER_ID`).
- `/summarize` can take longer than `/ask` (up to a few minutes) since it's built for thoroughness over speed.
- If a command doesn't respond within a few seconds and shows "The application did not respond," the bot's host process may be offline — ping whoever runs it.
