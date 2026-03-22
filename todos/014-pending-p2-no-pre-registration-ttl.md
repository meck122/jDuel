---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, security, backend]
dependencies: []
---

# No TTL on Unconnected Player Pre-Registrations — Name Slot Squatting

## Problem Statement

The two-phase join flow (HTTP registers player, then WebSocket connects) has no expiry on the pre-registration. An attacker can call `POST /api/rooms/:id/join` with an arbitrary player name, then never connect, permanently reserving that name slot. This enables griefing (blocking specific names) or filling all player slots to prevent legitimate players from joining.

## Findings

- File: `backend/src/app/api/routes.py` lines 224–231
- File: `backend/src/app/services/core/room_repository.py` lines 71–98
- No TTL or cleanup mechanism for players who pre-registered but never opened a WebSocket
- Combined with IP spoofing (#005), this bypasses the rate limiter

## Proposed Solutions

### Option A: Timestamp pre-registration and evict on subsequent join checks (Recommended)
- Store `registered_at: datetime` when player is added to `room.players` (pre-registration phase)
- On `POST /api/rooms/:id/join`, evict registrations older than 30 seconds where `player_id not in room.connections`
- **Pros:** Lazy eviction — no background task; fixes on next legitimate join attempt.
- **Effort:** Medium | **Risk:** Low

### Option B: Background cleanup task
- Periodic task (every 60s) evicts stale pre-registrations across all rooms
- **Pros:** Evicts even if no new joins come in.
- **Cons:** More complex; requires background task plumbing.
- **Effort:** Medium | **Risk:** Low

## Acceptance Criteria
- [ ] Pre-registrations that never complete a WebSocket connection are evicted after 30 seconds
- [ ] Evicted pre-registration allows another player to claim the same name
- [ ] Legitimate reconnecting player (WebSocket drop + re-register) is not evicted during the window

## Work Log
- 2026-03-22: Identified by `security-sentinel` review agent
