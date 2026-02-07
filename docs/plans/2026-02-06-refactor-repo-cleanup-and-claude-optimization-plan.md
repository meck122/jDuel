---
title: "refactor: Repo cleanup, bug fixes, docs consolidation, and Claude workflow optimization"
type: refactor
date: 2026-02-06
brainstorm: docs/brainstorms/2026-02-06-repo-cleanup-brainstorm.md
---

# Repo Cleanup, Bug Fixes, Docs Consolidation & Claude Workflow Optimization

## Overview

Comprehensive cleanup of the jDuel repository covering 7 confirmed bugs, documentation consolidation, CLAUDE.md rewrite, and skills refresh. The goal is to fix real issues, eliminate doc redundancy, and optimize the Claude Code development experience.

Based on [brainstorm](../brainstorms/2026-02-06-repo-cleanup-brainstorm.md) with Approach B (Deep Refactor) selected.

## Problem Statement

The codebase is well-structured but has accumulated:
- 7 confirmed bugs (silent error swallowing, hardcoded values, token leaks, race conditions)
- ~30% documentation redundancy across CLAUDE.md, README.md, and docs/
- CLAUDE.md lacks skill reference, testing guidance, and doc cross-links
- Duplicated constants between backend and frontend (REACTIONS)
- WebSocket validation errors silently dropped (client never notified)

## Proposed Solution

8 phases executed sequentially on `main`, each independently committable.

---

## Implementation Phases

### Phase 1: Git Housekeeping

**Goal:** Clean working tree so all subsequent work starts from a known state.

**Tasks:**
- [x] Create `metrics` branch from current HEAD
- [x] On `metrics` branch, stage and commit all uncommitted metrics changes:
  - `backend/pyproject.toml` (prometheus-client dependency)
  - `backend/src/app/api/websocket_handler.py` (metrics instrumentation)
  - `backend/src/app/main.py` (metrics endpoint)
  - `backend/src/app/services/container.py` (MetricsService wiring)
  - `backend/src/app/services/core/room_manager.py` (metrics hooks)
  - `backend/src/app/services/orchestration/orchestrator.py` (metrics hooks)
  - `backend/tests/unit/conftest.py` (metrics_service fixture)
  - `backend/uv.lock` (updated lockfile)
  - `backend/src/app/services/metrics/` (new service directory)
  - `backend/tests/unit/test_metrics_service.py` (new tests)
  - `METRICS_IMPLEMENTATION_SUMMARY.md` (summary doc)
  - `prometheus.yml` (Prometheus config)
  - `docs/Ec2OOMDebug.md` (debugging notes)
- [x] Switch back to `main`
- [x] Verify clean working tree with `git status`

**Acceptance Criteria:**
- [x] `metrics` branch exists with all metrics work committed
- [x] `main` branch has clean working tree (no staged/unstaged/untracked changes from metrics)

---

### Phase 2: Backend Bug Fixes

**Goal:** Fix 4 confirmed backend issues.

#### 2.1 Database connection context managers

**File:** `backend/src/app/db/database.py`

Not a leak (close() is called), but connections won't close on exceptions. Wrap in context managers:

```python
# Lines 43-68: get_random_questions()
# Lines 85-112: get_random_questions_by_difficulty()
# Lines 14-31: init_database()
# Change from explicit conn.close() to context manager pattern:

def get_random_questions(count: int = 10) -> list[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        # ... query logic ...
        return [dict(row) for row in cursor.fetchall()]
```

#### 2.2 State builder bounds check

**File:** `backend/src/app/services/orchestration/state_builder.py:57,86`

Add bounds validation before accessing `room.questions[room.question_index]`:

```python
# In _add_playing_state() at line 57:
if room.question_index >= len(room.questions):
    logger.error(f"question_index {room.question_index} out of bounds for {len(room.questions)} questions")
    return data

current_question = room.questions[room.question_index]
```

Same pattern at line 86 in `_add_results_state()`.

#### 2.3 WebSocket validation error responses

**File:** `backend/src/app/api/websocket_handler.py:80-129`

Currently, JSON decode errors (line 80), unknown message types (line 118), and validation failures (line 123) log warnings but send nothing back to the client. Add ERROR responses:

```python
# After line 86 (JSON decode error):
await websocket.send_json({"type": "ERROR", "message": "Invalid message format"})

# After line 121 (unknown message type):
await websocket.send_json({"type": "ERROR", "message": f"Unknown message type: {msg_type}"})

# After line 127 (validation failure):
await websocket.send_json({"type": "ERROR", "message": "Message validation failed"})
```

#### 2.4 Session token TOCTOU race condition

**File:** `backend/src/app/api/routes.py:189-209`

Between checking `stored_token` (line 190) and writing a new one (line 209), concurrent requests can orphan tokens. Use dict.setdefault() for atomic check-and-set:

```python
# Replace lines 207-209:
# Old:
# if not stored_token:
#     stored_token = secrets.token_urlsafe(32)
#     room.session_tokens[request.playerId] = stored_token

# New (atomic):
if not stored_token:
    new_token = secrets.token_urlsafe(32)
    stored_token = room.session_tokens.setdefault(request.playerId, new_token)
```

**Acceptance Criteria:**
- [x] Database functions use context managers (try-finally or `with`)
- [x] State builder returns gracefully on out-of-bounds question_index
- [x] WebSocket handler sends ERROR messages for validation failures
- [x] Session token generation is atomic via setdefault()
- [x] All existing tests pass (`uv run pytest`)

---

### Phase 3: Frontend Bug Fixes

**Goal:** Fix 3 confirmed frontend issues.

#### 3.1 Hardcoded question count

**Files:**
- `backend/src/app/models/state.py` — add `total_questions: int` to `RoomStateData`
- `backend/src/app/services/orchestration/state_builder.py` — populate `total_questions` from `len(room.questions)`
- `frontend/src/types/index.ts` — add `totalQuestions: number` to `RoomState`
- `frontend/src/features/game/Question/Question.tsx:49` — replace `"of 10"` with `of {roomState.totalQuestions}`

#### 3.2 GamePage silent error swallowing

**File:** `frontend/src/pages/GamePage/GamePage.tsx:65-85`

Non-ApiError exceptions are caught and silently ignored, leaving user stuck on "Connecting...":

```typescript
// In the catch block, after the ApiError handling:
} else {
  console.error("Unexpected error during registration:", error);
  setError("An unexpected error occurred. Please try again.");
}
```

#### 3.3 Session token cleanup

**File:** `frontend/src/services/api.ts`

Add a `clearTokens()` function and call it when leaving a game:

```typescript
// In api.ts:
export function clearToken(roomId: string): void {
  const tokens = JSON.parse(localStorage.getItem(SESSION_TOKEN_KEY) || "{}");
  delete tokens[roomId];
  if (Object.keys(tokens).length === 0) {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } else {
    localStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(tokens));
  }
}
```

**File:** `frontend/src/contexts/GameContext.tsx`

Call `clearToken(roomId)` in the disconnect/cleanup handler when room closes or player navigates away.

**Acceptance Criteria:**
- [x] Question counter shows dynamic total from server
- [x] Non-ApiError in GamePage shows user-visible error message
- [x] Session tokens cleared from localStorage on game exit
- [x] No TypeScript compilation errors (`npm run build`)

---

### Phase 4: Cross-Cutting Alignment

**Goal:** Eliminate duplicated constants and ensure type alignment.

#### 4.1 REACTIONS single source of truth

**Current duplication:**
- Backend: `backend/src/app/config/game.py:30-34`
- Frontend: `frontend/src/features/game/Reactions/Reactions.tsx:28-32`

**Approach:** Send available reactions from backend in `RoomStateData` so frontend doesn't hardcode them.

- Add `reactions: list[dict]` to `RoomStateData` in `backend/src/app/models/state.py`
- Populate from `REACTIONS` constant in `state_builder.py` (include in LOBBY and all states)
- Add `reactions: Reaction[]` to `RoomState` in `frontend/src/types/index.ts`
- Remove hardcoded `REACTIONS` array from `Reactions.tsx`, use `roomState.reactions` instead

#### 4.2 Remove dead code

- Delete `RoundState.reset()` method from `backend/src/app/models/round_state.py:25-31` (confirmed unused — game_service manually resets fields inline)

**Acceptance Criteria:**
- [x] REACTIONS defined only in backend `config/game.py`
- [x] Frontend reads reactions from room state, not hardcoded array
- [x] `RoundState.reset()` removed
- [x] All tests pass, app builds cleanly

---

### Phase 5: CLAUDE.md Rewrite

**Goal:** Make CLAUDE.md the optimal Claude Code entry point for this repo.

**File:** `CLAUDE.md`

Rewrite with these sections:

1. **Project Overview** — Keep current (concise, accurate)
2. **Development Commands** — Keep current, add testing commands (`uv run pytest`, `uv run pytest tests/unit/`, `uv run pytest -x -q`)
3. **Architecture** — Keep current diagram, add link to `docs/EventProtocol.md` for protocol details
4. **Key Technical Details** — Keep current
5. **Testing** (NEW) — Point to `testing-patterns` skill, list key commands, note `create_app(lifespan_override=...)` pattern for test isolation
6. **Skills Reference** (NEW) — Table of all skills with 1-line descriptions:

```markdown
## Skills Reference

| Skill | Use When... |
|-------|-------------|
| `ws-message-checklist` | Adding a new WebSocket message type |
| `host-config-pattern` | Adding a host-only game setting |
| `testing-patterns` | Writing tests, understanding fixtures |
| `type-system-alignment` | Syncing Python models with TypeScript types |
| `game-flow` | Testing UI changes, understanding game phases |
| `reactions` | Modifying the reactions feature |
| `answer-verification` | Working on NLP answer checking |
| `websocket-protocol` | Debugging WebSocket connections |
| `backend-architecture` | Understanding service container, orchestration |
| `frontend-design` | UI patterns, CSS variables, responsive design |
| `room-lifecycle` | Room creation, cleanup, reconnection |
| `debugging-backend` | Tracing state bugs, orchestrator issues |
| `deployment` | Deploying, rollback, health checks |
```

7. **Documentation** (NEW) — Links to key docs:

```markdown
## Documentation

- [Getting Started](docs/GettingStarted.md) — Setup and onboarding
- [Event Protocol](docs/EventProtocol.md) — Complete HTTP + WebSocket API reference
- [Deployment Guide](docs/DeploymentGuide.md) — Production deployment (EC2, Nginx, SystemD, HTTPS)
- [Development](docs/Development.md) — Local dev environment and workflows
```

8. **Formatting** — Keep current pre-commit reference

**Acceptance Criteria:**
- [x] CLAUDE.md has skills reference table
- [x] CLAUDE.md has testing section
- [x] CLAUDE.md cross-links to docs/
- [x] No redundant content with README.md

---

### Phase 6: Documentation Consolidation

**Goal:** Merge deployment docs, clean up redundancy.

#### 6.1 Consolidate deployment docs

Merge these 4 files into a single `docs/DeploymentGuide.md`:
- `docs/Deployment.md` (156 lines — deployment flow)
- `docs/Nginx.md` (188 lines — reverse proxy config)
- `docs/SystemD.md` (218 lines — service management)
- `docs/HTTPS.md` (84 lines — Let's Encrypt setup)

Structure of consolidated `docs/DeploymentGuide.md`:
```markdown
# Deployment Guide

## Overview (from Deployment.md)
## Prerequisites
## 1. SystemD Service Setup (from SystemD.md)
## 2. Nginx Reverse Proxy (from Nginx.md)
## 3. HTTPS with Let's Encrypt (from HTTPS.md)
## 4. Deploying Changes (deploy.sh walkthrough)
## 5. Troubleshooting
## 6. Monitoring & Health Checks
```

Delete the 4 individual files after consolidation.

#### 6.2 Clean up FrontendFlow.md

`docs/FrontendFlow.md` is 50% duplicate of `EventProtocol.md`. Options:
- **Keep unique content** (frontend design system section, lines ~816-990)
- **Remove duplicate sections** (HTTP API, WebSocket protocol, game flow — all in EventProtocol.md)
- Result: ~200-line focused frontend design reference

#### 6.3 Remove stale files

- `docs/ramUsage.txt` — Move relevant data into `docs/DeploymentGuide.md` troubleshooting section, delete file

#### 6.4 Update GettingStarted.md

Update links to point to new consolidated `DeploymentGuide.md` instead of individual files.

**Acceptance Criteria:**
- [x] Single `docs/DeploymentGuide.md` replaces 4 separate deployment docs
- [x] `FrontendFlow.md` trimmed to unique content only
- [x] `ramUsage.txt` data incorporated into deployment guide
- [x] All internal doc links updated
- [x] `GettingStarted.md` links correct

---

### Phase 7: Skills Refresh

**Goal:** Update existing skills for accuracy, create 2 new high-value skills.

#### 7.1 Update existing skills

Review each of the 11 skills against current codebase state. Key updates:
- **ws-message-checklist** — Add link to actual type definition files (`models/state.py`, `types/index.ts`)
- **testing-patterns** — Verify fixture names match current `conftest.py`
- **type-system-alignment** — Add note about `totalQuestions` and `reactions` fields added in Phase 3-4
- **reactions** — Update to reflect that reactions come from server state (no longer hardcoded in frontend)

#### 7.2 Create new skills

**Skill: `debugging-backend`**

```
.claude/skills/debugging-backend/SKILL.md
```

Content covering:
- How to trace ROOM_STATE mutations through orchestrator
- Key logging points in `orchestrator.py`, `room_manager.py`, `game_service.py`
- Common state bugs (timer not canceling, connections not cleared, stale question_index)
- How to inspect Room objects at runtime
- WebSocket close code reference (4003, 4004, 4009)

**Skill: `deployment`**

```
.claude/skills/deployment/SKILL.md
```

Content covering:
- `deploy.sh` walkthrough (what each step does)
- SystemD service management commands
- Nginx reload vs restart
- How to roll back a bad deploy
- Health check endpoints (`/health`, `/metrics`)
- Common issues (OOM on small instances, model loading memory)

**Acceptance Criteria:**
- [x] All 11 existing skills reviewed and updated where needed
- [x] `debugging-backend` skill created with state tracing guide
- [x] `deployment` skill created with deploy.sh walkthrough
- [x] Skills reference in CLAUDE.md updated to include new skills

---

### Phase 8: Settings & Permissions

**Goal:** Optimize `.claude/settings.local.json` for the full development workflow.

**File:** `.claude/settings.local.json`

Add missing useful permissions:
```json
"Bash(npm install:*)",
"Bash(npm run test:*)"
```

**Acceptance Criteria:**
- [x] Permissions allow full dev workflow without unnecessary prompts
- [x] No overly broad permissions added

---

## Quality Gates

- [x] All backend tests pass: `uv run pytest`
- [x] Frontend builds cleanly: `npm run build`
- [x] Pre-commit hooks pass: `uvx pre-commit run --all-files`
- [x] No broken internal doc links
- [x] CLAUDE.md skills table matches actual skills directory

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Breaking existing tests with backend fixes | Low | Run tests after each phase |
| Frontend type changes causing build failures | Low | Build check after Phase 3-4 |
| Doc consolidation losing important content | Low | Consolidate content, don't delete before verifying |
| Metrics branch conflicts with future merges | Low | Clean separation — metrics branch is self-contained |

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-02-06-repo-cleanup-brainstorm.md`
- Backend entry: `backend/src/app/main.py`
- Frontend entry: `frontend/src/main.tsx`
- Service container: `backend/src/app/services/container.py`
- Protocol reference: `docs/EventProtocol.md`

### Files Modified Per Phase
- **Phase 1:** Git operations only (no file edits)
- **Phase 2:** `db/database.py`, `state_builder.py`, `websocket_handler.py`, `routes.py`
- **Phase 3:** `state.py`, `state_builder.py`, `types/index.ts`, `Question.tsx`, `GamePage.tsx`, `api.ts`, `GameContext.tsx`
- **Phase 4:** `state.py`, `state_builder.py`, `types/index.ts`, `Reactions.tsx`, `round_state.py`, `config/game.py`
- **Phase 5:** `CLAUDE.md`
- **Phase 6:** `docs/DeploymentGuide.md` (new), delete `Deployment.md`, `Nginx.md`, `SystemD.md`, `HTTPS.md`, edit `FrontendFlow.md`, `GettingStarted.md`
- **Phase 7:** `.claude/skills/` (updates + 2 new)
- **Phase 8:** `.claude/settings.local.json`
