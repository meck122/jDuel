# TODO-014 [P2] No TTL on HTTP Pre-Registrations

## Status: Pending

## Problem

When a player calls `POST /api/rooms/{id}/join`, their name slot is reserved but there's no TTL. If they never connect via WebSocket, the slot is held indefinitely — name squatting that blocks legitimate players.

## Affected Files

- `backend/src/app/api/routes.py:224-242` — registers player and stores session token with no expiry
- `backend/src/app/services/core/room_repository.py` — `register_player()` adds to `room.players` permanently

## Fix

Add a TTL (e.g., 30 seconds) to pre-registrations. Clean up expired ones:

```python
# On pre-registration
registration.created_at = time.time()

# Periodic or on-access cleanup
if time.time() - registration.created_at > 30:
    del pre_registrations[player_id]
```

Or clean up stale pre-registrations when a new player attempts to join.

## Impact

- **Severity:** Name slot squatting, soft DoS on rooms
- **Fix complexity:** Low
