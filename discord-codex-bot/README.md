# discord-codex-bot

A standalone Discord bot with two roles, independent of AgentVault's `/bus/` orchestration:

- **`/ask`** — engineering/writing help agent. Dispatches a real `codex exec` subprocess per question. Uses Codex's hosted web-search tool (confirmed working live 2026-09-04 under a `read-only` sandbox — it's a server-side search call, not local shell network access, so no elevated sandbox is needed).
- **`/save`** and **`/fetch`** — file agent. Plain Node code (no LLM involved) that moves files between a Discord attachment and Google Drive / OneDrive. This process is a normal long-running Node program, not a sandboxed subprocess, so it has ordinary network access for the Drive/Graph API calls.

## One-time setup

You'll need to do three things yourself — account/consent screens I can't complete on your behalf. Everything else (code, `npm install`, running the bot) is already built.

### 1. Discord bot

1. Go to https://discord.com/developers/applications → **New Application**. Name it whatever you like.
2. **Bot** tab → **Reset Token** → copy it → this is `DISCORD_BOT_TOKEN`.
3. **General Information** tab → copy **Application ID** → this is `DISCORD_CLIENT_ID`.
4. **OAuth2 → URL Generator**: scopes = `bot` and `applications.commands`; bot permissions = `Send Messages`, `Attach Files`, `Use Slash Commands`. Open the generated URL and invite the bot to your server.
5. (Optional, recommended while testing) Right-click your server icon → Copy Server ID (enable Developer Mode in Discord settings first if you don't see this) → this is `DISCORD_GUILD_ID`. Registering commands to one guild is instant; global registration can take up to ~1 hour to show up.

### 2. Google Drive

1. https://console.cloud.google.com/ → create a project (any name).
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → External → fill the minimum required fields → add yourself as a **Test user** (keeps it in Testing mode, which is fine for personal use — no Google review needed).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Desktop app**. Copy the **Client ID** and **Client secret** → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### 3. OneDrive (Microsoft Graph)

1. https://portal.azure.com/ → **App registrations → New registration**. Name it whatever you like. Supported account types: **Personal Microsoft accounts only** (unless you specifically want a work/school OneDrive — then pick the multi-tenant option and set `MS_TENANT` to your tenant ID instead of `consumers`).
2. **Authentication** tab → **Advanced settings** → set **Allow public client flows** to **Yes** (required for the device-code sign-in flow this bot uses — no client secret needed for this flow).
3. **Overview** tab → copy **Application (client) ID** → this is `MS_CLIENT_ID`.
4. No API permissions need to be manually added ahead of time — the scopes (`Files.ReadWrite`, `offline_access`, `User.Read`) are requested at sign-in time and you'll consent to them during `npm run authorize-onedrive`.

## Running it

```
cd discord-codex-bot
copy .env.example .env      # then fill in the values from steps 1-3 above
npm install
npm run authorize-google    # one-time interactive browser sign-in
npm run authorize-onedrive  # one-time interactive device-code sign-in
npm run register-commands   # registers /ask /save /fetch
npm start                   # runs the bot -- keep this running
```

`npm start` needs to keep running for the bot to be online, same as any other long-running service — closing the terminal stops it. Worth eventually wrapping in something like `pm2` or a Windows scheduled task/service if you want it to survive reboots and stay up unattended; not set up yet.

## Notes on scope

- `/save` uses Google Drive's/Graph's simple upload, which comfortably covers normal Discord attachments but isn't set up for very large files (Drive's simple-upload endpoint tops out around a few hundred MB in practice; Graph's simple PUT is reliable up to ~4MB and needs a resumable session above that). Not built — attachments this large are an edge case, not the common path.
- `/fetch` won't post a file back into Discord if it's larger than ~7.5MB (Discord's own upload cap for non-boosted servers) — it'll give you the Drive/OneDrive link instead in that case.
- No local PC filesystem access anywhere in this bot, by design — only Discord attachment bytes moving to/from the two drives.
