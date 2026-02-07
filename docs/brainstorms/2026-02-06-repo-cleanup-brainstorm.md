# Repo Cleanup & Claude Workflow Optimization

**Date:** 2026-02-06
**Status:** Approved for implementation

## What We're Building

A comprehensive cleanup of the jDuel repository covering code quality fixes, documentation consolidation, CLAUDE.md optimization, and skills refresh. The goal is to fix real bugs, eliminate inconsistencies, and make Claude maximally effective for all development workflows.

## Why This Approach (B: Deep Refactor)

Approach B balances thoroughness with manageable risk. It fixes the concrete bugs found during audit, addresses cross-cutting type alignment issues, and improves the Claude development experience without over-scoping into full restructuring.

## Key Decisions

- **Metrics feature**: Stash on a separate `metrics` branch before cleanup work on `main`
- **Working branch**: `main` (solo project, direct commits)
- **CI/CD**: Keep manual `deploy.sh` (not adding GitHub Actions)
- **Docs**: Consolidate deployment docs into fewer files (not full restructure)
- **Skills**: Update existing 11 + create 2-3 new high-value skills
- **Root artifacts**: Move `METRICS_IMPLEMENTATION_SUMMARY.md` and `prometheus.yml` to metrics branch

## Phases

### Phase 1: Git Housekeeping
- Create `metrics` branch from current state with uncommitted changes
- Clean working tree on `main`
- Move metrics artifacts (METRICS_IMPLEMENTATION_SUMMARY.md, prometheus.yml) to metrics branch

### Phase 2: Code Fixes (Backend)
- Fix database connection leak in `db/database.py` (use context manager / try-finally)
- Add bounds check in `state_builder.py` for `question_index`
- Use `RoundState.reset()` or remove dead method
- Add missing return type annotation on `_calculate_score`
- Consistent metrics null handling in `websocket_handler.py`

### Phase 3: Code Fixes (Frontend)
- Fix hardcoded "of 10" questions — send `totalQuestions` from backend
- Add error handling for non-ApiError in `GamePage.tsx`
- Add reaction ID bounds validation
- Clear session tokens from localStorage on navigation away from game

### Phase 4: Cross-Cutting Alignment
- Extract duplicated REACTIONS constants — send from server or single source of truth
- Standardize WebSocket error responses (client gets notified of rejected messages)
- Add `totalQuestions` to `RoomStateData` and `RoomState` type

### Phase 5: CLAUDE.md Rewrite
- Add skill reference table (all skills with 1-line descriptions)
- Add "Common Tasks" section mapping workflows to skills
- Add compound-engineering plugin context
- Remove redundancy with README
- Add meta-note about keeping CLAUDE.md updated

### Phase 6: Documentation Consolidation
- Merge Nginx.md + SystemD.md + HTTPS.md + Deployment.md into single deployment guide
- Update GettingStarted.md and Development.md for accuracy
- Clean up stale docs (ramUsage.txt, Ec2OOMDebug.md — move to metrics branch or remove)

### Phase 7: Skills Refresh
- Update existing 11 skills for accuracy
- Create 2-3 new skills:
  - **Debugging backend state** — tracing ROOM_STATE mutations, orchestrator logging
  - **Deployment guide** — deploy.sh walkthrough, rollback, health checks
  - (Optional) **WebSocket debugging** — browser DevTools, message timing

### Phase 8: Settings & Permissions
- Add missing helpful permissions (git log, git diff, npm install)
- Review and tighten overly broad permissions

## Findings Summary

### Real Bugs Found (8)
1. Database connection leak on error (no try-finally)
2. Potential IndexError in state_builder (no bounds check)
3. Race condition in session token generation (TOCTOU)
4. Forever-connecting state in GamePage (unhandled non-ApiError)
5. Hardcoded "of 10" question count
6. Duplicated REACTIONS constants (backend + frontend)
7. Missing reactionId bounds validation on frontend
8. Session tokens never cleared from localStorage

### Type Safety Gaps (4)
1. Missing `_calculate_score` return type
2. Missing explicit type guards on optional values (Results.tsx)
3. Unused `RoundState.reset()` method (dead code)
4. Inconsistent metrics null checks

### Claude Workflow Gaps
1. No skill reference in CLAUDE.md
2. Missing debugging and deployment skills
3. Asymmetric permissions (uv sync allowed, npm install not)
4. No compound-engineering plugin awareness

## Open Questions

None — ready to proceed with implementation.
