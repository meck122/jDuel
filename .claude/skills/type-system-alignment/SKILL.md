---
name: type-system-alignment
description: Keeping Pydantic models and TypeScript interfaces synchronized.
---

## Naming Convention

**Python:** `camelCase` field names directly | **JSON:** `camelCase` | **TypeScript:** `camelCase`

This project uses camelCase field names directly in Pydantic models (no `Field(alias=...)` pattern):

```python
# Backend - Pydantic with camelCase field names
class RoomStateData(BaseModel):
    roomId: str
    timeRemainingMs: int | None = None
    totalQuestions: int = 0
    reactions: list[ReactionData] | None = None

# Serialize
state.model_dump(exclude_none=True)  # {"roomId": ..., "timeRemainingMs": ...}
```

```typescript
// Frontend - TypeScript interface
interface RoomState {
  roomId: string;
  timeRemainingMs?: number;
  totalQuestions: number;
  reactions?: { id: number; label: string }[];
}
```

## Critical Mappings

**Optional types:**
Python `Optional[str]` → TypeScript `string | null`

**Enums:**
Python `GameStatus.PLAYING.value = "playing"` → TypeScript `type GameStatus = 'playing' | ...`

**Collections:**
Python `List[str]` → TypeScript `string[]`
Python `Dict[str, int]` → TypeScript `Record<string, number>`

## Key Files

**Backend:** [models/state.py](backend/src/app/models/state.py) - RoomStateData, QuestionData, ResultsData
**Frontend:** [types/index.ts](frontend/src/types/index.ts) - Matching interfaces

## Common Pitfalls

❌ Using `snake_case` field names in Pydantic models → Use `camelCase` directly
❌ TypeScript uses `snake_case` → Should be `camelCase`
❌ Missing `?` or `| null` for `Optional` fields
❌ Enum string values don't match
❌ Forgetting `exclude_none=True` in `model_dump()` → Sends null fields to client

## Evolution Strategy

1. Add field as `Optional` in backend (backward compat)
2. Update frontend interface
3. Deploy backend first
4. Update frontend components
5. Make required if needed (breaking change)
