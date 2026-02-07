---
name: testing-patterns
description: Testing strategies - pytest fixtures, MockAnswerService pattern, test organization.
---

# Testing Patterns

Two-tier pytest framework: **unit** (isolated service tests) and **integration** (full HTTP + WebSocket through a real app instance). All tests run in ~1.5s with zero NLP model loading.

## Why `create_app(lifespan_override=...)` Exists

The production lifespan loads 3GB+ NLP models. `backend/src/app/main.py` exposes an app factory so integration tests can skip it entirely:

```python
from app.main import create_app

@contextlib.asynccontextmanager
async def noop_lifespan(_app):
    yield

app = create_app(lifespan_override=noop_lifespan)
```

The module-level `app = create_app()` preserves production behavior identically.

## Why `container_mod._container` Is Patched Directly

`backend/src/app/api/websocket_handler.py` calls `get_container()` at call time inside the handler — it does **not** use FastAPI `Depends()`. So `dependency_overrides` don't apply to WebSocket routes. The integration conftest sets the module-level singleton directly:

```python
import app.services.container as container_mod
container_mod._container = test_container   # restored to None after each test
```

## Conftest Hierarchy

```
tests/conftest.py              # Root — shared fixtures
    MockAnswerService class        simple string equality (no NLP)
    mock_answer_service            fixture returning MockAnswerService()
    sample_questions               10 Questions; index 2 has wrong_answers for MC coverage
    static_question_provider       StaticQuestionProvider backed by sample_questions

tests/unit/conftest.py         # Unit tier — real services with test doubles
    room_repository                RoomRepository()
    connection_manager             ConnectionManager(room_repository)
    room_manager                   RoomManager(question_provider=static_question_provider)
    game_service                   GameService(mock_answer_service)
    timer_service / state_builder  fresh instances
    mock_room_closer               MagicMock with AsyncMock close_room
    orchestrator                   GameOrchestrator wired with all above

tests/integration/conftest.py  # Integration tier — app + wired container
    noop_lifespan                  async context manager that just yields
    test_container                 wires ServiceContainer, patches _container singleton
    client                         TestClient(create_app(lifespan_override=noop_lifespan))
```

## HTTP Test Pattern

```python
def test_join_success(self, client: TestClient):
    room_id = client.post("/api/rooms").json()["roomId"]
    resp = client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Alice"})
    assert resp.status_code == 200
    assert resp.json()["playerId"] == "Alice"
```

## WebSocket Test Pattern

```python
def test_start_game(self, client: TestClient):
    # HTTP phase: create + join
    room_id = client.post("/api/rooms").json()["roomId"]
    client.post(f"/api/rooms/{room_id}/join", json={"playerId": "Alice"})
    # WebSocket phase
    with client.websocket_connect(f"/ws?roomId={room_id}&playerId=Alice") as ws:
        ws.receive_json()                   # consume initial ROOM_STATE
        ws.send_json({"type": "START_GAME"})
        msg = ws.receive_json()
        assert msg["roomState"]["status"] == "playing"
```

### Testing Pre-Accept Close Codes (4003, 4004, 4009)

The server closes before accepting for invalid connections. Starlette raises `WebSocketDisconnect` with a `.code` attribute — `match=` won't work because `str(exc)` is empty:

```python
from starlette.websockets import WebSocketDisconnect

with pytest.raises(WebSocketDisconnect) as exc_info:
    with client.websocket_connect(url):
        pass
assert exc_info.value.code == 4004
```

## Async Testing

`asyncio_mode = "auto"` in `pyproject.toml` removes the need for `@pytest.mark.asyncio`. Just write `async def test_...`:

```python
async def test_question_timer_fires_callback(self, timer_service):
    called = []
    async def cb(): called.append(True)
    timer_service.start_question_timer("ROOM1", 50, cb)
    await asyncio.sleep(0.1)
    assert len(called) == 1
```

## Run Commands

```bash
cd backend
uv run pytest tests/ -v                              # All tests
uv run pytest tests/unit/ -v                         # Unit only (fast)
uv run pytest tests/integration/ -v                  # Integration only
uv run pytest --cov=app --cov-report=term-missing    # Coverage
uv run pytest tests/ -x -q                           # Pre-commit style (stop on first failure)
```

## Bugs Found and Fixed

Two bugs existed in the original `test_room_manager.py`:

1. **`assert len(room.questions) == 10`** — `create_room()` passes an empty list; questions load at game start via `load_questions_by_difficulty()`. Fixed to `== 0`.
2. **`room.room_id.isupper() or room.room_id.isdigit()`** — Fails for mixed alphanumeric IDs like "A3B2". Fixed to `all(c in string.ascii_uppercase + string.digits for c in room.room_id)`.

## Key Files

| File | Role |
| --- | --- |
| `backend/src/app/main.py` | `create_app()` factory — only production change |
| `backend/tests/conftest.py` | Root fixtures: MockAnswerService, sample_questions, static_question_provider |
| `backend/tests/unit/conftest.py` | Unit-tier service fixtures |
| `backend/tests/integration/conftest.py` | App factory + `_container` patching — architecturally key |
| `backend/tests/unit/test_room_manager.py` | Moved here + bugs fixed |
| `backend/tests/unit/test_game_service.py` | Moved here (no changes needed) |
| `backend/tests/integration/test_rest_routes.py` | HTTP route tests (11 tests) |
| `backend/tests/integration/test_websocket.py` | WebSocket game flow tests (10 tests) |
