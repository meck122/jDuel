---
title: Opt-In Background Music with Global Mute Button
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-opt-in-music-requirements.md
---

# Opt-In Background Music with Global Mute Button

## Overview

Add opt-in background music to the jDuel frontend. This establishes the first audio code and the first global user-preference in the codebase. The feature ships as:

- A narrow `MusicContext` + `useMusic` hook
- A single `useMusicPreference` localStorage-backed hook
- Two thin `MuteButton` variants (Toolbar + Floating) sharing one toggle hook
- A `tracks.ts` manifest for bundled MP3 assets

Music is off by default, opt-in via a single click, and plays continuously across lobby, question, results, and game-over screens without restarting. The mute control is reachable from every screen — Toolbar on screens with an `AppBar`, top-left floating button on gameplay screens where Navigation hides itself.

## Problem Frame

From origin doc: jDuel has no audio today. Adding atmospheric background music makes the game feel more alive during lobby wait, question tension, and results — but only for players who want it, only on their terms, and only via mechanisms that respect WCAG 1.4.2 (default-off) and browser autoplay policy (user gesture required).

## Requirements Trace

All R1–R11 from the origin document. See `docs/brainstorms/2026-04-19-opt-in-music-requirements.md` for the full list. Key ones:

- **R1** default off
- **R2** continuous playback through all game phases including active question
- **R3** shuffle with no-repeat-in-a-row when N ≥ 2; loop when N = 1
- **R4** auto-resume on next user gesture for returning opted-in users
- **R5/R6/R7** reachable on every screen via Toolbar + top-left float
- **R8/R9** click toggles and persists; icon reflects state
- **R10/R11** `localStorage` persistence; no track-position persistence

## Scope Boundaries

- No SFX (music-only v1)
- No volume slider
- No settings drawer
- No lobby prompt
- No pause-on-blur
- No host-synced music
- No backend streaming — tracks are bundled static assets
- No track-position persistence
- No new runtime dependencies (raw HTML5 `<audio>`, no Howler)

## Context & Research

### Relevant code and patterns

- `frontend/src/contexts/GameContext.tsx` + `frontend/src/contexts/useGame.ts` + `frontend/src/contexts/index.ts` — provider/hook/barrel split to mirror
- `frontend/src/hooks/usePlayerName.ts` — localStorage-sync hook pattern; uses key `jduel_player_name` (underscore convention)
- `frontend/src/App.tsx` — provider nesting and `<Navigation />` placement inside `<Router>`
- `frontend/src/components/ui/Navigation/Navigation.tsx` — returns `null` on `/game/:id` unless `roomState.status === "finished"`; this is the reason the floating button exists
- `frontend/src/features/game/Reactions/Reactions.tsx` — feed at `zIndex: 99` (on `xs`: full-width top), bar at `zIndex: 100` (bottom full-width). Floating button must clear these.
- `@mui/icons-material` v7 — `VolumeUp` / `VolumeOff`
- CSS variables: `--navbar-height`, `--spacing-sm`, `--color-bg-elevated`, `--color-border-subtle`, `--radius-sm`

### Institutional learnings

- No `docs/solutions/` entries for audio or preferences. This plan establishes the first patterns for both.

### External references

- See origin doc's External Research section: autoplay policy in 2026 resolved by user-gesture opt-in; WCAG 1.4.2 satisfied by default-off; Vite static asset pattern `new URL('./file.mp3', import.meta.url)`.

### Codebase realities

- **No frontend test framework.** `frontend/package.json` has no `vitest`, `jest`, or `@testing-library/*`. The only frontend "test" is `npm run build` (tsc + lint). This plan therefore enumerates **manual acceptance scenarios** per feature-bearing unit. Automated unit tests are out of scope — adding a test framework is a separate, orthogonal decision.

## Key Technical Decisions

- **Narrow `MusicContext`.** No `PreferencesContext` yet (origin #3). When a second pref arrives, extract.
- **Two thin components sharing one hook.** `ToolbarMuteButton` rendered inside `Navigation`'s `<Toolbar>`; `FloatingMuteButton` rendered at App-root level inside `<Router>` as a sibling of `<Navigation>`. Both are thin wrappers over `useMuteToggle()` which encapsulates icon/label/click. Chosen over a single self-positioning component because the two placements live in different React trees and portaling across them is unnecessary complexity.
- **Exactly one button visible at a time.** Both buttons decide their own render gate:
  - `ToolbarMuteButton` renders when `Navigation` renders (Navigation's existing gate handles this)
  - `FloatingMuteButton` renders only when `Navigation` would return `null` — i.e. `location.pathname.startsWith("/game/") && roomState?.status !== "finished"`
  - This mirror-image gating guarantees no double icon on any screen
- **Raw HTML5 `<audio>`.** Origin #7. One `HTMLAudioElement` owned by `MusicProvider`, created imperatively (no JSX node). Shuffle-no-repeat on `ended`.
- **localStorage key `jduel_music_preference`** (values `"on" | "off"`). Matches `jduel_player_name` snake_case convention. Rejected the `jduel:prefs:music` suggestion from the origin doc — that would be the only `:` -delimited key in the repo.
- **Tracks under `frontend/src/assets/music/`** with a `tracks.ts` manifest using `new URL('./file.mp3', import.meta.url)`. Vite fingerprints and bundles at build time.
- **Preload: lazy.** Audio element not created until `MusicProvider` decides playback should start (either on mount if pref=on, or on first toggle).
- **Autoplay recovery for returning users.** If `pref === "on"` at mount and `audio.play()` rejects (autoplay block), install a single `{ once: true }` listener for `pointerdown` and `keydown` on `document` that retries `play()`. Detach on success or on unmount.
- **Default volume 0.4.** Unobtrusive for trivia play.
- **Floating button placement.** `position: fixed; top: calc(env(safe-area-inset-top, 0px) + var(--spacing-sm)); left: calc(env(safe-area-inset-left, 0px) + var(--spacing-sm)); zIndex: 101` with `var(--color-bg-elevated)` background and `var(--color-border-subtle)` border. zIndex 101 keeps it above the Reactions feed (99) and bar (100). The button is smaller than a reaction chip and the Reactions feed has `pointerEvents: none`, so clicks always reach the button.

## Open Questions

### Resolved during planning

- **Component shape:** two thin components sharing `useMuteToggle`, not a single portaled component.
- **localStorage key:** `jduel_music_preference`.
- **Default volume:** 0.4.
- **Asset location:** `frontend/src/assets/music/` with `tracks.ts` manifest.
- **zIndex:** 101 for floating button.

### Deferred to implementation

- Exact margin values around the floating button once visually observed against the notch on real devices.
- Whether the autoplay-recovery listener's `pointerdown`/`keydown` combo misses any legitimate gesture types (e.g. touch on iOS). If so, extend to `touchstart`. Validate in-browser.
- Whether the `ended` handler needs a small guard against rapid double-fire in any browser. Add if observed.

## Implementation Units

- [ ] **Unit 1: Music asset scaffolding**

**Goal:** Establish where tracks live and how they are imported so later units have a stable target.

**Requirements:** R3 (rotation), R11 (bundled static assets)

**Dependencies:** None

**Files:**
- Create: `frontend/src/assets/music/` *(directory; user drops `.mp3` files here)*
- Create: `frontend/src/assets/music/tracks.ts` *(exports `TRACKS: readonly URL[]`)*
- Create: `frontend/src/assets/music/README.md` *(brief: how to add a track, mastering volume note)*

**Approach:**

- `tracks.ts` is an explicit manifest — each entry is `new URL('./<file>.mp3', import.meta.url)`. Manual edits required when tracks are added; no glob imports. Keeps build deterministic and easy for the user to curate.
- Ship with an empty array in the initial PR. The user will add tracks separately.
- README note: keep tracks mastered quietly (peak around -12 LUFS) since there is no volume slider.

**Patterns to follow:**
- None in repo for audio assets; this unit establishes the pattern.

**Test scenarios:** none — this unit is pure scaffolding with no runtime behavior.

**Verification:**
- `npm run build` succeeds with empty manifest
- Once a track is added and referenced in `tracks.ts`, the build emits a fingerprinted file under `frontend/dist/assets/`

---

- [ ] **Unit 2: Music state — `useMusicPreference` hook and `MusicContext`**

**Goal:** Implement preference persistence, audio element lifecycle, shuffle-no-repeat rotation, and the autoplay-recovery listener.

**Requirements:** R1, R2, R3, R4, R8, R10, R11

**Dependencies:** Unit 1 (`TRACKS` manifest)

**Files:**
- Create: `frontend/src/hooks/useMusicPreference.ts`
- Modify: `frontend/src/hooks/index.ts` *(export `useMusicPreference`)*
- Create: `frontend/src/contexts/MusicContext.tsx` *(provider + `MusicProvider` export)*
- Create: `frontend/src/contexts/useMusic.ts` *(hook reading context)*
- Modify: `frontend/src/contexts/index.ts` *(export `MusicProvider` and `useMusic`)*

**Approach:**

- `useMusicPreference()` mirrors `usePlayerName`:
  - `useState` initializer reads `localStorage.getItem('jduel_music_preference')` synchronously
  - Returns `{ preference: "on" | "off", setPreference: (p) => void }`
  - Writer persists to `localStorage` and updates state
  - Unknown/missing stored values resolve to `"off"` (strict `=== "on"` check)
- `MusicProvider` owns:
  - An `audioRef` to a lazily-created `HTMLAudioElement` (volume `0.4`, `preload="auto"`)
  - A `playingRef` holding the currently-selected track URL (avoids stale closures in the `ended` handler)
  - `pickNextTrack()` — returns a random track from `TRACKS` excluding `playingRef.current`; degenerates to the same track when `TRACKS.length <= 1`
  - `ended` handler — picks next, sets `src`, calls `play()`
  - Mount effect — if `preference === "on"` and `TRACKS.length > 0`, create the audio element, pick a track, call `play()`. On rejection, install one-shot listeners on `document`:
    - `document.addEventListener('pointerdown', retry, { once: true })`
    - `document.addEventListener('keydown', retry, { once: true })`
    - `retry()` attempts `play()` once, then removes both listeners
  - Unmount effect — pause audio, detach listeners
  - `toggle()` — flips preference; if turning on and no audio exists yet, creates it and plays; if turning off, pauses
  - Context value exposes only `{ preference, toggle }`. No `play`/`pause` API — toggle is the only action.
- `useMusic()` throws a descriptive error when used outside `MusicProvider`, matching `useGame` ergonomics.

**Patterns to follow:**
- `frontend/src/hooks/usePlayerName.ts` — localStorage hook shape and key convention
- `frontend/src/contexts/GameContext.tsx` + `frontend/src/contexts/useGame.ts` — provider + hook split, barrel export

**Test scenarios (manual acceptance; no test framework in repo):**
- *Happy path* — First visit, `toggle()` called once: `localStorage.jduel_music_preference === "on"`, audio element exists, a random track plays, `useMusic().preference === "on"`.
- *Happy path* — With `TRACKS.length >= 3`, after current track `ended` fires twice, at no point does the same track play twice in a row (inspect via console log of `playingRef.current`).
- *Happy path* — Navigating Home → Lobby → Question → Results via `react-router-dom` does not remount `MusicProvider`; `audio.currentTime` keeps advancing without reset.
- *Edge case* — `TRACKS.length === 1`: when the single track `ended` fires, the same track restarts; no error.
- *Edge case* — `TRACKS.length === 0`: `toggle()` sets preference to `"on"` but no audio plays; no unhandled rejection; next `toggle()` sets it back to `"off"`.
- *Error path* — `localStorage.jduel_music_preference = "true"` (malformed): hook treats as `"off"`.
- *Return visit* — Fresh tab with `pref === "on"`: `audio.play()` rejects (autoplay block) → listener installs → any user gesture (click anywhere, keypress) retries `play()` successfully → listeners detach.
- *Return visit* — Fresh tab with `pref === "off"`: no audio element created, no autoplay attempt, no listener installed.
- *Cleanup* — On `MusicProvider` unmount (e.g. during dev hot-reload), audio pauses and document listeners detach; no console warnings about memory leaks.

**Verification:**
- `npm run build` succeeds
- Manual scenarios above pass in-browser
- DevTools → Application → Local Storage shows `jduel_music_preference` toggling correctly

---

- [ ] **Unit 3: `MuteButton` components**

**Goal:** Render the mute/unmute affordance as Toolbar and Floating variants with correct placement, icon state, and accessibility.

**Requirements:** R5, R6, R7, R8, R9

**Dependencies:** Unit 2

**Files:**
- Create: `frontend/src/components/ui/MuteButton/useMuteToggle.ts` *(icon + label + click from `useMusic`)*
- Create: `frontend/src/components/ui/MuteButton/ToolbarMuteButton.tsx`
- Create: `frontend/src/components/ui/MuteButton/FloatingMuteButton.tsx`
- Create: `frontend/src/components/ui/MuteButton/FloatingMuteButton.module.css`
- Modify: `frontend/src/components/ui/index.ts` *(export both components)*

**Approach:**

- `useMuteToggle()` — returns `{ Icon, label, onClick }` where `Icon` is `VolumeUp` (pref=on) or `VolumeOff` (pref=off), and `label` describes the action the click will take (`"Unmute music"` when currently off, `"Mute music"` when currently on). Centralizes icon/label/click so both button variants stay consistent.
- `ToolbarMuteButton` — `<IconButton aria-label={label} onClick={onClick} size="small"><Icon /></IconButton>`, styled to sit next to the existing About/Home button in Navigation. No visibility gating — it renders whenever its parent (Navigation) renders.
- `FloatingMuteButton` — decides its own visibility based on `useLocation()` + `useGame()`:
  - Renders only when `location.pathname.startsWith("/game/") && roomState?.status !== "finished"`
  - Otherwise returns `null`
  - When rendered, `<IconButton>` wrapped in a fixed-position `<Box>` or a CSS-module div. CSS module handles:
    - `position: fixed`, `top` and `left` using `env(safe-area-inset-*)` with `var(--spacing-sm)` offset
    - `z-index: 101`
    - `background: var(--color-bg-elevated)`, `border: 1px solid var(--color-border-subtle)`, `border-radius: var(--radius-sm)`
    - Hover/focus visible styles matching the rest of the app

**Patterns to follow:**
- Navigation's existing MUI `IconButton`/`Button` styling for sizing
- `Reactions.tsx` for `position: fixed` + z-index + mobile considerations
- `Navigation.module.css` for CSS-module conventions in this repo

**Test scenarios (manual):**
- *Happy path* — Click `ToolbarMuteButton` on Home: `VolumeOff` icon swaps to `VolumeUp`; audio starts; `localStorage` updates.
- *Happy path* — Click `FloatingMuteButton` on Lobby: same behavior; icon updates in place.
- *Placement — Home/About* — `ToolbarMuteButton` visible in Toolbar; `FloatingMuteButton` returns `null`.
- *Placement — Lobby/Question/Results* — `FloatingMuteButton` visible top-left; Navigation (and hence `ToolbarMuteButton`) not rendered.
- *Placement — GameOver (finished)* — `ToolbarMuteButton` visible; `FloatingMuteButton` returns `null` because `roomState.status === "finished"`.
- *No double icon* — Walk through all five screens consecutively; exactly one mute icon is visible at any moment.
- *Mobile — Results at xs width* — Incoming reaction chips slide in under the floating button visually; button remains tappable (Reactions feed has `pointerEvents: none`; button z-index 101 > feed 99).
- *Mobile — bottom bar* — Reactions bottom bar (`zIndex: 100`) does not overlap the floating button at top-left.
- *Accessibility* — Tab-to-focus shows focus ring on both variants; `aria-label` reads current action.
- *iOS safe area* — On a device with notch (simulate via Chrome DevTools iPhone profile), button clears the status bar; landscape orientation respects `safe-area-inset-left`.

**Verification:**
- `npm run build` succeeds
- All placement scenarios match the placement matrix in the origin doc
- No `console.warn` or accessibility audit warnings in DevTools

---

- [ ] **Unit 4: App integration**

**Goal:** Wire `MusicProvider` into the App tree and render the two button variants in their correct React trees.

**Requirements:** R5, R6, R7

**Dependencies:** Units 2 and 3

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ui/Navigation/Navigation.tsx`

**Approach:**

- `App.tsx` changes:
  - Wrap children with `<MusicProvider>` inside `<GameProvider>`:
    ```
    GameProvider > MusicProvider > Router > (Navigation, FloatingMuteButton, <main>Routes</main>)
    ```
  - `<FloatingMuteButton />` renders as a sibling of `<Navigation />` inside `<Router>` so it has access to `useLocation()` and `useGame()`.
- `Navigation.tsx` changes:
  - In the right-side `<Box>` that currently wraps the About/Home `<Button>`, replace the direct child with a flex container:
    ```
    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
      <ToolbarMuteButton />
      {/* existing About/Home button */}
    </Box>
    ```
  - No change to the existing null-return gate at `Navigation.tsx:16`.

**Patterns to follow:**
- Existing App.tsx provider nesting order
- Navigation's existing Toolbar layout

**Test scenarios (manual end-to-end):**
- *Full game flow* — Opt in on Home → join or create room → start game → play through a full session → music plays continuously from opt-in through lobby, question, results, and game-over without restart.
- *Mute mid-game* — Opt in on Home, click Floating button during active Question: audio stops immediately, preference saved.
- *Opt in during active question* — Never-opted-in user clicks Floating button on Question: audio starts, music plays.
- *Persistence across tabs* — Opt in, open a new tab to the same origin: `localStorage` shows `"on"`, and on first gesture music starts in the new tab.
- *Opt out persists* — Click to unmute on Home, close tab, reopen: pref is `"off"`, no audio element created, no autoplay attempt.
- *Navigation rule intact* — Active question still hides the Navigation AppBar; Floating button is the only mute affordance there.
- *No collision with existing controls* — Start Game button, Answer input, Reactions buttons, and About/Home link all remain reachable and visually unobstructed.

**Verification:**
- `npm run build` succeeds
- Full game flow plays without audio interruption or visual collision
- Placement matrix in origin doc matches observed behavior on all five screens, desktop and mobile viewports

## System-Wide Impact

- **Interaction graph:** `MusicContext` is independent of `GameContext`. `FloatingMuteButton` reads from both via `useMusic()` + `useGame()` + `useLocation()`. No callbacks, middleware, or observers crossed.
- **Error propagation:** `audio.play()` rejection is the only failure mode. Caught at the `MusicProvider` level and routed into the one-shot gesture listener; never surfaces to the user.
- **State lifecycle:** `MusicProvider` mounts once with the App; the audio element persists across route changes. On provider unmount (app teardown, dev hot-reload), audio pauses and document listeners detach.
- **API surface parity:** None — this is a self-contained frontend feature. No backend, WebSocket, or nginx changes.
- **Integration coverage:** Covered by Unit 4's end-to-end acceptance scenarios; unit-level scenarios prove each piece in isolation.
- **Unchanged invariants:**
  - `Navigation`'s "hide during active gameplay" rule at `Navigation.tsx:16` is untouched — `FloatingMuteButton` satisfies the every-screen requirement without compromising the gameplay-chrome rule.
  - `Reactions` render gate, z-index, and `pointerEvents` are untouched.
  - `GameContext` state flow and WebSocket lifecycle are untouched.
  - `localStorage` keys used by `usePlayerName` and session tokens are untouched (`jduel_music_preference` is a new, non-colliding key).

## Risks & Dependencies

| Risk | Mitigation |
| --- | --- |
| Floating button visually overlaps incoming reaction chips on mobile Results | Elevated background + border for legibility, z-index 101 above feed (99) and bar (100). Feed has `pointerEvents: none` so clicks always reach the button. Accept brief animated overlap as a v1 trade-off. |
| Autoplay-recovery listener never fires (user never interacts) | Listener is `{ once: true }` and detaches on page unload. Worst case: one inert listener released on navigation. |
| User's tracks are mastered loud, 0.4 volume still too loud | Out of v1 scope (no slider). Document in `frontend/src/assets/music/README.md` that tracks should be mastered quietly (target around -12 LUFS peak). |
| iOS safe-area insets don't clear notch in landscape | Deferred-to-impl: verify visually on device or simulator; nudge `env()` offsets if needed. |
| Empty `tracks.ts` manifest at initial merge | Unit 2 handles the zero-tracks case gracefully: preference persists, no audio plays, no console errors. |
| Returning opted-in user closes tab before any gesture on the new visit | Listener is inert; no harm. Music simply does not play until any gesture. |
| Dev hot-reload re-mounts `MusicProvider` and spawns multiple audio elements | Cleanup in unmount effect pauses and discards the old element. Observed ergonomics should be verified during unit 2 work. |

## Documentation / Operational Notes

- `frontend/src/assets/music/README.md` is the only new doc — brief how-to for adding tracks.
- No changes to `docs/DeploymentGuide.md`, nginx config, systemd units, or CI workflows.
- No new runtime or dev dependencies added to `frontend/package.json`.
- No backend changes; no `docs/EventProtocol.md` update required.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-opt-in-music-requirements.md](../brainstorms/2026-04-19-opt-in-music-requirements.md)
- **Prior ideation:** [docs/ideation/2026-04-18-opt-in-music-ideation.md](../ideation/2026-04-18-opt-in-music-ideation.md)
- Related code:
  - `frontend/src/contexts/GameContext.tsx`
  - `frontend/src/contexts/useGame.ts`
  - `frontend/src/hooks/usePlayerName.ts`
  - `frontend/src/components/ui/Navigation/Navigation.tsx`
  - `frontend/src/features/game/Reactions/Reactions.tsx`
  - `frontend/src/App.tsx`
