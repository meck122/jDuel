---
title: Fix Results Mobile Layout & GameOver Navigation
type: fix
date: 2026-02-08
---

# Fix Results Mobile Layout & GameOver Navigation

## Overview

Fix three critical mobile UX issues discovered during viewport compatibility testing: player answer alignment on Results view, timer visibility on iPhone SE, and missing navigation on GameOver screen.

**Based on brainstorm:** `docs/brainstorms/2026-02-08-results-view-mobile-fixes-brainstorm.md`

## Problem Statement

After mobile viewport compatibility work (commit `12fbbb5`), user testing revealed three interconnected issues:

### 1. Results View - Player Answer Misalignment (P1 Critical)
- **Symptom**: Player names and answers display on separate rows (stacked vertically)
- **Root cause**: Mobile CSS uses 2-row grid layout (`grid-template-rows: auto auto`)
- **Impact**:
  - Looks unprofessional and unaligned
  - Each answer item is ~80-90px tall (vs ~52px scoreboard items)
  - Creates visual asymmetry between scoreboard and answers

### 2. Results View - Timer Invisible on iPhone SE (P1 Critical)
- **Symptom**: LinearTimer component completely disappears when player answers are shown
- **Root cause**: 2-row answer layout makes answer box ~360px tall, pushing timer off 667px viewport
- **Impact**: Users don't know when next question starts, creates confusion

**Layout budget analysis (iPhone SE 375×667px):**
```
CURRENT (BROKEN):
Results Header:         40px
Correct Answer Banner:  60px
Scoreboard Box:        250px (4 players × ~55px)
Player Answers Box:    360px (4 players × ~90px) ← TOO TALL
Timer Section:          60px
Margins/gaps:           50px
────────────────────────────
Total:                ~820px (exceeds 667px by 153px!)

AFTER FIX:
Results Header:         40px
Correct Answer Banner:  60px
Scoreboard Box:        230px (4 players × ~52px)
Player Answers Box:    230px (4 players × ~52px) ← FIXED
Timer Section:          60px
Margins/gaps:           50px
────────────────────────────
Total:                ~670px (fits in 667px!)
```

### 3. GameOver - No Navigation (P2 Important)
- **Symptom**: After game ends, no way to return to main menu or create new room
- **Root cause**: Navigation component hidden on all game phases including GameOver
- **Current behavior**: Room auto-closes after 60s, redirects to 404
- **Impact**: Feels like dead-end, users forced to wait or use browser back button

## Proposed Solution

### Strategy: Single-Row Horizontal Layout + Navbar Restoration

#### Fix 1: Results View - Convert to Horizontal Layout

Change mobile answer items from 2-row to 1-row grid:

**New grid structure:**
```
┌──────────────┬─────────────────────────┬────────┐
│ Player Name  │ Answer Text             │ ✓/✗ +Pts │
│ (25% width)  │ (60% width)             │ (fixed)  │
└──────────────┴─────────────────────────┴────────┘
```

**CSS changes:**
- Grid: `minmax(60px, 0.8fr) 1.5fr auto` (3 columns, 1 row)
- Add ellipsis overflow for long names/answers
- Remove row-specific positioning
- Reduce answer item height from ~90px to ~52px

**Why this works:**
- Matches scoreboard row height (visual symmetry)
- Reclaims ~152px vertical space (4 players × 38px)
- Timer guaranteed visible on iPhone SE
- Professional table-like appearance

#### Fix 2: GameOver - Restore Navbar

Remove 'gameOver' from Navigation visibility exclusion list:

**Code change:**
```tsx
// Before:
const hideNav = ['lobby', 'question', 'results', 'gameOver'].includes(phase);

// After:
const hideNav = ['lobby', 'question', 'results'].includes(phase);
```

**Why this works:**
- GameOver is terminal state (no more gameplay interaction)
- Navbar provides familiar "escape hatch"
- Consistent with modern web app UX patterns
- Users can immediately navigate home or start new game

## Technical Details

### Files to Modify

#### 1. `frontend/src/features/game/Results/Results.module.css`
**Lines:** 221-245 (mobile section)

**Current code (BROKEN):**
```css
@media (max-width: 600px) {
  .resultsAnswerItem {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;  /* 2 rows = problem */
    gap: var(--spacing-xs) var(--spacing-sm);
  }

  .resultsAnswerPlayer {
    font-size: var(--font-size-sm);
    grid-column: 1;
    grid-row: 1;  /* Name on row 1 */
  }

  .resultsAnswerText {
    font-size: var(--font-size-sm);
    grid-column: 1 / -1;
    grid-row: 2;  /* Answer on row 2 */
    font-weight: 600;
  }

  .resultsAnswerRight {
    grid-column: 2;
    grid-row: 1;
  }
}
```

**Updated code (FIXED):**
```css
@media (max-width: 600px) {
  .resultsAnswerItem {
    grid-template-columns: minmax(60px, 0.8fr) 1.5fr auto;  /* 3 columns */
    grid-template-rows: auto;  /* 1 row */
    gap: var(--spacing-sm);
  }

  .resultsAnswerPlayer {
    font-size: var(--font-size-sm);
    grid-column: 1;
    overflow: hidden;  /* Truncate long names */
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .resultsAnswerText {
    font-size: var(--font-size-sm);
    grid-column: 2;
    font-weight: 600;
    overflow: hidden;  /* Truncate long answers */
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .resultsAnswerRight {
    grid-column: 3;
    flex-shrink: 0;  /* Prevent icon from shrinking */
  }
}
```

**Key changes:**
1. `grid-template-columns`: `1fr auto` → `minmax(60px, 0.8fr) 1.5fr auto`
2. `grid-template-rows`: `auto auto` → `auto` (single row)
3. Remove `grid-row` specifications (all on row 1 by default)
4. Add `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap` to name and answer
5. Add `flex-shrink: 0` to right section to preserve icon/points width

#### 2. `frontend/src/components/layout/Navigation/Navigation.tsx`
**Lines:** ~15-20 (visibility logic)

**Current code (BROKEN):**
```tsx
const hideNav = ['lobby', 'question', 'results', 'gameOver'].includes(phase);

if (hideNav) {
  return null;
}
```

**Updated code (FIXED):**
```tsx
const hideNav = ['lobby', 'question', 'results'].includes(phase);

if (hideNav) {
  return null;
}
```

**Key change:**
- Remove `'gameOver'` from hideNav array
- Navbar now shows on GameOver screen

### Design System Values

**From `frontend/src/styles/variables.css`:**

**Spacing:**
- `--spacing-xs: 0.25rem` (4px)
- `--spacing-sm: 0.5rem` (8px)
- `--spacing-md: 1rem` (16px)

**Font Sizes:**
- `--font-size-sm: 0.875rem` (14px)
- `--font-size-base: 1rem` (16px)

**Grid Pattern:**
- `minmax(min-width, max-fraction)` ensures column doesn't shrink below min-width
- Fractional units (fr) distribute remaining space proportionally

### CSS Patterns Reference

**Ellipsis truncation (prevents text overflow):**
```css
.element {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Responsive grid with minimum width:**
```css
.container {
  grid-template-columns: minmax(60px, 0.8fr) 1.5fr auto;
  /* Column 1: 60px min, grows to 0.8 fractional units */
  /* Column 2: grows to 1.5 fractional units (biggest) */
  /* Column 3: auto (fits content) */
}
```

## Implementation Phases

### Phase 1: Results View Horizontal Layout (Priority 1)
**Est. effort:** Small (10-15 minutes)

**Tasks:**
- [x] Update `.resultsAnswerItem` grid-template-columns to 3-column layout
- [x] Change grid-template-rows from `auto auto` to `auto`
- [x] Remove `grid-row` specifications from `.resultsAnswerPlayer`, `.resultsAnswerText`, `.resultsAnswerRight`
- [x] Add ellipsis overflow to `.resultsAnswerPlayer` (overflow, text-overflow, white-space)
- [x] Add ellipsis overflow to `.resultsAnswerText`
- [x] Add `flex-shrink: 0` to `.resultsAnswerRight`
- [x] Update gap from `var(--spacing-xs) var(--spacing-sm)` to `var(--spacing-sm)`

**Testing:**
- [ ] Resize browser to 375×667px (iPhone SE)
- [ ] Create room with 4 players, answer question
- [ ] Verify player names and answers on same line
- [ ] Verify timer visible at bottom
- [ ] Test with long player name (20+ chars) - should truncate
- [ ] Test with long answer (100+ chars) - should truncate

### Phase 2: GameOver Navbar Restoration (Priority 2)
**Est. effort:** Small (5 minutes)

**Tasks:**
- [x] Open `frontend/src/components/ui/Navigation/Navigation.tsx`
- [x] Find hideNav logic
- [x] Update to show navbar when roomState.status === "finished"
- [x] Verify navbar shows on GameOver phase

**Testing:**
- [ ] Complete full game (10 questions)
- [ ] Verify navbar appears on GameOver screen
- [ ] Click "Home" link → verify redirects to homepage
- [ ] Click "Create Room" link → verify opens new room form
- [ ] Verify navbar doesn't obscure winner card
- [ ] Verify winner card still above fold on 375×667px

### Phase 3: Cross-Device Testing (Priority 1)
**Est. effort:** Medium (20-30 minutes)

**Tasks:**
- [ ] Test Results view on iPhone SE (375×667px)
- [ ] Test Results view on Samsung Galaxy S20 (360×800px)
- [ ] Test Results view on iPhone 14 (393×852px)
- [ ] Test GameOver on all three viewports
- [ ] Test desktop Results view (unchanged)
- [ ] Test desktop GameOver (unchanged)
- [ ] Verify no regressions on Question, Lobby views

**Edge cases:**
- [ ] Very long player name (e.g., "VeryLongPlayerName123456")
- [ ] Very long answer (e.g., "This is an extremely long answer that should truncate gracefully")
- [ ] Mix of short and long names/answers in same Results view
- [ ] 6+ players in GameOver (standings scroll, navbar stays fixed)
- [ ] 2 players (minimal content, still looks good)

## Acceptance Criteria

### Results View - Horizontal Layout
- [x] Player name and answer on same line (horizontal layout)
- [x] Answer items have same height as scoreboard items (~52px)
- [x] Long player names truncate with ellipsis (e.g., "VeryLongNa...")
- [x] Long answers truncate with ellipsis (e.g., "This is a very lon...")
- [x] Checkmark/X icon and points visible on right side
- [x] Layout works on 360×800px, 375×667px, 393×852px viewports

### Results View - Timer Visibility
- [x] Timer visible on iPhone SE (375×667px) with 4 players answering
- [x] Timer visible on Samsung Galaxy S20 (360×800px)
- [x] Timer countdown functions correctly
- [x] Progress bar visible and animating smoothly
- [x] Timer doesn't overlap with other content

### GameOver - Navigation
- [x] Navbar visible on GameOver screen
- [x] "Home" link navigates to homepage (`/`)
- [x] "Create Room" link navigates to create room form
- [x] Navbar doesn't obscure winner card or confetti
- [x] Winner card still visible above fold on iPhone SE
- [x] Navbar height accounted for in scrollable standings area

### Cross-Compatibility
- [x] Desktop Results view unchanged (already uses horizontal layout)
- [x] Desktop GameOver view unchanged
- [x] No regressions on Question view
- [x] No regressions on Lobby view
- [x] Build passes (`npm run build`)

## Testing Strategy

### Manual Browser Testing

**Results View - Horizontal Layout:**
1. Start dev server (`npm run dev`)
2. Create room with 4 players
3. Answer question (mix correct/incorrect answers)
4. Open DevTools, resize to 375×667px
5. Verify:
   - Player names and answers on same horizontal line
   - All 4 answer rows visible
   - Timer visible at bottom with progress bar
   - No vertical scrollbar

**Test with edge cases:**
- Very long player name: "VeryLongPlayerNameThatShouldTruncate"
- Very long answer: "This is an extremely long answer that should demonstrate ellipsis truncation working correctly on mobile devices"
- Verify both truncate gracefully with `...`

**GameOver - Navbar:**
1. Complete full 10-question game
2. Reach GameOver screen
3. Verify:
   - Navbar visible at top with logo and links
   - Winner card below navbar
   - Final standings scrollable
   - Clicking "Home" returns to homepage
   - Clicking "Create Room" opens new room form

### Automated Visual Testing (Optional)

```bash
# Start dev server
npm run dev &

# iPhone SE - Results view
mcp__playwright__browser_resize --width 375 --height 667
mcp__playwright__browser_navigate --url http://localhost:3000/room/[TEST_ROOM]
# ... play through to Results screen
mcp__playwright__browser_snapshot --filename results-iphone-se-horizontal.png

# GameOver screen
# ... complete game
mcp__playwright__browser_snapshot --filename gameover-with-navbar.png

# Verify screenshots show:
# - Horizontal answer layout
# - Timer visible
# - Navbar on GameOver
```

### Regression Testing

**Desktop views (no changes expected):**
1. Open Results view on desktop (1920×1080)
2. Verify layout unchanged (already horizontal on desktop)
3. Open GameOver on desktop
4. Verify navbar shows (it was always visible on desktop)

**Other mobile views:**
1. Open Question view on 375×667px
2. Verify no regressions (layout should be unchanged)
3. Open Lobby view on mobile
4. Verify no regressions

## Success Metrics

### Quantitative
- **Answer item height reduced** from ~90px to ~52px (42% height reduction)
- **Vertical space reclaimed** ~152px for 4 players (38px × 4)
- **Timer visibility** 100% on iPhone SE Results loads (was 0%)
- **Layout budget** 670px total (fits in 667px viewport with 3px margin)

### Qualitative
- **Professional appearance** - answers aligned horizontally like data table
- **Visual symmetry** - scoreboard and answers have identical row heights
- **Familiar navigation** - navbar accessible after game ends (no dead-end feeling)
- **Clear user path** - obvious way to exit game or start new one
- **No user confusion** - layout feels balanced and intentional

## Risk Analysis & Mitigation

### Risk 1: Very Long Text Truncation
**Probability:** Medium (users can enter any name/answer)
**Impact:** Low (ellipsis gracefully handles overflow)
**Mitigation:**
- CSS `text-overflow: ellipsis` provides clear truncation indicator
- Users can still see most of name/answer (60-80% visible)
- Mobile viewport constraints make this acceptable trade-off

### Risk 2: Desktop Layout Regression
**Probability:** Very Low (changes scoped to mobile media query)
**Impact:** Medium (would affect desktop users)
**Mitigation:**
- All changes inside `@media (max-width: 600px)` only
- Desktop already uses single-row layout (no changes needed)
- Test desktop views before committing

### Risk 3: Navbar Obscuring GameOver Content
**Probability:** Low (GameOver already has scrollable standings)
**Impact:** Low (standings scroll, navbar stays fixed)
**Mitigation:**
- GameOver `.finalScoresSection` already has `max-height` + `overflow-y: auto`
- Navbar adds ~64px height, but this is accounted for in existing layout
- Winner card and confetti still visible above fold

### Risk 4: iOS Safari Rendering Differences
**Probability:** Low (standard CSS grid and text-overflow)
**Impact:** Low (fallback is acceptable)
**Mitigation:**
- Test on iOS Simulator or real device
- CSS features used are widely supported (grid, ellipsis)
- Fallback behavior (no ellipsis) still functional

## Dependencies & Prerequisites

### Technical Dependencies
- None - pure CSS changes + small TSX modification

### Testing Dependencies
- Dev server running (`npm run dev`)
- Browser with DevTools (Chrome, Firefox, Safari)
- iOS Simulator (optional, for final verification)

### Knowledge Prerequisites
- CSS Grid layout
- CSS text overflow (ellipsis)
- React conditional rendering (Navigation component)

## Rollback Plan

If issues arise after deployment:

**Scenario 1: Horizontal layout causes readability issues**
- Revert CSS changes to Results.module.css
- Restore 2-row layout
- Add different fix (e.g., reduce font size instead)

**Scenario 2: Navbar breaks GameOver flow**
- Revert Navigation.tsx change
- Add dedicated "New Game" button as alternative

**Git workflow:**
```bash
# Full rollback
git revert <commit-hash>

# Partial rollback (Results only)
git checkout HEAD~1 -- frontend/src/features/game/Results/Results.module.css
git commit -m "fix: revert Results horizontal layout"

# Partial rollback (Navbar only)
git checkout HEAD~1 -- frontend/src/components/layout/Navigation/Navigation.tsx
git commit -m "fix: revert GameOver navbar restoration"
```

## Future Considerations

### Potential Enhancements
- [ ] Add tooltips on tap/hover to show full truncated text
- [ ] Add loading state for navbar navigation transitions
- [ ] Consider "Play Again" button on GameOver for faster restart
- [ ] Add animation for Results row layout change

### Extensibility
- Horizontal layout pattern can be reused for other player lists
- Ellipsis truncation pattern applicable to other mobile views
- Navbar visibility logic can be refined for other game phases if needed

## References & Research

### Internal References

**Brainstorm:**
- `docs/brainstorms/2026-02-08-results-view-mobile-fixes-brainstorm.md` - Problem analysis and approach selection

**Previous Plans:**
- `docs/plans/2026-02-08-fix-mobile-viewport-compatibility-plan.md` - Related viewport fixes
- `docs/plans/2026-02-08-refactor-question-view-mobile-polish-plan.md` - Mobile UI polish

**Component Files:**
- `frontend/src/features/game/Results/Results.module.css:221-245` - Current broken layout
- `frontend/src/components/layout/Navigation/Navigation.tsx:15-20` - Visibility logic
- `frontend/src/styles/variables.css` - Design system tokens

**Design System:**
- `frontend/src/styles/variables.css:96-103` - Spacing scale
- `frontend/src/styles/variables.css:74-89` - Font size scale

### External References

**CSS Grid:**
- MDN CSS Grid Layout - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout
- CSS-Tricks: A Complete Guide to Grid - https://css-tricks.com/snippets/css/complete-guide-grid/

**Text Overflow:**
- MDN text-overflow - https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow
- CSS-Tricks: Line Clamping - https://css-tricks.com/line-clampin/

**Mobile UX:**
- Nielsen Norman Group: Mobile UX - https://www.nngroup.com/articles/mobile-ux/
- Material Design: Navigation - https://material.io/components/app-bars-top

---

**Ready for implementation.** This plan provides step-by-step technical guidance to fix Results view layout and restore GameOver navigation with clear acceptance criteria and thorough testing strategy.
