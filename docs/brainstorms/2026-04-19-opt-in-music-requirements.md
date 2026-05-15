---
date: 2026-04-19
topic: opt-in-music
---

# Opt-In Background Music

## Problem Frame

jDuel is a real-time trivia game played with friends. It currently has no audio. Adding atmospheric background music would make the game feel more alive during lobby wait, question tension, and results, but only for players who want it — and only on their terms. The feature must be off by default (WCAG 1.4.2), cheap to ignore, and reachable from any screen at any moment.

This is the first audio code in the codebase and the first global user-preference, so the shape set here becomes the default pattern for future audio or prefs work.

## Requirements

**Playback**
- R1. Music is off by default. Users must actively opt in; no audio plays until the user clicks the mute/unmute control.
- R2. Once opted in, music plays continuously across the session, including the active question phase — through lobby, question, results, and game-over transitions without restarting.
- R3. When N ≥ 2 tracks are provided, the player uses shuffle with no-repeat-in-a-row. When N = 1, the single track loops.
- R4. On a return visit with preference = on, playback resumes automatically as soon as browser policy allows — at latest on the next user gesture (any click/keypress).

**Controls and placement**
- R5. A single mute/unmute control is reachable on every screen of the app.
- R6. On screens that render the `Navigation` AppBar (Home, About, GameOver), the control lives in the Toolbar.
- R7. On gameplay screens that hide the AppBar (Lobby, Question, Results), the control renders as a fixed-position floating button at the **top-left** of the viewport.
- R8. Clicking the control toggles playback and persists the new preference in the same action.
- R9. The control icon reflects current preference state (speaker-on vs speaker-off) and is visible and tappable on both desktop and mobile.

**Persistence**
- R10. The music preference persists in `localStorage` under a `jduel:`-prefixed key (consistent with the existing player-name and session-token usage).
- R11. Track position is not persisted across page loads — fresh load picks a new track.

### Placement matrix

| Screen       | `roomState.status` | AppBar? | Mute button placement                  | Reactions conflict? |
| ------------ | ------------------ | ------- | -------------------------------------- | ------------------- |
| Home         | —                  | Yes     | Toolbar (right, near About)            | No                  |
| About        | —                  | Yes     | Toolbar (right)                        | No                  |
| Lobby        | `waiting`          | No      | Floating, top-left                     | No                  |
| Question     | `playing`          | No      | Floating, top-left                     | No                  |
| Results      | `results`          | No      | Floating, top-left                     | Yes (top-right feed, bottom bar) |
| Game Over    | `finished`         | Yes     | Toolbar (right)                        | Yes (top-right feed, bottom bar) |

## Success Criteria

- A player who wants music can enable it on Home and keep it running through a full game (lobby → question → results → game over) without it disappearing, restarting, or colliding with Reactions.
- A player who never clicks the icon never hears anything and sees no intrusive onboarding.
- A returning opted-in player hears music resume without having to click the icon again (after any user gesture on the page).
- The mute control is reachable and tappable on every screen at every room state, on both desktop and mobile viewports.

## Scope Boundaries

- No volume slider — mute is binary.
- No sound effects (SFX) — music only in v1.
- No settings drawer or menu — the bare icon is the only control surface.
- No lobby prompt or dedicated onboarding — the ambient icon is the opt-in affordance.
- No pause-on-blur / pause-on-window-focus-loss.
- No host-synced or per-room music selection.
- No streaming from the backend — tracks are bundled static assets.
- No persistence of track position across page loads.

## Key Decisions

- **Hybrid placement (ideation #1).** Toolbar where the AppBar already exists; top-left float on Lobby/Question/Results. Top-left is the only corner free of Reactions conflicts (feed at top-right z99, bar at bottom full-width z100) on Results, and the only corner that stays consistent across all three AppBar-less gameplay screens.
- **Music-only v1 (ideation #2).** SFX is not roadmapped this quarter. A narrow music scope avoids multi-channel architecture that would sit unused.
- **Narrow `MusicContext` (ideation #3).** No other preferences exist or are planned. Generalizing to a `PreferencesContext` now would be speculative; the refactor is cheap when a second pref actually arrives.
- **Bare button, no drawer (ideation #4).** A drawer on gameplay screens would be clunky and consume more than the corner. A single icon stays consistent between Toolbar and floating contexts.
- **Shuffle with no-repeat-in-a-row (ideation #5).** Sequential rotation gets stale on replays; shuffle materially improves feel at N = 3–5 and degenerates cleanly to a loop at N = 1.
- **Ambient button is the opt-in (ideation #6).** The always-visible icon is both the user gesture that unlocks audio and the affordance that communicates the feature exists. No lobby prompt to build or dismiss.
- **Raw HTML5 `<audio>` (ideation #7).** Howler's benefits (mobile unlock, fade, multi-channel, sprites) don't apply here — the opt-in click is the unlock gesture, there is no SFX layer, and no crossfade requirement. A dependency is unjustified.

## Dependencies / Assumptions

- Tracks: user provides N MP3 files, bundled as static frontend assets. MP3 is universally supported.
- Browser autoplay policy in 2026 is uniform across Chrome/Firefox/Safari: blocked until user gesture. The opt-in click satisfies this on first visit; any subsequent gesture satisfies it on return visits.
- `localStorage` is available (already used by `usePlayerName` and for session tokens).
- No existing audio code or global-preferences pattern — this feature establishes both.

## Outstanding Questions

### Resolve Before Planning

(none)

### Deferred to Planning

- [Affects R6/R7][Technical] Single `<MuteButton />` component that self-positions based on location + `roomState.status`, or two small components (`ToolbarMuteButton` inside `Navigation`, `FloatingMuteButton` mounted at App root with conditional visibility). Either is fine; pick based on which is cleaner.
- [Affects R7][Technical] Exact float offsets, `z-index`, and iOS safe-area inset handling so the floating button clears the notch and stays above page content without overlapping Reactions on Results.
- [Affects R1–R4][Technical] Track asset location (`frontend/src/assets/music/` via `new URL('...', import.meta.url)` vs `frontend/public/music/`) and preload strategy (recommended: lazy-load first track on opt-in, preload remaining in the background).
- [Affects R4][Technical] Mechanism for resuming playback on next user gesture when the browser blocks the initial `play()` call — a one-shot document-level `pointerdown`/`keydown` listener is the conventional approach.
- [Affects R8][Technical] Default volume level (40% is a reasonable starting point for background music that shouldn't drown out conversation).
- [Affects R10][Technical] Exact `localStorage` key name — suggest `jduel:prefs:music` to leave room for future `jduel:prefs:*` siblings without collision.

## Next Steps

`Resolve Before Planning` is empty → `-> /ce-plan` for structured implementation planning.
