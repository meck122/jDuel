# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

jDuel is a real-time multiplayer trivia game with a React frontend and FastAPI backend, using WebSocket for game communication and HTTP for room management.

## Development Commands

### Frontend (Node.js 18+)

```bash
npm install          # Install dependencies
npm run dev          # Dev server on http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier
```

### Backend (Python 3.13+, uv package manager)

```bash
uv sync                                                    # Install dependencies
CUDA_VISIBLE_DEVICES="" uv run uvicorn app.main:app --reload  # Dev server on http://localhost:8000 (run from backend/src/)
uv run ruff check .                                        # Lint
uv run ruff format .                                       # Format
```

### Testing

```bash
# Backend tests (run from backend/src/)
uv run pytest ../tests/                      # Full test suite
uv run pytest ../tests/unit/                 # Unit tests only
uv run pytest ../tests/integration/          # Integration tests only
uv run pytest -x -q                          # Stop on first failure, quiet

# Frontend
npm run build                                # Type-checks via tsc + builds
```

Tests use `create_app(lifespan_override=...)` to skip 3GB+ NLP model loading. See `testing-patterns` skill for fixtures and mock patterns.

### Formatting & Pre-commit

```bash
uvx pre-commit run --all-files               # Run all hooks (lint, format, tests)
```

### Deployment

```bash
./deploy.sh          # Full stack deploy (builds frontend, syncs backend, restarts services)
```

## Architecture

```
Frontend (React 19 + Vite)  <-->  Backend (FastAPI)
    |                                   |
    - HTTP: room create/join            - REST API (/api/rooms)
    - WebSocket: real-time gameplay     - WebSocket handler
    - Material-UI v7                    - NLP answer verification
```

### Backend Structure (`backend/src/app/`)

- `main.py` - FastAPI entry with CORS and lifespan management
- `api/routes.py` - HTTP endpoints (POST/GET rooms)
- `api/websocket_handler.py` - WebSocket message handling (START_GAME, ANSWER, ROOM_STATE)
- `services/container.py` - ServiceContainer for dependency injection
- `services/answer/` - NLP-powered answer verification (spaCy, sentence-transformers, RapidFuzz)
- `services/core/` - Game logic (room_manager, game_service, timer_service)
- `services/orchestration/` - Game flow and state broadcasting
- `config/game.py` - Timing constants (15s question, 10s results, 60s room cleanup)

### Frontend Structure (`frontend/src/`)

- `contexts/GameContext.tsx` - Centralized game state and WebSocket management
- `services/api.ts` - HTTP client for room operations
- `config.ts` - API/WebSocket URLs (localhost for dev, same-host for prod)
- `pages/HomePage/` - Room creation/joining with deep link support (`/room/AB3D`)
- `pages/GamePage/` - Active game session
- `features/game/` - Game UI components (Lobby, Question, Results, GameOver)

### Communication Protocol

See [docs/EventProtocol.md](docs/EventProtocol.md) for the complete HTTP + WebSocket API reference.

**HTTP:** `POST /api/rooms` (create), `GET /api/rooms/{roomId}` (info), `POST /api/rooms/{roomId}/join` (register)

**WebSocket client→server:** `START_GAME`, `ANSWER`, `UPDATE_CONFIG`, `REACTION`

**WebSocket server→client:** `ROOM_STATE`, `REACTION`, `ERROR`, `ROOM_CLOSED`

## Key Technical Details

- No database - all state is in-memory
- Room codes are 4-character alphanumeric
- Production uses systemd + nginx (no Docker)
- Backend linting configured with ruff in `pyproject.toml`
- Reactions, question count, and config are server-driven (sent in RoomStateData)

## Skills Reference

| Skill | Use When... |
|-------|-------------|
| `ws-message-checklist` | Adding a new WebSocket message type end-to-end |
| `host-config-pattern` | Adding a host-only game setting to the lobby |
| `testing-patterns` | Writing tests, understanding fixtures and mocks |
| `type-system-alignment` | Syncing Python Pydantic models with TypeScript types |
| `game-flow` | Testing UI changes across phases, Playwright automation |
| `reactions` | Modifying the player reactions feature |
| `answer-verification` | Working on NLP answer checking pipeline |
| `websocket-protocol` | Debugging WebSocket connections and message flow |
| `backend-architecture` | Understanding service container, orchestration |
| `frontend-design` | UI patterns, CSS variables, responsive breakpoints |
| `room-lifecycle` | Room creation, cleanup, reconnection flow |
| `debugging-backend` | Tracing state bugs, orchestrator issues |
| `deployment` | Deploying, rollback, health checks |

## Skills Policy

- Use existing skills when relevant to the task
- Update skills when you notice inaccuracies
- Create new skills in `.claude/skills/` for important, reusable patterns

## Documentation

- [Getting Started](docs/GettingStarted.md) - Setup and onboarding
- [Event Protocol](docs/EventProtocol.md) - Complete HTTP + WebSocket API reference
- [Deployment Guide](docs/DeploymentGuide.md) - Production deployment (EC2, Nginx, SystemD, HTTPS)
- [Development](docs/Development.md) - Local dev environment and workflows
