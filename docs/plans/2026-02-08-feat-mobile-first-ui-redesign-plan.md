---
title: Mobile-First UI Redesign
type: feat
date: 2026-02-08
---

# Mobile-First UI Redesign

## Overview

Comprehensive mobile-first UI redesign for jDuel prioritizing smartphone gameplay while maintaining a polished desktop experience. This redesign addresses key pain points around screen real estate, navigation clarity, and mobile-friendly interactions.

**Core principle:** Everything visible without scrolling on mobile devices (375x667px reference).

**Status:** Based on brainstorm document from 2026-02-08. All key design decisions finalized.

---

## Problem Statement

### Current Pain Points

1. **Question view requires scrolling on mobile** - Players must scroll to see question + timer + all answer options, creating friction during time-sensitive gameplay
2. **Repetitive timer UI** - Same circular SVG timer appears in Question, Results, and GameOver views, feeling monotonous and taking up excessive space (circular timer occupies 90-110px height)
3. **Unclear navigation purpose** - Navbar appears everywhere but serves limited purpose during active gameplay (wastes 64px vertical space)
4. **Results view hierarchy** - Two-column grid doesn't prioritize the most engaging moment (answer reveal) on mobile
5. **Reactions overlap content** - Fixed positioning at bottom (48px) + top-right (120px height) can block important UI elements on small screens

### User Impact

- **Primary use case:** Smartphone gameplay for casual party/social gaming
- **Critical constraint:** No scrolling during Question view (time pressure makes scrolling unacceptable)
- **Multiplayer sync:** Players shouldn't navigate away mid-game (navbar encourages accidental exits)

---

## Proposed Solution

Mobile-first redesign targeting 375x667px viewport (iPhone SE reference) with progressive enhancement for desktop. Focus on multiple choice mode (default game mode).

### Key Changes

1. **Navigation:** Remove navbar from active game views (Lobby, Question, Results, GameOver)
2. **Timer Differentiation:** Circular for questions, linear for results, text for gameover
3. **Question View:** Compact header + everything above the fold
4. **Results Layout:** Answers first, then scoreboard (prioritize engagement)
5. **Reactions:** FAB + bottom sheet drawer with toast notifications
6. **Multiple Choice:** Default to ON with toggle option

---

## Technical Approach

### Architecture

**Component Structure:**
```
frontend/src/
├── components/
│   ├── common/
│   │   ├── Timer/
│   │   │   ├── Timer.tsx (update variants)
│   │   │   ├── LinearTimer.tsx (NEW)
│   │   │   └── Timer.module.css (update styles)
│   │   └── Toast/
│   │       ├── Toast.tsx (NEW)
│   │       └── Toast.module.css (NEW)
│   └── ui/
│       └── Navigation/
│           └── Navigation.tsx (add conditional visibility)
├── features/game/
│   ├── Question/
│   │   ├── Question.tsx (redesign header)
│   │   ├── QuestionHeader.tsx (NEW compact component)
│   │   └── Question.module.css (mobile-first styles)
│   ├── Results/
│   │   ├── Results.tsx (reorder sections)
│   │   └── Results.module.css (vertical stack)
│   ├── GameOver/
│   │   ├── GameOver.tsx (text countdown)
│   │   └── GameOver.module.css (update)
│   └── Reactions/
│       ├── Reactions.tsx (FAB + bottom sheet)
│       ├── ReactionBottomSheet.tsx (NEW)
│       └── Reactions.module.css (update)
└── contexts/
    └── GameContext.tsx (update default config)
```

### Implementation Phases

#### Phase 1: Foundation & Navigation

**Goal:** Set up conditional navigation visibility and install toast library

**Tasks:**

1. **Install react-hot-toast**
   ```bash
   cd frontend
   npm install react-hot-toast
   ```
   - Lightweight (4KB gzipped)
   - Accessible
   - Customizable styling
   - File: `frontend/package.json`

2. **Add conditional Navigation visibility**
   - Update `Navigation.tsx` to check current route
   - Hide on `/game/*` routes (Lobby, Question, Results, GameOver)
   - Show only on `/` and `/about`
   - Implementation:
     ```tsx
     const location = useLocation();
     const isGamePage = location.pathname.startsWith('/game/');

     if (isGamePage) return null;

     return <AppBar>...</AppBar>;
     ```
   - File: `frontend/src/components/ui/Navigation/Navigation.tsx:7-12`
   - **Success criteria:** Navbar disappears on GamePage, visible on HomePage/AboutPage

3. **Update PageContainer min-height calculation**
   - Change from `calc(100vh - var(--navbar-height))` to `100vh` for game pages
   - Conditional logic based on whether navbar is visible
   - File: `frontend/src/components/layout/PageContainer/PageContainer.module.css:4-8`

**Estimated effort:** 1-2 hours

---

#### Phase 2: Timer Variants

**Goal:** Create LinearTimer component and update Timer usage across views

**Tasks:**

1. **Create LinearTimer component**
   - New component: `frontend/src/components/common/LinearTimer/LinearTimer.tsx`
   - Props interface:
     ```tsx
     interface LinearTimerProps {
       timeRemainingMs: number;
       resetKey: number | string;
       variant?: 'results' | 'subtle';
       label?: string; // e.g., "Next question in"
     }
     ```
   - Implementation:
     - Horizontal progress bar using CSS linear-gradient background
     - Local interpolation (100ms ticks) like current Timer
     - Auto-reset on `resetKey` change
     - Two variants:
       - `results`: Teal gradient progress bar (16px height)
       - `subtle`: Minimal text-only countdown
   - Styling: CSS Modules with mobile-first approach
   - File: `frontend/src/components/common/LinearTimer/LinearTimer.tsx` (NEW)
   - File: `frontend/src/components/common/LinearTimer/LinearTimer.module.css` (NEW)

2. **Update Results view to use LinearTimer**
   - Replace circular Timer with LinearTimer variant="results"
   - Position at bottom of results section (below scoreboard)
   - Label: "Next question in"
   - File: `frontend/src/features/game/Results/Results.tsx:35-38`
   - File: `frontend/src/features/game/Results/Results.module.css:30-45`

3. **Update GameOver view to use text countdown**
   - Replace circular Timer with LinearTimer variant="subtle"
   - Simple text display: "Room closing in 8s"
   - Position below final standings
   - File: `frontend/src/features/game/GameOver/GameOver.tsx:54-58`
   - File: `frontend/src/features/game/GameOver/GameOver.module.css:120-135`

4. **Keep circular Timer in Question view**
   - No changes to Question timer (high urgency = circular is appropriate)
   - File: `frontend/src/features/game/Question/Question.tsx:58` (no change)

**Success criteria:**
- [ ] LinearTimer smoothly counts down like circular Timer
- [ ] Results view uses horizontal progress bar
- [ ] GameOver shows minimal text countdown
- [ ] Question view retains circular timer
- [ ] All timers reset correctly on phase changes

**Estimated effort:** 3-4 hours

---

#### Phase 3: Question View Redesign (Critical)

**Goal:** Compact header, everything above the fold on mobile (375x667px)

**Tasks:**

1. **Create QuestionHeader component**
   - Inline layout: `Q{number} • {category}` on single line
   - Component: `frontend/src/features/game/Question/QuestionHeader.tsx` (NEW)
   - Props:
     ```tsx
     interface QuestionHeaderProps {
       questionIndex: number;
       totalQuestions: number;
       category: string;
     }
     ```
   - Styling:
     ```css
     .header {
       display: flex;
       align-items: center;
       gap: var(--spacing-xs);
       font-size: var(--font-size-sm);
       color: var(--color-text-secondary);
       margin-bottom: var(--spacing-xs);
     }

     .questionNumber {
       font-family: var(--font-family-mono);
       color: var(--color-accent-teal);
     }

     .separator {
       color: var(--color-text-tertiary);
     }

     .category {
       color: var(--color-text-secondary);
     }
     ```
   - Height: ~24px (down from ~60px stacked layout)
   - File: `frontend/src/features/game/Question/QuestionHeader.tsx` (NEW)
   - File: `frontend/src/features/game/Question/QuestionHeader.module.css` (NEW)

2. **Redesign Question layout**
   - Update `Question.tsx` to use QuestionHeader
   - Move LinearTimer below header (slim horizontal bar, 16px height)
   - Reduce question text font size:
     - Desktop: `var(--font-size-2xl)` (down from `--font-size-3xl`)
     - Mobile: `var(--font-size-xl)` (down from `--font-size-2xl`)
   - Reduce line-height: `1.3` (down from `1.5`)
   - Reduce spacing between elements:
     - Header → Timer: `var(--spacing-xs)` (4px)
     - Timer → Question: `var(--spacing-sm)` (8px)
     - Question → Options: `var(--spacing-md)` (16px)
   - File: `frontend/src/features/game/Question/Question.tsx:20-60`
   - File: `frontend/src/features/game/Question/Question.module.css:1-225`

3. **Optimize answer button layout**
   - Full-width buttons on mobile (already implemented, verify)
   - Minimum tap target: 56px height (increase from current 48px)
   - Font size: `var(--font-size-md)` on mobile (verify readability)
   - Grid gap: `var(--spacing-sm)` (8px) on mobile
   - File: `frontend/src/features/game/Question/Question.module.css:84-225`

4. **Mobile viewport testing**
   - Test on Chrome DevTools with 375x667px viewport (iPhone SE)
   - Verify no scrolling required to see all 4 answer options
   - Check question length edge cases:
     - Short question (20 chars): should have extra space
     - Medium question (80 chars): target case
     - Long question (150 chars): might require smaller font or scrolling (acceptable edge case)
   - Test on real devices if possible (iOS Safari, Android Chrome)

**Layout Budget (375px width, 667px height):**
```
QuestionHeader:        24px
LinearTimer:           16px
Spacing (xs):           4px
Question text:      60-80px (2-3 lines at font-size-xl)
Spacing (sm):           8px
Spacing (md):          16px
Answer A:              56px
Gap:                    8px
Answer B:              56px
Gap:                    8px
Answer C:              56px
Gap:                    8px
Answer D:              56px
Bottom padding:        16px
─────────────────────────────
Total:           404-424px
Available:           667px
Margin:          243-263px ✓ (plenty of room)
```

**Success criteria:**
- [ ] Question header fits on single line (Q3 • Category)
- [ ] Linear timer bar is slim and unobtrusive
- [ ] Question text is readable (test with 35+ age users)
- [ ] All 4 answer buttons visible without scrolling (375x667px)
- [ ] Tap targets ≥ 56px height
- [ ] Desktop layout not compromised

**Estimated effort:** 4-6 hours (includes mobile testing iteration)

---

#### Phase 4: Results View Reordering

**Goal:** Prioritize answer reveal, vertical stack on mobile

**Tasks:**

1. **Reorder Results sections**
   - Current order: Scoreboard (left) + Player Answers (right)
   - New order: Correct Answer → Player Answers → Scoreboard → Timer
   - Update JSX structure in `Results.tsx`
   - File: `frontend/src/features/game/Results/Results.tsx:15-70`

2. **Correct Answer Banner** (already exists, verify positioning)
   - Keep at top (already implemented)
   - Success gradient background
   - File: `frontend/src/features/game/Results/Results.module.css:8-28`

3. **Player Answers List**
   - Move above scoreboard
   - Current styling is good (checkmark/X, points gained, color-coded borders)
   - Verify mobile spacing
   - File: `frontend/src/features/game/Results/Results.module.css:65-110`

4. **Scoreboard**
   - Position after player answers
   - Keep current styling (ranked list with scores)
   - File: `frontend/src/features/game/Results/Results.module.css:112-156`

5. **Linear Timer**
   - Position at bottom (after scoreboard)
   - Label: "Next question in"
   - File: `frontend/src/features/game/Results/Results.tsx:35-38` (updated in Phase 2)

6. **Mobile layout**
   - Vertical stack on ≤600px viewport
   - Remove two-column grid on mobile
   - Update media query:
     ```css
     @media (max-width: 600px) {
       .resultsContainer {
         flex-direction: column;
         gap: var(--spacing-md);
       }
     }
     ```
   - File: `frontend/src/features/game/Results/Results.module.css:175-234`

**Success criteria:**
- [ ] Correct answer visible first (immediate feedback)
- [ ] Player answers shown before competitive scoreboard
- [ ] Vertical stack on mobile (no side-by-side)
- [ ] Timer at bottom (least important)
- [ ] Desktop maintains optional two-column layout

**Estimated effort:** 2-3 hours

---

#### Phase 5: Reactions Redesign

**Goal:** FAB + bottom sheet drawer with toast notifications

**Tasks:**

1. **Create Toast component**
   - Wrapper around react-hot-toast with custom styling
   - Component: `frontend/src/components/common/Toast/Toast.tsx` (NEW)
   - Props:
     ```tsx
     interface ToastProps {
       playerId: string;
       reactionLabel: string;
     }
     ```
   - Implementation:
     - Use `toast.custom()` from react-hot-toast
     - Display format: `{playerId}: {reactionLabel}`
     - Position: `top-center` on mobile, `bottom-right` on desktop
     - Auto-dismiss: 2.5 seconds
     - Custom styling with purple/teal accent
   - File: `frontend/src/components/common/Toast/Toast.tsx` (NEW)
   - File: `frontend/src/components/common/Toast/Toast.module.css` (NEW)

2. **Create ReactionBottomSheet component**
   - Use Material-UI Drawer with `anchor="bottom"`
   - Component: `frontend/src/features/game/Reactions/ReactionBottomSheet.tsx` (NEW)
   - Props:
     ```tsx
     interface ReactionBottomSheetProps {
       open: boolean;
       onClose: () => void;
       reactions: Array<{ id: number; label: string }>;
       onReactionClick: (reactionId: number) => void;
       cooldownActive: boolean;
     }
     ```
   - Layout:
     - Grid of reaction buttons (3 columns on mobile, 5 on desktop)
     - Each button: emoji + label
     - Disabled state during cooldown (opacity 0.5)
   - Styling:
     - Dark backdrop (`rgba(0, 0, 0, 0.7)`)
     - Purple gradient header
     - Slide-up animation (Material-UI default)
   - File: `frontend/src/features/game/Reactions/ReactionBottomSheet.tsx` (NEW)
   - File: `frontend/src/features/game/Reactions/ReactionBottomSheet.module.css` (NEW)

3. **Update Reactions component**
   - Remove fixed bottom button bar
   - Remove fixed top-right feed overlay
   - Add FAB (Floating Action Button):
     - Material-UI Fab component
     - Icon: EmojiEmotionsIcon (or similar)
     - Position: `bottom-center` on mobile, `bottom-right` on desktop
     - Color: Teal gradient (`var(--gradient-teal)`)
     - Z-index: 1000 (below navbar 1100)
   - Add BottomSheet integration:
     - State: `const [sheetOpen, setSheetOpen] = useState(false)`
     - Open on FAB click
     - Close on backdrop click or reaction select
   - Update reaction handling:
     - Send reaction via `sendReaction(reactionId)` (existing)
     - Show toast notification for incoming reactions
     - Use `reactionEmitter.on('reaction', ...)` (existing pattern)
   - File: `frontend/src/features/game/Reactions/Reactions.tsx:1-100`
   - File: `frontend/src/features/game/Reactions/Reactions.module.css:1-130`

4. **Install Material-UI icons**
   - Check if `@mui/icons-material` is already installed
   - If not: `npm install @mui/icons-material`
   - Import `EmojiEmotionsIcon` or `MoodIcon`
   - File: `frontend/package.json`

5. **Toaster Provider setup**
   - Add `<Toaster />` component to App.tsx layout
   - Configure global toast options:
     ```tsx
     <Toaster
       position="top-center"
       toastOptions={{
         duration: 2500,
         style: {
           background: 'var(--color-bg-secondary)',
           color: 'var(--color-text-primary)',
           border: '1px solid var(--color-accent-purple)',
         },
       }}
     />
     ```
   - File: `frontend/src/App.tsx:15-25`

**Success criteria:**
- [ ] FAB visible on Results and GameOver views
- [ ] FAB opens bottom sheet with all reaction options
- [ ] Bottom sheet slides up smoothly (Material-UI animation)
- [ ] Reactions show as brief toast notifications (2.5s)
- [ ] Toasts don't overlap important content
- [ ] Cooldown enforced (3s client-side mirroring)
- [ ] Desktop FAB positioned bottom-right
- [ ] Mobile FAB positioned bottom-center

**Estimated effort:** 5-6 hours

---

#### Phase 6: Multiple Choice Default & Config

**Goal:** Default multiple choice mode to ON

**Tasks:**

1. **Update GameContext default config**
   - Set `multipleChoiceEnabled: true` as default
   - File: `frontend/src/contexts/GameContext.tsx:45-55`
   - Current default: `false`
   - New default: `true`
   - Change:
     ```tsx
     const defaultConfig: RoomConfig = {
       difficulty: 'medium',
       multipleChoiceEnabled: true, // ← was false
     };
     ```

2. **Update backend default config**
   - Verify backend default matches frontend
   - File: `backend/src/app/services/core/room_manager.py:35-45` (approximate)
   - Change Python Pydantic model default:
     ```python
     class RoomConfig(BaseModel):
         difficulty: str = "medium"
         multiple_choice_enabled: bool = True  # ← was False
     ```
   - Note: May need to update `backend/src/app/models/room.py` or equivalent

3. **Verify GameSettings component**
   - Ensure toggle reflects new default (ON)
   - No code changes needed (reads from `roomState.config`)
   - File: `frontend/src/features/game/GameSettings/GameSettings.tsx:15-25`

**Success criteria:**
- [ ] New games default to multiple choice mode ON
- [ ] Toggle still works (host can disable if desired)
- [ ] Frontend and backend defaults match

**Estimated effort:** 1 hour

---

## Acceptance Criteria

### Functional Requirements

- [ ] Question view fits above fold on iPhone SE (375x667px) without scrolling
- [ ] All interactive elements meet 56px minimum tap target size
- [ ] Navbar hidden during active game sessions (Lobby, Question, Results, GameOver)
- [ ] Navbar visible on HomePage and AboutPage
- [ ] Timer visuals differentiated:
  - [ ] Circular timer in Question view
  - [ ] Linear progress bar in Results view
  - [ ] Text countdown in GameOver view
- [ ] Reactions accessible via FAB + bottom sheet drawer
- [ ] Reaction toasts appear briefly without blocking content
- [ ] Multiple choice mode defaults to ON in new games
- [ ] Results view shows correct answer first, then player answers, then scoreboard

### Quality Metrics

- [ ] No horizontal scrolling on any view (mobile)
- [ ] Touch interactions feel native (no lag, clear feedback)
- [ ] Desktop experience still polished (not compromised)
- [ ] Maintains current playful aesthetic (confetti, gradients, animations)
- [ ] All CSS uses variables (no hardcoded colors/spacing)
- [ ] Mobile lighthouse accessibility score ≥ 95
- [ ] All text readable (verify with 35+ age users if possible)

### User Experience

- [ ] Players can answer questions without scrolling (mobile)
- [ ] Reaction feature remains fun without blocking UI
- [ ] Timer urgency is intuitively communicated (circular=urgent, linear=moderate, text=subtle)
- [ ] Navigation feels natural (no confusion about missing navbar during game)
- [ ] Results view prioritizes engagement (answer reveal first)
- [ ] Bottom sheet drawer is intuitive (users understand FAB interaction)

---

## Testing Strategy

### Manual Testing Checklist

**Question View:**
1. Open game on Chrome DevTools (375x667px viewport)
2. Start game, navigate to Question phase
3. Verify all elements visible without scrolling:
   - [ ] Question header (Q1 • Category)
   - [ ] Linear timer bar
   - [ ] Question text
   - [ ] All 4 answer buttons (A, B, C, D)
4. Test with long question (150+ characters)
5. Test on real devices (iOS Safari, Android Chrome)

**Navigation:**
1. Navigate to HomePage - verify navbar visible
2. Create/join game - verify navbar disappears on GamePage
3. Navigate to AboutPage - verify navbar visible
4. Click "Back to Game" - verify navbar disappears

**Timer Variants:**
1. Question phase - verify circular timer with color changes (green → amber → red)
2. Results phase - verify linear progress bar with "Next question in" label
3. GameOver phase - verify text countdown "Room closing in Xs"

**Reactions:**
1. Open game on mobile viewport
2. Navigate to Results phase
3. Verify FAB appears (bottom-center on mobile)
4. Click FAB - verify bottom sheet slides up
5. Click reaction - verify bottom sheet closes
6. Verify toast notification appears (2.5s, auto-dismiss)
7. Test cooldown (3s between reactions)
8. Test on desktop - verify FAB position (bottom-right)

**Results Layout:**
1. Navigate to Results phase
2. Verify order on mobile (vertical stack):
   - [ ] Correct answer banner (top)
   - [ ] Player answers list
   - [ ] Scoreboard
   - [ ] Linear timer (bottom)
3. Verify desktop layout (optional two-column)

**Multiple Choice Default:**
1. Create new game
2. Verify GameSettings shows "Multiple Choice: ON"
3. Toggle OFF, verify text input mode
4. Toggle ON, verify option buttons return

### Browser Testing Matrix

| Browser | Viewport | Priority |
|---------|----------|----------|
| Chrome DevTools | 375x667px (iPhone SE) | High |
| Chrome DevTools | 390x844px (iPhone 12/13) | Medium |
| iOS Safari (real device) | iPhone SE/12/13 | High |
| Android Chrome (real device) | Pixel 5/6 | Medium |
| Desktop Chrome | 1440x900 | Medium |
| Desktop Firefox | 1440x900 | Low |

### Accessibility Testing

1. Run Lighthouse on mobile viewport
   - Target score: ≥ 95 accessibility
   - Check color contrast (timer colors, text)
   - Verify tap target sizes (≥ 56px)
2. Test keyboard navigation (desktop)
   - Tab through answer buttons
   - Enter to select
   - Escape to close bottom sheet
3. Test screen reader (VoiceOver/TalkBack)
   - Verify timer announcements
   - Verify button labels
   - Verify reaction toasts announced

---

## Dependencies & Risks

### Dependencies

**NPM Packages:**
- `react-hot-toast` (NEW) - Toast notification library
- `@mui/icons-material` (verify existing or install) - Material Icons

**No breaking changes expected:**
- WebSocket protocol unchanged
- Backend API unchanged (only default config value)
- Existing components not removed (only updated)

### Risks & Mitigation

**Risk: Question text overflow on very long questions**
- **Mitigation:** Test with 150+ character questions. Consider dynamic font sizing or accept scrolling as edge case.
- **Fallback:** Add `max-height` + `overflow-y: auto` with subtle scrollbar styling

**Risk: Bottom sheet not intuitive for users unfamiliar with FAB pattern**
- **Mitigation:** Add brief tooltip or pulsing animation on first appearance
- **Fallback:** User testing feedback loop - adjust if confusion persists

**Risk: Linear timer less visible than circular timer**
- **Mitigation:** Use vibrant teal gradient, ensure sufficient contrast
- **Testing:** Verify visibility in different lighting conditions

**Risk: Mobile viewport fragmentation (many screen sizes)**
- **Mitigation:** Test on 3-4 common sizes (375px, 390px, 414px widths)
- **Strategy:** Design for 375px (smallest), scale up gracefully

**Risk: Toast notifications too distracting during gameplay**
- **Mitigation:** 2.5s auto-dismiss, subtle animation, positioned away from critical content
- **Fallback:** Make toasts dismissible with swipe gesture (react-hot-toast built-in)

---

## Success Metrics

**Quantitative:**
- Mobile Lighthouse accessibility score: ≥ 95
- Tap target compliance: 100% of interactive elements ≥ 56px
- Above-the-fold success rate: 100% of questions visible on 375x667px viewport (excluding edge cases >150 chars)

**Qualitative:**
- User feedback: "No scrolling needed during questions" (validate with 3-5 testers)
- User feedback: "Reactions are fun and not distracting" (validate with 3-5 testers)
- Developer experience: "Styling follows CSS variable conventions" (code review)

---

## Migration & Rollout

**No database migration needed** (no backend schema changes)

**Deployment Strategy:**
1. Deploy frontend changes (all phases together)
2. Deploy backend config default change
3. Test on production with single game session
4. Monitor for WebSocket errors or UI bugs
5. Rollback plan: Revert frontend build, restart backend service

**Backward Compatibility:**
- Existing games in progress: no impact (state managed in memory)
- Old clients: N/A (no persistent clients, all state server-driven)

**Rollback Plan:**
- Frontend: Revert to previous build (`npm run build` from previous commit)
- Backend: Change default config back to `multiple_choice_enabled: False`
- Time estimate: 5 minutes (no data migration to reverse)

---

## Future Considerations

**Potential Enhancements:**
1. **Dynamic question font sizing** - Automatically reduce font size for long questions
2. **Reaction analytics** - Track which reactions are most used
3. **Custom reaction packs** - Allow hosts to select reaction sets
4. **Progressive Web App (PWA)** - Add offline support and install prompt
5. **Landscape orientation support** - Optimize for rotated mobile devices
6. **Tablet-optimized layouts** - Special handling for iPad (768px+ width)

**Extensibility Notes:**
- LinearTimer component can be reused for other countdown needs
- Toast system can be used for other notifications (errors, achievements)
- BottomSheet pattern can be applied to other features (settings, help)

---

## Implementation Checklist

### Phase 1: Foundation & Navigation
- [x] Install react-hot-toast (`npm install react-hot-toast`)
- [x] Update Navigation.tsx with route-based visibility (`/game/*` hidden)
- [x] Update PageContainer min-height calculation (100vh for game pages)
- [ ] Test navbar visibility on all routes

### Phase 2: Timer Variants
- [ ] Create LinearTimer component (LinearTimer.tsx + .module.css)
- [ ] Update Results.tsx to use LinearTimer variant="results"
- [ ] Update GameOver.tsx to use LinearTimer variant="subtle"
- [ ] Test timer countdown accuracy and reset behavior

### Phase 3: Question View Redesign
- [ ] Create QuestionHeader component (inline layout)
- [ ] Update Question.tsx to use QuestionHeader
- [ ] Add LinearTimer below header (16px height)
- [ ] Reduce question text font size and line-height
- [ ] Reduce spacing between elements
- [ ] Verify answer buttons ≥ 56px height
- [ ] Test on 375x667px viewport (no scrolling)
- [ ] Test on real devices (iOS + Android)

### Phase 4: Results View Reordering
- [ ] Reorder Results sections (answer → players → scoreboard → timer)
- [ ] Verify mobile vertical stack (≤600px)
- [ ] Test desktop two-column layout

### Phase 5: Reactions Redesign
- [ ] Create Toast component (wrapper for react-hot-toast)
- [ ] Create ReactionBottomSheet component (MUI Drawer)
- [ ] Update Reactions.tsx (remove button bar, add FAB)
- [ ] Install @mui/icons-material if needed
- [ ] Add Toaster provider to App.tsx
- [ ] Test FAB positioning (bottom-center mobile, bottom-right desktop)
- [ ] Test bottom sheet open/close
- [ ] Test toast notifications (2.5s auto-dismiss)
- [ ] Test cooldown enforcement (3s)

### Phase 6: Multiple Choice Default
- [ ] Update GameContext default config (multipleChoiceEnabled: true)
- [ ] Update backend default config (multiple_choice_enabled: True)
- [ ] Verify GameSettings toggle reflects new default

### Final Testing
- [ ] Run full game flow (HomePage → Lobby → Question → Results → GameOver)
- [ ] Test on all browser/viewport combinations (see testing matrix)
- [ ] Run Lighthouse accessibility audit (target ≥ 95)
- [ ] Verify no horizontal scrolling on any view
- [ ] Verify all CSS uses variables (no hardcoded values)
- [ ] Run `npm run build` (type-check passes)
- [ ] Deploy to production (see rollout plan)

---

## References & Research

### Internal References

**Component Architecture:**
- Current Timer: `frontend/src/components/common/Timer/Timer.tsx:14-99`
- Navigation: `frontend/src/components/ui/Navigation/Navigation.tsx:7-42`
- GameContext: `frontend/src/contexts/GameContext.tsx:19-133`
- Question layout: `frontend/src/features/game/Question/Question.module.css:84-225`
- Results layout: `frontend/src/features/game/Results/Results.module.css:65-240`
- Reactions: `frontend/src/features/game/Reactions/Reactions.tsx:1-100`

**Styling System:**
- CSS Variables: `frontend/src/styles/variables.css:1-140`
- Global utilities: `frontend/src/styles/global.css:154-228`
- Theme config: `frontend/src/theme.ts:1-76`

**Type Definitions:**
- RoomState: `frontend/src/types/index.ts:6-27`
- RoomConfig: `frontend/src/types/index.ts` (verify line numbers)

### External References

**Libraries:**
- [react-hot-toast docs](https://react-hot-toast.com/) - Toast notification patterns
- [Material-UI Drawer](https://mui.com/material-ui/react-drawer/) - Bottom sheet implementation
- [Material-UI Fab](https://mui.com/material-ui/react-floating-action-button/) - Floating action button

**Design Resources:**
- [iOS Human Interface Guidelines - Touch Targets](https://developer.apple.com/design/human-interface-guidelines/inputs/touchscreen-gestures) - 44-56px minimum
- [Material Design - FAB placement](https://m2.material.io/components/buttons-floating-action-button#placement) - Bottom-right standard
- [Web Accessibility - WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/?showtechniques=131#target-size) - 44x44px touch targets

### Related Work

**Brainstorm Document:**
- `docs/brainstorms/2026-02-08-mobile-first-ui-redesign-brainstorm.md` - Complete design decisions

**Skills:**
- `frontend-design` - UI patterns, CSS variables, responsive breakpoints
- `game-flow` - Testing UI changes across phases
- `reactions` - Reactions feature architecture
- `type-system-alignment` - TypeScript/Python type sync

**Documentation:**
- `docs/EventProtocol.md` - WebSocket messages (unchanged)
- `CLAUDE.md` - Project commands and architecture

---

## Notes

**Edge Cases:**
- Very long questions (>150 chars): May require scrolling on smallest viewports. Acceptable edge case or consider dynamic font sizing.
- Network latency: Timer interpolation handles this (local countdown from server time)
- Rapid reaction spam: 3s cooldown prevents (enforced server-side + client-side)

**Performance Considerations:**
- LinearTimer re-renders every 100ms (same as circular Timer, acceptable)
- Toast library is lightweight (4KB gzipped)
- Bottom sheet uses MUI Drawer (already in bundle)

**Accessibility Notes:**
- Ensure timer color changes don't rely solely on color (add text "TIME!" on critical)
- Toast notifications should be announced by screen readers (react-hot-toast supports ARIA)
- FAB should have descriptive aria-label ("Open reactions")

---

**Total Estimated Effort:** 16-23 hours
**Recommended Timeline:** 2-3 days (includes testing and iteration)
