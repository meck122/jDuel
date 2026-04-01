---
name: frontend-design
description: UI/UX patterns specific to multiplayer trivia games - question displays, timers, scoring, leaderboards, and game flow.
---

# Frontend Design System

Theme: **retro-futuristic arcade terminal.** Dark palette with purple/teal accents and a scanline overlay (`body::after` in `global.css`).

## Two-Layer Styling Architecture

The frontend uses a two-layer model. Understanding this prevents confusion about what goes where:

| Layer | What it owns | How to use |
|-------|-------------|-----------|
| **MUI sx prop** | Layout, spacing, breakpoints, responsive behavior | `sx={{ p: { xs: 2, sm: 4 }, display: "flex" }}` |
| **CSS variables** | Visual identity: colors, shadows, gradients, fonts | `sx={{ color: "var(--color-accent-purple)" }}` |

CSS variable strings work directly inside `sx` values — MUI passes them through to the browser. Never hardcode color hex values; always reference the CSS token.

Almost all component styling lives in `sx` props. The exceptions are Timer, LinearTimer, Navbar, AboutPage, and `components.css`, which still use CSS modules and reference CSS variable tokens.

## CSS Variables (`frontend/src/styles/variables.css`)

All visual tokens are defined here. Never hardcode colors, spacing, or radii — use the variables.

**Key layout vars:**

| Variable | Value | Use |
|----------|-------|-----|
| `--navbar-height` | `64px` | Offset for anything positioned below the fixed navbar |
| `--reactions-bar-height` | `52px` | Height of the fixed reaction button bar |

**Accent palette:**

| Variable | Use |
|----------|-----|
| `--color-accent-purple` | Primary interactive accent (buttons, highlights, player names) |
| `--color-accent-teal` | Secondary accent (scores, success states) |
| `--color-accent-red` | Gold/amber accent (active states, wins) — name is legacy |
| `--color-success` / `--color-error` | Correct/incorrect answer indicators |
| `--color-timer-safe` / `-warning` / `-critical` | Timer color transitions (green → amber → red) |

**Fonts:** `--font-display` (Bebas Neue) for headings, `--font-mono` (JetBrains Mono) for data/scores/labels.

**Spacing/font-size/radius tokens** (`--spacing-*`, `--font-size-*`, `--radius-*`) are retained for non-migrated CSS modules. Do not remove them.

## MUI Theme (`frontend/src/theme.ts`)

Custom breakpoints — the standard MUI defaults are **not** used:

| Breakpoint | px | Role |
|------------|-----|------|
| `xs` | 0 | Mobile baseline |
| `sm` | 600 | Primary layout break (mobile → desktop) |
| `md` | 768 | Secondary break (tablet, wider layouts) |
| `lg` | 1024 | Large screens |
| `xl` | 1280 | Extra-large |

**MUI spacing scale:** `[0, 4, 8, 12, 16, 24, 32, 48, 64]px` — so `spacing(1)=4px`, `spacing(2)=8px`, `spacing(4)=16px`, `spacing(6)=24px`.

## Shared sx Patterns (`frontend/src/styles/sxPatterns.ts`)

Reusable sx objects exported for common UI shapes. Use these before writing new layout code:

| Export | What it renders |
|--------|----------------|
| `sxCard` | Standard card (bg-secondary, border, radius-lg, shadow-md) |
| `sxContentBox` | Inner content area (bg-elevated, border-subtle, radius-md) |
| `sxScoreItem` | Score row with hover highlight |
| `sxGameSection` | Game phase section with max-width centering |
| `sxGameHeader` | Page-level game section heading |
| `sxPlayerGrid` | Responsive player grid (single col on mobile, 2-col on sm+) |

## Breakpoints in sx

Always use the object breakpoint syntax — never raw `@media` blocks inside sx:

```tsx
// Correct
<Box sx={{ fontSize: { xs: "1rem", sm: "1.5rem" }, p: { xs: 2, sm: 4 } }}>

// Wrong — don't do this in sx
<Box sx={{ "@media (max-width: 600px)": { fontSize: "1rem" } }}>
```

## Z-Index Layers

Fixed-position elements stack in this order. Slot new overlays into the right layer:

| Layer | Z-Index | Elements |
|-------|---------|----------|
| Scanline overlay | 9999 | `body::after` — pointer-events: none, purely visual |
| Navbar | 1100 | `<header>` |
| Reaction button bar | 100 | Fixed bottom bar |
| Reaction feed | 99 | Fixed top-right overlay |
| Question (mobile) | 1 | Full-screen fixed overlay on xs |
| Content | default | All other game phase components |

## Fixed-Position Overlay Rules

Anything `position: fixed` that sits below the navbar **must** offset its `top` using `--navbar-height`:

```tsx
<Box sx={{ position: "fixed", top: "calc(var(--navbar-height) + 8px)" }}>
```

The reaction feed uses breakpoint-responsive top offsets:

```tsx
top: {
  xs: "calc(var(--navbar-height) + var(--spacing-xs))",
  sm: "calc(var(--navbar-height) + var(--spacing-sm))",
}
```

## Global Button Style Overrides

`global.css` sets aggressive defaults on `button` (gradient background, uppercase text, letter-spacing). When `Box component="button"` needs a different look, explicitly override all of these in `sx`:

```tsx
sx={{
  background: "var(--color-bg-elevated)",
  textTransform: "none",
  letterSpacing: 0,
  "&:hover:not(:disabled)": {
    filter: "none",  // global.css sets filter: brightness(1.1) on hover
    // ... your hover styles
  },
}}
```

## Conditional sx

Use inline ternaries for state-dependent styles. Keep logic inside the `sx` object rather than toggling class names:

```tsx
sx={{
  background: isActive ? "var(--color-bg-elevated)" : "var(--color-bg-secondary)",
  border: isActive ? "2px solid var(--color-accent-red)" : "2px solid var(--color-border-default)",
}}
```

For a card with multiple conditional properties, extract a helper function:

```tsx
const cardSx = (isActive: boolean, isSecond?: boolean) => ({
  flex: 1,
  background: isActive ? "var(--color-bg-elevated)" : "var(--color-bg-secondary)",
  animation: "cardSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
  ...(isSecond ? { animationDelay: "0.12s" } : {}),
});
```

## Keyframe Animations

`@keyframes` must live in CSS files (not inline in sx). All keyframes are in `frontend/src/styles/animations.css`. Reference them by name in sx:

```tsx
sx={{ animation: "fadeIn 300ms ease forwards" }}
```

Current keyframes: `fadeIn`, `slideUp`, `pulse`, `shimmer`, `timerPulse`, `spin`, `cardSlideUp`, `formReveal`, `feedSlideIn`.

## Mobile Testing Viewports

Test UI changes against these three device dimensions:

| Device | Width × Height | Why |
|--------|---------------|-----|
| iPhone SE / older iPhones | 375 × 667px | Most common baseline. If it works here, it works on most devices. |
| iPhone 14/15 Pro, Pixel 7 | 393 × 852px | Modern mid-to-large phones. The "standard" modern phone. |
| Samsung Galaxy S20/S21 | 360 × 800px | Most common Android width — catches width-related issues. |

## Component Conventions

- **Tap targets:** Minimum 56px height on interactive elements (buttons, option cards) on mobile
- **Full-width inputs:** Text inputs and submit buttons go full-width on mobile (`width: { xs: "100%", sm: "auto" }`)
- **Animations:** Use `forwards` fill mode so elements stay in their end state. Keep durations under 300ms for interactive feedback.
- **Disabled states:** Use `opacity: 0.4` + `cursor: not-allowed` consistently. Don't change layout properties on disabled elements.
