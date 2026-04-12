---
title: "refactor: Remove questions DB from git, add import tooling, purge jeopardy refs"
type: refactor
status: completed
date: 2026-04-11
origin: docs/brainstorms/2026-04-11-questions-db-extraction-requirements.md
---

# refactor: Remove Questions DB from Git, Add Import Tooling, Purge Jeopardy Refs

## Overview

`questions.db` is currently tracked in git, which commits question data to version history
and creates IP/copyright exposure. A `jeopardyTheme` symbol and related prose exist in the
frontend codebase. This refactor removes the binary from git, introduces a standalone CSV
import script and an SCP convenience script for production question management, and scrubs
all "jeopardy" strings from tracked source files.

## Problem Statement / Motivation

- **IP risk:** The questions were rewritten from Jeopardy source material. Keeping the DB in
  git ties question data to the codebase history.
- **Operational friction:** Updating questions requires committing a binary DB file and
  redeploying code.
- **Legal exposure:** "jeopardyTheme" and adjacent prose in source files create a visible
  association to Jeopardy branding.

After this refactor, questions live exclusively on the production VM, managed via an import
script that is the only thing that needs to be in the repo.

## Proposed Solution

Six discrete steps, each independently committable:

1. Fix `.gitignore` to unblock `scripts/` and gitignore `*.db`
2. Remove `questions.db` from git tracking
3. Write `scripts/import_questions.py` (replaces untracked `backend/src/scripts/import_questions.py`)
4. Write `scripts/upload-questions.sh` + `deploy/.env.example`
5. Extend `deploy.sh` with `--import-questions` flag
6. Remove all "jeopardy" strings from tracked source files

## Technical Considerations

### Existing import script

`backend/src/scripts/import_questions.py` exists on disk but is **not tracked in git**
(blocked by `**/scripts/` in `.gitignore`). It contains a function named
`import_jeopardy_questions` and uses pandas with `quality_rating`/`model_name` filtering —
incompatible with the current CSV schema. It can be left on disk or deleted; it is never
committed and does not need to be migrated.

### `.gitignore` line 19: `**/scripts/`

This pattern currently blocks any `scripts/` directory in the repo from being tracked.
It must be removed before the new `scripts/` directory can be committed. Removing it is safe
— no other scripts directories exist in the tracked tree.

### Import script: standalone stdlib only

The new `scripts/import_questions.py` should use only Python stdlib (`sqlite3`, `csv`,
`argparse`, `pathlib`, `sys`). This makes it callable with plain `python3` without activating
the uv environment, simplifying the `deploy.sh` invocation.

### `deploy.sh` site-down risk

`deploy.sh` stops the backend at Step 1 using `set -e`. If the import step fails
mid-deploy, the backend never restarts and the site goes down. The pre-flight check for the
CSV file **must happen before Step 1** (before `systemctl stop jduel-backend`).

### DB path

`DATABASE_PATH` is defined at `backend/src/app/db/database.py:9` as
`Path(__file__).parent / "questions.db"` (resolves to `backend/src/app/db/questions.db`).
The import script should accept `--db-path` as an optional argument with this as the
default, keeping the path DRY without importing app code.

### `init_database()` has no production call site

`init_database()` is exported from `backend/src/app/db/__init__.py` but is never called at
app startup (`main.py` lifespan only calls `load_answer_service()` and `init_services()`).
The import script must call `CREATE TABLE IF NOT EXISTS` itself (or call `init_database()`
equivalently) to ensure the schema exists before inserting rows.

### Tests are unaffected

All tests use `StaticQuestionProvider` injected into `RoomManager`. No test ever hits
`DATABASE_PATH`. No test changes are needed.

## CSV Column Mapping

Input CSV columns (used): `rewritten_question`, `correct_answer`, `general_category`,
`difficulty`, `wrong_answer_1`, `wrong_answer_2`, `wrong_answer_3`

DB columns: `question`, `answer`, `category`, `difficulty`, `wrong_answer_1`,
`wrong_answer_2`, `wrong_answer_3`

Ignored columns: `original_show_number`, `original_air_date`, `original_round`,
`original_category`, `original_value`, `original_question`, `original_answer`,
`quality_rating`, `model_name`

## Acceptance Criteria

- [ ] `git ls-files | grep questions.db` returns nothing
- [ ] `git ls-files | grep -E '\.(db|csv)$'` returns nothing
- [ ] `git grep -i jeopardy` returns zero matches across all tracked files
- [ ] `scripts/import_questions.py --help` documents CSV path and `--db-path` arguments
- [ ] Running `scripts/import_questions.py questions.csv` on a valid CSV prints row count
      and exits 0; exits 1 if 0 rows were imported
- [ ] `deploy.sh --import-questions` aborts with a clear error (and without stopping the
      backend) if `~/questions-import.csv` does not exist on the VM
- [ ] Full workflow succeeds on a fresh VM:
      `./scripts/upload-questions.sh questions.csv` → `./deploy.sh --import-questions`
- [ ] Frontend builds cleanly after `jeopardyTheme` → `appTheme` rename (`npm run build`)

## System-Wide Impact

- **`jeopardyTheme` rename:** Used in exactly two files (`theme.ts:33` export,
  `App.tsx:4` import, `App.tsx:20` JSX). No other callers.
- **DB file removal from git:** Existing git history retains the file; `git log -- questions.db`
  will still show it. This is acceptable — the goal is forward-looking, not a history rewrite.
- **`**/scripts/` removal from `.gitignore`:** Existing `backend/src/scripts/` contents
  (`import_questions.py`, `answer_service_testing.py`, `processed_trivia.csv`) become
  eligible for tracking. They should **not** be staged — the CSV is covered by the top-level
  `*.csv` rule. Verify the `.py` files there are intentionally untracked before committing.

## Implementation Steps

### Step 1 — Fix `.gitignore`

File: `.gitignore`

- Remove line 19: `**/scripts/`
- Add `*.db` (suggested placement: near the `*.csv` entry on line 57)

```diff
-**/scripts/
```

```diff
 # csv
 *.csv
+
+# SQLite databases
+*.db
```

### Step 2 — Remove `questions.db` from git

Run once (not a code change — a git operation):

```bash
git rm --cached backend/src/app/db/questions.db
```

Then commit together with the `.gitignore` changes from Step 1 so the file is not
immediately re-tracked.

### Step 3 — Write `scripts/import_questions.py`

New file: `scripts/import_questions.py`

Responsibilities:
- Accept positional argument: CSV file path
- Accept optional `--db-path` (default: `backend/src/app/db/questions.db` relative to
  repo root, computed relative to script location via `__file__`)
- `CREATE TABLE IF NOT EXISTS questions (...)` — replicate schema from `database.py`
- `DELETE FROM questions` (clear before reimport)
- Read CSV row by row, map columns (see CSV Column Mapping above), insert each row
- Print `Imported N questions from <csv_path>` on success
- Exit 1 with a clear message if 0 rows were inserted (empty CSV, all rows malformed)
- No external dependencies (stdlib only: `sqlite3`, `csv`, `argparse`, `pathlib`, `sys`)

### Step 4 — Write `scripts/upload-questions.sh` and `deploy/.env.example`

New file: `scripts/upload-questions.sh`

Responsibilities:
- Usage: `./scripts/upload-questions.sh /local/path/to/questions.csv`
- Load `JDUEL_SSH_HOST` and `JDUEL_SSH_USER` from env; if not set, try sourcing
  `deploy/.env`; if still unset, print usage and exit 1
- Optional `--key /path/to/key.pem` flag for SSH identity file
- SCP the given CSV to `$JDUEL_SSH_USER@$JDUEL_SSH_HOST:~/questions-import.csv`
- Print confirmation: `Uploaded to $JDUEL_SSH_HOST:~/questions-import.csv`

New file: `deploy/.env.example`

```bash
# Copy to deploy/.env and fill in your Oracle VM connection details
JDUEL_SSH_HOST=your-vm-ip-or-hostname
JDUEL_SSH_USER=ubuntu
# Optional: path to SSH private key (if not using ssh-agent or ~/.ssh/config)
# JDUEL_SSH_KEY=~/.ssh/jduel.key
```

### Step 5 — Extend `deploy.sh` with `--import-questions`

File: `deploy.sh`

Insert after the color variable definitions (after line 12), before Step 1:

```bash
# Parse arguments
IMPORT_QUESTIONS=false
for arg in "$@"; do
  case $arg in
    --import-questions) IMPORT_QUESTIONS=true ;;
  esac
done

# Pre-flight: verify CSV exists before stopping the backend
if [ "$IMPORT_QUESTIONS" = true ]; then
  CSV_PATH="$HOME/questions-import.csv"
  if [ ! -f "$CSV_PATH" ]; then
    echo "❌ --import-questions: CSV not found at $CSV_PATH"
    echo "   Run: ./scripts/upload-questions.sh /path/to/questions.csv"
    exit 1
  fi
fi
```

Insert after Step 3 (uv sync), before Step 4 (copy frontend files):

```bash
# Step 3b: Import questions (if requested)
if [ "$IMPORT_QUESTIONS" = true ]; then
  echo -e "${BLUE}📥 Importing questions from CSV...${NC}"
  python3 "$SCRIPT_DIR/scripts/import_questions.py" "$CSV_PATH" \
    --db-path "$SCRIPT_DIR/backend/src/app/db/questions.db"
fi
```

### Step 6 — Purge "jeopardy" references

| File | Location | Change |
|------|----------|--------|
| `frontend/src/theme.ts` | Line 33 | `jeopardyTheme` → `appTheme` |
| `frontend/src/App.tsx` | Line 4 | Update import: `jeopardyTheme` → `appTheme` |
| `frontend/src/App.tsx` | Line 20 | Update JSX: `jeopardyTheme` → `appTheme` |
| `README.md` | Line 326 | Reword: `Custom Jeopardy-inspired theme` → `Custom Material-UI theme` |

After edits: `npm run build` to confirm no TypeScript errors.

## Dependencies & Risks

- **`**/scripts/` removal exposes `backend/src/scripts/*.py`**: Verify these are intentionally
  untracked before `git add`. If they should stay untracked, add `backend/src/scripts/` to
  `.gitignore` as a scoped exclusion after removing the broad `**/scripts/` pattern.
- **Historical DB data in git**: `git log` still shows historical question content. Acceptable
  for now (history rewrite is out of scope per requirements doc).
- **Empty DB on fresh VM without `--import-questions`**: If a fresh VM is deployed without
  the flag, the backend starts with an empty DB and games will fail when `get_random_questions`
  returns an empty list. This is expected behavior — operators must run the import on fresh VMs.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-11-questions-db-extraction-requirements.md](../brainstorms/2026-04-11-questions-db-extraction-requirements.md)
  — Key decisions carried forward: clear-and-reimport strategy; separate upload script; CSV
  mapping (rewritten_question → question, correct_answer → answer, general_category → category)
- `backend/src/app/db/database.py:9` — DATABASE_PATH constant and schema definition
- `backend/src/app/services/core/question_provider.py:44` — DatabaseQuestionProvider
- `frontend/src/theme.ts:33` — jeopardyTheme export
- `frontend/src/App.tsx:4,20` — jeopardyTheme import and usage
- `README.md:326` — jeopardy prose reference
- `.gitignore:19` — `**/scripts/` pattern to remove
