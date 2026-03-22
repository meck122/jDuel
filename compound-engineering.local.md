---
review_agents:
  - compound-engineering:review:kieran-python-reviewer
  - compound-engineering:review:kieran-typescript-reviewer
  - compound-engineering:review:security-sentinel
  - compound-engineering:review:performance-oracle
  - compound-engineering:review:architecture-strategist
---

## Project Review Context

jDuel is a real-time multiplayer trivia game with:
- **Backend**: FastAPI (Python 3.13), WebSocket + HTTP hybrid, in-memory state (no DB), NLP answer verification (spaCy + sentence-transformers + RapidFuzz)
- **Frontend**: React 19 + TypeScript, MUI v7, React Router 7, Vite 7
- **Deployment**: Oracle Cloud aarch64 VPS (4 GB RAM), systemd + nginx, Let's Encrypt HTTPS

Key architectural decisions:
- Two-phase connection: HTTP pre-registration → WebSocket for gameplay
- Service Container pattern for dependency injection
- GameOrchestrator coordinates all game state transitions
- All room/player state is in-memory (intentional — no persistence requirement)
- CUDA_VISIBLE_DEVICES= set to prevent GPU allocation on CPU-only host

Focus areas for review:
- WebSocket concurrency and race conditions (in-memory shared state)
- Answer verification pipeline correctness and performance
- Frontend WebSocket lifecycle and reconnection logic
- Service layer coupling and testability
- Security of WebSocket message handling
