---
date: 2026-03-31
topic: mui-sx-migration
---

# MUI sx Migration — Frontend CSS Overhaul

## Problem Frame

The jDuel frontend has 18 CSS module files with 54+ hand-written `@media` blocks using three inconsistent magic-number breakpoints (380px, 600px, 768px). Each new feature requires manual mobile CSS fixes — centering issues, gaps, overflow problems — that keep recurring because there's no unified responsive strategy. The developer (solo, AI-assisted) needs a system where correct mobile behavior is the default, not something to fix after the fact.

An MUI sx migration was planned and decided in February 2026 but never executed. The same structural problems it would have fixed keep surfacing.

## Requirements

- R1. All game screen components (Question, Results, GameOver, Lobby) use MUI layout primitives (`Box`, `Stack`) with `sx` responsive props instead of CSS module files and hand-written `@media` queries.
- R2. All page components (HomePage, GamePage, AboutPage) and shared layout components (PageContainer) are migrated to MUI sx.
- R3. Breakpoints are sourced from the MUI theme exclusively — no raw pixel values in component styling.
- R4. Desktop layout remains full-width (not constrained to phone-card width). Mobile gets a clean single-column layout. The responsive difference is handled via MUI sx, not separate CSS files.
- R5. The MUI theme (`theme.ts`) is expanded to own spacing, breakpoints, and typography. `variables.css` is trimmed to visual-only tokens: gradients, glow shadows, accent colors, and display font references.
- R6. The migration is delivered screen-by-screen. Each phase is independently shippable and verified in production before the next begins.

## Success Criteria

- Zero hand-written `@media` queries remain in component files after full migration.
- A new component written by Claude using MUI sx automatically looks correct on mobile without a follow-up fix.
- The five game screens (HomePage, Lobby, Question, Results, GameOver) fit within 390×844 without overflow or clipping.
- `variables.css` is reduced to visual tokens only (target: under 60 lines).

## Scope Boundaries

- Not migrating to MUI component library (Button, TextField, etc.) — keep custom-styled HTML elements for the game's visual identity.
- Not adding visual regression tests (Playwright screenshots) — out of scope for this migration.
- Not redesigning any screen's visual appearance — layout and responsiveness only.
- Lobby settings side panel (desktop) → inline (mobile) is acceptable to simplify to inline-only if the panel migration adds disproportionate complexity.

## Key Decisions

- **Keep desktop wide:** Wordle-style phone-card layout rejected. Desktop stays full-width.
- **MUI for structure, variables.css for aesthetics:** Gradients, glows, and accent colors stay in CSS variables. MUI theme owns the responsive system. This is standard practice and avoids expressing complex visual effects as JS objects.
- **Phase order — simple to complex:** Theme foundation first, then GameOver → Results → Lobby → Question → HomePage. Each phase establishes patterns for the next.
- **Skip clamp() as a standalone step:** Fluid typography would be deleted by the MUI migration anyway. Not worth the intermediate churn.
- **Question screen last:** The most complex component (currently uses `position: fixed; inset: 0` as a mobile hack). Tackle it after patterns are established on simpler screens.

## Migration Phases

- **Phase 1 — Theme foundation:** Expand `theme.ts` with spacing scale, breakpoints, and typography. Trim `variables.css` to visual tokens only. Establish MUI sx patterns.
- **Phase 2 — GameOver:** Simplest game screen. Validate the patterns.
- **Phase 3 — Results:** Medium complexity (player list, score grid).
- **Phase 4 — Lobby:** Side panel → inline settings on mobile.
- **Phase 5 — Question:** Fix `position: fixed` hack, migrate options grid.
- **Phase 6 — Pages:** HomePage, PageContainer, AboutPage.

## Dependencies / Assumptions

- MUI v7 and `@emotion/react` are already installed as production dependencies.
- `theme.ts` already exists with partial palette/typography — it gets expanded, not replaced.
- Navigation component is already MUI — no migration needed there.

## Outstanding Questions

### Deferred to Planning

- [Affects R5][Technical] Should `global.css` button/form base styles move into MUI theme `components` overrides, or stay as global CSS reset?
- [Affects R1][Technical] Question screen: replace `position: fixed; inset: 0` with a `height: 100dvh` flex layout or keep the overlay approach and just rewrite it in sx?
- [Affects R4][Needs research] What MUI breakpoint values to use — default MUI (`xs:0, sm:600, md:900`) or custom values matching current breakpoints?

## Next Steps
→ `/ce:plan` for structured implementation planning
