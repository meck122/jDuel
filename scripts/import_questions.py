#!/usr/bin/env python3
"""Import questions from a CSV file into the jDuel SQLite database.

Usage:
    python3 scripts/import_questions.py questions.csv
    python3 scripts/import_questions.py questions.csv --db-path /custom/path/questions.db

CSV columns used:
    rewritten_question, correct_answer, general_category, difficulty,
    wrong_answer_1, wrong_answer_2, wrong_answer_3

All other columns (original_*, quality_rating, model_name, etc.) are ignored.

Behavior: clears all existing questions and reimports fresh from the CSV.
Exits with code 1 if zero rows were successfully imported.
"""

import argparse
import csv
import sqlite3
import sys
from pathlib import Path

# Default DB path relative to this script's location (repo_root/backend/src/app/db/questions.db)
_SCRIPT_DIR = Path(__file__).parent
DEFAULT_DB_PATH = _SCRIPT_DIR.parent / "backend" / "src" / "app" / "db" / "questions.db"

CREATE_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        difficulty INTEGER,
        wrong_answer_1 TEXT,
        wrong_answer_2 TEXT,
        wrong_answer_3 TEXT
    )
"""

INSERT_SQL = """
    INSERT INTO questions (category, question, answer, difficulty,
                           wrong_answer_1, wrong_answer_2, wrong_answer_3)
    VALUES (?, ?, ?, ?, ?, ?, ?)
"""


def import_questions(csv_path: Path, db_path: Path) -> int:
    """Import questions from CSV into the database.

    Returns:
        Number of rows successfully inserted.
    """
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(CREATE_TABLE_SQL)
        cursor.execute("DELETE FROM questions")

        inserted = 0
        skipped = 0

        with csv_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                question = row.get("rewritten_question", "").strip()
                answer = row.get("correct_answer", "").strip()
                if not question or not answer:
                    skipped += 1
                    continue

                category = row.get("general_category", "").strip() or None
                difficulty_raw = row.get("difficulty", "").strip()
                try:
                    difficulty = int(difficulty_raw) if difficulty_raw else None
                except ValueError:
                    difficulty = None

                cursor.execute(
                    INSERT_SQL,
                    (
                        category,
                        question,
                        answer,
                        difficulty,
                        row.get("wrong_answer_1", "").strip() or None,
                        row.get("wrong_answer_2", "").strip() or None,
                        row.get("wrong_answer_3", "").strip() or None,
                    ),
                )
                inserted += 1

        conn.commit()

    return inserted, skipped


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import questions from CSV into the jDuel SQLite database."
    )
    parser.add_argument("csv_path", type=Path, help="Path to the questions CSV file")
    parser.add_argument(
        "--db-path",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Path to the SQLite database file (default: {DEFAULT_DB_PATH})",
    )
    args = parser.parse_args()

    csv_path: Path = args.csv_path
    db_path: Path = args.db_path

    if not csv_path.exists():
        print(f"Error: CSV file not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    db_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Importing from {csv_path} into {db_path}...")
    inserted, skipped = import_questions(csv_path, db_path)

    if inserted == 0:
        print(
            f"Error: 0 rows imported. Check that the CSV has the required columns "
            f"(rewritten_question, correct_answer). Skipped {skipped} malformed rows.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Imported {inserted} questions from {csv_path.name}")
    if skipped:
        print(f"Skipped {skipped} rows with missing question or answer")


if __name__ == "__main__":
    main()
