---
date: 2026-04-18
topic: opt-in-music
focus: opt-in background music with global mute button; N user-provided tracks
mode: repo-grounded
---

# Ideation: Opt-In Music Feature

## Grounding Context

### Codebase Context
- React 19 + Vite frontend, FastAPI backend, Material-UI v7
- No existing audio code — blank slate; this feature will establish the pattern
- `frontend/src/components/ui/Navigation/Navigation.tsx` is the shared AppBar/Toolbar — natural host for a mute button
- **Critical:** `Navigation.tsx:16` returns `null` during active gameplay (`isGamePage && !isGameFinished`). The "every screen" requirement collides with this rule.
- `GameContext.tsx` is the only context in use; no global preferences context exists
- `localStorage` is used for player names (`usePlayerName`) and session tokens; no prefixed-key convention yet
- Router: `HomePage`, `GamePage`, `AboutPage`; `Navigation` wraps all routes
- No `docs/solutions/` prior art for audio, preferences, or autoplay

### External Research
- **Autoplay in 2026:** uniformly blocked until gesture across Chrome/Firefox/Safari. Opt-in click *is* the gesture — autoplay policy is fully resolved.
- **Library landscape:** Howler.js (~7KB gz) is dominant for browser games; handles mobile unlock, fade, loop, volume. `react-use-audio-player` wraps it with React context.
- **UX norms:** top-right speaker icon is near-universal; mute-only (no volume slider) is correct scope at N<6. MUI `VolumeUp`/`VolumeOff` icons available.
- **WCAG 1.4.2 Audio Control:** satisfied entirely by default-off. No browser/OS `prefers-reduced-audio` equivalent.
- **Vite:** reference audio via `new URL('./tracks/x.mp3', import.meta.url)`; lazy-load first track on opt-in, preload rest after.
- **Cautionary tale:** Kahoot shipped music without in-app mute; community complaints ran for years.

## Direct Answers

**Complexity:** Low–Medium for v1. ~1 context + 1 hook + 1 Toolbar button + 1 localStorage key + audio assets. ~1 focused day. Decisions below can push to Medium–High.

**How it's implemented:**
1. Single audio instance (Howler singleton *or* one `<audio>` ref) mounted at App root so it survives route changes
2. `MusicProvider` / `PreferencesProvider` context reads `localStorage` on mount
3. Mute button in `Navigation` Toolbar uses `VolumeUp`/`VolumeOff`; click handler is the gesture that unlocks autoplay + persists the pref
4. Tracks referenced via `new URL('./tracks/x.mp3', import.meta.url)`
5. Opt-in click inside a handler is a valid user gesture in all three browsers in 2026

## Ranked Ideas

### 1. Gameplay-chrome collision — RESOLVED (B1 hybrid)
**Decision:** Hybrid — mute button in the `Navigation` Toolbar on screens that have an AppBar (Home, About, GameOver); a floating mute button at **top-left** on gameplay screens without an AppBar (Lobby, Question, Results). Music plays continuously through all phases, including the active question.

**Why top-left (not top-right / bottom-*):** Only corner that is clean on all three no-AppBar screens. `Reactions` renders during `results` and `finished` and owns:
- top-right / full-width-top on mobile (reactions feed, z99)
- bottom full-width (reactions bar, z100)

Top-left is the only position free of reactions conflicts on Results.

**Implementation notes:**
- One `<MuteButton />` component that reads current `roomState.status` (or location) and self-positions
- Or two small components (`ToolbarMuteButton` inside Navigation + `FloatingMuteButton` rendered at App root with conditional visibility)
- Fixed position with `z-index` above page content; safe-area insets for iOS

**Tradeoff accepted:** the button changes corner between Home→Lobby (top-right Toolbar → top-left float). Consistent muscle memory on the 3 gameplay screens matters more than cross-route consistency.

**Status:** Explored

### 2. Music-only v1 vs general audio layer
**Description:** Build only for background music now, or design a general audio layer on day one assuming SFX (correct-answer ding, timer tick, buzzer) will follow?
**Rationale:** SFX is a natural next feature for a trivia game. Going generic later means rewriting the context and the mute semantics (mute both? separate toggles?).
**Downsides:** Generic now = YAGNI risk; music-only now = rewrite risk. Hinges on whether SFX is actually roadmapped.
**Confidence:** 70% that music-only v1 is right if SFX isn't planned this quarter.
**Complexity:** Music-only: Low. Generic: Medium.
**Status:** Unexplored

### 3. GlobalPreferencesContext vs narrow MusicContext
**Description:** No global-preferences pattern exists. Create a narrow `MusicContext` (smallest surface, swap later), or establish `PreferencesContext` now (music + future theme, reduced-motion, SFX).
**Rationale:** First-mover pattern decisions shape the next N features.
**Downsides:** Generalizing for unknown future needs is speculative; narrow now costs a small refactor later.
**Confidence:** 75% narrow is right — one concrete pref doesn't justify a framework.
**Complexity:** Both Low; generic is ~1.5× the code.
**Status:** Unexplored

### 4. Bare mute button vs settings drawer — Implied by #1
**Description:** Ship just a mute icon in the Toolbar, or build a small settings drawer this mute lives inside (future: volume, SFX, track selection).
**Implied answer:** Bare button. A floating drawer on gameplay screens would be clunky and consume more than the top-left corner. Bare icon is consistent across Toolbar and floating contexts.
**Confidence:** 90% bare button for v1 given #1 = B1.
**Complexity:** Low.
**Status:** Explored

### 5. Track rotation strategy
**Description:** Sequential, shuffle with no-repeat-in-a-row, or single looping track. For N=1: trivial loop. For N=3–5: shuffle-no-repeat materially improves feel vs sequential. Optional 1–2s crossfade (Howler `fade()`).
**Rationale:** Matters more than it seems for a game that gets replayed; hearing the same lobby track every time changes how the game "feels."
**Downsides:** Shuffle state must survive route changes; crossfade adds slight complexity.
**Confidence:** 70%. Needs the actual track count.
**Complexity:** Low.
**Status:** Unexplored

### 6. Opt-in presentation
**Description:** How does the user first enable music?
- **(a) Ambient mute button:** speaker icon always visible; clicking it is both the gesture and the opt-in.
- **(b) Lobby prompt:** one-time "🎵 Play music this round?" chip in the lobby before gameplay pressure. Mute button still exists for later toggling.

**Rationale:** Board-game analogy — house rules are set at the table, not mid-play. Lobby prompt may produce higher opt-in rate; ambient button is less intrusive.
**Downsides:** (b) adds UI that's only relevant once (and must be dismissible). (a) risks users never noticing the feature.
**Confidence:** 60%. Worth an experiment.
**Complexity:** (a) Low; (b) Low–Medium.
**Status:** Unexplored

### 7. Howler.js vs raw HTML5 audio
**Description:** Add Howler (~7KB gz; mobile unlock, fade, loop, volume) or use a raw `<audio ref>` element.
**Rationale:** Raw audio is sufficient for N=1 loop; Howler becomes the right answer the moment you want fade, shuffle-crossfade, or SFX layering. Depends on #2 and #5.
**Downsides:** Dependency weight vs rewriting if requirements grow. Howler is well-maintained.
**Confidence:** 75% Howler is right unless v1 is strictly N=1 with no fade.
**Complexity:** Howler: Low. Raw: Low.
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| A2 | iOS/Safari autoplay workarounds | Opt-in click = gesture fully resolves; implementation gotcha |
| A5 | Track restarts on route change | Solved by App-root mount; implementation detail |
| A6 | Volume slider instead of mute | Mute-only is right for N<6 per research |
| A7 | Pause on blur | Polish, not a v1 design decision |
| B3 | Single long ambient loop | Duplicates Decision #5 (N=1) less directly |
| B4 | Host-synced music for all players | Major scope expansion; different feature |
| B5 | Skip the mute button entirely | Contradicts explicit ask |
| B6 | First click anywhere starts music | Violates opt-in principle |
| C2 | Persist vs re-confirm each visit | Only one sane answer |
| C3 | "Mute" vs "toggle" semantic | Terminology, swallowed by Decision #4 |
| D4 | Declarative tracks manifest | Implementation tactic |
| D5 | Prefixed localStorage key | Implementation detail |
| E2 | Spotify-style "enabled" vs "playing" split | Overkill for N<6 |
| E4 | Remember loop resume position | Overkill |
| F2 | Design for N=100 | Constraint-flipping exercise, not direction |
| F3 | Design for 0% opt-in | Supports lazy load; doesn't compete |
| F4 | Design for 100% opt-in | Polish |
| F6 | Stream tracks from backend | Rejected by stated context (user provides tracks) |
