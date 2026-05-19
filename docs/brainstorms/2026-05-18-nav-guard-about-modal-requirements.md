# Navigation Guard + About-as-Modal — Requirements

**Date:** 2026-05-18
**Status:** Ready for planning
**Scope:** Lightweight (frontend-only UX fix)

## Problem

Two related ways a player can accidentally leave a live game without warning:

1. **About link** (`frontend/src/components/ui/Navigation/Navigation.tsx`) is a real route (`/about`). Clicking it during the **lobby** (`status === "waiting"`) or **results / game-over** (`status === "finished"`) navigates away from `/game/:roomId` and effectively kicks the user out of their session. The button is already hidden during active question phases, but lobby and results both show it.
2. **jDuel logo** (top-left) is an unguarded `<Link to="/">`. Clicking it from any in-room screen silently dumps the player back to the home page.

Both are common accidental-click footguns that destroy the player's session without confirmation.

## Goals

- Make the About content reachable from anywhere without disrupting an in-progress game.
- Guard accidental navigation home while the player is in a room.
- Keep the visual language consistent with the existing game UI (MUI v7, theme tokens, `Dialog` patterns already used in the app).

## Non-goals

- Trapping the browser **back button** via `history.pushState` / `popstate`.
- Redesigning the About page **content** itself.
- A "rejoin after accidental leave" recovery flow.
- Any backend, room-lifecycle, or WebSocket changes.

## User-facing behavior

### About link

- The "About" navbar button opens a **modal overlay** on every page (home, lobby, game, results). No route change.
- Modal body is **scrollable** (About content is long-form).
- Dismissable via ESC, backdrop click, and an explicit close button — standard MUI `Dialog` dismissal pattern.
- Visual style matches existing dialogs in the app (background, font tokens, accent colors).

### `/about` route

- Kept as a **redirect** to `/` with the About modal auto-opened (so existing bookmarks / external links still resolve to something useful).
- Implementation suggestion deferred to planning, but the user-facing contract is: navigating to `/about` lands you on the home page with the About modal already open.

### jDuel logo (top-left)

| Current screen | `roomState.status` | Logo click behavior |
|---|---|---|
| Home page | n/a | No-op (or scroll-to-top — planning's call) |
| Lobby | `waiting` | "Leave game?" **confirm modal** |
| Active question | active gameplay | "Leave game?" **confirm modal** |
| Results (between rounds) | active gameplay | "Leave game?" **confirm modal** |
| Game Over | `finished` | Free navigation to `/` (as today) |

- Confirm modal copy: short, on-brand, makes clear the room continues without them (e.g., "Leave the game? Your room will keep playing without you.").
- "Stay" is the safe / default action; "Leave" is the destructive secondary.
- Style matches the rest of the game's dialog vocabulary.

### Browser-level exits (refresh / close tab / ⌘W)

- While `status` is `waiting` or active gameplay, register a `window.beforeunload` listener so the browser shows its native "Leave site?" prompt.
- Remove the listener when `status` becomes `finished` or when the user is no longer on `/game/:roomId`.
- Browser **back button** is explicitly **not** trapped — accepted gap, can be revisited later.

## Success criteria

- Clicking About from lobby, question, or results screens does **not** change route and does **not** disconnect the player from their room.
- Clicking the logo from lobby, question, or results triggers a confirm before navigation. Cancel keeps the player in their game with no state loss.
- Refreshing or closing the tab during an active session shows the browser's native confirmation.
- After `status === "finished"` (game over), all of the above guards are off — the player can freely return home.
- No regressions in the active-gameplay header (Q-counter, mute, skip-track, SBBadge all still render).

## Assumptions

- "In a room" is detectable from `roomState.status` plus route, using the same boundary `Navigation.tsx` already uses for `isActiveGameplay` (extended to include `waiting`).
- The existing `GameProvider` wraps the router (`frontend/src/App.tsx`), so modal state and the confirm dialog can live anywhere in the tree without prop drilling. Whether the modal lives in `Navigation`, `App`, or a dedicated context is a planning decision.
- MUI `Dialog` is already in use across the app for similar modals; no new dependency needed.

## Dependencies

- None outside the frontend. No backend, protocol, or deployment changes.

## Open questions (deferrable to planning)

- Exact copy for the confirm dialog (a one-liner — designer/product call).
- Whether the About modal should also be openable from a deep link like `?about=1` (nice-to-have, not required).
- Whether the home-page logo click should be a true no-op or a scroll-to-top.

## Out-of-scope follow-ups worth tracking

- Back-button trap via `popstate` if accidental back-navigation turns out to be a real source of player loss.
- Auto-rejoin after accidental disconnect (separate, larger feature).
