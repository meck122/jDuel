---
title: "feat: Add per-route dynamic document titles"
type: feat
status: active
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-per-route-dynamic-titles-requirements.md
---

# feat: Add per-route dynamic document titles

## Overview

Every page in jDuel currently shows "jDuel" as the browser tab title. This PR adds descriptive `document.title` values per route — keyword-rich for the crawlable pages (`/`, `/about`) and reactive to game phase on `/game/:roomId`.

No new dependencies. Three components, each with a `useEffect` that sets and resets `document.title`.

## Acceptance Criteria

- [ ] Navigating to `/` sets tab title to `"jDuel — Free Online Multiplayer Trivia"`
- [ ] Navigating to `/about` sets tab title to `"About — jDuel"`
- [ ] Entering a game room sets title to `"Waiting for players — jDuel"` while `status === "waiting"`
- [ ] Title updates to `"Round in progress — jDuel"` when `status === "playing"`
- [ ] Title updates to `"Viewing results — jDuel"` when `status === "results"`
- [ ] Title updates to `"Game over — jDuel"` when `status === "finished"`
- [ ] Navigating away from any page resets `document.title` to `"jDuel"` (cleanup on unmount)
- [ ] No `react-helmet-async` or other new npm dependency introduced

## Implementation

### 1. `frontend/src/pages/HomePage/HomePage.tsx`

`useEffect` is already imported. Add a title effect inside the component (after the existing state declarations):

```tsx
useEffect(() => {
  document.title = "jDuel — Free Online Multiplayer Trivia";
  return () => {
    document.title = "jDuel";
  };
}, []);
```

### 2. `frontend/src/pages/AboutPage/AboutPage.tsx`

`useEffect` is not yet imported. Add the import and effect:

```tsx
import { useEffect } from "react";

export function AboutPage() {
  useEffect(() => {
    document.title = "About — jDuel";
    return () => {
      document.title = "jDuel";
    };
  }, []);

  return (
    // ... existing JSX unchanged
  );
}
```

### 3. `frontend/src/pages/GamePage/GamePage.tsx`

`useEffect` and `roomState` are both already in scope. Add a reactive title effect alongside the existing effects:

```tsx
// Reactive title — updates as game phase changes
const GAME_TITLES: Record<string, string> = {
  waiting: "Waiting for players — jDuel",
  playing: "Round in progress — jDuel",
  results: "Viewing results — jDuel",
  finished: "Game over — jDuel",
};

useEffect(() => {
  if (roomState?.status) {
    document.title = GAME_TITLES[roomState.status] ?? "jDuel";
  }
  return () => {
    document.title = "jDuel";
  };
}, [roomState?.status]);
```

Place `GAME_TITLES` as a module-level constant (alongside the existing `RETRY_OPTIONS` constant) to avoid re-creating it on every render.

## Context

- `roomState` is typed as `RoomState | null` — the null guard (`roomState?.status`) ensures no title is set during the brief connecting window; the tab stays at `"jDuel"` until the first `ROOM_STATE` message arrives.
- The cleanup function runs on unmount and on every dependency change before re-running the effect. For the game page this means the title correctly resets if the user navigates away mid-game.
- `GamePage.tsx:13` already imports `useEffect`, `GamePage.tsx:101` already destructures `roomState` from `useGame()`.
- `AboutPage.tsx` currently has no React imports and will need `useEffect` added.

## Sources

- **Origin document:** [docs/brainstorms/2026-04-13-per-route-dynamic-titles-requirements.md](../brainstorms/2026-04-13-per-route-dynamic-titles-requirements.md) — Key decisions: plain `document.title` (no library), reset on unmount, dynamic game phase titles
- `frontend/src/pages/GamePage/GamePage.tsx:13` — existing `useEffect` import
- `frontend/src/pages/GamePage/GamePage.tsx:101` — `roomState` from `useGame()`
- `frontend/src/pages/HomePage/HomePage.tsx:12` — existing `useEffect` import
- `frontend/src/types/index.ts:9` — `status: "waiting" | "playing" | "results" | "finished"`
