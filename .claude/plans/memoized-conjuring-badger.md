# Plan: Add Reactions Feature

## Summary
Add Clash Royale-style playful reaction emotes that players can fire during the **playing** and **results** phases. Reactions broadcast in real-time to all players via a dedicated WebSocket message (not bundled into ROOM_STATE). A 3-second server-enforced cooldown prevents spam. The UI is a fixed bottom button bar + a floating feed showing who reacted and with what.

## Design Decisions

**Transport: Dedicated `REACTION` broadcast message (not bundled into ROOM_STATE)**
ROOM_STATE is only pushed on discrete state changes. During playing/results, no state push happens until the next phase transition. Forcing a full state rebuild just to carry a reaction is wasteful and couples ephemeral social signals to authoritative game state. A standalone broadcast is lighter, more immediate, and follows the existing pattern cleanly.

**Cooldown: 3 seconds, server-enforced**
Server tracks `last_reaction_times: dict[str, datetime]` on the Room dataclass. Violations are silently dropped (same pattern as the existing rate limiter). Client mirrors the cooldown locally to disable buttons as a UX hint, but the server is the authority. The dict is cleared when transitioning out of results (`_on_results_timeout`).

**Reactions definition (single source of truth on backend):**
| ID | Label |
|----|-------|
| 0 | nice try! >:) |
| 1 | ah man! :( |
| 2 | better luck next time :p |

**UI: Fixed bottom bar (buttons) + fixed top-right feed (received reactions)**
Both are `position: fixed` so they float over game content without disrupting layout. Feed items slide in and auto-dismiss after 4 seconds. On mobile, feed collapses to a full-width strip and buttons shrink for thumb reach.

---

## Files to Modify

1. `backend/src/app/config/game.py`
2. `backend/src/app/config/__init__.py`
3. `backend/src/app/models/game.py`
4. `backend/src/app/models/websocket_messages.py`
5. `backend/src/app/api/websocket_handler.py`
6. `backend/src/app/services/orchestration/orchestrator.py`
7. `frontend/src/types/index.ts`
8. `frontend/src/contexts/GameContext.tsx`
9. `frontend/src/features/game/Results/Results.tsx`
10. `frontend/src/features/game/GameView/GameView.tsx`
11. `frontend/src/features/game/index.ts`

## Files to Create

12. `frontend/src/features/game/Reactions/Reactions.tsx`
13. `frontend/src/features/game/Reactions/Reactions.module.css`

---

## Implementation Steps

### Backend

#### 1. `backend/src/app/config/game.py` — Add reaction constants
Append after `ROOM_ID_PATTERN`:
```python
# Reactions
REACTION_COOLDOWN_MS = 3000  # 3 seconds between reactions per player
REACTIONS = [
    {"id": 0, "label": "nice try! >:)"},
    {"id": 1, "label": "ah man! :("},
    {"id": 2, "label": "better luck next time :p"},
]
```

#### 2. `backend/src/app/config/__init__.py` — Export new constants
Add `REACTION_COOLDOWN_MS` and `REACTIONS` to the import from `app.config.game` and to `__all__`.

#### 3. `backend/src/app/models/game.py` — Add cooldown tracking to Room
Add field declaration after `session_tokens`:
```python
last_reaction_times: dict[str, datetime] = field(default_factory=dict)
```
Initialize in `__init__`: `self.last_reaction_times = {}`

#### 4. `backend/src/app/models/websocket_messages.py` — Add ReactionMessage
New model:
```python
class ReactionMessage(BaseModel):
    """Message to send a reaction (playing/results phase only)."""
    type: Literal["REACTION"]
    reactionId: int
```
Update `WebSocketClientMessage.type` Literal to include `"REACTION"`.

#### 5. `backend/src/app/api/websocket_handler.py` — Route REACTION messages
Import `ReactionMessage`. Add branch in the msg_type if/elif chain:
```python
elif msg_type == "REACTION":
    validated = ReactionMessage.model_validate(message)
    await orchestrator.handle_reaction(room_id, player_id, validated.reactionId)
```

#### 6. `backend/src/app/services/orchestration/orchestrator.py` — handle_reaction + cleanup
Add `handle_reaction` method:
- Gate: room exists, status is PLAYING or RESULTS
- Validate reactionId in `range(len(REACTIONS))`
- Check `last_reaction_times[player_id]` against REACTION_COOLDOWN_MS; silently drop if too soon
- Record timestamp in `last_reaction_times`
- Broadcast `{"type": "REACTION", "playerId": player_id, "reactionId": reaction_id}` via `self._room_manager.broadcast_state()`

Add cleanup in `_on_results_timeout`: call `room.last_reaction_times.clear()` after `advance_question()` and before the broadcast, so cooldowns don't carry across rounds.

### Frontend

#### 7. `frontend/src/types/index.ts` — Extend types
Add `Reaction` interface:
```typescript
export interface Reaction {
  playerId: string;
  reactionId: number;
  receivedAt: number; // client timestamp for auto-dismiss
}
```
Extend `WebSocketMessage` union with: `| { type: "REACTION"; playerId: string; reactionId: number }`

#### 8. `frontend/src/contexts/GameContext.tsx` — Wire reactions
- Add `reactions` state: `const [reactions, setReactions] = useState<Reaction[]>([])`
- Add REACTION case in ws.onmessage switch: append to reactions with `receivedAt: Date.now()`
- Add useEffect: clear reactions when `roomState?.status` leaves playing/results
- Add `sendReaction` callback using existing `sendMessage`
- Expose `reactions` and `sendReaction` on `GameContextValue`

#### 9. `frontend/src/features/game/Reactions/Reactions.tsx` — New component (CREATE)
Contains:
- `REACTIONS` const array (mirrors backend definition)
- `DISMISS_DELAY_MS = 4000`
- Client-side cooldown via `useRef<number>(0)` + state for button disabled state with a 100ms interval countdown
- Auto-dismiss useEffect: on each `reactions` change, compute TTL of oldest item, set timeout to remove expired items
- Renders: feed overlay (top-right, slides in) + button bar (fixed bottom)
- Buttons disabled during cooldown, call `sendReaction` on click

#### 10. `frontend/src/features/game/Reactions/Reactions.module.css` — New stylesheet (CREATE)
- `.buttonBar`: `position: fixed; bottom: 0; left: 0; right: 0;` — dark semi-transparent bg with blur, flex row of buttons
- `.reactionButton`: compact monospace buttons, purple glow on hover, 0.4 opacity when disabled
- `.feed`: `position: fixed; top: 0; right: 0;` — narrow column, `pointer-events: none`, `max-height` to cap overflow
- `.feedItem`: dark card with slide-in animation (`translateX` from right), player name in purple, label in muted text
- Mobile (`@media max-width: 600px`): feed goes full-width at top, buttons shrink

#### 11. `frontend/src/features/game/GameView/GameView.tsx` — Mount Reactions
Import `Reactions`. Render `<Reactions />` inside the container div, but only when status is `"playing"` or `"results"`. This component is self-contained (fixed positioning) so it doesn't affect layout of sibling phase components.

#### 12. `frontend/src/features/game/index.ts` — Export
Add: `export { Reactions } from "./Reactions/Reactions";`

---

## Verification

1. **Backend smoke test**: Start the backend, create a room with 2+ players, start a game. During the playing phase, send a `{"type": "REACTION", "reactionId": 0}` message from one player and verify the other player receives `{"type": "REACTION", "playerId": "...", "reactionId": 0}`.
2. **Cooldown test**: Send two REACTION messages within 3 seconds from the same player. The second should be silently dropped (only one REACTION broadcast received by others).
3. **Phase gating test**: Send a REACTION while status is "waiting" or "finished". It should be silently dropped.
4. **Invalid reactionId test**: Send `reactionId: 99`. Should be dropped (logged as warning).
5. **Frontend visual test**: Play a game in browser. During playing/results, click reaction buttons. Verify: reactions appear in the feed with the correct player name, buttons disable during cooldown and re-enable after ~3s, feed items disappear after ~4s, buttons are reachable on mobile viewport.
6. **Run existing tests**: `cd backend && uv run pytest` — ensure no regressions. Frontend: `cd frontend && npm run lint`.
