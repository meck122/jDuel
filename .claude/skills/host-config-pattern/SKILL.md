---
name: host-configuration
description: Standardized pattern for adding host-only game settings to jDuel. Use when implementing new lobby configuration options, toggles, or game mode settings that only the host should control.
---

# Host Configuration Pattern

Standardized pattern for adding host-only game settings to jDuel.

## How It Works

The host is the **first player to register** in a room. Host identity is tracked in `Room.host_id` (set automatically in `room_repository.py` on first `register_player` call).

All host-controlled settings live in **`RoomConfig`** (`backend/src/app/models/room_config.py`). To add a new setting:

1. Add a field to `RoomConfig` with a safe default
2. Add the matching camelCase field to `RoomConfigData` in `models/state.py`
3. Add the field to the frontend `RoomConfig` type in `types/index.ts`
4. Handle the new field in `orchestrator.handle_config_update()` — this is where validation and state mutation happen

Everything else (WebSocket routing, host validation, broadcast) is already wired up.

## Protocol

**Client → Server:**

```json
{ "type": "UPDATE_CONFIG", "config": { "someNewSetting": true } }
```

**Validation (in orchestrator):**

- Sender must be `room.host_id`
- Room status must be `"waiting"` (before game starts)
- Unknown fields are silently ignored

**Server → Client (via ROOM_STATE broadcast):**

```json
{
  "roomState": {
    "hostId": "PlayerName",
    "config": { "multipleChoiceEnabled": true, "someNewSetting": true },
    ...
  }
}
```

## Frontend Toggle Pattern

In `Lobby.tsx`, settings are visible to **all** players but only the host can interact:

```tsx
<label
  className={`${styles.configToggle} ${!isHost ? styles.configToggleDisabled : ''}`}
  title={isHost ? undefined : 'Only the host can change settings'}
>
  <input
    type='checkbox'
    className={styles.configCheckbox}
    checked={roomState?.config?.someNewSetting ?? false}
    disabled={!isHost}
    onChange={(e) => updateConfig({ someNewSetting: e.target.checked })}
  />
  <span className={styles.configSlider} />
  <span className={styles.configLabel}>Setting Label</span>
</label>
```

The CSS toggle pattern (`.configCheckbox`, `.configSlider`, `.configToggle`, `.configToggleDisabled`) is already defined in `Lobby.module.css` — reuse it for additional toggles.

## Key Files

| File                                                     | Role                                            |
| -------------------------------------------------------- | ----------------------------------------------- |
| `backend/src/app/models/room_config.py`                  | Add new config fields here                      |
| `backend/src/app/models/state.py`                        | `RoomConfigData` — camelCase mirror for clients |
| `backend/src/app/services/orchestration/orchestrator.py` | `handle_config_update()` — apply + validate     |
| `frontend/src/types/index.ts`                            | `RoomConfig` interface                          |
| `frontend/src/contexts/GameContext.tsx`                  | `updateConfig()` action                         |
| `frontend/src/features/game/Lobby/Lobby.tsx`             | Toggle UI                                       |
