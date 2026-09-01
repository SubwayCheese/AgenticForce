# SDSU Interactive Campus Hub & Course Explorer Blueprint

Architectural specification and design blueprint for the San Diego State University (SDSU) Interactive Platform (`D:\SDSU-Interactive-Hub`).

---

## 🏛️ 1. Project Overview & Specs
- **Location:** `D:\SDSU-Interactive-Hub`
- **Server Address:** `http://127.0.0.1:3080`
- **Theme Aesthetics:** SDSU Aztec Scarlet Red (`#A6192E`), Gold (`#D1A153`), and Deep Charcoal (`#0A0A0F`) glassmorphism styling.
- **Dependencies:** 0 third-party API keys required; native Node HTTP server with zero dependency footprint.

---

## 🛠️ 2. API Endpoints Contract

| Endpoint | Method | Description | Sample Output |
|---|---|---|---|
| `/api/courses?query=...` | `GET` | Filters SDSU course catalog by keyword/code | `{ ok: true, count: N, courses: [...] }` |
| `/api/campus` | `GET` | Returns landmark hotspot details & history | `{ ok: true, hotspots: [...] }` |
| `/api/news` | `GET` | Returns live campus announcements & research news | `{ ok: true, news: [...] }` |
| `/api/stats` | `GET` | Returns Aztec spirit stats & national rankings | `{ ok: true, stats: {...} }` |

---

## 🎨 3. UI/UX Design System
- **Hero Banner:** Animated background blurring orbs (`@keyframes floatOrb`), Aztec statistics cards, and CTA buttons.
- **Course Explorer:** Real-time search input box dynamically filtering CS, AI, Cybersecurity, and Data Science courses.
- **Campus Hotspots:** Interactive cards showcasing Hepner Hall, Aztec Student Union, Love Library, Viejas Arena, ARC Center, and Storm Hall.
- **Aztec News Feed:** Card grid displaying live campus news and athletic announcements.

---
*Related:* [[00 - Master Agent Index]] | [[01 - Multi-Agent Coordination Protocol]] | [[03 - Agentic Creations & Architectural Artifacts]]
