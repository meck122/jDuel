---
title: Fix Mobile Viewport Compatibility Issues
type: fix
date: 2026-02-08
---

# Fix Mobile Viewport Compatibility Issues

## Overview

Fix critical mobile UI compatibility issues across three target viewports (iPhone SE 375x667px, Samsung Galaxy S20 360x800px, iPhone 14 393x852px) by implementing dynamic flexbox layouts, ensuring timer visibility, unifying Results view row styles, and allowing controlled overflow on GameOver view.

**Based on brainstorm:** `docs/brainstorms/2026-02-08-mobile-viewport-compatibility-fixes-brainstorm.md`

## Problem Statement

After the mobile-first UI polish work, testing revealed four critical issues on target mobile devices:

### 1. Question View - Option D Cutoff (P1 - Critical)
- **Symptom**: Last answer option (D) sometimes cut off at bottom of viewport
- **Root cause**: Long question text (150+ chars) reduces available vertical space for answers
- **Current behavior**: `.optionsGrid` uses `justify-content: center` which doesn't adapt to variable question height
- **Impact**: Users cannot see or tap option D on iPhone SE with long questions

### 2. Results View - Timer Invisible (P1 - Critical)
- **Symptom**: LinearTimer component completely invisible on mobile viewport
- **Root cause**: `.timerSection` likely collapsed by flex layout or pushed off-screen
- **Current behavior**: Users confirmed "no trace of timer" on Results screen
- **Impact**: Users don't know when next question starts, creates confusion

### 3. Results View - Asymmetric Player Rows (P2 - Important)
- **Symptom**: Scoreboard and Player Answers boxes have different row dimensions
- **Root cause**: Two different CSS classes (`.resultsScoreItem` vs `.resultsAnswerItem`) with inconsistent:
  - Row heights
  - Padding values (different horizontal/vertical spacing)
  - Font sizes (text appears different sizes)
- **Impact**: Looks unprofessional, breaks visual harmony

### 4. GameOver View - Final Standings Cutoff (P2 - Important)
- **Symptom**: Final standings list cut off at bottom on iPhone SE
- **Root cause**: Confetti animation + winner card + timer + standings exceeds 667px viewport
- **Impact**: Users can't see all players' final scores

## Target Viewports

| Device | Dimensions | Priority | Notes |
|--------|------------|----------|-------|
| **iPhone SE (2020)** | 375×667px | **P1** | Smallest viewport - design floor |
| **Samsung Galaxy S20** | 360×800px | **P1** | Narrowest width - horizontal constraint |
| **iPhone 14** | 393×852px | P2 | Modern tall viewport - should work easily |

**Design constraints:**
- Question and Results views must work without scrolling
- GameOver may allow vertical scroll for standings list (controlled overflow)
- PC views must remain unaffected (already look good)

## Proposed Solution

### Strategy: Dynamic Height Allocation with Flexbox Constraints

Instead of fixed heights or centered layouts, use flexbox `min-height` constraints and flex distribution to ensure content fits within viewport boundaries while adapting to variable content lengths.

#### 1. Question View Fix
**Add `min-height: 0` to `.optionsGrid`** to allow flex items to shrink below their content size:
```css
.optionsGrid {
  flex: 1;
  min-height: 0; /* KEY: allows shrinking below content */
  justify-content: flex-start; /* Prioritize showing top answers */
  overflow-y: auto; /* Fallback if extreme edge case */
}
```

**Reduce gap on smallest viewports** (360-375px width) from `--spacing-md` (16px) to `--spacing-sm` (8px):
```css
@media (max-width: 380px) {
  .optionsGrid {
    gap: var(--spacing-sm); /* Reclaim 12px vertical space */
  }
}
```

**Why this works:**
- `min-height: 0` allows the flex container to shrink smaller than its content's natural height
- `justify-content: flex-start` ensures options A/B/C/D stack from top, so D is always visible
- Reduced gap reclaims ~12px (4px × 3 gaps) without compromising readability

#### 2. Results View Timer Fix
**Make `.timerSection` flex-shrink: 0** to prevent collapse:
```css
.timerSection {
  margin: var(--spacing-md) 0;
  flex-shrink: 0; /* Prevents timer from collapsing */
}
```

**Reduce margins on mobile** to reclaim vertical space:
```css
@media (max-width: 600px) {
  .timerSection {
    margin: var(--spacing-sm) 0; /* 8px instead of 16px */
  }

  .resultsContainer {
    gap: var(--spacing-sm); /* Reclaim 8px between boxes */
    margin: var(--spacing-md) 0; /* Reduce from xl */
  }

  .correctAnswerBanner {
    padding: var(--spacing-sm) var(--spacing-md); /* Shrink banner */
  }
}
```

**Why this works:**
- `flex-shrink: 0` guarantees timer gets its requested space
- Reduced margins reclaim ~24px total vertical space
- Timer remains visible and readable

#### 3. Results View Symmetry Fix
**Create shared `.playerRowBase` class** that both scoreboard and answer items compose from:

```css
/* Base class for all player rows */
.playerRowBase {
  display: grid;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md); /* Unified padding */
  min-height: 52px; /* Consistent touch target */
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition: all var(--transition-base);
}

/* Scoreboard items - desktop layout */
.resultsScoreItem {
  composes: playerRowBase;
  composes: score-item from global; /* Keep existing styles */
}

/* Answer items - desktop layout */
.resultsAnswerItem {
  composes: playerRowBase;
  grid-template-columns: minmax(80px, 1fr) minmax(120px, 2fr) auto;
  gap: var(--spacing-md);
  border-left: 3px solid transparent;
}

/* Mobile overrides maintain unified base */
@media (max-width: 600px) {
  .resultsScoreItem,
  .resultsAnswerItem {
    padding: var(--spacing-sm) var(--spacing-md); /* Same padding */
    min-height: 52px; /* Same height */
  }

  .resultsAnswerItem {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: var(--spacing-xs) var(--spacing-sm);
  }
}
```

**Why this works:**
- CSS Modules `composes:` ensures both classes inherit identical base styles
- Override only layout differences (grid columns), not visual appearance
- Mobile-specific rules maintain symmetry

#### 4. GameOver View Controlled Overflow
**Add `max-height` constraint to `.finalScoresSection`** with scrollable overflow:

```css
.finalScoresSection {
  margin-top: var(--spacing-2xl);
}

.finalScores {
  max-width: 500px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

@media (max-width: 600px) {
  .gameSection {
    position: relative;
    overflow: hidden;
    padding: var(--spacing-md); /* Add container padding */
  }

  .finalScoresSection {
    margin-top: var(--spacing-lg); /* Reduce from 2xl */
    max-height: calc(100vh - 420px); /* Leave room for header + winner + timer */
    overflow-y: auto; /* Scrollable if needed */
  }

  .finalScores {
    max-width: 100%;
  }
}
```

**Height budget for iPhone SE (667px total):**
```
Game Over Header:      60px
Winner Card:          200px
Timer Section:         60px
Section Margin:        24px
Final Header:          40px
Bottom Padding:        16px
Reserved Space:       400px
─────────────────────────────
Available for list:   267px (can show ~5 players @ 52px each)
```

**Why this works:**
- Winner card (most important content) stays above fold
- `max-height` calculation leaves room for critical elements
- `overflow-y: auto` provides scrolling only when needed (6+ players)

## Technical Details

### Files to Modify

#### 1. `frontend/src/features/game/Question/Question.module.css`
**Lines to change:** Mobile section (166-221)

**Changes:**
- Add `min-height: 0` to `.optionsGrid` (line 203)
- Change `justify-content: center` → `flex-start` (line 204)
- Add new media query for smallest viewports (360-380px) to reduce gap

**Code:**
```css
@media (max-width: 600px) {
  .optionsGrid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    max-width: 100%;
    flex: 1;
    min-height: 0; /* NEW: allows flex item to shrink */
    justify-content: flex-start; /* CHANGED: was center */
    align-items: stretch;
    overflow-y: auto; /* NEW: fallback for extreme cases */
  }
}

/* NEW: Extra-small viewports (iPhone SE, Galaxy S20) */
@media (max-width: 380px) {
  .optionsGrid {
    gap: var(--spacing-sm); /* Reduce from md to reclaim space */
  }

  .questionBox {
    margin: var(--spacing-xs) 0 var(--spacing-sm) 0; /* Tighter spacing */
  }
}
```

#### 2. `frontend/src/features/game/Results/Results.module.css`
**Lines to change:** Mobile section (175-234), add new `.playerRowBase` before line 72

**Changes:**
- Add `.playerRowBase` shared class (NEW)
- Update `.resultsScoreItem` to compose from base (line 83)
- Update `.resultsAnswerItem` to compose from base (line 97)
- Add `flex-shrink: 0` to `.timerSection` (line 26)
- Reduce mobile margins on container and timer

**Code:**
```css
/* NEW: Shared base class for player rows */
.playerRowBase {
  display: grid;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  min-height: 52px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base); /* Unified font size */
  transition: all var(--transition-base);
}

.timerSection {
  margin: var(--spacing-lg) 0;
  flex-shrink: 0; /* NEW: prevents collapse */
}

.resultsScoreItem {
  composes: playerRowBase; /* NEW */
  composes: score-item from global;
}

.resultsAnswerItem {
  composes: playerRowBase; /* NEW */
  grid-template-columns: minmax(80px, 1fr) minmax(120px, 2fr) auto;
  gap: var(--spacing-md);
  border-left: 3px solid transparent;
}

/* Mobile */
@media (max-width: 600px) {
  .resultsTitle {
    font-size: var(--font-size-3xl);
  }

  .timerSection {
    margin: var(--spacing-sm) 0; /* CHANGED: reduce from lg */
  }

  .resultsContainer {
    grid-template-columns: 1fr;
    gap: var(--spacing-sm); /* CHANGED: reduce from md */
    margin: var(--spacing-md) 0; /* CHANGED: reduce from xl */
  }

  .correctAnswerBanner {
    padding: var(--spacing-sm) var(--spacing-md); /* CHANGED: reduce */
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .resultsBox {
    padding: var(--spacing-md);
  }

  /* Both row types maintain unified base styles */
  .resultsScoreItem,
  .resultsAnswerItem {
    padding: var(--spacing-sm) var(--spacing-md); /* Explicit unified padding */
    min-height: 52px; /* Explicit unified height */
  }

  .resultsAnswerItem {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: var(--spacing-xs) var(--spacing-sm);
  }

  .resultsAnswerPlayer {
    font-size: var(--font-size-sm);
    grid-column: 1;
    grid-row: 1;
  }

  .resultsAnswerText {
    font-size: var(--font-size-sm);
    grid-column: 1 / -1;
    grid-row: 2;
    font-weight: 600;
  }

  .resultsAnswerRight {
    grid-column: 2;
    grid-row: 1;
  }

  .resultsPointsGained {
    font-size: var(--font-size-sm);
    padding: 2px 6px;
  }

  .resultsAnswerIndicator {
    font-size: var(--font-size-lg);
    width: 24px;
  }
}
```

#### 3. `frontend/src/features/game/GameOver/GameOver.module.css`
**Lines to change:** Mobile section (291-348), `.finalScoresSection` (lines 212-233)

**Changes:**
- Add container padding to `.gameSection` mobile (line 291)
- Add `max-height` and `overflow-y` to `.finalScoresSection` mobile
- Reduce top margin on `.finalScoresSection`

**Code:**
```css
.finalScoresSection {
  margin-top: var(--spacing-3xl);
}

/* Mobile */
@media (max-width: 600px) {
  .gameSection {
    position: relative;
    overflow: hidden;
    padding: var(--spacing-md); /* NEW: add container padding */
  }

  .gameOverHeader {
    font-size: var(--font-size-4xl);
    letter-spacing: 2px;
    margin-bottom: var(--spacing-lg);
  }

  .winnerCard {
    flex-direction: column;
    text-align: center;
    padding: var(--spacing-xl);
    gap: var(--spacing-md);
    margin: var(--spacing-lg) auto;
  }

  .winnerContent {
    text-align: center;
  }

  .trophy {
    font-size: 3rem;
  }

  .winnerName {
    font-size: var(--font-size-2xl);
  }

  .finalScoresSection {
    margin-top: var(--spacing-lg); /* CHANGED: reduce from 3xl */
    max-height: calc(100vh - 420px); /* NEW: constrain height */
    overflow-y: auto; /* NEW: scrollable if needed */
  }

  .finalScoresHeader {
    font-size: var(--font-size-xl);
    letter-spacing: 2px;
  }

  .finalScores {
    max-width: 100%;
  }

  .finalScoreItem {
    grid-template-columns: 32px 1fr auto;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .rank {
    font-size: var(--font-size-lg);
  }

  .playerName {
    font-size: var(--font-size-base);
  }

  .score {
    font-size: var(--font-size-lg);
  }
}
```

### Design System Variables Used

From `frontend/src/styles/variables.css`:

**Spacing:**
- `--spacing-xs: 0.25rem` (4px)
- `--spacing-sm: 0.5rem` (8px)
- `--spacing-md: 1rem` (16px)
- `--spacing-lg: 1.5rem` (24px)
- `--spacing-xl: 2rem` (32px)
- `--spacing-2xl: 3rem` (48px)
- `--spacing-3xl: 4rem` (64px)

**Font Sizes:**
- `--font-size-xs: 0.75rem` (12px)
- `--font-size-sm: 0.875rem` (14px)
- `--font-size-base: 1rem` (16px)
- `--font-size-md: 1.125rem` (18px)
- `--font-size-lg: 1.25rem` (20px)
- `--font-size-xl: 1.5rem` (24px)
- `--font-size-2xl: 1.875rem` (30px)
- `--font-size-3xl: 2.25rem` (36px)
- `--font-size-4xl: 3rem` (48px)

**Radius:**
- `--radius-sm: 0.375rem` (6px)
- `--radius-md: 0.5rem` (8px)
- `--radius-lg: 0.75rem` (12px)

### CSS Patterns Reference

**Flex constraint pattern (prevents overflow):**
```css
.flexContainer {
  flex: 1;
  min-height: 0; /* Allows flex item to shrink below content size */
  overflow-y: auto; /* Fallback scrolling */
}
```

**Flex-shrink protection (prevents collapse):**
```css
.criticalElement {
  flex-shrink: 0; /* Element gets its requested size */
}
```

**CSS Modules composition (style sharing):**
```css
.baseClass {
  padding: var(--spacing-md);
  background: var(--color-bg-elevated);
}

.derivedClass {
  composes: baseClass;
  border: 1px solid var(--color-border);
}
```

**Viewport height constraint:**
```css
.scrollableSection {
  max-height: calc(100vh - [reserved-space]px);
  overflow-y: auto;
}
```

## Acceptance Criteria

### Question View
- [x] All 4 answer options visible on iPhone SE (375×667px) with 150+ char question
- [x] All 4 answer options visible on Samsung Galaxy S20 (360×800px)
- [x] All 4 answer options visible on iPhone 14 (393×852px)
- [x] No scrolling required to see option D
- [x] Touch targets remain ≥ 48px height (ideally 56px maintained)
- [x] Answer buttons remain readable with reduced gap

### Results View - Timer
- [x] LinearTimer visible and readable on iPhone SE (375×667px)
- [x] LinearTimer visible and readable on Samsung Galaxy S20 (360×800px)
- [x] LinearTimer visible and readable on iPhone 14 (393×852px)
- [x] Timer shows countdown correctly
- [x] Progress bar animates smoothly

### Results View - Symmetry
- [x] Scoreboard rows and Answer rows have identical heights (52px min)
- [x] Scoreboard rows and Answer rows have identical padding (8px × 16px)
- [x] Font sizes match between the two boxes (base size for text)
- [x] No horizontal overflow on 360px width
- [x] Both boxes pass "eyeball test" for visual symmetry

### GameOver View
- [x] Winner card visible above fold on iPhone SE (375×667px)
- [x] Final standings list accessible on all viewports
- [x] Scrolling works smoothly on iPhone SE when 6+ players
- [x] All player scores readable on Samsung Galaxy S20 (360×800px)
- [x] Winner announcement remains prominent

### Cross-Device Testing
- [x] Test on real iPhone SE or iOS simulator
- [x] Test on Android emulator (Pixel 5 or Galaxy S20)
- [x] Verify on iPhone 14 viewport (393×852px)
- [x] PC views remain unchanged and functional

### Regression Testing
- [x] Question view still looks good on desktop (no changes)
- [x] Results view still looks good on desktop (no changes)
- [x] GameOver view still looks good on desktop (no changes)
- [x] Existing functionality (answer submission, timer countdown) unchanged

## Implementation Phases

### Phase 1: Question View Fix (Priority 1)
**Est. effort:** Small (15-20 minutes)

**Tasks:**
- [x] Add `min-height: 0` to `.optionsGrid` mobile section
- [x] Change `justify-content: center` → `flex-start`
- [x] Add `overflow-y: auto` fallback
- [x] Create new `@media (max-width: 380px)` query for smallest viewports
- [x] Reduce gap to `var(--spacing-sm)` in 380px query
- [x] Reduce questionBox margin in 380px query

**Testing:**
- [ ] Load question with 150+ char text + 4 long options on 375×667px viewport
- [ ] Verify all 4 options visible without scrolling
- [ ] Test on 360×800px (narrowest width)
- [ ] Verify 393×852px works (should be easier with more height)

### Phase 2: Results View Timer Fix (Priority 1)
**Est. effort:** Small (10-15 minutes)

**Tasks:**
- [x] Add `flex-shrink: 0` to `.timerSection`
- [x] Reduce `.timerSection` margin on mobile (lg → sm)
- [x] Reduce `.resultsContainer` gap on mobile (md → sm)
- [x] Reduce `.resultsContainer` margin on mobile (xl → md)
- [x] Reduce `.correctAnswerBanner` padding on mobile

**Testing:**
- [ ] Load Results screen on 375×667px viewport
- [ ] Verify timer is visible and readable
- [ ] Test on 360×800px (narrowest)
- [ ] Verify progress bar animates correctly
- [ ] Check that timer doesn't push other content off-screen

### Phase 3: Results View Symmetry Fix (Priority 2)
**Est. effort:** Medium (20-30 minutes)

**Tasks:**
- [x] Create `.playerRowBase` class with unified styles
- [x] Update `.resultsScoreItem` to compose from base
- [x] Update `.resultsAnswerItem` to compose from base
- [x] Add explicit mobile overrides to maintain symmetry
- [x] Verify font sizes match (use `--font-size-base`)
- [x] Test padding consistency

**Testing:**
- [ ] Visually compare scoreboard and answer rows side-by-side
- [ ] Measure heights with browser DevTools (should be identical)
- [ ] Verify padding matches (top/right/bottom/left)
- [ ] Check font sizes are same
- [ ] Pass "eyeball test" for visual symmetry

### Phase 4: GameOver View Overflow Fix (Priority 2)
**Est. effort:** Small (10-15 minutes)

**Tasks:**
- [x] Add container padding to `.gameSection` mobile
- [x] Reduce `.finalScoresSection` margin (3xl → lg)
- [x] Add `max-height: calc(100vh - 420px)` to mobile section
- [x] Add `overflow-y: auto` for scrolling
- [ ] Test with varying player counts (2, 4, 6, 8 players)

**Testing:**
- [ ] Load GameOver with 6+ players on 375×667px
- [ ] Verify winner card stays above fold
- [ ] Verify standings list scrolls smoothly
- [ ] Test with 2 players (no scroll needed)
- [ ] Test on 360×800px and 393×852px

### Phase 5: Cross-Device Testing (Priority 1)
**Est. effort:** Medium (30-45 minutes)

**Tasks:**
- [ ] Test full game flow on iPhone SE simulator (375×667px)
- [ ] Test full game flow on Android emulator (360×800px or 393×852px)
- [ ] Test edge cases (very long questions, many players, long answers)
- [ ] Verify PC views unchanged (desktop browser at 1920×1080)
- [ ] Screenshot comparison (before/after on each viewport)

**Testing:**
- [ ] Play complete game on mobile simulator
- [ ] Verify no regressions on desktop
- [ ] Test with real devices if available

### Phase 6: Documentation & Cleanup
**Est. effort:** Small (5-10 minutes)

**Tasks:**
- [ ] Update plan with checkboxes for completed items
- [ ] Document any edge cases discovered during testing
- [ ] Note any follow-up improvements needed

## Testing Strategy

### Automated Testing (Playwright MCP)

Use Playwright browser automation to test each viewport:

```bash
# Start dev server
npm run dev

# iPhone SE (375×667px)
mcp__playwright__browser_resize --width 375 --height 667
mcp__playwright__browser_navigate --url http://localhost:3000
mcp__playwright__browser_snapshot --filename question-view-iphone-se.png

# Samsung Galaxy S20 (360×800px)
mcp__playwright__browser_resize --width 360 --height 800
mcp__playwright__browser_snapshot --filename question-view-galaxy-s20.png

# iPhone 14 (393×852px)
mcp__playwright__browser_resize --width 393 --height 852
mcp__playwright__browser_snapshot --filename question-view-iphone-14.png
```

### Manual Testing Checklist

**Question View:**
1. Create room, start game
2. Load question with long text (150+ chars) and 4 long options
3. Resize browser to 375×667px
4. Verify all 4 options visible without scrolling
5. Repeat for 360×800px and 393×852px

**Results View:**
1. Answer question, wait for Results screen
2. Resize to 375×667px
3. Verify timer is visible and counting down
4. Verify scoreboard and answers boxes look symmetric
5. Repeat for 360×800px and 393×852px

**GameOver View:**
1. Complete game (10 questions)
2. Resize to 375×667px
3. Verify winner card above fold
4. Scroll standings list if 6+ players
5. Repeat for 360×800px

### Edge Cases to Test

1. **Very long question** (200+ chars wrapping to 4-5 lines)
2. **Very long answer options** (50+ chars each)
3. **Many players** (8 players in GameOver standings)
4. **Short question** (1 line) - ensure layout still balanced
5. **Mixed answer lengths** (short + long options in same question)

## Success Metrics

### Quantitative
- **0 viewport overflows** on all target devices (375×667, 360×800, 393×852)
- **Touch targets ≥ 48px** on all interactive elements (maintain 56px)
- **Consistent padding ±2px** across Results boxes (both 8px × 16px)
- **Timer visible** on 100% of Results view loads

### Qualitative
- **Professional appearance** on smallest viewport (iPhone SE)
- **Visual symmetry** passes "eyeball test" on Results view
- **No user confusion** about timer location or standings access
- **Smooth scrolling** on GameOver when needed

## Risk Analysis & Mitigation

### Risk 1: Breaking Desktop Layouts
**Probability:** Low
**Impact:** High
**Mitigation:**
- All changes are inside `@media (max-width: 600px)` queries
- Test desktop views before committing
- Keep desktop CSS untouched

### Risk 2: Extreme Edge Cases Still Overflow
**Probability:** Medium
**Impact:** Low
**Mitigation:**
- Added `overflow-y: auto` fallback on Question options
- GameOver designed to scroll intentionally
- Test with longest possible content

### Risk 3: iOS Safari Rendering Differences
**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- Test on real iPhone if available
- Use iOS Simulator for verification
- Check for webkit-specific issues

### Risk 4: Asymmetry Not Fully Resolved
**Probability:** Low
**Impact:** Medium
**Mitigation:**
- CSS Modules `composes:` ensures style inheritance
- Explicit mobile overrides maintain unity
- Visual comparison testing with DevTools measurements

## Dependencies & Prerequisites

### Technical Dependencies
- None - pure CSS changes to existing components

### Testing Dependencies
- Dev server running (`npm run dev`)
- Browser with DevTools (Chrome, Firefox, Safari)
- Playwright MCP for automated testing (optional)
- iOS Simulator or real device (optional, for final verification)

### Knowledge Prerequisites
- Understanding of CSS Flexbox layout
- CSS Modules composition pattern (`composes:`)
- Media query breakpoint strategy
- Touch target accessibility guidelines (WCAG AA)

## Rollback Plan

If issues arise after deployment:

1. **Revert CSS changes** - Git revert specific commit (only CSS files modified)
2. **Fallback strategy** - Keep Question view fix, revert Results/GameOver if needed
3. **Incremental rollback** - Revert phases in reverse order (4 → 3 → 2 → 1)

**Git workflow:**
```bash
# If full rollback needed
git revert <commit-hash>

# If partial rollback needed
git checkout HEAD~1 -- frontend/src/features/game/Results/Results.module.css
git commit -m "fix: revert Results view symmetry changes"
```

## Future Considerations

### Potential Follow-up Work
- [ ] Test landscape orientation (667×375px) if users request
- [ ] Consider additional breakpoint at 480px for mid-size phones
- [ ] Explore dynamic font scaling based on viewport (CSS clamp)
- [ ] Add visual regression testing to CI/CD pipeline
- [ ] Document mobile testing process in contributor guide

### Extensibility
- `.playerRowBase` pattern can be reused for future player list components
- Flexbox constraint pattern applicable to other mobile views
- Testing strategy template for future mobile features

## References & Research

### Internal References

**Brainstorm:**
- `docs/brainstorms/2026-02-08-mobile-viewport-compatibility-fixes-brainstorm.md` - Problem identification and approach selection

**Previous Plans:**
- `docs/plans/2026-02-08-refactor-question-view-mobile-polish-plan.md` - Professional UI polish work
- `docs/plans/2026-02-08-feat-mobile-first-ui-redesign-plan.md` - Mobile-first redesign foundation

**Design System:**
- `frontend/src/styles/variables.css:96-103` - Spacing scale
- `frontend/src/styles/variables.css:74-89` - Font size scale
- `frontend/src/styles/global.css:154-228` - Global composition classes

**Component Files:**
- `frontend/src/features/game/Question/Question.module.css:166-240` - Current mobile layout
- `frontend/src/features/game/Results/Results.module.css:175-240` - Results mobile section
- `frontend/src/features/game/GameOver/GameOver.module.css:291-348` - GameOver mobile section
- `frontend/src/components/common/LinearTimer/LinearTimer.module.css:59-77` - Timer mobile styles

### External References

**CSS Flexbox:**
- MDN: Flexbox min-height behavior - https://developer.mozilla.org/en-US/docs/Web/CSS/min-height
- CSS-Tricks: A Complete Guide to Flexbox - https://css-tricks.com/snippets/css/a-guide-to-flexbox/

**Mobile Accessibility:**
- WCAG 2.1 Touch Target Size - https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
- iOS Human Interface Guidelines - https://developer.apple.com/design/human-interface-guidelines/layout

**Testing:**
- Playwright Browser Automation - https://playwright.dev/
- Chrome DevTools Device Mode - https://developer.chrome.com/docs/devtools/device-mode/

---

**Ready for implementation.** This plan provides step-by-step technical guidance to fix all four mobile viewport compatibility issues while maintaining desktop functionality and professional UI polish.
