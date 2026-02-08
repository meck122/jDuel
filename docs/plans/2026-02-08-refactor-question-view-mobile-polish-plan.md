---
title: Polish Question View Mobile UI - Professional Spacing & Visual Hierarchy
type: refactor
date: 2026-02-08
---

# Polish Question View Mobile UI - Professional Spacing & Visual Hierarchy

## Overview

The Question view currently functions (no scrolling, all content visible), but the spacing and visual hierarchy need professional UI design polish. The question box is disproportionately wide compared to answer buttons, and there's excessive empty space at the bottom creating an unbalanced, "tacky" appearance.

**Goal:** Transform the Question view into a polished, professional mobile interface with proper visual hierarchy, balanced proportions, and efficient use of vertical space—while maintaining the no-scroll constraint.

---

## Problem Statement

### Current Issues (Identified from Screenshots)

1. **Question box too wide** - Full-width question text creates awkward horizontal layout, making the text block appear disproportionate to the answer cards below
2. **Answer cards too narrow** - Button text gets cramped despite having wasted space to the left/right
3. **Huge empty gap at bottom** - All content pushed to top 60% of screen, leaving 40% blank space below option D
4. **Unbalanced vertical distribution** - Content doesn't fill the viewport gracefully, creating a "squeezed at top, empty at bottom" effect
5. **Visual hierarchy unclear** - Question text, timer, and answers all compete for attention with similar visual weight

### Design Principles for Professional Mobile UI

**From UX best practices:**
- **Balanced proportions** - Content should feel centered and distributed, not pushed to extremes
- **Intentional whitespace** - Spacing should enhance readability, not create awkward gaps
- **Clear visual hierarchy** - User's eye should flow: Timer → Question → Answers
- **Comfortable density** - Tight enough to fit, spacious enough to breathe
- **Tap-friendly targets** - 48-56px minimum height, generous padding for thumbs

---

## Proposed Solution

### Visual Hierarchy Strategy

**Priority order (where user's eye should land):**

1. **Timer** (top) - Most urgent element, compact but visible
2. **Question text** (middle) - Core content, needs comfortable reading space
3. **Answer options** (bottom half) - Large, thumb-friendly tap targets

**Spacing strategy:**
- Distribute content across full viewport height using flexbox `justify-content: space-between`
- Remove fixed margins, use flex spacing to eliminate dead space at bottom
- Balance question width vs. answer width for visual harmony

### Technical Approach

**CSS Changes (Mobile 600px breakpoint):**

1. **Use flexbox space distribution** instead of margin-based spacing
   ```css
   .gameSection {
     display: flex;
     flex-direction: column;
     justify-content: space-between;  /* Eliminate bottom gap */
   }
   ```

2. **Constrain question box width** to create visual balance
   ```css
   .questionBox {
     max-width: 340px;  /* ~90% of 375px viewport */
     margin: 0 auto;     /* Center it */
   }
   ```

3. **Increase answer button padding** to use vertical space efficiently
   ```css
   .optionButton {
     min-height: 56px;      /* Up from 48px */
     padding: var(--spacing-md) var(--spacing-lg);  /* More generous */
   }
   ```

4. **Optimize gap sizes** to distribute content evenly
   ```css
   .optionsGrid {
     gap: var(--spacing-md);  /* Up from --spacing-xs for breathing room */
     flex: 1;                 /* Take available space */
     display: flex;           /* Flexbox for vertical distribution */
     flex-direction: column;
     justify-content: center; /* Center answers in remaining space */
   }
   ```

5. **Add subtle visual separation** with borders/shadows where appropriate
   ```css
   .questionBox {
     margin-bottom: var(--spacing-lg);  /* Clear separation from answers */
   }
   ```

---

## Technical Details

### Files to Modify

#### `frontend/src/features/game/Question/Question.module.css`

**Current mobile section:**
```css
@media (max-width: 600px) {
  .gameSection {
    position: fixed;
    inset: 0;
    margin: 0;
    padding: var(--spacing-sm);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 1;
    background: var(--color-bg-primary);
  }

  .questionBox {
    margin: var(--spacing-xs) 0;
    flex-shrink: 0;
  }

  .question {
    font-size: var(--font-size-base);
    padding: var(--spacing-sm) var(--spacing-md);
    /* ... */
  }

  .optionsGrid {
    grid-template-columns: 1fr;
    gap: var(--spacing-xs);  /* TOO TIGHT */
    flex: 1;
    align-content: start;    /* PUSHES TO TOP */
  }

  .optionButton {
    padding: var(--spacing-xs) var(--spacing-md);  /* TOO CRAMPED */
    min-height: 48px;
  }
}
```

**Proposed changes:**
```css
@media (max-width: 600px) {
  .gameSection {
    position: fixed;
    inset: 0;
    margin: 0;
    padding: var(--spacing-md);  /* Increase from --spacing-sm for breathing room */
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;  /* NEW: Distribute vertically */
    z-index: 1;
    background: var(--color-bg-primary);
  }

  .questionBox {
    margin: var(--spacing-sm) 0 var(--spacing-md) 0;  /* Balanced spacing */
    flex-shrink: 0;
    max-width: 340px;  /* NEW: Constrain width for visual balance */
    margin-left: auto;
    margin-right: auto;
  }

  .question {
    font-size: var(--font-size-base);
    padding: var(--spacing-md);  /* Increase from --spacing-sm */
    line-height: 1.4;  /* Up from 1.3 for readability */
    text-align: left;
    border-width: 1px;
    border-top-width: 2px;
    box-shadow: none;
  }

  .optionsGrid {
    display: flex;  /* Change from grid to flex */
    flex-direction: column;
    gap: var(--spacing-md);  /* Increase from --spacing-xs */
    flex: 1;  /* Take available vertical space */
    justify-content: center;  /* NEW: Center answers in remaining space */
    align-items: stretch;  /* Full-width buttons */
  }

  .optionButton {
    padding: var(--spacing-md) var(--spacing-lg);  /* More generous */
    min-height: 56px;  /* Increase from 48px */
  }

  .optionLetter {
    font-size: var(--font-size-xl);  /* Up from --font-size-lg */
    min-width: 28px;  /* Up from 22px */
  }

  .optionText {
    font-size: var(--font-size-base);  /* Up from --font-size-sm */
    line-height: 1.4;
  }
}
```

#### `frontend/src/features/game/Question/QuestionHeader.module.css`

**Add margin-bottom to create clear separation:**
```css
@media (max-width: 600px) {
  .header {
    font-size: var(--font-size-xs);
    margin-bottom: var(--spacing-sm);  /* Add separation below header */
    flex-shrink: 0;
  }
}
```

#### `frontend/src/components/common/Timer/Timer.module.css`

**Ensure timer has bottom margin for spacing:**
```css
@media (max-width: 600px) {
  .timerWrapper {
    width: 48px;
    height: 48px;
    margin: var(--spacing-sm) auto;  /* Add top/bottom margin */
    flex-shrink: 0;
  }

  .timerWrapper .timerText {
    font-size: 1.1rem;
  }
}
```

---

## Design Rationale

### Why These Changes Create Professional UI

1. **`justify-content: space-between` on `.gameSection`**
   - Eliminates awkward empty space at bottom
   - Distributes content naturally across full viewport
   - Creates balanced, intentional composition

2. **`max-width: 340px` on `.questionBox`**
   - Prevents question text from spanning entire width (looks awkward on narrow screens)
   - Creates visual balance with answer buttons below
   - Centered positioning maintains symmetry

3. **`justify-content: center` on `.optionsGrid`**
   - Centers answer buttons in remaining vertical space
   - Creates balanced "sandwich" layout: header → question → [centered answers]
   - No longer pushed to top with giant gap below

4. **Increased padding/gaps**
   - `gap: var(--spacing-md)` (16px) instead of `var(--spacing-xs)` (4px)
   - Gives content room to breathe
   - Matches professional mobile app standards
   - Still fits comfortably without scrolling

5. **Larger button text and tap targets**
   - `min-height: 56px` instead of 48px
   - `font-size: var(--font-size-base)` instead of `--font-size-sm`
   - More comfortable to read and tap
   - Better use of available vertical space

---

## Acceptance Criteria

### Visual Quality

- [x] Question box width proportionate to answer buttons (not disproportionately wide)
- [x] No large empty gaps at bottom of screen
- [x] Content distributed evenly across viewport height
- [x] Clear visual hierarchy: Timer → Question → Answers
- [x] Spacing feels intentional, not arbitrary

### Functional Requirements

- [x] No scrolling required on 375x667px viewport (maintained)
- [x] All interactive elements ≥ 48px tap target size (56px achieved)
- [x] Content remains readable and accessible
- [x] Layout responsive to different question lengths
- [x] Works on iPhone SE, standard Android phones

### Professional Polish

- [x] UI feels balanced and composed, not cramped or sparse
- [x] Spacing follows consistent rhythm from design system
- [x] Typography hierarchy clear (size, weight, spacing)
- [x] Layout feels intentional, not haphazard
- [x] Passes "eyeball test" from professional designers

---

## Testing Strategy

### Visual Regression Testing

1. **Use Playwright MCP** to capture screenshots at 375x667px
2. **Test with varying question lengths:**
   - Short (20-30 chars): "What is 2+2?"
   - Medium (100-120 chars): Current Einstein question length
   - Long (150-180 chars): Wrap to 3-4 lines
3. **Verify:**
   - No scrollbar appears
   - Content feels balanced at all lengths
   - No awkward gaps or cramped sections

### Real Device Testing

1. **iPhone SE (2020)** - 375x667px reference device
2. **iPhone 13 Mini** - 375x812px (tall viewport)
3. **Standard Android** (e.g., Pixel 5) - 393x851px
4. **Verify:**
   - Touch targets feel comfortable
   - Text is readable without zooming
   - Layout adapts gracefully

### Edge Cases

- [ ] Very short question (1 line) - does layout still look balanced?
- [ ] Very long question (4 lines) - does it still fit without scrolling?
- [ ] Answer text varies (short vs. long options) - buttons remain consistent?

---

## Implementation Phases

### Phase 1: Core Layout Changes (Priority 1)

**Files:** `Question.module.css`

- [x] Add `justify-content: space-between` to `.gameSection` mobile
- [x] Add `max-width: 340px` and centering to `.questionBox` mobile
- [x] Change `.optionsGrid` from grid to flex column with `justify-content: center`
- [x] Increase gaps from `--spacing-xs` to `--spacing-md`

**Testing:** Screenshot comparison, verify no scrollbar, check bottom gap eliminated

### Phase 2: Spacing & Polish (Priority 2)

**Files:** `Question.module.css`, `QuestionHeader.module.css`, `Timer.module.css`

- [x] Increase button padding and min-height
- [x] Increase font sizes for option letter and text
- [x] Add consistent margins to header and timer
- [x] Increase gameSection padding from `--spacing-sm` to `--spacing-md`

**Testing:** Real device testing, verify touch targets comfortable, typography readable

### Phase 3: Visual Refinement (Priority 3)

**Files:** `Question.module.css`

- [x] Fine-tune line-height for question text (1.4 instead of 1.3)
- [x] Adjust question padding for readability
- [x] Verify hover states still work well with new sizing

**Testing:** Designer review, user feedback, edge case testing

---

## Rollback Plan

If changes cause scrolling or usability issues:

1. **Revert CSS changes** - Git revert specific commit
2. **Fallback:** Keep `justify-content: space-between` but revert button sizing
3. **Test:** Identify which specific change broke layout, adjust incrementally

---

## Success Metrics

### Quantitative

- **Lighthouse Accessibility:** Maintain ≥ 95 score
- **Touch target size:** All buttons ≥ 48px (ideally 56px)
- **Viewport coverage:** Content uses 85-95% of vertical space (not 60% or 100%)
- **Typography scale:** Consistent use of --spacing and --font-size tokens

### Qualitative

- **Designer approval:** Pass visual review from UX designer perspective
- **User feedback:** "Looks professional/polished" (not "cramped" or "empty")
- **Brand consistency:** Maintains jDuel playful aesthetic while looking polished
- **Competitive benchmark:** Comparable to commercial trivia app UIs (e.g., Kahoot, Quizizz mobile)

---

## References

### Internal Files

- Current implementation: `frontend/src/features/game/Question/Question.module.css:166-232`
- Design system: `frontend/src/styles/variables.css:1-80`
- Timer component: `frontend/src/components/common/Timer/Timer.module.css:93-104`
- Question header: `frontend/src/features/game/Question/QuestionHeader.module.css:24-28`

### Design System Values

- **Spacing scale:** `--spacing-xs` (4px), `--spacing-sm` (8px), `--spacing-md` (16px), `--spacing-lg` (24px)
- **Font sizes:** `--font-size-xs` (12px), `--font-size-sm` (14px), `--font-size-base` (16px), `--font-size-lg` (20px)
- **Mobile breakpoint:** `max-width: 600px`
- **Touch targets:** 48-56px minimum (iOS/Android guidelines)

### External References

- Material Design Touch Targets: https://material.io/design/usability/accessibility.html#layout-and-typography
- iOS Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/layout
- Mobile UX Best Practices: https://www.nngroup.com/articles/mobile-ux/

---

## Related Work

- Original mobile-first redesign: `docs/plans/2026-02-08-feat-mobile-first-ui-redesign-plan.md`
- Brainstorm document: `docs/brainstorms/2026-02-08-mobile-first-ui-redesign-brainstorm.md`
- Frontend design skill: `.claude/skills/frontend-design/` (if available)

---

**Ready for implementation.** This plan focuses on professional UI polish through balanced proportions, intentional spacing, and clear visual hierarchy—without sacrificing the no-scroll constraint.
