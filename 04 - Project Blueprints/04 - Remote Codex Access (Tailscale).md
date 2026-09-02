---
tier: warm
relevance: 0.5
last_accessed: 2026-09-01
type: blueprint
status: active
domain: blueprints
description: Parked plan to make the agent-comms phone dashboard reachable off the home WiFi via Tailscale, not yet implemented
tags: ["tailscale", "remote-access", "networking", "agent-comms"]
---
# Remote Codex Access (Tailscale) Blueprint

**Status: 🅿️ PARKED -- not yet implemented.** This is a resume-later note,
not a finished blueprint. Nothing below has been installed or configured
yet; see "What's left" at the bottom for the actual next steps.

---

## 1. Problem

The live chat dashboard (`C:\Users\trevo\agent-comms\dashboard.html` +
`server.js`, port 47415) already lets a phone talk to Codex in real time --
but only when the phone is on the same home WiFi as the PC. Off that
network (cellular, another WiFi), it can't reach the server at all. The
goal of this blueprint is anywhere-access, not just same-WiFi access.

---

## 2. Decision: Tailscale, and why not the alternatives

Discussed and decided 2026-09-01, not yet acted on.

| Option | Verdict | Reason |
|---|---|---|
| **Port forward + Dynamic DNS** | Rejected | Exposes port 47415 directly to the public internet. The dashboard is plain HTTP today, so the bearer token would travel in cleartext to anyone positioned on the path, and the open port becomes discoverable by internet-wide scanners. Also requires touching home router config. |
| **Cloudflare Tunnel / ngrok** | Rejected (for now) | No router changes needed and gets real HTTPS, but routes traffic through a third party's infrastructure and creates a public-facing URL -- more exposure than necessary for a single-user, two-device use case. |
| **Tailscale** | **Chosen** | Private encrypted mesh network (WireGuard) between just this PC and the phone, addressed by your own Tailscale account. No public URL, nothing internet-scannable, no router changes. The PC gets a private `100.x.x.x` address reachable only by devices logged into the same Tailscale account, from anywhere with internet. This was already anticipated in the original agent-comms hardening plan as the intended path once LAN-only wasn't enough -- see that plan's Auth section: "Not intended for direct internet exposure; that would need TLS or something like Tailscale, out of scope for Phase 1." |

---

## 3. What's already true (no work needed here)

- `server.js` binds `0.0.0.0:47415` and is already running.
- Bearer-token auth is already wired in (`run/token.txt`, `X-Agent-Token`
  header / `?t=` query param, checked via `crypto.timingSafeEqual`).
- `dashboard.html` already reads `?t=` on first load, saves it to
  `localStorage`, and strips it from the URL bar.
- A Windows Firewall rule ("Node.js JavaScript Runtime", Allow, Public
  profile) already permits inbound connections on the current network.

None of this needs to change for Tailscale -- Tailscale just becomes a new
network path to the same already-working server. The token stays the auth
layer; Tailscale adds network-level privacy on top, it doesn't replace the
token check.

---

## 4. What's left (the actual blank to resume)

- [ ] **Confirm with the user before installing anything** -- this is a
      persistent background service + virtual network adapter on the PC,
      not a config tweak. Get explicit go-ahead in the moment, don't just
      do it because this file exists.
- [ ] Install the Tailscale client on this Windows machine
      (`C:\Windows\System32` session / this PC).
- [ ] User installs the Tailscale app on their phone and logs into the
      same Tailscale account (only the user can do this half).
- [ ] Confirm the PC's assigned Tailscale IP (`100.x.x.x`).
- [ ] Test phone access via `http://<tailscale-ip>:47415/?t=<token>`
      while the phone is deliberately OFF the home WiFi (e.g. on
      cellular) -- the actual point of this change, so don't skip
      verifying it under the real target condition.
- [ ] Optional hardening to consider once basic access works: Tailscale
      ACLs/tags restricting exactly which devices can reach port 47415,
      and/or adding TLS even inside the tunnel for defense in depth
      (not required for security since Tailscale traffic is already
      WireGuard-encrypted end to end, but would stop the token from ever
      appearing as cleartext even within the tunnel).

---

## Related Notes

- [[00 - Master Agent Index]] (hub)
- [[ARCHITECTURE]] (application) -- section 2 documents agent-comms' current role as dashboard-only, which is exactly the server this blueprint makes reachable off-WiFi
