---
status: pending
priority: p1
issue_id: "008"
tags: [code-review, security, backend]
dependencies: []
---

# Room Codes Generated with Non-Cryptographic random Module

## Problem Statement

`random.choices()` (Python's `random` module) is used to generate room codes. This module is not cryptographically secure — it is seeded and predictable. Room codes are session identifiers with only a 4-character space (36^4 = ~1.7M possibilities). An attacker can enumerate all possible room IDs via `GET /api/rooms/:id` requests or observe a sequence of generated codes to narrow the search space.

## Findings

- File: `backend/src/app/services/core/room_repository.py` lines 107–112
- `random.choices(string.ascii_uppercase + string.digits, k=4)` — predictable PRNG
- Session tokens are correctly generated with `secrets.token_urlsafe(32)` — same file uses both
- The inconsistency makes this easy to miss in review

## Proposed Solutions

### Option A: Replace random.choices with secrets.choice (Recommended)
```python
import secrets
alphabet = string.ascii_uppercase + string.digits
code = "".join(secrets.choice(alphabet) for _ in range(4))
```
- **Pros:** One-line change; cryptographically correct.
- **Effort:** Small | **Risk:** Very low

### Option B: Increase code length to 6 characters
- 36^6 = ~2.2 billion combinations; makes brute-force impractical even with a weak PRNG
- Use `secrets.choice` as well
- **Pros:** Defense-in-depth; also fixes the silent 6-char fallback issue (Arch P3)
- **Effort:** Small | **Risk:** Low (code length is handled throughout — check frontend display/input validation)

## Recommended Action
<!-- To be filled during triage -->

## Technical Details
- Affected file: `backend/src/app/services/core/room_repository.py` line 108
- Also check `frontend/src/pages/HomePage/` for room code input length validation if going with Option B

## Acceptance Criteria
- [ ] Room codes generated with `secrets.choice` (not `random.choices`)
- [ ] No other non-cryptographic random usage in security-sensitive code paths

## Work Log
- 2026-03-22: Identified by `kieran-python-reviewer` and `security-sentinel` review agents

## Resources
- `backend/src/app/services/core/room_repository.py`
- Python docs: `secrets` module
