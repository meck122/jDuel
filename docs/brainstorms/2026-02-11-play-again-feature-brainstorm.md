# Play Again Feature Brainstorm

**Date:** 2026-02-11
**Status:** Ready for planning

## What We're Building

A "Play Again" button on the GameOver screen (host-only) that resets the room back to the lobby state. All connected players return to the lobby, scores reset to zero, and the room reopens for new players to join. The host can reconfigure settings before starting the next game.

## Why This Approach

- **Follows existing patterns:** Game actions (START_GAME, ANSWER, UPDATE_CONFIG) already flow through WebSocket messages. Adding PLAY_AGAIN is consistent.
- **Reuses existing UI:** The lobby screen already handles player lists, config, and the start flow. No new screens needed.
- **Host control:** The host decides when to restart, matching the existing host-driven model (host creates room, host starts game, host configures).
- **Simplest implementation:** One new WS message type, one backend handler to reset room state, one button on the frontend.

## Key Decisions

1. **Trigger mechanism:** Host clicks "Play Again" button → sends `PLAY_AGAIN` WebSocket message (not HTTP — follows existing WS pattern for game actions)
2. **Player retention:** All connected players automatically return to lobby. No individual opt-in prompt — players can leave manually if they want.
3. **Score handling:** Scores reset to zero each game. No cumulative tracking.
4. **Room openness:** Room fully reopens — shareable link works, new players can join just like a fresh room.
5. **State reset:** Backend clears scores, answers, round counter, current question. Room status changes from `game_over` → `waiting`. Broadcasts fresh ROOM_STATE.

## Rejected Approaches

- **Auto-return with timer:** Removes host control, awkward if host wants a break. Harder to integrate with existing timer service.
- **HTTP endpoint reset:** Breaks the established pattern where game actions use WebSocket. Extra complexity for no benefit.
- **Per-player "Play Again?" prompt:** Adds UI complexity with little value — players who want to leave can just close the tab.

## Open Questions

None — design is straightforward. Ready for planning.
