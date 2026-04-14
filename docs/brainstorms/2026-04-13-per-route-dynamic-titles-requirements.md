---
date: 2026-04-13
topic: per-route-dynamic-titles
---

# Per-Route Dynamic Document Titles

## Problem Frame

Every page in jDuel shows "jDuel" as the browser tab title regardless of context. Googlebot indexes the rendered `<title>` tag, so all routes currently have zero keyword value. Users with multiple tabs open cannot identify which tab is which.

## Requirements

- R1. `HomePage` sets title `"jDuel — Free Online Multiplayer Trivia"` on mount.
- R2. `AboutPage` sets title `"About — jDuel"` on mount.
- R3. `GamePage` sets a title that updates reactively as `roomState.status` changes:
  - `waiting` → `"Waiting for players — jDuel"`
  - `playing` → `"Round in progress — jDuel"`
  - `results` → `"Viewing results — jDuel"`
  - `finished` → `"Game over — jDuel"`
- R4. All page-level title effects reset `document.title` to `"jDuel"` on unmount, so navigating away never leaves a stale title.

## Success Criteria

- Googlebot (and other JS-executing crawlers) index keyword-rich titles for `/` and `/about`.
- The browser tab reflects the current game phase while a game is in progress.
- No new npm dependencies are introduced.

## Scope Boundaries

- No `react-helmet-async` or any title management library — plain `document.title` in `useEffect`.
- No room code or player names embedded in titles.
- No changes to the static `og:title` or `twitter:title` in `index.html` — those are already set correctly.
- No SSR or prerendering — this is a client-side change only.

## Key Decisions

- **Plain `document.title` over a library:** No new dependency, ~3 lines per component, sufficient for a SPA without SSR.
- **Reset on unmount:** Prevents stale titles leaking across navigations; ensures a clean baseline if routing ever changes.
- **Dynamic game titles:** Tab updates live as phase progresses — useful when the tab is backgrounded mid-game.

## Next Steps
→ `/ce:plan` for structured implementation planning
