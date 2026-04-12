# TODO-021 [P2] GameProvider Stale State Across Sessions

## Status: Pending

## Problem

`GameProvider` wraps the `Router` in the component tree, so its state persists across route changes. When a player navigates from a game back to the HomePage, stale `roomState` from the previous session leaks through — potentially showing old game data or causing incorrect UI behavior.

## Affected Files

- `frontend/src/App.tsx:18-41` — `<GameProvider>` wraps entire app including `<Router>`, never unmounts between game sessions
- `frontend/src/contexts/GameContext.tsx` — state persists across route changes

## Fix

Options:
1. **Reset state on route change:** Clear `roomState` when navigating away from `/room/:id`
2. **Move GameProvider inside GamePage:** Only mount the provider when on the game route
3. **Key the provider:** Use the room ID as a React key so it remounts on room change

Option 2 is cleanest:

```tsx
// App.tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/room/:roomId" element={
    <GameProvider>
      <GamePage />
    </GameProvider>
  } />
</Routes>
```

## Impact

- **Severity:** Stale UI data on HomePage after leaving a game
- **Fix complexity:** Low-Medium — depends on what other components need GameContext
