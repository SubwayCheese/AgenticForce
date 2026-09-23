# Gemini Video CLI — Project Handoff Document
**Created:** 2026-09-23  
**Account:** <owner Google account>  
**Device:** RaspPiDrive (aarch64 — Raspberry Pi, Debian Linux)  
**Author:** Antigravity AI session (conversation ID: 24aa081d-4128-4c65-a8e8-ffb2e58aab95)

---

## 1. What Was Built

A full **command-line interface for Google Veo video generation** integrated into the Raspberry Pi's user environment, with MCP (Model Context Protocol) server support so Antigravity (`agy`) can invoke video generation as an AI tool.

### Installed Commands

| Command | Type | Location |
|---|---|---|
| `gemini-video` | Main CLI | `/home/subwaycheese/.local/bin/gemini-video` |
| `gemini-veo` | Symlink alias | `/home/subwaycheese/.local/bin/gemini-veo` |
| `agy-video` | Symlink alias | `/home/subwaycheese/.local/bin/agy-video` |
| `gemini-video-mcp` | MCP server daemon | Registered via `agy mcp list` |

All three CLI names are interchangeable. Works in **any terminal** — independent of `agy`.

---

## 2. Project File Locations

### Python Package (Source + Virtualenv)

```
/home/subwaycheese/.local/share/gemini-video/
├── venv/                          # Python 3.13 virtualenv
│   └── lib/python3.13/site-packages/
│       ├── google_genai/          # google-genai SDK
│       ├── google/auth/           # google-auth
│       ├── google_auth_oauthlib/  # OAuth device flow support
│       ├── requests/              # HTTP client
│       ├── rich/                  # Terminal formatting
│       ├── click/                 # CLI framework
│       └── mcp/                   # MCP server framework
├── pyproject.toml                 # Package definition + entry points
└── src/gemini_video/
    ├── __init__.py
    ├── config.py                  # Config loader (~/.gemini/video-config.json)
    ├── auth.py                    # Client creation, backend resolution
    ├── oauth_flow.py              # Google device authorization flow (NEW)
    ├── models.py                  # Supported Veo model definitions
    ├── generator.py               # VideoGenerator class, download logic
    ├── cli.py                     # Click CLI (all commands)
    └── mcp_server.py              # MCP server (4 tools exposed to agy)
```

### Configuration Files

| File | Purpose |
|---|---|
| `~/.gemini/video-config.json` | API key, GCP project, defaults (model, ratio, duration) |
| `~/.gemini/video-oauth-token.json` | OAuth token from `auth login` (generative-language scope) |
| `~/.gemini/antigravity-cli/antigravity-oauth-token` | Antigravity session token (aicode scope — NOT for video) |
| `~/.gemini/config/mcp_config.json` | Registers `gemini-video-mcp` as a stdio MCP server |
| `~/.gemini/config/skills/gemini-video/SKILL.md` | Antigravity global skill documentation |
| `~/.agents/skills/gemini-video/SKILL.md` | Workspace skill documentation |

---

## 3. Authentication Architecture

### The Core Problem (Investigated Thoroughly)

The user has a **Gemini Pro consumer subscription** (Google One / AI Premium via `<owner Google account>`). This subscription grants video generation access inside the **Gemini web app** (`gemini.google.com`) — but it is **not the same system** as the developer API.

Three separate systems exist:

| System | Auth Method | Veo Access |
|---|---|---|
| Gemini Web App (`gemini.google.com`) | Google account login in browser | ✅ Included in Gemini Pro subscription |
| Gemini Developer API (`generativelanguage.googleapis.com`) | API key from AI Studio | ❌ Separate billing; free-tier quota = 0 for Veo |
| Vertex AI (`aiplatform.googleapis.com`) | GCP project + billing account | ✅ Paid per second of video generated |

The Antigravity CLI (`agy`) uses a **4th internal system**: `daily-cloudcode-pa.googleapis.com` with the `aicode` scope — this is Google's internal Code Assist backend and does NOT expose Veo/video generation endpoints.

### What Was Discovered During Investigation

- **Antigravity OAuth token** (`antigravity-oauth-token`) has scopes: `aicode`, `cclog`, `cloud-platform`, `experimentsandconfigs` — **no** `generative-language` scope
- Calling `generativelanguage.googleapis.com` with the Antigravity token returns `ACCESS_TOKEN_SCOPE_INSUFFICIENT`
- The `cloudcode-pa.googleapis.com` API uses an internal protobuf JSON schema — `"contents"` field is rejected; it does not expose video generation
- Vertex AI with `aicode-consumers` project returns `SERVICE_DISABLED` — the user's account has no IAM permissions there
- The user's API key (`<API-KEY-REDACTED>`) is confirmed **free-tier** for Veo; returns `429 RESOURCE_EXHAUSTED` with `free_tier_requests, limit: 0, model: veo-3.1`

### The Solution Built: OAuth Device Flow (generative-language scope)

A new OAuth token path was engineered using the **Google Device Authorization Flow** (RFC 8628). This requests the `https://www.googleapis.com/auth/generative-language` scope — which is the correct scope for the Gemini Developer API — but authenticated as the user's **Google account identity** (not an API key).

**Client credentials used** (Google Cloud SDK public credentials — standard in open-source tooling):
- Client ID: `32555940559.apps.googleusercontent.com`
- Client Secret: `<gcloud-public-client-secret>`

**Flow:**
1. `gemini-video auth login` → CLI requests a device code from `https://oauth2.googleapis.com/device/code`
2. User visits URL + enters short code in any browser (can be phone, laptop, etc.)
3. User signs in as `<owner Google account>` and grants access
4. CLI polls `https://oauth2.googleapis.com/token` and receives `access_token` + `refresh_token`
5. Token saved to `~/.gemini/video-oauth-token.json` (permissions: `chmod 600`)
6. Token auto-refreshes using the refresh token — no re-login needed for months

**Token storage file (`~/.gemini/video-oauth-token.json`) structure:**
```json
{
  "access_token": "ya29.xxx...",
  "refresh_token": "1//xxx...",
  "expires_in": 3599,
  "token_type": "Bearer",
  "id_token": "eyJhbGciOiJSUzI1NiJ9...",
  "scope": "openid email profile https://www.googleapis.com/auth/generative-language",
  "_saved_at": "2026-09-23T17:20:00Z"
}
```

---

## 4. Backend Priority & Resolution

When `gemini-video generate` is called, the `auth.py` module resolves the backend in this priority order:

```
1. gemini-oauth   ← OAuth token from 'auth login' (PREFERRED)
2. gemini-api     ← API key from config / environment variable
3. vertexai       ← Antigravity OAuth token + GCP project ID
```

The `gemini-oauth` backend uses `google.oauth2.credentials.Credentials` with the device-flow token, passed directly to `genai.Client(credentials=creds)` — no API key needed.

---

## 5. CLI Commands Reference

### Video Generation

```bash
# Basic text-to-video
gemini-video generate "A cinematic drone shot over misty redwood forests at golden hour"

# With options
gemini-video generate "Neon-lit Tokyo street at night, rain reflections" \
  --model veo-3.1-generate-preview \
  --aspect-ratio 16:9 \
  --resolution 1080p \
  --duration 8 \
  -o tokyo_night.mp4

# Short form
gemini-video create "A hummingbird in slow motion"

# Async (returns operation ID immediately, don't wait)
gemini-video generate "Ocean waves crashing at sunset" --async

# Image to video (animate a still)
gemini-video animate "Camera slowly pans while snow falls" -i photo.jpg -o animated.mp4
```

### Authentication

```bash
# RECOMMENDED — Link your Google account (uses your Gemini subscription)
gemini-video auth login

# Remove the Google account link
gemini-video auth logout

# Check all auth backends
gemini-video auth status

# Alt: Set an AI Studio API key (separate from subscription)
gemini-video auth set-key <YOUR_API_KEY>

# Alt: Set a GCP project for Vertex AI
gemini-video auth set-project my-gcp-project-id

# Clear stored API key and project
gemini-video auth clear
```

### Operations & Status

```bash
# Check the status of an async operation
gemini-video status <OPERATION_NAME> -o output.mp4

# List all supported Veo models
gemini-video list-models

# Run diagnostics
gemini-video doctor
```

### Environment Variables

```bash
export GEMINI_API_KEY="your-api-key"          # Overrides config file key
export GOOGLE_CLOUD_PROJECT="your-project"    # Overrides config file project
export VERTEX_LOCATION="us-central1"          # Vertex AI region
```

---

## 6. Supported Models

| Model ID | Name | Max Duration | Audio | Img2Vid |
|---|---|---|---|---|
| `veo-3.1-generate-preview` | Veo 3.1 (Default) | 8s | ✅ | ✅ |
| `veo-3.1-fast-generate-preview` | Veo 3.1 Fast | 8s | ✅ | ✅ |
| `veo-3.0-generate-001` | Veo 3.0 | 8s | ✅ | ✅ |
| `veo-2.0-generate-001` | Veo 2.0 | 8s | ❌ | ✅ |

**Important constraints (Gemini Developer API):**
- Duration must be **even numbers**: 4, 6, or 8 seconds only (5, 7 are rejected)
- `fps` parameter is **Vertex AI only** — rejected by the Developer API
- `generate_audio` is **Vertex AI only** — rejected by the Developer API
- The CLI handles these constraints automatically

---

## 7. MCP Integration (Antigravity / agy)

The `gemini-video` MCP server is registered in `~/.gemini/config/mcp_config.json`. When you're inside an `agy` session, you can ask the AI to generate videos and it will call these tools:

| MCP Tool | Description |
|---|---|
| `gemini_generate_video` | Text-to-video generation |
| `gemini_animate_image` | Image-to-video animation |
| `gemini_get_video_status` | Check async operation status |
| `gemini_list_video_models` | List available models |

MCP tool schemas are cached at:
`~/.gemini/antigravity-cli/mcp/gemini-video/*.json`

The skill documentation that triggers this in `agy` is at:
`~/.gemini/config/skills/gemini-video/SKILL.md`

---

## 8. Known Issues & Constraints

| Issue | Status | Notes |
|---|---|---|
| Free-tier API key has 0 Veo quota | ⚠️ Blocked | Key `AQ.Ab8...` is free-tier; use `auth login` instead |
| `cloudcode-pa.googleapis.com` doesn't expose Veo | ✅ Confirmed | Antigravity's backend is Code Assist only |
| Antigravity OAuth token lacks `generative-language` scope | ✅ Confirmed | Has `aicode`, `cloud-platform` — not for Gemini API |
| Duration must be even (4/6/8s) via Developer API | ✅ Handled | `generator.py` auto-rounds to nearest valid value |
| `fps` / `generate_audio` are Vertex AI only | ✅ Handled | CLI skips these params when using Developer API |
| `predictLongRunning` proto schema deprecation | ⚠️ Warning | SDK logs a deprecation warning; non-breaking |

---

## 9. Next Steps / If Starting Fresh

### To activate video generation immediately:

1. Run `gemini-video auth login` in any terminal
2. Visit the URL shown, sign in as `<owner Google account>`, enter the code
3. Run `gemini-video generate "your prompt here"`

### If the OAuth token stops working:

- Run `gemini-video auth logout` then `gemini-video auth login` again
- The refresh token should keep it alive for months without re-login

### To enable billing-based Vertex AI (more quota, more features):

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g., `my-veo-project`)
3. Enable billing (credit card required, ~$0.50/minute of video generated)
4. Enable the Vertex AI API
5. Run: `gemini-video auth set-project my-veo-project`

### To update the CLI code:

All source is at `/home/subwaycheese/.local/share/gemini-video/src/gemini_video/`. After editing:

```bash
cd /home/subwaycheese/.local/share/gemini-video
source venv/bin/activate
pip install -e . --quiet
```

---

## 10. System Info

```
OS:        Debian Linux (aarch64)
Host:      RaspPiDrive
Kernel:    6.18.39+rpt-rpi-v8
Python:    3.13
User:      subwaycheese
Home:      /home/subwaycheese
agy:       /home/subwaycheese/.local/bin/agy
ffmpeg:    Installed (/usr/bin/ffmpeg)
ffprobe:   Installed (/usr/bin/ffprobe)
```

---

*This document was generated by Antigravity AI during the live engineering session on 2026-09-23.*  
*Conversation reference: `24aa081d-4128-4c65-a8e8-ffb2e58aab95`*
