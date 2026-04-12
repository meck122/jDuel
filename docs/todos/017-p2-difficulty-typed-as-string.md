# TODO-017 [P2] Difficulty Typed as String, Not Union

## Status: Pending

## Problem

The difficulty field is typed as `str` in both Python models and TypeScript interfaces instead of a proper union/literal type (`"enjoyer" | "master" | "beast"`). This allows invalid difficulty values to pass type checking silently.

## Affected Files

- `backend/src/app/models/room_config.py:17` — `difficulty: str = "enjoyer"`
- `backend/src/app/models/state.py:19` — `difficulty: str` in state model
- `frontend/src/types/index.ts:3` — `difficulty: string` in `RoomConfig` interface
- `backend/src/app/config/game.py` — `DIFFICULTY_RANGES` dict keys define the valid values

## Fix

**Python:**
```python
from typing import Literal
DifficultyLevel = Literal["enjoyer", "master", "beast"]
# Use in Pydantic models: difficulty: DifficultyLevel
```

**TypeScript:**
```typescript
type DifficultyLevel = "enjoyer" | "master" | "beast";
```

Use the `type-system-alignment` skill when implementing to keep both sides in sync.

## Impact

- **Severity:** Silent acceptance of invalid difficulty values
- **Fix complexity:** Low — type annotation changes
