---
title: Mobile Viewport Compatibility Fixes
date: 2026-02-08
topic: Fix mobile UI issues across iPhone SE, iPhone 14, and Samsung Galaxy S20
status: in-progress
---

# Mobile Viewport Compatibility Fixes

## What We're Building

Fixing mobile UI compatibility issues across popular device viewports:
- **iPhone SE**: 375x667px (smallest target viewport)
- **iPhone 14**: 393x852px (taller modern iPhone)
- **Samsung Galaxy S20**: 360x800px (popular Android)

## Problems Identified

### 1. Question View - Option D Cutoff
- **Root cause**: Long question text causes option D to be pushed below viewport
- **Current behavior**: `justify-content: center` centers the answer grid, but doesn't account for variable question height
- **Constraint**: Must maintain no-scroll requirement

### 2. Results View - Timer Invisible
- **Root cause**: LinearTimer component completely hidden on mobile viewport
- **Location**: `.timerSection` in Results.tsx (lines 85-92)
- **Impact**: Users don't know when next question starts

### 3. Results View - Asymmetric Player Rows
- **Root cause**: Scoreboard and Player Answers use different CSS classes with inconsistent:
  - Row heights (`.resultsScoreItem` vs `.resultsAnswerItem`)
  - Padding values
  - Font sizes
- **Impact**: Looks unprofessional, breaks visual harmony

### 4. GameOver View - Final Standings Cutoff
- **Root cause**: `.finalScoresSection` likely overflows viewport with confetti + winner card + standings
- **Impact**: Can't see all players' final scores

## Target Viewports

| Device | Dimensions | Priority |
|--------|------------|----------|
| iPhone SE (2020) | 375x667px | **P1** (smallest) |
| Samsung Galaxy S20 | 360x800px | **P1** (narrowest) |
| iPhone 14 | 393x852px | **P2** (taller) |

**Design constraint**: Must work on all three without scrolling (except GameOver if needed).

## Why This Approach

### Chosen Strategy: Dynamic Height Allocation

Instead of fixed heights or centering, use **flexbox min-height constraints** to ensure content fits:

1. **Question View**: Calculate available space for answers based on actual question height
   - Use `flex: 1` on `.optionsGrid` but add `min-height: 0` to prevent overflow
   - Add `max-height` constraint that subtracts header + question + timer heights

2. **Results View**: Visible timer with guaranteed space
   - Make `.timerSection` `flex-shrink: 0` to prevent collapse
   - Reduce unnecessary margins/padding on mobile

3. **Symmetric Results Boxes**: Unify CSS classes
   - Create shared base class for player rows across scoreboard and answers
   - Use CSS composition (`composes:`) to ensure consistency

4. **GameOver View**: Allow controlled overflow with scroll
   - Keep critical content (winner card) above fold
   - Allow `.finalScoresSection` to scroll if needed on iPhone SE

### Why Not Alternatives?

**❌ Reduce font sizes everywhere**: Would hurt readability, undermines polish goal

**❌ Fixed pixel heights**: Won't adapt to variable question/answer text lengths

**❌ Allow scrolling on Question view**: Violates user's "no scroll" requirement

**✅ Dynamic flex-based layout**: Adapts to content while respecting viewport constraints

## Key Decisions

### Decision 1: Question View Layout Strategy
- Use `flex: 1` + `min-height: 0` on `.optionsGrid` to prevent overflow
- Add `overflow-y: auto` as fallback (shouldn't trigger unless extreme edge case)
- Keep `justify-content: flex-start` instead of `center` to prioritize top answers
- Reduce gap from `--spacing-md` (16px) to `--spacing-sm` (8px) on smallest viewports

**Trade-off**: Less vertical breathing room, but ensures all 4 options visible.

### Decision 2: Results View Timer Visibility
- Make `.timerSection` visible with `flex-shrink: 0`
- Reduce `.resultsContainer` gap on mobile to reclaim space
- Shrink `.correctAnswerBanner` padding on mobile

**Trade-off**: Slightly denser Results layout, but timer is critical UX.

### Decision 3: Unify Results Row Styles
- Create shared `.playerRow` base class
- Both `.resultsScoreItem` and `.resultsAnswerItem` compose from it
- Override only layout differences (grid columns), keep padding/height/fonts unified

**Trade-off**: Minor refactor needed, but ensures long-term consistency.

### Decision 4: GameOver Overflow Strategy
- Allow `.finalScoresSection` to overflow with `overflow-y: auto`
- Use `max-height: calc(100vh - [header + winner + timer])` to contain it
- Ensure winner card stays above fold (most important content)

**Trade-off**: GameOver might scroll, but it's acceptable for final standings review.

## Open Questions

- [x] Should we reduce option button heights on smallest viewport (360x667)?
  - **Answer**: Only if needed after flex fixes - try to keep 56px min-height for touch targets

- [ ] Do we need to test landscape orientation (667x375)?
  - **Decision needed**: Low priority (mobile games typically portrait), defer unless user requests

- [ ] Should scoreboard and answers stack vertically on ALL mobile (currently only <600px)?
  - **Answer**: Yes, current behavior is good - 2 columns would be cramped on 360-393px widths

## Technical Details

### Files to Modify

1. **frontend/src/features/game/Question/Question.module.css**
   - Add `min-height: 0` to `.optionsGrid` mobile section
   - Change `justify-content: center` → `flex-start`
   - Conditionally reduce gap on smallest viewports

2. **frontend/src/features/game/Results/Results.module.css**
   - Add shared `.playerRow` base class
   - Make both score and answer items compose from it
   - Ensure `.timerSection` has `flex-shrink: 0` on mobile
   - Reduce gaps/padding to reclaim vertical space

3. **frontend/src/features/game/GameOver/GameOver.module.css**
   - Add `max-height` constraint to `.finalScoresSection`
   - Add `overflow-y: auto` for scrollable standings

4. **frontend/src/styles/global.css** (if shared classes needed)
   - Consider adding `.player-row-base` global class for consistency

### CSS Patterns to Use

**Flex constraint pattern:**
```css
.optionsGrid {
  flex: 1;
  min-height: 0; /* KEY: allows flex item to shrink below content size */
  display: flex;
  flex-direction: column;
  justify-content: flex-start; /* Prioritize top items */
  overflow-y: auto; /* Fallback if content still overflows */
}
```

**Shared row composition:**
```css
.playerRowBase {
  display: grid;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  min-height: 52px; /* Consistent touch target */
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
}

.resultsScoreItem {
  composes: playerRowBase;
  grid-template-columns: 1fr auto;
}

.resultsAnswerItem {
  composes: playerRowBase;
  grid-template-columns: 1fr auto; /* Same structure */
}
```

## Acceptance Criteria

### Question View
- [ ] All 4 answer options visible on 375x667px with longest test question
- [ ] All 4 answer options visible on 360x800px (narrowest)
- [ ] No scrolling required to see option D
- [ ] Touch targets remain ≥ 48px height

### Results View
- [ ] LinearTimer visible and readable on all 3 target viewports
- [ ] Scoreboard rows and Answer rows have identical heights
- [ ] Scoreboard rows and Answer rows have identical padding
- [ ] Font sizes match between the two boxes
- [ ] No horizontal overflow on 360px width

### GameOver View
- [ ] Winner card visible above fold on 375x667px
- [ ] Final standings list accessible (scrollable if needed)
- [ ] All player scores readable on 360x800px

### Cross-Device
- [ ] Test on real iPhone SE or simulator
- [ ] Test on Android emulator (Pixel 5 or Galaxy S20)
- [ ] Verify on iPhone 14 viewport (393x852px)

## Testing Strategy

Use Playwright MCP or agent-browser CLI:

```bash
# iPhone SE
mcp__playwright__browser_resize --width 375 --height 667
mcp__playwright__browser_navigate --url http://localhost:3000
# ... test each view

# Samsung Galaxy S20
mcp__playwright__browser_resize --width 360 --height 800

# iPhone 14
mcp__playwright__browser_resize --width 393 --height 852
```

**Test cases:**
1. Question with 150+ char text + 4 long options
2. Results with 4 players + long answers
3. GameOver with 6+ players

## Success Metrics

**Quantitative:**
- 0 viewport overflows on target devices
- Touch targets ≥ 48px on all interactive elements
- Consistent padding (±2px tolerance) across Results boxes

**Qualitative:**
- Looks polished and professional on smallest viewport (iPhone SE)
- Visual symmetry passes "eyeball test"
- No user confusion about where timer is

## Related Work

- Previous plan: `docs/plans/2026-02-08-refactor-question-view-mobile-polish-plan.md`
- Previous mobile redesign: `docs/plans/2026-02-08-feat-mobile-first-ui-redesign-plan.md`
- Design system: `frontend/src/styles/variables.css`

---

**Next Step**: Create implementation plan via `/workflows:plan`.
