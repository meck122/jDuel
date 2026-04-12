# TODO-008 [P1] Non-Cryptographic Room Codes

## Status: Pending

## Problem

Room codes are generated using `random.choices()` (Mersenne Twister) instead of `secrets.choice()`. With 4-character alphanumeric codes (36^4 = ~1.7M possibilities), codes are:
- Predictable if the PRNG state is known
- Enumerable via brute force (~1.7M requests)

Combined with no rate limiting on room lookups (GET /api/rooms/{id}), an attacker can discover all active rooms.

## Affected Files

- `backend/src/app/services/core/room_repository.py:100-112` — `_generate_unique_room_code()` uses `random.choices()`

## Fix

```python
# Before
import random
code = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=4))

# After
import secrets
ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
code = ''.join(secrets.choice(ALPHABET) for _ in range(4))
```

Optionally increase code length to 5-6 chars for more entropy. The `ROOM_ID_PATTERN` in `game.py` already allows up to 6 chars: `r"^[A-Z0-9]{4,6}$"`.

## Impact

- **Severity:** Room enumeration possible, privacy risk
- **Fix complexity:** Very low — one-line change
- **Risk:** None

## Testing

- Verify generated codes match `ROOM_ID_PATTERN`
- Existing tests should pass unchanged
