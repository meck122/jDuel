---
date: 2026-03-28
topic: mobile-ui-polish
---

# Mobile UI Polish Pass

## Problem Frame

On mobile (390x844), several game screens have visual issues that make the app feel unfinished: the lobby has a disconnected settings panel, the question view wastes vertical space, the results timer looks clunky, and game over requires scrolling. Mobile players are the primary audience and shouldn't need to scroll during gameplay views.

## Requirements

- R1. **Lobby: merge settings into main card on mobile.** On screens <=768px, fold Game Settings into the bottom of the main lobby card as an inline section with a divider. No separate floating card. On desktop, keep the side-by-side layout.
- R2. **Question view: eliminate dead space.** Remove the top gap above Q1/10 header and the bottom gap below the last answer button. Answer option buttons should stretch/distribute to fill available vertical space on mobile. No scrolling required.
- R3. **Results timer: replace progress bar with small circular timer.** Use the same circular countdown ring component from the question view but at a smaller size. Show "Next question in" as a label near the ring. Remove the linear progress bar entirely from results.
- R4. **Results: tighten spacing.** Reduce the excessive top whitespace above "Round Results" header. Ensure the entire results view (answers + scoreboard + timer + reactions) fits on mobile without scrolling.
- R5. **Game Over: fit on mobile viewport.** Tighten spacing so champion card + play again button + final standings + reactions all fit without scrolling. Reduce margins between sections.
- R6. **General: professional feel.** Fix player name truncation in results (show full names or truncate gracefully). Ensure consistent spacing and visual rhythm across all screens.

## Success Criteria

- All 5 game screens (home, lobby, question, results, game over) fit within a 390x844 viewport without scrolling
- Visual consistency across screens (timer style, spacing, card styles)
- No regressions on desktop layout

## Scope Boundaries

- NOT redesigning the color scheme, typography, or brand identity
- NOT changing the home page (it looks solid)
- NOT modifying game logic or backend
- Desktop layout changes only where needed to avoid breaking merged-settings lobby

## Key Decisions

- **Circular timer for results**: Matches the question view's visual language, looks professional, compact
- **Merge settings into lobby card on mobile**: One cohesive panel eliminates the floating orphan settings box

## Next Steps

-> Proceed directly to work — scope is clear, CSS-only changes
