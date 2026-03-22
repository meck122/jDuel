---
status: pending
priority: p2
issue_id: "018"
tags: [code-review, frontend, performance, react]
dependencies: []
---

# GameContext Value Object Recreated on Every Render — All Consumers Re-render

## Problem Statement

The `value` object in `GameProvider` is constructed inline on every render. Since `roomState` is replaced on every `ROOM_STATE` WebSocket message (~every 100ms from timers), every broadcast triggers a full re-render of all context consumers: `Lobby`, `Question`, `Results`, `GameOver`, `Reactions`, `GameView`, `Navigation`.

The context merges stable values (roomId, playerId, callbacks) with rapidly changing values (roomState, isConnected). Components that only read stable fields re-render unnecessarily on every server broadcast.

## Findings

- File: `frontend/src/contexts/GameContext.tsx` lines 207–221
- Every `setRoomState` call causes all `useGame()` consumers to re-render
- For current room sizes (2-8 players) this is unlikely to drop frames but causes unnecessary reconciliation work

## Proposed Solution

Split the context into two providers:
```ts
// GameIdentityContext — stable; only changes on connect/disconnect
const GameIdentityContext = { roomId, playerId, startGame, submitAnswer, sendReaction, sendMessage, connect, disconnect }

// GameStateContext — volatile; changes on every ROOM_STATE
const GameStateContext = { roomState, isConnected, isConnecting, connectionError }
```

Components like `Navigation` that only need `roomId` use `useGameIdentity()` — zero re-renders from state updates.
Components like `Question` that need `roomState` use `useGameState()`.

**Simpler alternative:** Wrap the `value` object in `useMemo` with appropriate dependencies (less ideal but low-effort).

## Acceptance Criteria
- [ ] Components that only read identity/actions don't re-render on every `ROOM_STATE` message
- [ ] `useGame()` hook still works for components that need both
- [ ] All existing component behavior preserved

## Work Log
- 2026-03-22: Identified by `performance-oracle` review agent
