---
name: reactions
description: Player reactions system — emitter architecture, backend validation, and cooldown flow. Use when modifying or extending the reaction feature.
---

# Reactions System

Players can fire trash-talk reactions ("nice try! >:)", etc.) during the `results` and `finished` phases. Reactions are lightweight — they bypass the normal `ROOM_STATE` broadcast and use a dedicated `REACTION` message type.

## Why Not Context?

React 19 batches **all** state updates, including those triggered from native WebSocket `onmessage` handlers. A `REACTION` message arriving in the same event as a `ROOM_STATE` would have its context update deferred, making reactions appear one click behind. `flushSync` doesn't fix this — it only guarantees the *provider* re-renders synchronously, not that consumers flush in the same commit.

**Solution:** A module-level pub/sub emitter (`reactionEmitter.ts`) delivers reactions directly to the `Reactions` component's local state, completely sidestepping context propagation.

## Data Flow

```
Player clicks reaction button
  → sendReaction(id)                        GameContext sends { type: "REACTION", reactionId }
    → WebSocket to server
      → orchestrator.handle_reaction()      validates phase, ID, cooldown
        → broadcast REACTION message        sent to all connections in the room
          → GameContext ws.onmessage        receives { type: "REACTION", playerId, reactionId }
            → emitReaction(...)             calls all registered listeners synchronously
              → Reactions component         setReactions(prev => [...prev, reaction])
                → feed item renders
```

## Backend Validation (orchestrator.handle_reaction)

Three gates, all silent drops (no error sent back):

1. **Phase** — room status must be `results` or `finished`
2. **Reaction ID** — must be a valid index into the `REACTIONS` list in `config/game.py`
3. **Cooldown** — per-player, 3s (`REACTION_COOLDOWN_MS`). Tracked in `Room.last_reaction_times`. Cleared on each question advance.

## Frontend Lifecycle

- `Reactions` mounts only when `status === "results" || status === "finished"` (conditional in `GameView`)
- On mount, it subscribes to `reactionEmitter`; the effect cleanup unsubscribes
- Local `reactions` state accumulates feed items for the duration of the phase
- On unmount (phase change back to `playing`), state is destroyed — no explicit clear needed
- Client-side cooldown (100ms tick) mirrors the server cooldown as a UX hint; server is authoritative

## Adding a New Reaction

1. Add an entry to `REACTIONS` in `backend/src/app/config/game.py`

That's it. Reactions are **server-driven** — the backend sends the full reactions list in every `ROOM_STATE` broadcast (via `RoomStateData.reactions`). The frontend reads `roomState.reactions` dynamically. No frontend constants to update.

## Key Files

| File | Role |
|------|------|
| `frontend/src/services/reactionEmitter.ts` | Pub/sub emitter — decouples WS delivery from React state |
| `frontend/src/features/game/Reactions/Reactions.tsx` | Button bar + feed UI, local state, cooldown UX |
| `frontend/src/features/game/Reactions/Reactions.module.css` | Fixed positioning (navbar-aware), slide-in animation |
| `frontend/src/contexts/GameContext.tsx` | Routes incoming REACTION messages to emitter; exposes `sendReaction` |
| `backend/src/app/services/orchestration/orchestrator.py` | `handle_reaction()` — validation, cooldown, broadcast |
| `backend/src/app/config/game.py` | `REACTIONS` list and `REACTION_COOLDOWN_MS` |
| `backend/src/app/models/game.py` | `Room.last_reaction_times` dict |
