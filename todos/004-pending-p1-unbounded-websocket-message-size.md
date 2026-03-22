---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, security, backend, websocket, dos]
dependencies: []
---

# No WebSocket Payload Size Limit — OOM Vector

## Problem Statement

`receive_text()` in the WebSocket handler has no `max_size` argument. A connected player can send a single WebSocket frame of arbitrary size (e.g., 100 MB JSON blob) before the rate limiter executes. The rate limiter checks message count, not size. `json.loads(data)` will parse and hold the entire payload in memory synchronously, and `MAX_ANSWER_LENGTH = 500` validation only applies after full parse.

**Why it matters:** A single authenticated room member can crash or OOM the server process, taking down all active rooms plus the 850 MB+ NLP models loaded in-process. The systemd `Restart=always` means the server recovers in 3 seconds — with fresh rate limit counters.

## Findings

- File: `backend/src/app/api/websocket_handler.py` line 69
```python
data = await ws.receive_text()  # no max_size
```
- All game messages are tiny (< 1 KB). The largest legitimate message is an ANSWER with 500 chars.
- uvicorn default max WebSocket frame size is 16 MB — still far too large.

## Proposed Solutions

### Option A: Set --ws-max-size in uvicorn startup (Recommended, fastest)
- Add `--ws-max-size 8192` (8 KB) to the ExecStart in `deploy/jduel-backend.service`.
- Also update the dev run command in CLAUDE.md.
- **Pros:** One-line change; blocks all oversized frames before they reach Python code.
- **Cons:** None.
- **Effort:** Small | **Risk:** Low

### Option B: Pre-check data length before json.loads
```python
data = await ws.receive_text()
if len(data) > 1024:
    await ws.close(code=1009, reason="Message too large")
    return
```
- **Pros:** Defense-in-depth even if uvicorn limit is misconfigured.
- **Cons:** Still allocates memory for the oversized frame before checking.
- **Effort:** Small | **Risk:** Low

### Option C: Both A and B (Belt-and-suspenders)
- **Effort:** Small | **Risk:** Very low

## Recommended Action
<!-- To be filled during triage -->

## Technical Details
- Affected files: `deploy/jduel-backend.service` (ExecStart), `backend/src/app/api/websocket_handler.py`
- CLAUDE.md dev run command should also document the flag

## Acceptance Criteria
- [ ] uvicorn is started with `--ws-max-size 8192` (or similar small limit)
- [ ] WebSocket frames exceeding the limit are rejected before `json.loads`
- [ ] Oversized message attempt is logged at WARNING level

## Work Log
- 2026-03-22: Identified by `security-sentinel` review agent

## Resources
- `deploy/jduel-backend.service`
- `backend/src/app/api/websocket_handler.py`
- uvicorn docs: `--ws-max-size`
