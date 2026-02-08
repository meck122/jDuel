# Mobile-First UI Redesign Brainstorm

**Date:** 2026-02-08
**Status:** Ready for Planning
**Focus:** Multiple Choice Mode (default game mode)

---

## What We're Building

A comprehensive mobile-first UI redesign for jDuel that prioritizes smartphone gameplay while maintaining a polished desktop experience. The redesign addresses key pain points around screen real estate, navigation clarity, and mobile-friendly interactions.

**Core principle:** Everything visible without scrolling on mobile devices.

---

## Why This Approach

### Current Pain Points

1. **Question view requires scrolling on mobile** - Players must scroll to see question + timer + all answer options, creating friction during time-sensitive gameplay
2. **Repetitive timer UI** - Same circular SVG timer appears in Question, Results, and GameOver views, feeling monotonous and taking up excessive space
3. **Unclear navigation purpose** - Navbar appears everywhere but serves limited purpose during active gameplay
4. **Results view hierarchy** - Two-column grid doesn't prioritize the most engaging moment (answer reveal) on mobile
5. **Reactions overlap content** - Fixed positioning at bottom + top-right can block important UI elements on small screens

### Why Mobile-First Matters

- **Primary use case:** Players use smartphones for casual party/social gaming
- **Fun & playful vibe:** jDuel is a lighthearted multiplayer experience, not a serious quiz app
- **Linear game flow:** Home → Lobby → Game → Results → GameOver is a guided path, not a navigation-heavy app
- **Multiple choice default:** Simpler answer mode optimizes for speed and accessibility

---

## Key Decisions

### 1. Navigation Strategy

**Decision:** Remove navbar from active game views (Lobby, Question, Results, GameOver)

- **Keep navbar on:** HomePage, AboutPage only
- **Rationale:** Players shouldn't navigate away mid-game (breaks multiplayer sync). Reclaims ~64px of vertical space on mobile.
- **About page access:** Only from HomePage (makes most sense before joining a game)

### 2. Timer Differentiation

**Decision:** Use different timer styles based on context and urgency

- **Question view:** Circular timer with color-coded urgency (green → amber → red)
  - High urgency = prominent visual treatment
  - Critical moment where timer matters most
- **Results view:** Linear progress bar or simple text countdown
  - Lower urgency (just waiting for next question)
  - More space-efficient on mobile
- **GameOver view:** Simple text countdown (e.g., "Room closing in 8s")
  - Purely informational
  - No urgency, minimal visual weight

### 3. Question View Layout (Critical Mobile Constraint)

**Decision:** Compact header + full-width answer cards, everything above the fold

**Layout structure:**
```
┌─────────────────────────┐
│ Q3 • Category           │ ← Inline, single line
├─────────────────────────┤
│ [Linear timer bar]      │ ← Slim progress bar
├─────────────────────────┤
│ Question text?          │ ← Smaller font, tight spacing
├─────────────────────────┤
│ [A] Option one          │ ← Full-width tap cards
│ [B] Option two          │
│ [C] Option three        │
│ [D] Option four         │
└─────────────────────────┘
```

**Key changes:**
- Question number + category on same line (not stacked)
- Compact linear timer replaces large circular timer
- Smaller question text (reduce font-size, line-height)
- Large, tap-friendly answer buttons (min 56px height)
- No scrolling required on standard mobile screens (375px width, 667px height reference)

### 4. Results View Priority

**Decision:** Answers first, then scoreboard (vertical stack on mobile)

**Layout order:**
1. **Correct answer banner** (top, most important)
2. **Player answers list** ("Who got it right?")
   - Checkmark/X indicators
   - Points gained per player
3. **Scoreboard** (current standings)
4. **Linear timer** ("Next question in 8s")

**Rationale:** The "Did I get it?" moment is most engaging. Show immediate feedback before competitive standings.

### 5. Reactions UI

**Decision:** Move to bottom sheet drawer with toast notifications

**New interaction:**
- **Floating Action Button (FAB):** Bottom-right corner, opens drawer
- **Bottom sheet:** Slides up with all emoji reaction options
- **Toast notifications:** Brief, non-blocking toasts for incoming reactions
  - Appear briefly at top or bottom
  - Auto-dismiss after 2-3 seconds
  - Don't overlap critical content

**Benefits:**
- Cleaner mobile UI (no fixed bottom bar)
- More reaction options possible (not limited to 3 visible buttons)
- Preserves playful vibe without blocking gameplay

### 6. Multiple Choice Mode

**Decision:** Default to ON in lobby settings, allow toggle

- GameSettings sidebar shows "Multiple Choice: ON" by default
- Host can toggle OFF for text input mode if desired
- Balances convenience (most players want MC) with flexibility

---

## Implementation Scope

### Pages to Update

#### **Question View**
- Redesign header layout (inline category + question number)
- Replace circular timer with linear progress bar
- Reduce question text font size and spacing
- Optimize answer button layout for mobile tap targets
- Test "above the fold" constraint on multiple screen sizes

#### **Results View**
- Reorder sections (answer reveal → player answers → scoreboard)
- Replace circular timer with linear bar or text countdown
- Vertical stacking on mobile, maintain desktop two-column option
- Adjust spacing for tighter mobile layout

#### **GameOver View**
- Replace circular timer with simple text countdown
- Keep confetti and winner card (playful vibe)
- Ensure final standings fit without scrolling

#### **Reactions Component**
- Build new BottomSheet component (slide-up drawer)
- Create FAB trigger button
- Implement toast notification system for incoming reactions
- Remove fixed bottom button bar
- Remove fixed top-right feed overlay

#### **Navigation Component**
- Add route-based visibility logic: only show on `/` and `/about`
- Hide on `/game/*` routes (Lobby, Question, Results, GameOver)

### New Components Needed

1. **BottomSheet** - Slide-up drawer for reactions
2. **Toast** - Brief notification component for reactions
3. **LinearTimer** - Horizontal progress bar variant
4. **CompactQuestionHeader** - Inline category + question number

### CSS/Styling Updates

- New mobile breakpoint rules for condensed Question header
- Linear timer variants (results, gameover)
- Bottom sheet animations (slide-up, backdrop)
- Toast notification styles
- Reduced font sizes and spacing for Question view

---

## Design Principles

### Mobile-First Constraints

1. **No scrolling on Question view** (375x667px reference)
2. **Tap targets ≥ 48px** (iOS/Android accessibility guidelines)
3. **Above the fold = immediate usability** (no hidden content)
4. **Progressive enhancement for desktop** (use extra space for layout, not more features)

### Visual Hierarchy

1. **High urgency → bold, prominent** (Question timer)
2. **Medium urgency → moderate** (Results timer)
3. **Low urgency → subtle** (GameOver timer)
4. **Immediate feedback first** (Answer reveal before scores)

### Playful Vibe Preservation

- Keep confetti, bouncy animations, playful copy
- Reactions still silly and fun (just better positioned)
- Maintain purple/teal/gold gradient branding
- Fun doesn't mean cluttered—clean mobile UI can still be playful

---

## Open Questions

### Technical Decisions

1. **BottomSheet implementation:** Build custom or use Material-UI Drawer?
   - Custom = full control, lighter weight
   - MUI Drawer = faster, accessible, consistent with AppBar
   - **Recommendation:** MUI Drawer (already using MUI throughout)

2. **Toast library:** Build custom or use a library (e.g., react-hot-toast)?
   - Custom = minimal bundle size, exact control
   - Library = faster, battle-tested, accessible
   - **Recommendation:** react-hot-toast (lightweight, 4KB gzipped)

3. **Timer transition strategy:** Gradual rollout or all at once?
   - Option A: Ship Question timer first, then Results/GameOver
   - Option B: Update all timer variants in single PR
   - **Recommendation:** Single PR (maintains consistency, easier QA)

### UX Details

1. **Reaction FAB placement:** Bottom-right or bottom-center?
   - Bottom-right = standard FAB position (Material Design)
   - Bottom-center = more prominent, symmetrical
   - **Recommendation:** Bottom-center for mobile, bottom-right for desktop

2. **Question font size reduction:** How small is too small?
   - Need to test readability on real devices
   - Consider dynamic sizing based on question length
   - **Testing needed:** Verify with users 35+ age range

3. **Results answer list:** Show all players or just top performers?
   - Current: Show all players (can be long with 8+ players)
   - Alternative: Show only players who answered (hide those who didn't)
   - **Recommendation:** Show all (transparency, no confusion)

---

## Success Criteria

### Functional Requirements

- [ ] Question view fits above fold on iPhone SE (375x667px) and similar devices
- [ ] All interactive elements meet 48px minimum tap target size
- [ ] Navbar hidden during active game sessions
- [ ] Timer visuals differentiated (circular vs. linear vs. text)
- [ ] Reactions accessible via bottom sheet, don't block content
- [ ] Multiple choice mode defaults to ON in new games

### Quality Metrics

- [ ] Mobile lighthouse accessibility score ≥ 95
- [ ] No horizontal scrolling on any view (mobile)
- [ ] Touch interactions feel native (no lag, clear feedback)
- [ ] Desktop experience still polished (not compromised)
- [ ] Maintains current playful aesthetic

### User Experience

- [ ] Players can answer questions without scrolling (mobile)
- [ ] Reaction feature remains fun without blocking UI
- [ ] Timer urgency is intuitively communicated
- [ ] Navigation feels natural (no confusion about missing navbar)
- [ ] Results view prioritizes engagement (answer reveal first)

---

## Next Steps

1. **Run `/workflows:plan`** to create detailed implementation plan
   - Component-by-component breakdown
   - File paths and specific changes
   - Testing strategy for mobile breakpoints
   - Migration plan for timer variants

2. **Prototype Question view** in isolation
   - Most critical component
   - Validate "above the fold" constraint
   - Test on real devices (not just DevTools)

3. **User testing considerations**
   - Test with actual phones (iOS + Android)
   - Verify readability with different age groups
   - Observe reaction feature usability (is bottom sheet intuitive?)

---

## Related Documentation

- `docs/EventProtocol.md` - WebSocket messages (unchanged by UI redesign)
- `frontend-design` skill - UI patterns and CSS variables
- `game-flow` skill - Complete game progression (useful for testing)
- `CLAUDE.md` - Project commands and architecture

---

**Ready for planning phase.** Run `/workflows:plan` to proceed with implementation.
