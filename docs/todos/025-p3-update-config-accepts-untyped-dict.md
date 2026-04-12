# TODO-025 [P3] UPDATE_CONFIG Accepts Untyped Dict

## Status: Pending

## Problem

The `UPDATE_CONFIG` WebSocket message accepts an untyped dict as the config payload. A malicious host could send arbitrary key-value pairs to overwrite unexpected Room fields — mass-assignment risk.

## Affected Files

- `backend/src/app/models/websocket_messages.py:23-27` — `UpdateConfigMessage` has `config: dict = Field(default_factory=dict)` (untyped)
- `backend/src/app/api/websocket_handler.py:102-106` — passes `validated.config` dict to orchestrator
- `backend/src/app/services/orchestration/orchestrator.py:210-257` — `handle_config_update()` manually checks string keys instead of Pydantic validation
- `backend/src/app/models/room_config.py:6-17` — `RoomConfig` dataclass defines the actual structure

## Fix

Define a typed Pydantic model for allowed config fields:

```python
class RoomConfig(BaseModel):
    num_questions: int = Field(ge=1, le=50)
    difficulty: DifficultyLevel = "enjoyer"
    # ... only allowed fields

# In handler:
config = RoomConfig(**payload["config"])
room.update_config(config)
```

Reject unknown fields with `model_config = ConfigDict(extra="forbid")`.

Use the `host-config-pattern` skill when implementing.

## Impact

- **Severity:** Mass-assignment risk, potential for unexpected state mutations
- **Fix complexity:** Low-Medium — define model, validate in handler
