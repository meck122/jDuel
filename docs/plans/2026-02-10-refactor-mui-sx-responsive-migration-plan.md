---
title: Migrate Frontend from CSS Modules to MUI sx Prop
type: refactor
date: 2026-02-10
---

# Migrate Frontend from CSS Modules to MUI sx Prop

## Overview

Replace the entire CSS module styling system with MUI's `sx` prop and theme-based responsive breakpoints. This eliminates the current whack-a-mole mobile responsiveness problem by providing a single, consistent responsive system. The MUI theme becomes the single source of truth for all design tokens.

## Problem Statement

The current frontend uses 18 CSS module files + 3 global CSS files with hand-written `@media` queries at inconsistent breakpoints (600px, 768px, 380px). Each game view handles mobile responsiveness differently:
- Question view: `position: fixed; inset: 0` (full-screen hack)
- Results view: Normal document flow (timer clips on iPhone SE 375x667)
- GameOver view: `calc(100vh - 420px)` magic numbers

The MUI theme (`theme.ts`) and CSS variables (`variables.css`) define the **same colors independently** with no connection. There's zero `sx` prop usage despite MUI v7.3.7 being installed.

## Proposed Solution

### Phase 1: Theme Foundation

Expand `theme.ts` to contain all design tokens currently in `variables.css`. This becomes the single source of truth.

**File: `frontend/src/theme.ts`**

Add to the existing theme:

```tsx
const jeopardyTheme = createTheme({
  // Existing palette stays, add missing colors:
  palette: {
    // ... existing primary/secondary/background/text ...
    gold: { main: 'rgb(251, 191, 36)', light: 'rgb(253, 216, 99)' },
    timer: {
      safe: 'rgb(16, 185, 129)',
      warning: 'rgb(245, 158, 11)',
      critical: 'rgb(239, 68, 68)',
    },
    border: {
      subtle: 'rgba(235, 235, 235, 0.1)',
      default: 'rgba(235, 235, 235, 0.2)',
      emphasis: 'rgba(235, 235, 235, 0.3)',
    },
    bg: {
      primary: 'rgb(18, 16, 28)',
      secondary: 'rgb(26, 24, 38)',
      elevated: 'rgb(34, 32, 48)',
      hover: 'rgb(42, 40, 58)',
    },
  },
  // Custom shadows array + named glows
  shadows: [...defaultShadows], // Keep MUI defaults, add custom via theme
  // Custom values for gradients, glows, fonts
  custom: {
    gradients: {
      purple: 'linear-gradient(135deg, rgb(139, 92, 246) 0%, rgb(87, 53, 192) 100%)',
      teal: 'linear-gradient(135deg, rgb(45, 212, 191) 0%, rgb(94, 234, 212) 100%)',
      purpleTeal: 'linear-gradient(135deg, rgb(139, 92, 246) 0%, rgb(45, 212, 191) 100%)',
      gold: 'linear-gradient(135deg, rgb(251, 191, 36) 0%, rgb(253, 216, 99) 100%)',
      success: 'linear-gradient(135deg, rgb(22, 163, 74) 0%, rgb(34, 197, 94) 100%)',
    },
    glows: {
      purple: '0 0 20px rgba(139, 92, 246, 0.3)',
      teal: '0 0 20px rgba(45, 212, 191, 0.3)',
      gold: '0 0 20px rgba(251, 191, 36, 0.4)',
    },
    fonts: {
      display: '"Bebas Neue", sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
    navbarHeight: '64px',
  },
  // Keep default breakpoints (xs:0, sm:600, md:900, lg:1200)
  // These align with the existing 600px mobile breakpoint
});
```

Add TypeScript module augmentation for custom theme properties:

```tsx
declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      gradients: Record<string, string>;
      glows: Record<string, string>;
      fonts: Record<string, string>;
      navbarHeight: string;
    };
  }
  interface ThemeOptions {
    custom?: { ... };
  }
}
```

**Acceptance criteria:**
- [ ] All 140 lines of `variables.css` tokens are represented in the theme
- [ ] TypeScript augmentation compiles without errors
- [ ] Existing Navigation component still renders correctly

### Phase 2: Shared sx Patterns + Global CSS Slim-down

Create shared sx pattern objects for the composable global classes, and keep only essential global CSS.

**New file: `frontend/src/sxPatterns.ts`**

```tsx
// Replaces: composes: card from global
export const cardSx = { ... };

// Replaces: composes: game-section from global
export const gameSectionSx = { ... };

// Replaces: composes: content-box from global
export const contentBoxSx = { ... };

// Replaces: composes: score-item from global
export const scoreItemSx = { ... };
```

**New file: `frontend/src/styles/animations.css`** (minimal keyframes file)

Keep keyframe definitions that can't easily be inlined:
- `confettiFall` (complex multi-step with nth-child)
- `timerPulse`, `timerFlash`
- `cardSlideUp`, `formReveal`
- `bounce`, `feedSlideIn`

**Modify: `frontend/src/styles/global.css`**

Slim down to only:
- Box-sizing reset
- Body background (radial gradient + scanline overlay)
- `#root` setup
- `.app-main` padding-top (for navbar offset)
- Heading margin reset
- Remove: `.card`, `.game-section`, `.content-box`, `.score-item`, `.score-value`, `.player-grid`, `.game-header`
- Remove: Global `button` and `input` styles (will conflict with MUI)
- Import animations.css instead of variables.css

**Delete:** `frontend/src/styles/variables.css` (replaced by theme)
**Delete:** `frontend/src/styles/components.css` (unused utility classes)

**Acceptance criteria:**
- [ ] Shared sx patterns match the visual appearance of the old global classes
- [ ] Global CSS is < 60 lines (just reset + body + app-main)
- [ ] Keyframe animations file exists and is imported

### Phase 3: Trivial/Low Complexity Components

Migrate components with < 40 lines of CSS. Establish the sx prop patterns.

**Components (6):**

| Component | CSS Lines | Notes |
|-----------|-----------|-------|
| `PlayerName` | 5 | 1 class (`.youBadge`) |
| `GameView` | 11 | 2 classes, container + mobile padding |
| `QuestionHeader` | 30 | 4 classes, inline flex header |
| `PageContainer` | 37 | Replace with MUI `Container` or `Box` |
| `GamePage` | 71 | Error/retry states, no game layout |
| `GameSettings` | 28 | Simple flex column container |

**Pattern for each component:**
1. Remove `import styles from "./X.module.css"`
2. Add MUI `Box`/`Stack`/`Typography` imports as needed
3. Replace `className={styles.X}` with `sx={{ ... }}`
4. Use theme values: `(theme) => theme.palette.primary.main` for colors
5. Use responsive syntax: `{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }` for breakpoints
6. Delete the `.module.css` file

**Example migration (PlayerName):**

```tsx
// Before:
<span className={styles.youBadge}> (You)</span>

// After:
<Box component="span" sx={{ color: 'secondary.main', fontSize: '0.85em', fontWeight: 700 }}>
  {' '}(You)
</Box>
```

**PageContainer → MUI Container:**

```tsx
// Replace custom PageContainer with MUI Container
<Container maxWidth={maxWidth} sx={{
  minHeight: '100vh',
  display: centered ? 'flex' : 'block',
  alignItems: centered ? 'center' : undefined,
  justifyContent: centered ? 'center' : undefined,
  py: { xs: 1, sm: 3 },
  px: { xs: 1, sm: 2 },
}}>
  {children}
</Container>
```

**Acceptance criteria:**
- [ ] All 6 components render identically to before
- [ ] 6 CSS module files deleted
- [ ] No regressions on mobile (iPhone SE 375x667)

### Phase 4: Medium Complexity Components

**Components (5):**

| Component | CSS Lines | Key Challenge |
|-----------|-----------|---------------|
| `Navigation` | 51 | Already MUI, just remove CSS module overlay |
| `LinearTimer` | 77 | Progress bar animation, two variants |
| `Timer` | 105 | SVG styling, keyframes (pulse/flash), 3 variants |
| `DifficultySelector` | 88 | Dynamic pill variants (`.pillEnjoyer`, `.pillMaster`, `.pillBeast`) |
| `MultipleChoiceToggle` | 78 | Checkbox + slider CSS (`:checked + .slider` selector) |

**Navigation migration:**
- Already uses `AppBar`, `Toolbar`, `Button`, `Box`, `Typography`
- Move all CSS module styles into `sx` props on existing MUI components
- Delete `Navigation.module.css`

**Timer migration:**
- SVG elements can't use `sx` prop directly — keep SVG styling inline or use `styled()`
- Move keyframes to `animations.css` and reference via `animation` in sx
- Variant logic (wrapper sizes) becomes conditional sx values

**DifficultySelector migration:**
- Dynamic pill color variants map to conditional sx objects
- Track/pill layout uses MUI `Stack` with gap

**MultipleChoiceToggle migration:**
- The `:checked + .slider` CSS pattern needs MUI `Switch` component OR custom sx with `& input:checked + span` selector
- Consider replacing with MUI `Switch` component (natural fit)

**Acceptance criteria:**
- [ ] All 5 components render identically
- [ ] Timer animations (pulse, flash) still work
- [ ] DifficultySelector pill colors match per-difficulty
- [ ] MultipleChoiceToggle transitions smoothly
- [ ] 5 CSS module files deleted

### Phase 5: High Complexity Components

**Components (5):**

| Component | CSS Lines | Key Challenge |
|-----------|-----------|---------------|
| `Lobby` | 258 | Two-column layout, `composes: card`, `composes: player-grid`, 3 breakpoints |
| `Question` | 253 | Full-screen mobile takeover (`position: fixed; inset: 0`), `composes: game-section` |
| `Results` | 264 | Two-column grid, `composes: game-section/content-box/score-item/score-value`, timer clipping |
| `HomePage` | 204 | Card entrance animations, form reveal, responsive card layout |
| `AboutPage` | 228 | Stepped list with pseudo-elements, tech badges with nth-child colors |

**Lobby migration:**
```tsx
// Before: .lobbyWrapper { display: flex; gap: var(--spacing-xl); }
// After:
<Stack direction={{ xs: 'column', md: 'row' }} gap={{ xs: 2, md: 3 }}>
  <Box sx={{ flex: 1, ...cardSx }}>
    {/* Lobby content */}
  </Box>
  <GameSettings />
</Stack>
```

**Question migration (most critical):**
- The mobile `position: fixed; inset: 0` pattern must be preserved
- Use responsive sx: `{ position: { xs: 'fixed', sm: 'static' }, inset: { xs: 0, sm: 'auto' } }`
- Keep the `document.body.style.overflow = "hidden"` useEffect

**Results migration (main bug fix):**
```tsx
// Key fix: use Stack to prevent timer clipping
<Stack sx={{ width: '100%', my: { xs: 1, sm: 2 } }}>
  {/* Header */}
  {/* Correct Answer Banner */}
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 1, sm: 2 } }}>
    {/* Player Answers */}
    {/* Scoreboard */}
  </Box>
  {/* Timer - always visible, flexShrink: 0 */}
  <Box sx={{ flexShrink: 0, my: { xs: 1, sm: 2 } }}>
    <LinearTimer ... />
  </Box>
</Stack>
```

**HomePage migration:**
- Card entrance animations (`cardSlideUp`, `formReveal`) reference keyframes from `animations.css`
- Cards layout: `<Stack direction={{ xs: 'column', md: 'row' }} gap={3}>`

**AboutPage migration:**
- Stepped list pseudo-elements use `&::before` in sx
- Tech badge nth-child colors: Use array mapping with explicit color per badge, not CSS nth-child

**Acceptance criteria:**
- [ ] Question view fits viewport on iPhone SE (375x667) without scrolling
- [ ] Results timer is **never clipped** on any viewport
- [ ] Lobby two-column layout stacks to single column on mobile
- [ ] HomePage card animations play correctly
- [ ] AboutPage step numbers render correctly
- [ ] All 5 CSS module files deleted

### Phase 6: Very High Complexity Components

**Components (2):**

| Component | CSS Lines | Key Challenge |
|-----------|-----------|---------------|
| `GameOver` | 358 | 12 confetti pieces with nth-child positioning/colors, `confettiFall` + `bounce` keyframes |
| `Reactions` | 130 | Fixed positioning (bottom bar + top feed), `feedSlideIn` keyframe, z-index layering |

**GameOver confetti migration:**
- The 12 confetti pieces use `nth-child` for position (`left: 5%`, `left: 15%`, etc.) and alternating colors
- **Recommended approach:** Generate confetti pieces in TSX with explicit `sx` per piece via map:

```tsx
const CONFETTI_PIECES = [
  { left: '5%', bg: 'primary.main', delay: '0s', shape: 'rect' },
  { left: '15%', bg: 'gold.main', delay: '0.3s', shape: 'circle' },
  // ... 10 more
];

{CONFETTI_PIECES.map((piece, i) => (
  <Box key={i} sx={{
    position: 'absolute',
    width: piece.shape === 'circle' ? 8 : 10,
    height: piece.shape === 'circle' ? 8 : 24,
    borderRadius: piece.shape === 'circle' ? '50%' : 0,
    top: -30,
    left: piece.left,
    bgcolor: piece.bg,
    opacity: 0,
    animation: `confettiFall 3.5s ease-in cubic-bezier(0.25, 0.46, 0.45, 0.94) ${piece.delay} infinite`,
  }} />
))}
```

**Reactions migration:**
- Fixed positioning: `sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}`
- Feed overlay: `sx={{ position: 'fixed', top: (theme) => \`calc(\${theme.custom.navbarHeight} + 8px)\`, ... }}`
- `feedSlideIn` animation from `animations.css`

**Acceptance criteria:**
- [ ] Confetti animation plays correctly with all 12 pieces
- [ ] Trophy bounces
- [ ] Reactions button bar stays fixed at bottom
- [ ] Reactions feed shows at top-right (or full-width on mobile)
- [ ] Z-index layering: scanline(9999) > navbar(1100) > reactions(100/99) > content
- [ ] 2 CSS module files deleted

### Phase 7: App-Level Cleanup

**Modify `App.tsx`:**
- Replace `div.app-layout` and `main.app-main` with MUI `Box` components using sx

```tsx
<Box>
  <Navigation />
  <Box component="main" sx={{ pt: '64px' }}>
    <Routes>...</Routes>
  </Box>
</Box>
```

**Final global.css (target: ~30 lines):**
```css
@import "./animations.css";

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: radial-gradient(ellipse at center, rgb(22,18,36) 0%, rgb(16,14,26) 50%, rgb(10,9,16) 100%);
}

body::after { /* scanline overlay */ }

#root { width: 100%; min-height: 100vh; }
```

**Delete files:**
- All 18 `.module.css` files (should already be deleted in phases 3-6)
- `frontend/src/styles/variables.css`
- `frontend/src/styles/components.css`

**Verify exports:** Update `components/index.ts` if PageContainer interface changed.

**Acceptance criteria:**
- [ ] `npm run build` passes (TypeScript + Vite)
- [ ] `npm run lint` passes
- [ ] No remaining CSS module imports in any TSX file
- [ ] Only 2 CSS files remain: `global.css` (~30 lines) + `animations.css` (~80 lines)
- [ ] All game phases render correctly: Lobby → Question → Results → GameOver

## Technical Considerations

### Architecture Impacts
- **Bundle size:** MUI's Emotion runtime adds ~8KB gzipped. Removing 18 CSS module files saves ~15KB. Net positive.
- **Render performance:** sx prop generates CSS at render time. For static styles, this is negligible. For dynamic styles (timer progress), inline `style` prop is still used (no change from current).
- **Developer experience:** sx prop has IntelliSense via TypeScript theme augmentation. Responsive values are explicit in the code rather than hidden in separate CSS files.

### Potential Breaking Points
1. **Global button/input styles:** Removing global `button { background: gradient; text-transform: uppercase }` will affect ALL buttons. Must migrate all buttons before removing.
2. **CSS composes:** Six components use `composes: X from global`. Each must explicitly include the composed styles.
3. **Pseudo-elements in sx:** `&::before`, `&::after` syntax in sx requires careful escaping.
4. **MUI CssBaseline interaction:** CssBaseline already resets some styles. After removing global.css resets, verify CssBaseline handles the same resets.

### Mobile Testing Targets
Test every phase against these viewports:
- iPhone SE: 375 x 667px (smallest supported)
- Samsung Galaxy S20: 360 x 800px (narrowest Android)
- iPhone 14 Pro: 393 x 852px (modern baseline)

## Acceptance Criteria

### Functional Requirements
- [ ] All game phases (Lobby, Question, Results, GameOver) render correctly on desktop and mobile
- [ ] Question view fits within viewport without scrolling on all test devices
- [ ] Results timer is always visible (never clipped)
- [ ] Confetti animation plays on GameOver
- [ ] Timer pulse/flash animations work
- [ ] Reactions button bar fixed at bottom, feed at top
- [ ] HomePage card entrance animations play
- [ ] Deep links (/room/:roomId) still work
- [ ] Navigation shows/hides correctly per game phase

### Non-Functional Requirements
- [ ] Zero CSS module imports remaining
- [ ] `npm run build` produces no errors
- [ ] `npm run lint` passes
- [ ] Only `global.css` (~30 lines) + `animations.css` (~80 lines) remain as CSS files
- [ ] MUI theme contains all design tokens (single source of truth)
- [ ] TypeScript augmentations compile cleanly

## Dependencies & Risks

**Dependencies:**
- MUI v7.3.7 (already installed)
- React 19.2 (already installed)
- No new packages needed

**Risks:**
- **Visual regression on edge cases:** Subtle CSS differences between module-scoped CSS and sx-generated CSS. Mitigate with visual testing at each phase.
- **Global button style removal timing:** If global styles are removed before all buttons are migrated, buttons will appear unstyled. Mitigate by removing global styles last (Phase 7).
- **GameOver confetti complexity:** 358 lines of CSS with nth-child selectors. Highest risk of visual regression. Mitigate with explicit data-driven approach.

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-10-mui-sx-responsive-migration-brainstorm.md`
- Current theme: `frontend/src/theme.ts`
- Design tokens: `frontend/src/styles/variables.css`
- Frontend design skill: `.claude/skills/frontend-design/SKILL.md`

### File Inventory (18 CSS modules to migrate)

**Layout/Common (4):**
1. `components/layout/PageContainer/PageContainer.module.css` (37 lines)
2. `components/common/Timer/Timer.module.css` (105 lines)
3. `components/common/LinearTimer/LinearTimer.module.css` (77 lines)
4. `components/common/PlayerName/PlayerName.module.css` (5 lines)

**UI (1):**
5. `components/ui/Navigation/Navigation.module.css` (51 lines)

**Pages (3):**
6. `pages/HomePage/HomePage.module.css` (204 lines)
7. `pages/GamePage/GamePage.module.css` (71 lines)
8. `pages/AboutPage/AboutPage.module.css` (228 lines)

**Game Features (10):**
9. `features/game/GameView/GameView.module.css` (11 lines)
10. `features/game/Lobby/Lobby.module.css` (258 lines)
11. `features/game/Question/Question.module.css` (253 lines)
12. `features/game/Question/QuestionHeader.module.css` (30 lines)
13. `features/game/Results/Results.module.css` (264 lines)
14. `features/game/GameOver/GameOver.module.css` (358 lines)
15. `features/game/Reactions/Reactions.module.css` (130 lines)
16. `features/game/GameSettings/GameSettings.module.css` (28 lines)
17. `features/game/GameSettings/DifficultySelector.module.css` (88 lines)
18. `features/game/GameSettings/MultipleChoiceToggle.module.css` (78 lines)
