---
name: frontend-design
description: UI/UX patterns specific to multiplayer trivia games - question displays, timers, scoring, leaderboards, and game flow.
---

# Frontend Design System

Theme: **retro-futuristic arcade terminal.** Dark palette with purple/teal accents and a scanline overlay (`body::after` in `global.css`). All components use CSS Modules.

## CSS Variables (`frontend/src/styles/variables.css`)

All styling tokens are defined here. Never hardcode colors, spacing, or radii — use the variables.

**Key layout vars:**

| Variable | Value | Use |
|----------|-------|-----|
| `--navbar-height` | `64px` | Offset for anything positioned below the fixed navbar |
| `--container-md` | `768px` | Max-width for centered content columns |

**Accent palette:**

| Variable | Use |
|----------|-----|
| `--color-accent-purple` | Primary interactive accent (buttons, highlights, player names) |
| `--color-accent-teal` | Secondary accent (scores, success states) |
| `--color-success` / `--color-error` | Correct/incorrect answer indicators |
| `--color-timer-safe` / `-warning` / `-critical` | Timer color transitions (green → amber → red) |

**Fonts:** `--font-display` (Bebas Neue) for headings, `--font-mono` (JetBrains Mono) for data/scores/labels.

## Z-Index Layers

Fixed-position elements stack in this order. If you add a new overlay, slot it into the right layer:

| Layer | Z-Index | Elements |
|-------|---------|----------|
| Scanline overlay | 9999 | `body::after` — pointer-events: none, purely visual |
| Navbar | 1100 | `<header>` in global.css |
| Reaction button bar | 100 | Fixed bottom bar |
| Reaction feed | 99 | Fixed top-right overlay |
| Content | default | All game phase components |

## Fixed-Position Overlay Rules

Anything `position: fixed` that sits below the navbar **must** offset its `top` using `--navbar-height`:

```css
top: calc(var(--navbar-height) + var(--spacing-sm));
```

Using a raw pixel or spacing value here will place the element behind the navbar. This was a real bug — the reaction feed was invisible until this was fixed.

## Mobile Breakpoints

Two breakpoints used consistently across the app:

- **600px** — primary mobile breakpoint. Single-column layouts, smaller tap targets, reduced padding. Used by Question, Results, Reactions, GameOver, Lobby.
- **768px** — tablet/secondary. Two-column → single-column for wider layouts like Lobby settings and GameSettings.

Design mobile-first: start at 390px viewport width and expand outward.

## Component Conventions

- **Tap targets:** Minimum 56px height on interactive elements (buttons, option cards) on mobile
- **Full-width inputs:** Text inputs and submit buttons go full-width on mobile
- **Animations:** Use `forwards` fill mode on CSS keyframes so elements stay in their end state. Keep durations under 300ms for interactive feedback.
- **Disabled states:** Use `opacity: 0.4` + `cursor: not-allowed` consistently. Don't change layout properties on disabled elements.
