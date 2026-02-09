---
title: Fix Navigation Black Screen - GameProvider Context Issue
date: 2026-02-08
topic: Fix Navigation component crash when using useGame() outside GameProvider
status: ready-for-planning
---

# Fix Navigation Black Screen - GameProvider Context Issue

## What We're Building

Fixing a critical crash where the entire app shows a black screen after adding `useGame()` hook to Navigation component. The issue occurs because Navigation is rendered at App level (outside GameProvider), but useGame() requires being inside GameProvider context.

**Error:** `"useGame must be used within a GameProvider"`

## Why This Happened

In commit `3f8c034`, we added game status checking to Navigation.tsx:

```tsx
const { roomState } = useGame();
const isGameFinished = roomState?.status === "finished";
if (isGamePage && !isGameFinished) return null;
```

This broke the app because:
1. **Navigation is rendered at App level** (App.tsx line 23) - outside GameProvider
2. **GameProvider only wraps GamePage** (GamePage.tsx line 155)
3. **HomePage and AboutPage have no GameProvider** → Navigation calls useGame() → crash

## Why This Approach

### Chosen Strategy: Move GameProvider to App Level

Wrap the entire app (Router + Navigation + Routes) in GameProvider at the App.tsx level.

**Architecture:**
```tsx
<ThemeProvider>
  <GameProvider>  {/* NEW: Wrap entire app */}
    <Router>
      <Navigation />  {/* Can now use useGame() */}
      <Routes>
        <HomePage />
        <GamePage />  {/* Remove GameProvider from here */}
        <AboutPage />
      </Routes>
    </Router>
  </GameProvider>
</ThemeProvider>
```

**Why this works:**
- Navigation has access to game context everywhere (HomePage, AboutPage, GamePage)
- GamePage no longer needs its own GameProvider wrapper
- Consistent context availability across all pages
- Simple, clean architecture - no defensive checks needed

**Trade-off:** GameProvider wraps all pages, even those that don't use game state (HomePage, AboutPage). This is acceptable because:
- GameProvider is lightweight when not connected to a room
- Context is always available - no conditional logic needed
- Simplifies future features that need game state on other pages

## Alternative Approaches Considered

### ❌ Option 2: Make useGame() Optional in Navigation

Make GameContext provide a default empty value so Navigation can call useGame() even outside GameProvider.

**Why rejected:**
- Adds defensive null checks: `const { roomState } = useGame(); if (!roomState) return null;`
- Violates React Context best practices (should explicitly require provider)
- Masks the real issue instead of fixing the architecture
- Navigation behavior becomes unpredictable based on context availability

### ❌ Option 3: Pass Game State via URL

GamePage passes finished status via URL query param (`/game/ABC?status=finished`), Navigation reads from URL.

**Why rejected:**
- Hacky - URL shouldn't be the source of truth for app state
- Tight coupling between routes and Navigation logic
- Doesn't scale if we need other game state in Navigation (e.g., reactions, player count)
- Breaks if user manually edits URL

### ❌ Option 4: Remove useGame() from Navigation

Go back to route-based visibility logic without checking game status.

**Why rejected:**
- Loses the feature we implemented (navbar on GameOver)
- Route-based logic is less flexible than state-based logic
- Doesn't solve the architectural issue

## Key Decisions

### Decision 1: GameProvider Scope
**Wrap entire Router + Navigation + Routes in GameProvider at App.tsx level**

**Implementation:**
```tsx
// App.tsx
function App() {
  return (
    <ThemeProvider theme={jeopardyTheme}>
      <CssBaseline />
      <GameProvider>  {/* NEW: App-level GameProvider */}
        <Router>
          <div className="app-layout">
            <Navigation />
            <main className="app-main">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/room/:roomId" element={<RoomRedirect />} />
                <Route path="/game/:roomId" element={<GamePage />} />
                <Route path="/about" element={<AboutPage />} />
              </Routes>
            </main>
          </div>
        </Router>
      </GameProvider>
    </ThemeProvider>
  );
}
```

**Trade-off:** All pages now have game context, even if they don't use it. Acceptable for architectural consistency.

### Decision 2: onRoomClosed Callback Handling
**Make onRoomClosed optional in GameProvider**

**Current GameProvider signature:**
```tsx
interface GameProviderProps {
  children: React.ReactNode;
  onRoomClosed: () => void;  // Currently required
}
```

**Updated signature:**
```tsx
interface GameProviderProps {
  children: React.ReactNode;
  onRoomClosed?: () => void;  // Make optional
}
```

**Implementation:**
```tsx
// GameContext.tsx
const handleRoomClosed = useCallback(() => {
  disconnect();
  if (onRoomClosed) {  // Only call if provided
    onRoomClosed();
  }
}, [disconnect, onRoomClosed]);
```

**Why this works:**
- App.tsx doesn't need to pass onRoomClosed (no navigation needed at app level)
- GamePage can still pass its navigation handler if needed
- Flexible - future pages can provide their own handlers

**Alternative considered:** Move navigation logic inside GameProvider using useNavigate(). Rejected because it tightly couples context to routing library.

### Decision 3: GamePage Wrapper Removal
**Remove GameProvider wrapper from GamePage.tsx**

Since GameProvider is now at App level, GamePage no longer needs to wrap GamePageContent.

**Before:**
```tsx
export function GamePage() {
  const navigate = useNavigate();
  const handleRoomClosed = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <GameProvider onRoomClosed={handleRoomClosed}>
      <GamePageContent />
    </GameProvider>
  );
}
```

**After:**
```tsx
export function GamePage() {
  // GamePageContent can directly use useGame() - context already provided by App
  return <GamePageContent />;
}
```

**Consideration:** If we need GamePage-specific onRoomClosed behavior, we can use useEffect in GamePageContent to set it via a context method.

## Open Questions

- [x] Should GameProvider wrap all pages or just game-related routes?
  - **Answer:** Wrap all pages for consistency and simplicity (chosen approach)

- [x] How to handle onRoomClosed callback when GameProvider moves to App level?
  - **Answer:** Make callback optional, only call if provided

- [ ] Should we add a useEffect in GamePage to register an onRoomClosed handler?
  - **Decision needed:** Current approach makes callback optional. If GamePage needs navigation on room close, we can add a context method like `setOnRoomClosed()` that GamePage calls in useEffect.

- [ ] Do HomePage or AboutPage need any game state cleanup logic?
  - **Decision needed:** Currently they don't connect to rooms. If they do in the future, we'll need disconnect logic.

## Technical Details

### Files to Modify

#### 1. `frontend/src/App.tsx`
**Changes:**
- Import GameProvider from contexts
- Wrap Router + content in `<GameProvider>`
- No callback needed at this level

**Before:**
```tsx
function App() {
  return (
    <ThemeProvider theme={jeopardyTheme}>
      <CssBaseline />
      <Router>
        <div className="app-layout">
          <Navigation />
          <main className="app-main">
            <Routes>
              {/* routes */}
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}
```

**After:**
```tsx
import { GameProvider } from "./contexts";

function App() {
  return (
    <ThemeProvider theme={jeopardyTheme}>
      <CssBaseline />
      <GameProvider>
        <Router>
          <div className="app-layout">
            <Navigation />
            <main className="app-main">
              <Routes>
                {/* routes */}
              </Routes>
            </main>
          </div>
        </Router>
      </GameProvider>
    </ThemeProvider>
  );
}
```

#### 2. `frontend/src/contexts/GameContext.tsx`
**Changes:**
- Make onRoomClosed prop optional
- Add null check before calling callback

**Before:**
```tsx
interface GameProviderProps {
  children: React.ReactNode;
  onRoomClosed: () => void;
}

const handleRoomClosed = useCallback(() => {
  disconnect();
  onRoomClosed();
}, [disconnect, onRoomClosed]);
```

**After:**
```tsx
interface GameProviderProps {
  children: React.ReactNode;
  onRoomClosed?: () => void;
}

const handleRoomClosed = useCallback(() => {
  disconnect();
  if (onRoomClosed) {
    onRoomClosed();
  }
}, [disconnect, onRoomClosed]);
```

#### 3. `frontend/src/pages/GamePage/GamePage.tsx`
**Changes:**
- Remove GameProvider wrapper (already provided by App)
- Simplify component structure

**Before:**
```tsx
export function GamePage() {
  const navigate = useNavigate();

  const handleRoomClosed = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <GameProvider onRoomClosed={handleRoomClosed}>
      <GamePageContent />
    </GameProvider>
  );
}
```

**After (Option A - Simplest):**
```tsx
export function GamePage() {
  return <GamePageContent />;
}
```

**After (Option B - With room-closed navigation):**
```tsx
export function GamePage() {
  // If we need GamePage-specific room close handling,
  // we can add a setOnRoomClosed method to GameContext
  // and call it in useEffect here
  return <GamePageContent />;
}
```

**Decision:** Use Option A initially. If we discover we need GamePage-specific onRoomClosed behavior, we can add a context method later.

#### 4. `frontend/src/components/ui/Navigation/Navigation.tsx`
**No changes needed** - already uses useGame() correctly, will now work because it's inside GameProvider.

## Acceptance Criteria

- [ ] App loads without errors on HomePage
- [ ] App loads without errors on AboutPage
- [ ] App loads and connects successfully on GamePage
- [ ] Navigation component renders on all pages
- [ ] Navigation hides during active gameplay (Lobby, Question, Results)
- [ ] Navigation shows on GameOver screen (`roomState.status === "finished"`)
- [ ] No console errors about GameProvider
- [ ] Browser console is clean (no React warnings)

## Testing Strategy

### Manual Testing

1. **HomePage Test:**
   - Navigate to http://localhost:3000
   - Verify page loads (not black screen)
   - Verify navbar shows with "About" link
   - No console errors

2. **AboutPage Test:**
   - Click "About" link
   - Verify page loads with content
   - Verify navbar shows with "Back to Game" link
   - No console errors

3. **GamePage Test (Active Game):**
   - Create/join a room
   - Navigate to /game/:roomId
   - Verify navbar hidden during Lobby, Question, Results phases
   - No console errors

4. **GamePage Test (GameOver):**
   - Complete a full game (reach GameOver screen)
   - Verify navbar shows on GameOver screen
   - Verify "Home" link works
   - No console errors

### Playwright Browser Testing

```bash
# Use browser automation to verify UI
mcp__playwright__browser_navigate --url http://localhost:3000
mcp__playwright__browser_snapshot  # Verify HomePage loads

mcp__playwright__browser_click --ref [about-link]
mcp__playwright__browser_snapshot  # Verify AboutPage loads

mcp__playwright__browser_console_messages --level error  # Check for errors
```

## Success Metrics

### Quantitative
- **Zero console errors** on all pages
- **Navigation renders** on HomePage, AboutPage, GameOver
- **Navigation hides** during Lobby, Question, Results

### Qualitative
- **Professional UX** - no broken black screens
- **Consistent architecture** - GameProvider available everywhere
- **Clean code** - no defensive null checks or workarounds

## Related Work

- Previous commit: `3f8c034` - Added useGame() to Navigation (introduced bug)
- Previous brainstorm: `docs/brainstorms/2026-02-08-results-view-mobile-fixes-brainstorm.md`
- Previous plan: `docs/plans/2026-02-08-fix-results-mobile-layout-gameover-nav-plan.md`
- GameContext source: `frontend/src/contexts/GameContext.tsx`

---

**Next Step**: Create implementation plan via `/workflows:plan`.
