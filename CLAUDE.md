# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
uv sync                                      # Install dependencies
uv run uvicorn app.main:app --reload         # Dev server on http://localhost:8000 (run from backend/src/)
uv run ruff check .                          # Lint
uv run ruff format .                         # Format
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

**HTTP:**

- `POST /api/rooms` - Create room
- `GET /api/rooms/{roomId}` - Get room info
- `POST /api/rooms/{roomId}/join` - Pre-register player

**WebSocket (client → server):**

- `START_GAME` - Host starts game
- `ANSWER` - Submit answer

**WebSocket (server → client):**

- `ROOM_STATE` - Full game state broadcast
- `ERROR` - Error message
- `ROOM_CLOSED` - Room closed

## Key Technical Details

- No database - all state is in-memory
- Room codes are 4-character alphanumeric
- Production uses systemd + nginx (no Docker)
- Backend linting configured with ruff in `pyproject.toml`

## Skills

- Use existing skills when relevant
- Improve existing skills to improve our workflows
- Create new skills locally in .claude/skills when doing a skill that is something important and likely to be reused

### Formatting

```bash
# Run on all files at root
uvx pre-commit run --all-files
```
