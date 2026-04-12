# MUI sx Responsive Migration

**Date:** 2026-02-10
**Status:** Decided

## Problem

Mobile UI breaks across different viewport sizes. The current approach uses CSS modules with hand-written media queries at inconsistent breakpoints (600px, 768px, 380px). Each view handles responsiveness differently:

- **Question view**: Uses `position: fixed; inset: 0` to hijack the full viewport. Works but is a hack.
- **Results view**: Normal document flow. Timer gets clipped on iPhone SE (375x667). Layout looks bad on small screens.
- **GameOver view**: Similar flow-based issues.

There's no unified strategy for constraining game content to the viewport. Every new resolution introduces new breakage.

## What We're Building

A full frontend migration from CSS modules to MUI's `sx` prop system with theme-based responsive breakpoints.

### Scope
- **All game views**: Lobby, Question, Results, GameOver
- **All pages**: HomePage, GamePage, AboutPage
- **Layout components**: PageContainer, Navigation (already MUI)
- **Design tokens**: Move `variables.css` values into MUI theme

### Scroll Policy
- **Question view**: Must fit within viewport without scrolling (time pressure)
- **Results/GameOver/Lobby**: Can scroll if needed, but layout should look good at any size

## Why This Approach

**Chosen: MUI sx + Theme Breakpoints (Approach 1)**

Replace CSS modules with MUI's `Box`, `Stack`, `Container` using the `sx` prop. Move design tokens (colors, spacing, typography) into the MUI theme. Use MUI's breakpoint system (`xs`, `sm`, `md`) for responsive behavior.

### Why not alternatives?
- **Hybrid (MUI layout + CSS modules)**: Two styling systems to maintain. Confusing ownership of spacing.
- **Full MUI component migration**: Too heavy. Risk of losing the custom dark game aesthetic. MUI's `Button`, `TextField` etc. would fight the existing design identity.
- **Keep CSS + fix incrementally**: Whack-a-mole. The structural problem (no viewport constraint strategy) remains.

## Key Decisions

1. **MUI sx over CSS modules** - Single responsive system, breakpoint-aware by default
2. **Theme-based design tokens** - Colors, spacing, typography from `variables.css` move into `jeopardyTheme`
3. **Full frontend scope** - All views and pages migrate for consistency
4. **Question view stays viewport-locked** - Only view that must never scroll
5. **Results/GameOver can scroll** - But layout must degrade gracefully on small screens

## Open Questions

- Should `global.css` base styles (reset, body background, button defaults) move into MUI theme `components` overrides, or stay as global CSS?
- How to handle the custom gradients and glow shadows? MUI theme custom values vs keeping a small `variables.css` for visual tokens only?
- What MUI breakpoint values to use? Default MUI breakpoints (`xs: 0, sm: 600, md: 900, lg: 1200`) or custom?

## Technical Notes

### Current Architecture
- `variables.css` - 140 lines of CSS custom properties (colors, spacing, fonts, shadows, gradients)
- `global.css` - Reset, form elements, button styles, reusable classes (`.game-section`, `.content-box`, `.score-item`)
- 10+ CSS module files for game features
- MUI theme at `theme.ts` - Already defines palette, typography, component overrides
- Navigation component already uses MUI (`AppBar`, `Toolbar`, `Button`, `Box`)

### Migration Surface
- `frontend/src/features/game/` - 10 component + 10 CSS module files
- `frontend/src/pages/` - 3 pages with CSS modules
- `frontend/src/components/` - Layout and UI components
- `frontend/src/styles/` - `variables.css`, `global.css`
- `frontend/src/theme.ts` - Expand with all design tokens
