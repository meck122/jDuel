# Speed Battle — Design Assets

Source of truth for the visual design of the Speed Battle game mode (see [`docs/brainstorms/2026-04-26-speed-battle-game-mode-requirements.md`](../../brainstorms/2026-04-26-speed-battle-game-mode-requirements.md)).

These artifacts were produced in [Claude Design](https://www.anthropic.com/news/claude-design-anthropic-labs) and exported as a "handoff bundle" for use by Claude Code.

## Contents

- **[`prototype/Speed Battle.html`](prototype/Speed%20Battle.html)** — self-contained interactive prototype. Open in a browser to click through the screens. React + JSX + inline CSS, all rendered via Babel-in-browser. **Mock data only** — real implementation must wire WebSocket + `SpeedBattleHandler` per the requirements doc.
- **[`prototype/tweaks-panel.jsx`](prototype/tweaks-panel.jsx)** — meta-tool for live-tuning prototype values (font sizes, leaderboard width, match duration). Used during design iteration; not part of the production design.
- **[`chats/chat1.md`](chats/chat1.md)** — full design conversation. Captures *intent* (what the user asked for, what landed, what was deferred). Read this before assuming any visual decision in the HTML is the final answer.
- **[`HANDOFF-README.md`](HANDOFF-README.md)** — original Claude Design handoff instructions to coding agents (kept verbatim from the bundle).

## Screens covered (in scope)

| Screen | Requirement | Notes |
|---|---|---|
| Lobby with Game Mode toggle | R1, R3, R4, R4a | Inline rules blurb when Speed Battle selected; ⚡ Start button |
| 3-2-1 countdown overlay | R5a | Animated, full-screen, ~3s total |
| Speed Battle round (in-game) | R5, R6, R8, R9, R9a, R13, R13a, R28, R28a | Top nav with ⚡ badge + persistent timer; question card; cooldown ring + lock pill; live leaderboard side panel (desktop) / compact strip (mobile <700px) |
| Time's Up overlay | R11, R15a | Slam-in animation before final results |
| Final leaderboard | R15, R17 | Placement medals, tiebreaker note, confetti |

## Screens explicitly out of scope (per design chat)

- **R12** — exhausted-pool terminal state (player answered all 100). Edge case; can ship without.
- **R21a** — reconnect-mid-cooldown view. Behavior is specified in requirements; visual treatment was deferred.

These need to be designed during PR 3 frontend implementation, but they're low-stakes per the requirements doc (R12 is intentionally low-polish; R21a's spec is "no notice — resume directly").

## Bonus: Classic lobby visual refinements

The prototype's Lobby page is a refined version of the existing Classic Lobby. CSS-level changes only (no behavior change). PR 3 implementer should decide whether to adopt these for both modes (recommended — they're polish, not redesign) or scope them out.

## Important: design tokens diverge from existing codebase

The prototype defines its own CSS custom properties that **don't match the existing jDuel token names**. Same intent (purple accent, monospace + display fonts, rounded corners) but different naming conventions. PR 3 must include a token-mapping pass.

| Prototype token | Existing codebase equivalent | Status |
|---|---|---|
| `--purple` (`rgb(139,92,246)`) | `--color-accent-purple` | Same hex, rename |
| `--font-d` ("Bebas Neue") | `--font-display` | Same intent, rename |
| `--font-m` ("JetBrains Mono") | (verify if exists) | Likely rename |
| `--r-lg`, `--r-md`, `--r-sm`, `--r-xl`, `--r-full` | `--radius-lg` (others?) | May need to add |
| `--bg0`, `--bg1`, `--bg2`, `--bg3` (background tier system) | (verify if exists) | Likely new — add to token file |
| `--fg`, `--fg2`, `--fg3`, `--fg4` (foreground tier system) | `--color-text-primary`, etc. | Verify equivalence; rename or add |
| `--gold` (`rgb(251,191,36)`) | (does not exist) | **New token** — used for Speed Battle badge + Host pill |
| `--teal` (`rgb(45,212,191)`) | (does not exist) | **New token** — used in some gradients |
| `--border`, `--border-s` | `--color-border-subtle` | Rename |

## Open issues / known deviations from the prototype

User-flagged items the implementer should weigh while building PR 3 — these are *not* "match the prototype exactly":

- **jDuel logo in the top nav is different** from the existing site. The existing logo wins; do not adopt the prototype's variant.
- **`prototype/tweaks-panel.jsx` is design-time only** — a meta-tool used during design iteration to live-tune values. Ignore it for production implementation.
- **Mobile layout is wonky and incomplete in the prototype.** R13a's collapsible drawer behavior is only partially in (a `<700px` switch to a compact "You: N · Leader: M" strip). Treat the mobile experience as needing a real design pass during PR 3, not as a solved problem.
- **Question + answer cards feel oversized in the prototype.** Scale down during implementation; don't carry over the prototype's default sizing 1:1. The prototype's `tweaks-panel.jsx` exposed font-size sliders precisely because the defaults were not final.

## Classic mode improvements — explicitly in scope for PR 3

The user has explicitly endorsed adopting the prototype's visual style improvements in Classic mode as well, **especially the leaderboard view** which is materially better than the existing Classic results UI. PR 3 should:

- Bundle the Classic Lobby refinements (room-code header treatment, player-tile styling, share-link card, settings-panel layout) for both modes.
- Adopt the prototype's leaderboard styling for Classic's existing results screen, not just the new Speed Battle final leaderboard.
- Keep all behavior unchanged in Classic — these are CSS-level changes only.

If the resulting PR 3 diff feels too large to review in one pass, the implementer may extract a "Classic visual refresh" sub-PR that lands first; default is to bundle.

## Implementation guidance

The HANDOFF-README in this folder says "recreate them pixel-perfectly in whatever technology makes sense for the target codebase." For jDuel that's React 19 + MUI v7 + `sx` prop pattern. Treat the prototype's React/JSX as **visual + structural reference**, not drop-in code:

- Match the visual output (layout, colors, typography, spacing, motion)
- Use existing MUI components where possible (`Box`, `Switch`, `FormControlLabel`, etc.)
- Adapt prototype tokens to existing CSS variables (or add new ones deliberately)
- Skip the prototype's mock data plumbing — wire to real `roomState` + WebSocket instead
- Reuse existing animation conventions if they exist; the prototype's keyframes are a starting point
