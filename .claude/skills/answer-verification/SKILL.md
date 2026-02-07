---
name: answer-verification
description: Multi-stage NLP answer verification pipeline and testing patterns.
---

## 5-Stage Verification Pipeline

[answer_service.py](backend/src/app/services/answer/answer_service.py)

1. **Exact match** - Case-insensitive, normalized (`paris` = `Paris`)
2. **Numeric match** - Float comparison (`42` = `42.0`)
3. **Fuzzy match** - RapidFuzz 85% threshold (handles typos: `Pari` → `Paris`)
4. **Semantic match** - sentence-transformers 0.8 threshold (synonyms: `car` → `automobile`)
5. **Lemmatized match** - spaCy (tense: `running` → `run`)

Pipeline stops at first match (early exit optimization).

## Model Loading

**Lazy load once at startup** in main.py lifespan:

```python
answer_service = AnswerService()
await asyncio.to_thread(answer_service.load_models)  # ~5-10s, 300MB RAM
```

Models:

- sentence-transformers: `all-MiniLM-L6-v2` (~80MB, 200MB RAM)
- spaCy: `en_core_web_md` (43MB, 300MB RAM)

**CPU Mode (Default):** Backend runs without GPU using `CUDA_VISIBLE_DEVICES=""`. This is the standard configuration for both development and production (~850MB total RAM). GPU acceleration is not needed for jDuel's answer verification workload.

## Testing Pattern

**Unit Tests:** Use `MockAnswerService` to avoid loading models:

```python
class MockAnswerService:
    def is_correct(self, submitted: str, correct: str) -> bool:
        return submitted.lower().strip() == correct.lower().strip()
```

**Integration Tests:** Use real `AnswerService` with `CUDA_VISIBLE_DEVICES=""`:

```bash
cd backend/src
CUDA_VISIBLE_DEVICES="" uv run pytest ../tests/integration/
```

The backend starts quickly (~5-10s) even with model loading when GPU is disabled.

## Multiple Choice Mode

For MC questions, bypass NLP (exact match only):

```python
if question.is_multiple_choice:
    is_correct = submitted.strip() == question.answer.strip()
else:
    is_correct = answer_service.is_correct(submitted, question.answer)
```
