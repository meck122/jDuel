---
title: "refactor: MUI sx Responsive Migration"
type: refactor
status: completed
date: 2026-03-31
origin: docs/brainstorms/2026-03-31-mui-sx-migration-requirements.md
---

# refactor: MUI sx Responsive Migration

## Overview

Replace all 18 CSS module files with MUI `sx` prop-based styling using the already-installed MUI v7 + Emotion stack. The goal is to eliminate recurring mobile CSS bugs by making correct responsive behavior the default, not something to patch after the fact. Desktop stays full-width; mobile gets clean single-column layouts; the responsive difference is handled via MUI theme breakpoints instead of scattered magic-number `@media` blocks.

Delivered in 7 phases, each independently shippable to production.

## Problem Statement

jDuel's frontend has 18 CSS module files containing 54+ hand-written `@media` blocks with three inconsistent magic-number breakpoints (380px, 600px, 768px). Each new feature triggers a CSS fix cycle — typically: "build → notice mobile broken → ask Claude to fix → repeat." This is caused by no unified responsive strategy: every component independently re-invents flex/grid layouts and mobile overrides.

MUI v7 and `@emotion/react` are installed but completely unused for styling (only used for icons and `ThemeProvider` wiring). The project is paying the ~150KB bundle cost with zero benefit.

A migration was planned in February 2026 but not executed. The same bug classes keep recurring.

## Proposed Solution

Phase-by-phase migration to MUI `sx` prop, simple screens first to establish patterns, complex screens last. Each phase deletes one or more CSS module files and replaces them with inline `sx` objects that reference the MUI theme's breakpoints and spacing.

**Design token split:**
- **MUI theme** owns: spacing scale, breakpoints, typography, palette
- **`variables.css`** keeps: gradients, glow shadows, accent colors, Bebas Neue/JetBrains Mono font references (visual/aesthetic tokens — awkward to express in JS)
- CSS variables can be referenced directly in `sx` via `'var(--color-accent-purple)'` strings — fully supported

## Technical Approach

### Architecture

**MUI v7 responsive sx pattern (use object syntax — not array syntax):**
```tsx
// Preferred in v7
<Box sx={{ p: { xs: 2, sm: 3, md: 4 }, flexDirection: { xs: 'column', md: 'row' } }} />

// Array syntax — valid but not recommended (fragile positional mapping)
<Box sx={{ p: [2, 3, 4] }} />
```

**Stack with `useFlexGap` (recommended for new code):**
```tsx
<Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }} useFlexGap>
```

**CSS variables in `sx` — the bridge pattern:**
```tsx
// Any existing CSS variable works as a string in sx:
<Box sx={{ background: 'var(--gradient-purple)', boxShadow: 'var(--shadow-glow-purple)' }} />
```

**`cssVariables: true` in theme.ts** — enables MUI to emit all theme values as CSS custom properties (`--mui-palette-primary-main`, etc.) on `:root`. Lets existing `variables.css` reference them if needed and enables dark/light mode token swapping. Enable in Phase 1.

**Theme-level module augmentation** for any custom values (navbar height, reactions bar height):
```ts
declare module '@mui/material/styles' {
  interface Theme {
    custom: { navbarHeight: string; reactionsBarHeight: string };
  }
  interface ThemeOptions {
    custom?: { navbarHeight?: string; reactionsBarHeight?: string };
  }
}
```

**Shared `sx` patterns file** (`frontend/src/styles/sxPatterns.ts`) — replaces the six CSS `composes: from global` usages:
```ts
export const sxCard = { background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)' };
export const sxGameSection = { ... };
```

### Implementation Phases

#### Phase 1: Theme Foundation

**Goal:** Establish the single source of truth for layout tokens. No component changes.

**Tasks:**
- Fix `background.default/paper` divergence: theme.ts uses `rgb(18, 18, 18)` / `rgb(28, 28, 28)` but `variables.css` defines `rgb(18, 16, 28)` / `rgb(26, 24, 38)`. Use `variables.css` values — the purple warmth is intentional.
- Enable `cssVariables: true` in `createTheme`
- Add custom breakpoints matching current app layout breakpoints:
  ```ts
  breakpoints: { values: { xs: 0, sm: 600, md: 768, lg: 1024, xl: 1280 } }
  ```
  Rationale: current app uses 768px as the primary "tablet/desktop" breakpoint. MUI's default `md` is 900px which does not match. Setting `md: 768` means `sx={{ display: { xs: 'none', md: 'block' } }}` matches existing behavior.
- Add spacing scale mirroring `variables.css` spacing tokens (0, 4, 8, 12, 16, 24, 32, 48, 64 px → `theme.spacing(0–8)`)
- Add `palette.warning` (referenced in GamePage retry state but missing from theme)
- Add font families to `typography`:
  ```ts
  typography: { fontFamily: 'system-ui, ...', displayFamily: '"Bebas Neue", cursive' }
  ```
  Add TypeScript module augmentation for `displayFamily`
- Add TypeScript module augmentation for `theme.custom` (navbarHeight, reactionsBarHeight)
- Fix `typography.h1/h2/h3` to use `variables.css` values as source of truth
- Create `frontend/src/styles/sxPatterns.ts` with shared sx objects replacing global `composes:` usage

**Success criteria:** `npm run build` passes. No visual change to any screen.

**Files changed:** `theme.ts`, `frontend/src/styles/sxPatterns.ts` (new file)

---

#### Phase 2: Infrastructure & Easy Wins

**Goal:** Migrate all 0-media-query components + PageContainer. Validate the sx pattern.

**Tasks:**

`PageContainer.tsx` + `PageContainer.module.css` → MUI `Box` with sx:
```tsx
<Box
  sx={{
    minHeight: '100dvh',
    width: '100%',
    display: centered ? 'flex' : undefined,
    alignItems: centered ? 'center' : undefined,
    justifyContent: centered ? 'center' : undefined,
    p: { xs: 1, sm: 3 },
    maxWidth: maxWidthMap[maxWidth],
    mx: 'auto',
  }}
>
```

`PlayerName.module.css` — 1 trivial rule (`.youBadge` color) → inline sx on the span element. Delete module file.

`GamePage.module.css` — no media queries, error/retry card styles → sx on Box elements. Delete module file.

`GameView.module.css` — no media queries, simple container → sx. Delete module file.

**Fix broken token references** (discovered in research — these are bugs regardless of migration):
- `LinearTimer.module.css` references `--color-bg-tertiary`, `--border-radius-full`, `--color-border`, `--font-family-mono` — none defined in `variables.css`. Fix by using correct defined tokens.
- `QuestionHeader.module.css` references `--font-family-mono`, `--color-text-tertiary` — undefined. Fix by using `--font-mono` and `--color-text-muted`.

**Success criteria:** 4 CSS module files deleted. All screens visually identical.

---

#### Phase 3: GameOver

**Goal:** Migrate GameOver screen. Establish pattern for animation-heavy components.

**Key challenge — confetti `nth-child` selectors:**
`GameOver.module.css` uses `nth-child` CSS selectors to position and color 20 confetti pieces. The `sx` prop has no equivalent. Solution: convert to a data-driven `CONFETTI_PIECES` array in the TSX with explicit `sx` per piece.

```tsx
const CONFETTI_PIECES = [
  { left: '10%', color: 'var(--color-accent-purple)', delay: '0s', size: 8 },
  { left: '20%', color: 'var(--color-accent-teal)', delay: '0.3s', size: 10 },
  // ... 18 more
];

{CONFETTI_PIECES.map((piece, i) => (
  <Box key={i} sx={{ position: 'absolute', left: piece.left, width: piece.size, height: piece.size * 0.4, background: piece.color, animation: `confettiFall var(--transition-slow) ${piece.delay} infinite` }} />
))}
```

**Keep `@keyframes` in CSS.** The `animation` CSS property can reference named keyframes defined anywhere, but the keyframes themselves cannot be inline in `sx`. Create `frontend/src/styles/animations.css` for all keyframe definitions.

**Files changed:** `GameOver.tsx`, `GameOver.module.css` (deleted), `animations.css` (new)

**Success criteria:** GameOver screen visually identical, no scroll on 390×844, confetti animates correctly.

---

#### Phase 4: Results

**Goal:** Migrate Results screen. Establish pattern for responsive 2-column grids.

**Key change — 2-column grid → MUI Grid:**
```tsx
// Current CSS: grid-template-columns: 1fr 1fr at desktop, 1fr at 768px
// New sx:
<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 1, sm: 2 } }}>
```

Or using MUI Grid v2 (stable in v7):
```tsx
<Grid container spacing={{ xs: 1, sm: 2 }}>
  <Grid size={{ xs: 12, md: 6 }}>{/* Scores */}</Grid>
  <Grid size={{ xs: 12, md: 6 }}>{/* Answers */}</Grid>
</Grid>
```
Note: v7 Grid uses `size` prop, not `xs`/`sm` directly on the grid item.

**Timer component note:** `Timer.tsx` and `LinearTimer.tsx` use SVG elements. SVG cannot use the MUI `sx` prop directly. These components stay as CSS modules (or use `styled()`). Do not attempt to migrate SVG styling to `sx` in this phase.

**Files changed:** `Results.tsx`, `Results.module.css` (deleted)

**Success criteria:** Results screen identical on desktop and mobile. 2-column layout on desktop (≥768px), single column on mobile.

---

#### Phase 5: Lobby + GameSettings

**Goal:** Migrate the Lobby screen and its settings sub-components. Handle side panel show/hide.

**Key change — side panel visibility:**
Replace the `settingsSide`/`settingsInline` dual-render pattern with sx display toggle:
```tsx
// Desktop: show side panel, hide inline
// Mobile: hide side panel, show inline section

// Side panel (rendered once, toggled via sx):
<Box sx={{ display: { xs: 'none', md: 'block' } }}>
  <GameSettings />
</Box>

// Inline inside card (rendered once, toggled via sx):
<Box sx={{ display: { xs: 'block', md: 'none' }, mt: 2, pt: 2, borderTop: '2px solid var(--color-border-default)' }}>
  <GameSettings />
</Box>
```

This renders `GameSettings` twice (once for each display context) but avoids two different component instances — MUI's `display` toggle is cleaner than the current dual-render with separate CSS classes.

**`MultipleChoiceToggle` — CSS `:checked + .slider` has no sx equivalent:**
The current implementation uses a hidden checkbox + CSS `:checked + .slider::after` pseudo-element for the toggle animation. Migrate to MUI `Switch`:
```tsx
import Switch from '@mui/material/Switch';
<Switch checked={isMultipleChoice} onChange={handleToggle} color="secondary" />
```
Visually verify the toggle matches the existing design. MUI Switch in dark mode with `color="secondary"` (teal) should be close.

**`DifficultySelector` pill-track** — custom but achievable in sx with flex + selected-state border styling.

**Files changed:** `Lobby.tsx`, `Lobby.module.css` (deleted), `GameSettings.tsx`, `GameSettings.module.css` (deleted), `DifficultySelector.tsx`, `DifficultySelector.module.css` (deleted), `MultipleChoiceToggle.tsx`, `MultipleChoiceToggle.module.css` (deleted)

**Success criteria:** Settings panel visible beside lobby on desktop, inline on mobile. Toggle visually functional.

---

#### Phase 6: Question

**Goal:** Migrate the most complex screen. Fix the `position: fixed; inset: 0` mobile layout.

**The `position: fixed` approach is intentional — Question must never scroll** (time pressure). Preserve it via responsive sx:

```tsx
<Box
  sx={{
    position: { xs: 'fixed', sm: 'static' },
    inset: { xs: 0, sm: 'auto' },
    overflow: { xs: 'hidden', sm: 'visible' },
    display: 'flex',
    flexDirection: 'column',
    p: { xs: '12px 16px', sm: 3 },
    background: { xs: 'var(--color-bg-primary)', sm: 'transparent' },
    zIndex: { xs: 1, sm: 'auto' },
  }}
>
```

**Options grid — 2-column → 1-column:**
```tsx
<Box
  sx={{
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
    gap: { xs: 1, sm: 2 },
    maxWidth: { xs: '100%', sm: '600px' },
    mx: 'auto',
    mt: { xs: 0, sm: 2 },
    flex: { xs: 1, sm: 'initial' },
    minHeight: { xs: 0, sm: 'auto' },
    alignContent: { xs: 'center', sm: 'initial' },
  }}
>
```

**Extra-small phone breakpoint (iPhone SE, 380px):** The current 380px breakpoint has no MUI equivalent. Options: add a custom `xxs` breakpoint or handle via `sx` with a CSS media query string fallback. Recommend: add `xxs: 380` to the custom breakpoints defined in Phase 1.

**Reactions bar interaction:** The Question overlay at `z-index: 1` and the Reactions button bar at `z-index: 100` are in a documented stack order. When migrating, use `theme.custom` z-index values and verify the Reactions bar (fixed at `bottom: 0`) is visible over the Question fixed overlay. See the known bug history: the fixed-position navbar offset must use `calc(var(--navbar-height) + spacing)`, not raw pixels.

**Files changed:** `Question.tsx`, `Question.module.css` (deleted), `QuestionHeader.tsx`, `QuestionHeader.module.css` (deleted)

**Success criteria:** Question view never scrolls on mobile. Options grid is 2-column on desktop, 1-column on mobile. Timer circle visible and centered.

---

#### Phase 7: Pages + Cleanup

**Goal:** Migrate remaining pages, delete migrated CSS files, trim `global.css` and `variables.css`.

**`HomePage.module.css`** — note: this file uses `min-width: 768px` (mobile-first), unlike the rest of the app. With MUI's mobile-first breakpoints this is actually the correct direction. Cards layout:
```tsx
<Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, md: 3 }} useFlexGap sx={{ maxWidth: { xs: '500px', md: '800px' }, mx: 'auto' }}>
```

**`AboutPage.module.css`** — has a decorative CSS counter/pseudo-element timeline (`::before` with `counter-increment`). CSS pseudo-elements and counters cannot be expressed in `sx`. Options:
1. Keep `AboutPage.module.css` as the one remaining CSS module file (acceptable trade-off)
2. Convert the timeline to a data-driven React component with explicit numbering

Recommend option 1 — a single decorative CSS file for the About page is not a meaningful maintenance burden.

**`Reactions.module.css`** — two `position: fixed` elements: the button bar (bottom) and the feed overlay. Migration approach mirrors Question Phase 6. Key rule: anything `position: fixed` below the navbar **must** use `top: calc(var(--navbar-height) + spacing)`. In sx: `top: 'calc(var(--navbar-height) + 8px)'`. This was the source of a previous production bug (reaction feed invisible).

**Cleanup — DO THIS LAST:**
1. Remove all migrated CSS module `import` statements from components
2. Delete migrated `.module.css` files
3. **Remove global.css button/input base styles** — only after confirming every button on every screen uses MUI-styled or sx-styled variants. Removing early breaks all buttons globally.
4. Trim `variables.css` to visual tokens only (target: under 60 lines). Remove spacing tokens, font-size tokens, and border-radius tokens that are now in the MUI theme.
5. Remove `@emotion/styled` from unused imports (it was installed but may be unused after migration)

**Files changed:** `HomePage.tsx`, `HomePage.module.css` (deleted), `Reactions.tsx`, `Reactions.module.css` (deleted), `GameOver.module.css` (already deleted in Phase 3), global.css (trimmed), variables.css (trimmed)

**Success criteria:** Zero hand-written `@media` queries remain in component files (About page exception acceptable). `variables.css` under 60 lines.

---

## System-Wide Impact

### Interaction Graph

The MUI ThemeProvider wraps the entire app in `App.tsx`. Every component that uses `sx` or MUI components reads from this context. Changes to `theme.ts` affect every component on every screen simultaneously — test all 5 game screens after each Phase 1 change.

### Error & Failure Propagation

If `cssVariables: true` is enabled and a component references `theme.vars.palette.X` but the theme doesn't define `X`, it silently renders `var(--mui-undefined)` — no TypeScript error, just missing styles. Test Phase 1 visually on all screens before proceeding.

### State Lifecycle Risks

The `settingsSide`/`settingsInline` dual-render in Phase 5 renders `GameSettings` twice in the DOM (both present, one hidden via display:none). If `GameSettings` has internal state (difficulty selection, toggle state), that state is duplicated. Verify both instances stay in sync via the shared `roomState` from context — they should since they both read from `useGame()`.

### API Surface Parity

`MultipleChoiceToggle` is replaced with MUI `Switch`. The prop interface (`checked`, `onChange`) stays the same — no caller changes needed. Visually verify against the current design.

### Integration Test Scenarios

1. Mobile (390×844): question view takes full viewport, no scroll possible, options accessible without reaching navbar
2. Desktop (1280×800): lobby shows settings side panel; results show 2-column grid; question shows 2-column options
3. iPhone SE (375×667): all 5 screens fit without scroll or overflow
4. Theme switch (if `cssVariables: true`): `--mui-palette-primary-main` appears on `:root` in browser devtools
5. Reactions + Question overlap: Reactions button bar visible over Question full-screen overlay

## Acceptance Criteria

- [ ] Zero `@media` queries in migrated component files (AboutPage exception acceptable)
- [ ] All 5 game screens fit within 390×844 without overflow
- [ ] Desktop layout is full-width with side-by-side elements where applicable (Lobby settings panel, Results 2-column grid, Question 2-column options)
- [ ] `variables.css` reduced to visual tokens only, under 60 lines
- [ ] `npm run build` passes after each phase
- [ ] No visual regressions on desktop (1280px) or mobile (390px)
- [ ] `MuiCssBaseline` covers all reset styles previously in `global.css` after cleanup
- [ ] MUI theme breakpoints align with existing layout behavior: `md: 768px`

## Success Metrics

- A new game screen written by Claude using MUI sx automatically looks correct on mobile without a follow-up fix
- CSS-related bug fixes are eliminated from the next 3 feature development sessions
- `variables.css` is under 60 lines (currently 141 lines)

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| `global.css` button styles removed too early | Do cleanup (Phase 7) last; verify every button on every screen before trimming global.css |
| SVG in Timer can't use sx | Keep Timer/LinearTimer as CSS modules or use `styled()` — do not attempt sx on SVG elements |
| MultipleChoiceToggle visual regression | Test MUI Switch appearance against screenshots before deleting old CSS |
| confetti nth-child patterns | Convert to data-driven array in GameOver — explicitly track each piece's properties in JS |
| theme breakpoints affect all screens simultaneously | Test all 5 screens after Phase 1 theme changes before committing |
| `cssVariables: true` emits `--mui-*` vars that may conflict with `--color-*` vars | Use `cssVarPrefix: 'mui'` (default) — no conflict with existing `--color-` / `--shadow-` / `--gradient-` namespace |
| Reactions fixed-position navbar offset bug | When migrating Reactions, always use `top: 'calc(var(--navbar-height) + 8px)'` not raw pixels — previously caused invisible reaction feed |

## Sources & References

### Origin
- **Origin document:** [docs/brainstorms/2026-03-31-mui-sx-migration-requirements.md](docs/brainstorms/2026-03-31-mui-sx-migration-requirements.md)
  Key decisions carried forward: (1) desktop stays full-width, (2) MUI owns layout tokens / variables.css keeps visual tokens, (3) phase order simple→complex

### Internal References
- Prior migration plan (February): `docs/plans/2026-02-10-refactor-mui-sx-responsive-migration-plan.md` — covers same scope, contains gotcha list used here
- Frontend design skill (needs updating after migration): `.claude/skills/frontend-design/SKILL.md`
- Existing theme: `frontend/src/theme.ts`
- Design tokens: `frontend/src/styles/variables.css`
- Global styles: `frontend/src/styles/global.css`

### External References
- MUI v7 sx prop docs: https://mui.com/system/getting-started/
- MUI v7 CSS variables: https://mui.com/material-ui/customization/css-theme-variables/overview/
- MUI v7 responsive values: https://mui.com/system/responsive-styles/
- MUI v7 Grid v2: https://mui.com/material-ui/react-grid/
