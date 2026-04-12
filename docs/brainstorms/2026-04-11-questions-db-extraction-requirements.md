---
date: 2026-04-11
topic: questions-db-extraction
---

# Questions DB Extraction & Jeopardy Cleanup

## Problem Frame

The `questions.db` SQLite file is tracked in git, which commits copyrighted/proprietary question data to version history and makes question updates require a code deploy. Additionally, scattered "jeopardy" references in the codebase create legal exposure since the questions have been rewritten and are no longer Jeopardy content.

Affected party: the developer (deployment workflow friction, IP risk).

## Requirements

- **R1.** Remove `questions.db` from git tracking and add it to `.gitignore`. The file persists on the production VM but is no longer part of the repository.
- **R2.** Add `scripts/import_questions.py` — a Python script that accepts a CSV file path, clears all existing questions from the DB, and imports fresh records. Mapping: `rewritten_question` → `question`, `correct_answer` → `answer`, `general_category` → `category`, `difficulty` → `difficulty`, `wrong_answer_1/2/3` → same. All `original_*`, `quality_rating`, and `model_name` columns are ignored.
- **R3.** Add `scripts/upload-questions.sh` — a shell script that SCP-copies a local CSV file to the Oracle VM at a well-known staging path (e.g., `~/questions-import.csv`). Reads VM connection info (user + host) from a local `.env` or accepts them as arguments.
- **R4.** Add `--import-questions` flag to `deploy.sh`. When passed, after the backend service starts, it runs `import_questions.py` using the CSV at the well-known staging path on the VM. If no CSV is found at that path, the flag is a no-op with a warning.
- **R5.** Remove all "jeopardy" references from tracked source files: `README.md`, `frontend/src/theme.ts`, `frontend/src/App.tsx`. Rename the `jeopardyTheme` export in `theme.ts` to a neutral name (e.g., `appTheme`). Update all callers.

## Success Criteria

- A fresh clone with no DB file can be deployed and have a working question DB by running: `./scripts/upload-questions.sh questions.csv` followed by `./deploy.sh --import-questions`.
- `git grep -i jeopardy` returns zero matches in tracked files.
- No CSV or DB data appears in `git ls-files`.

## Scope Boundaries

- Not changing the DB schema (no new columns for `quality_rating`, `model_name`, etc.).
- Not adding a question management UI or admin endpoint.
- Not deduplication logic — import is always clear-and-reimport.
- The import script is a local CLI tool only; no HTTP endpoint to trigger imports.

## Key Decisions

- **Clear-and-reimport on every run:** Predictable, simple, avoids duplicate risk.
- **Well-known staging path on VM (`~/questions-import.csv`):** Upload and deploy scripts agree on this path without needing to pass it around.
- **Separate upload script, not a deploy.sh flag:** Uploading data and deploying code are independent operations; they should be separately invocable.
- **Python for import script:** Keeps it in the backend ecosystem with direct access to the existing `database.py` module.

## Dependencies / Assumptions

- The Oracle VM SSH connection details (user + host) must be available locally, either as env vars (`JDUEL_SSH_USER`, `JDUEL_SSH_HOST`) or via a `deploy/.env` file.
- The `deploy.sh --import-questions` flag is run *on the VM*, not from the developer's host machine. The CSV must already be present at the well-known path before this flag is useful.

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Technical] Should `upload-questions.sh` also trigger the import automatically after uploading (i.e., a one-shot "upload and import" shortcut), or stay strictly as a file copy?
- [Affects R2][Technical] Should `import_questions.py` print a summary (rows imported, skipped, timing) for observability?

## Next Steps

→ `/ce:plan` for structured implementation planning
