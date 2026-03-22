---
status: pending
priority: p3
issue_id: "024"
tags: [code-review, frontend, accessibility]
dependencies: []
---

# HomePage Clickable Divs Not Keyboard or Screen-Reader Accessible

## Problem Statement

The "Host a Game" and "Join a Game" card sections are clickable `<div>` elements with no `role="button"`, `tabIndex`, or keyboard handler. They cannot be activated by keyboard-only users and are not announced as interactive by screen readers. Form inputs use only `placeholder` for labeling (no `<label>` elements).

## Findings

- File: `frontend/src/pages/HomePage/HomePage.tsx` lines 111–133, 135–167
- Clickable `<div>` with `onClick` but no `role="button"` or `tabIndex`
- Input elements labeled only by `placeholder` — disappears when typing; not reliably announced by screen readers
- This affects all players on first load

## Proposed Solution

1. Replace clickable `<div>` cards with `<button>` elements (simplest fix):
```tsx
<button
  className={styles.card}
  onClick={() => setActiveCard("host")}
  type="button"
>
```

2. Add `<label>` elements for all form inputs:
```tsx
<label htmlFor="playerName">Your Name</label>
<input id="playerName" ... />
```

## Acceptance Criteria
- [ ] Card sections activatable via keyboard (Tab to focus, Enter/Space to activate)
- [ ] Screen readers announce cards as interactive
- [ ] All form inputs have associated `<label>` elements
- [ ] No visual changes to existing design

## Work Log
- 2026-03-22: Identified by `kieran-typescript-reviewer` review agent
