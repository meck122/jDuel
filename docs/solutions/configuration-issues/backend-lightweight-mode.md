---
title: "Backend Runs Without CUDA - NLP Model Configuration"
category: configuration-issues
tags: [backend, nlp, answer-verification, deployment, testing, cuda, environment-variables, spacy, sentence-transformers]
module: backend/answer-verification
symptom: "Assumption that backend requires 3GB+ NLP model loading or CUDA for startup"
root_cause: "Documentation gap - backend runs without GPU using CUDA_VISIBLE_DEVICES environment variable"
date: 2026-02-07
---

# Backend Runs Without CUDA - NLP Model Configuration

## Problem Statement

There was an incorrect assumption that the jDuel backend requires loading a 3GB+ NLP model or CUDA GPU acceleration to start. This blocked browser testing and feature video recording workflows.

**Reality:** The backend runs perfectly in "lightweight mode" without GPU acceleration using the `CUDA_VISIBLE_DEVICES` environment variable.

## Correct Configuration

### Local Development

```bash
CUDA_VISIBLE_DEVICES="" uv run uvicorn app.main:app --reload
```

This environment variable tells PyTorch/Transformers to ignore GPUs and run on CPU only.

### What This Enables

- **Browser testing** - No need to bypass model loading
- **Integration tests** - Full backend runs in test environment
- **Feature video recording** - Backend can run alongside browser automation
- **Faster iteration** - No model warmup overhead

### Resource Usage

| Mode | RAM Usage | Startup Time | Use Case |
|------|-----------|--------------|----------|
| **CPU (CUDA_VISIBLE_DEVICES="")** | ~850MB | Fast | Dev, testing, production |
| **GPU (CUDA enabled)** | ~3GB | Slower | ML research (not needed) |

## Technical Details

### NLP Stack

jDuel uses two NLP models for answer verification:

1. **spaCy** (`en_core_web_md`) - Lemmatization and basic NLP
2. **sentence-transformers** (`all-MiniLM-L6-v2`) - Semantic similarity

Both models run efficiently on CPU without GPU acceleration.

### Lifespan Management

The backend uses FastAPI's lifespan events to load models:

```python
# backend/src/app/main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Models load during startup (both with or without CUDA)
    await container.answer_service.initialize()
    yield
    # Cleanup on shutdown
```

Tests use `lifespan_override` to skip model loading when not needed:

```python
# backend/tests/conftest.py
async def test_lifespan_override(app: FastAPI):
    # Skip model loading for fast unit tests
    yield
```

## Where This Was Documented

### Files Already Correct ✓

- **docs/Development.md** (lines 31-34) - Shows `CUDA_VISIBLE_DEVICES=""` usage
- **docs/DeploymentGuide.md** (lines 61-63) - Production SystemD config includes env var
- **.claude/skills/deployment/SKILL.md** - Deployment skill references correct config

### Files That Need Updates

1. **CLAUDE.md** (line 25)
   - Current: `uv run uvicorn app.main:app --reload`
   - Should be: `CUDA_VISIBLE_DEVICES="" uv run uvicorn app.main:app --reload`

2. **README.md** (lines 64-69)
   - Missing CUDA configuration note in backend setup section
   - Should mention environment variable for lightweight mode

3. **.claude/skills/answer-verification/SKILL.md**
   - Should clarify that CUDA is not required
   - Update testing section to reference correct startup command

## Impact on Testing Workflows

This configuration enables the full `/lfg` workflow including previously skipped steps:

- **Step 7: `/test-browser`** - Can now run browser tests with backend running
- **Step 8: `/feature-video`** - Can record feature videos with live backend

## References

- **External Docs:**
  - [sentence-transformers CPU vs GPU](https://www.sbert.net/docs/installation.html)
  - [spaCy GPU support](https://spacy.io/usage#gpu)
  - [FastAPI lifespan events](https://fastapi.tiangolo.com/advanced/events/)

- **Related Files:**
  - `backend/src/app/main.py` (lifespan setup)
  - `backend/src/app/services/answer/answer_service.py` (model initialization)
  - `backend/tests/conftest.py` (test lifespan override)

## Recommended Actions

1. Update CLAUDE.md line 25 with correct startup command
2. Update README.md backend section with CUDA configuration note
3. Update answer-verification skill documentation
4. Consider adding this to onboarding docs for new contributors
