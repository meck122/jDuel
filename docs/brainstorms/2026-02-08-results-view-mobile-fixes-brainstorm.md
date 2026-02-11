---
title: Results View Mobile Layout Fixes & GameOver Navigation
date: 2026-02-08
topic: Fix player answer alignment and timer visibility on Results view, restore navbar on GameOver
status: ready-for-planning
---

# Results View Mobile Layout Fixes & GameOver Navigation

## What We're Building

Fixing three interconnected mobile UX issues discovered after viewport compatibility work:

1. **Results View - Player Answer Alignment** (P1 Critical)
   - Current: Player name and answer on separate rows (unprofessional, takes vertical space)
   - Goal: Single-line horizontal layout: `Name | Answer | ✓/✗`

2. **Results View - Timer Visibility on iPhone SE** (P1 Critical)
   - Current: Timer disappears when player answers present (2-row layout pushes it off-screen)
   - Goal: Timer always visible on 375×667px viewport

3. **GameOver - Return to Main Menu** (P2 Important)
   - Current: No way to return home after game ends (navbar hidden during gameplay)
   - Goal: Restore navbar on GameOver screen for familiar navigation

## Problems Identified

### 1. Results View - Player Answer 2-Row Layout
**Current CSS (mobile):**
```css
.resultsAnswerItem {
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;  /* 2 rows = problem */
  gap: var(--spacing-xs) var(--spacing-sm);
}

.resultsAnswerPlayer {
  grid-column: 1;
  grid-row: 1;  /* Name on row 1 */
}

.resultsAnswerText {
  grid-column: 1 / -1;
  grid-row: 2;  /* Answer on row 2 */
}
```

**Why this is bad:**
- Each answer item is ~80-90px tall (2 rows + padding)
- With 4 players, answer box takes ~320-360px vertical space
- On iPhone SE (667px total height), this pushes timer off-screen
- Looks unprofessional and unaligned compared to scoreboard

**Layout budget on iPhone SE (375×667px):**
```
Results Header:         40px
Correct Answer Banner:  60px
Scoreboard Box:        250px (4 players × ~55px each)
Player Answers Box:    360px (4 players × ~90px each) ← TOO TALL
Timer Section:          60px
Margins/gaps:           50px
──────────────────────────
Total:                ~820px (exceeds 667px!)
```

### 2. GameOver - Missing Navigation
**Current behavior:**
- Navigation component conditionally hidden during game phases (Lobby, Question, Results, GameOver)
- After game ends, users have no way to return to home/create new room
- Room closes automatically after 60 seconds, then redirects to 404

**User experience issue:**
- Feels like a dead-end
- Users forced to wait for timeout or manually navigate via browser back button
- Inconsistent with modern web app patterns (always provide navigation)

## Why This Approach

### Chosen Strategy: Single-Row Horizontal Layout + Navbar Restoration

#### 1. Results View - Horizontal Answer Layout

**Use 3-column grid on single row:**
```css
.resultsAnswerItem {
  grid-template-columns: minmax(60px, 0.8fr) 1.5fr auto; /* Name | Answer | Icon */
  grid-template-rows: auto; /* Single row */
  gap: var(--spacing-sm);
}

.resultsAnswerPlayer {
  grid-column: 1;
  grid-row: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resultsAnswerText {
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resultsAnswerRight {
  grid-column: 3;
  grid-row: 1;
}
```

**Why this works:**
- Reduces answer item height from ~90px to ~52px (same as scoreboard rows)
- Reclaims ~152px vertical space (4 players × 38px saved per row)
- Symmetrical with scoreboard (both use single-row layout)
- Text overflow handled gracefully with ellipsis
- Timer guaranteed visible on iPhone SE

**Layout budget after fix:**
```
Results Header:         40px
Correct Answer Banner:  60px
Scoreboard Box:        230px (4 players × ~52px each)
Player Answers Box:    230px (4 players × ~52px each) ← FIXED
Timer Section:          60px
Margins/gaps:           50px
──────────────────────────
Total:                ~670px (fits in 667px!)
```

#### 2. GameOver - Restore Navbar

**Modify Navigation visibility logic:**
```tsx
// Current: Hide on all game phases
const hideNav = ['lobby', 'question', 'results', 'gameOver'].includes(phase);

// Proposed: Show on GameOver
const hideNav = ['lobby', 'question', 'results'].includes(phase);
```

**Why this works:**
- GameOver is a terminal state (game complete, no more interaction needed)
- Navbar provides familiar "escape hatch" to return home
- Consistent with web app best practices (always show navigation)
- Users can immediately start a new game or return to home

### Why Not Alternatives?

**❌ Truncate answers with smaller font:** Makes text harder to read, undermines accessibility

**❌ Add dedicated "New Game" button:** Duplicates navbar functionality, creates visual clutter

**❌ Keep 2-row layout + reduce other spacing:** Not enough space to reclaim, would make layout cramped

**✅ Single-row horizontal layout + navbar:** Solves both problems elegantly without compromise

## Key Decisions

### Decision 1: Results View Layout
- Use single-row 3-column grid: `minmax(60px, 0.8fr) 1.5fr auto`
- Player name gets ~25% width with ellipsis overflow
- Answer text gets ~60% width with ellipsis overflow
- Checkmark/points gets fixed width on right
- Matches scoreboard row height (52px min-height)

**Trade-off:** Very long player names or answers will truncate, but this is acceptable for mobile viewport constraints.

### Decision 2: GameOver Navbar
- Restore navbar on GameOver phase only
- Remove GameOver from `hideNav` array
- Navbar provides "Home" and "Create Room" links
- Maintains consistent navigation pattern

**Trade-off:** Adds ~64px navbar height, but GameOver already has scrollable standings so this is fine.

### Decision 3: Font Sizes
- Keep `font-size-sm` (14px) for mobile player names and answers
- Maintain readability while fitting horizontally
- Consistent with current scoreboard styling

**Trade-off:** None - this is already the current font size.

## Open Questions

- [x] Should we show navbar on GameOver or add a button?
  - **Answer:** Show full navbar (user preference)

- [x] Should we truncate long answers or reduce font size?
  - **Answer:** Horizontal layout with ellipsis truncation (user preference)

- [ ] Should we add tooltips on hover/tap to show full truncated text?
  - **Decision needed:** Low priority - defer unless user requests

- [ ] Should we differentiate correct vs incorrect answers with background color (not just icon)?
  - **Decision needed:** Current green/red background tint is already present

## Technical Details

### Files to Modify

#### 1. `frontend/src/features/game/Results/Results.module.css`
**Lines to change:** Mobile section (221-245)

**Changes:**
- Change `.resultsAnswerItem` grid layout from 2-row to 1-row
- Update grid-template-columns to 3-column layout
- Remove row-specific positioning for name/text/right
- Add text overflow handling (ellipsis, nowrap)

**Before:**
```css
.resultsAnswerItem {
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: var(--spacing-xs) var(--spacing-sm);
}

.resultsAnswerPlayer {
  grid-column: 1;
  grid-row: 1;
}

.resultsAnswerText {
  grid-column: 1 / -1;
  grid-row: 2;
  font-weight: 600;
}

.resultsAnswerRight {
  grid-column: 2;
  grid-row: 1;
}
```

**After:**
```css
.resultsAnswerItem {
  grid-template-columns: minmax(60px, 0.8fr) 1.5fr auto;
  grid-template-rows: auto; /* Single row */
  gap: var(--spacing-sm);
}

.resultsAnswerPlayer {
  grid-column: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resultsAnswerText {
  grid-column: 2;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resultsAnswerRight {
  grid-column: 3;
  flex-shrink: 0;
}
```

#### 2. `frontend/src/components/layout/Navigation/Navigation.tsx`
**Lines to change:** Visibility logic (~line 15-20)

**Changes:**
- Remove 'gameOver' from hideNav array
- Allow navbar to show on GameOver phase

**Before:**
```tsx
const hideNav = ['lobby', 'question', 'results', 'gameOver'].includes(phase);
```

**After:**
```tsx
const hideNav = ['lobby', 'question', 'results'].includes(phase);
```

### CSS Patterns Used

**Ellipsis truncation pattern:**
```css
.element {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Responsive grid columns with minmax:**
```css
.container {
  grid-template-columns: minmax(min-width, max-fraction) fraction auto;
}
```

## Acceptance Criteria

### Results View - Player Answers
- [ ] Player name and answer on same line (horizontal layout)
- [ ] Answer items have same height as scoreboard items (~52px)
- [ ] Long names truncate with ellipsis (e.g., "VeryLongName...")
- [ ] Long answers truncate with ellipsis (e.g., "This is a very long answ...")
- [ ] Checkmark/X and points visible on right
- [ ] Layout works on 360×800px, 375×667px, 393×852px

### Results View - Timer Visibility
- [ ] Timer visible on iPhone SE (375×667px) with 4 players
- [ ] Timer visible on Samsung Galaxy S20 (360×800px)
- [ ] Timer countdown works correctly
- [ ] Progress bar visible and animating

### GameOver - Navigation
- [ ] Navbar visible on GameOver screen
- [ ] "Home" link returns to homepage
- [ ] "Create Room" link starts new game
- [ ] Navbar doesn't obscure winner card or standings
- [ ] Winner card still visible above fold on iPhone SE

### Cross-Compatibility
- [ ] Desktop Results view unchanged (already uses horizontal layout)
- [ ] Desktop GameOver unchanged
- [ ] No regressions on Question, Lobby views

## Testing Strategy

### Visual Testing (Playwright)

```bash
# iPhone SE - Results with 4 players
mcp__playwright__browser_resize --width 375 --height 667
mcp__playwright__browser_navigate --url http://localhost:3000/[results-route]
mcp__playwright__browser_snapshot

# Verify:
# - Player names and answers on same line
# - Timer visible at bottom
# - No vertical overflow

# GameOver screen
mcp__playwright__browser_navigate --url http://localhost:3000/[gameover-route]
mcp__playwright__browser_snapshot

# Verify:
# - Navbar visible at top
# - Winner card below navbar
# - Standings scrollable
```

### Manual Testing

1. **Results View:**
   - Create room with 4 players
   - Answer question (mix correct/incorrect)
   - Resize browser to 375×667px
   - Verify timer visible, answers horizontal

2. **GameOver:**
   - Complete full game (10 questions)
   - Verify navbar appears
   - Click "Home" link → redirects to homepage
   - Click "Create Room" → new room form

### Edge Cases

- [ ] Very long player name (20+ chars) - truncates gracefully
- [ ] Very long answer (100+ chars) - truncates gracefully
- [ ] Mix of short and long names/answers - layout consistent
- [ ] 6+ players in GameOver - standings scroll, navbar stays fixed

## Success Metrics

### Quantitative
- **Answer item height reduced** from ~90px to ~52px (42% reduction)
- **Timer visible** on 100% of Results loads on iPhone SE
- **Vertical space reclaimed** ~152px for 4 players

### Qualitative
- **Professional appearance** - answers aligned horizontally like a table
- **Visual symmetry** - scoreboard and answers have matching row heights
- **Familiar navigation** - navbar always accessible after game ends
- **No user confusion** - clear path to exit/restart game

## Related Work

- Previous plan: `docs/plans/2026-02-08-fix-mobile-viewport-compatibility-plan.md`
- Previous brainstorm: `docs/brainstorms/2026-02-08-mobile-viewport-compatibility-fixes-brainstorm.md`
- Navigation component: `frontend/src/components/layout/Navigation/Navigation.tsx`

---

**Next Step**: Create implementation plan via `/workflows:plan`.
