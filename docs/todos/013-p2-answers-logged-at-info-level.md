# TODO-013 [P2] Correct Answers Logged at INFO Level

## Status: Pending

## Problem

Correct answers to trivia questions are logged at INFO level, visible in `journalctl -u jduel-backend`. This leaks game content to anyone with log access and could be used to cheat if logs are streamed.

## Affected Files

- `backend/src/app/services/answer/answer_service.py:137-143` — logs `correct_answer` at INFO level:
  ```python
  logger.info(
      "Answer check: user=%r, correct=%r, fuzzy=%.1f, embedding=%.2f",
      user_answer, correct_answer, fuzzy, embedding,
  )
  ```

## Fix

- Change answer content logging to DEBUG level
- Log only verification results (correct/incorrect, score) at INFO
- Avoid logging the actual correct answer text

```python
# Before
logger.info(f"Correct answer: {correct_answer}, Player answer: {player_answer}")

# After
logger.debug(f"Answer verification: correct={correct_answer}")
logger.info(f"Player {player_id} answered {'correctly' if is_correct else 'incorrectly'}, score: {score}")
```

## Impact

- **Severity:** Game integrity issue, information leak
- **Fix complexity:** Very low — change log levels
