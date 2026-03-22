---
status: pending
priority: p3
issue_id: "025"
tags: [code-review, backend, security, type-safety]
dependencies: []
---

# UPDATE_CONFIG Accepts Untyped dict — Mass-Assignment Risk

## Problem Statement

`UpdateConfigMessage.config` is typed as a plain `dict`. The orchestrator validates known keys manually, but untyped dicts invite future mass-assignment vulnerabilities if a developer adds a new config field without adding explicit validation. This is the only inbound message type that doesn't use a typed Pydantic model for its payload.

## Findings

- File: `backend/src/app/models/websocket_messages.py` line 27: `config: dict = Field(default_factory=dict)`
- File: `backend/src/app/services/orchestration/orchestrator.py` lines 238–249
- Unknown keys are silently ignored today — safe — but relies on developer discipline

## Proposed Solution

```python
# websocket_messages.py
from typing import Optional, Literal

class UpdateConfigPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    multipleChoiceEnabled: Optional[bool] = None
    difficulty: Optional[Literal["enjoyer", "master", "beast"]] = None

class UpdateConfigMessage(BaseModel):
    type: Literal["UPDATE_CONFIG"]
    config: UpdateConfigPayload
```

Remove the manual key checks in the orchestrator — Pydantic validation handles it.

## Acceptance Criteria
- [ ] `UpdateConfigMessage.config` is a typed `UpdateConfigPayload` Pydantic model
- [ ] Unknown config keys are rejected by Pydantic (`extra="forbid"`)
- [ ] Orchestrator uses the typed model fields instead of manual dict access
- [ ] TypeScript `sendMessage` type includes typed config payload

## Work Log
- 2026-03-22: Identified by `kieran-python-reviewer` and `security-sentinel` review agents
