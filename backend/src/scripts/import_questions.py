"""Script to import Jeopardy questions from CSV into SQLite database."""

import pandas as pd
import sqlite3
import re
import sys
from pathlib import Path

# Add parent directory to path to import from app package
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.database import DATABASE_PATH, init_database


def is_valid_answer(answer: str) -> bool:
    """Check if answer is a single word with only letters and numbers."""
    if not answer:
        return False

    # Remove whitespace and check if single word
    cleaned = str(answer).strip()
    if " " in cleaned:
        return False

    # Check if only contains letters and numbers (no apostrophes, hyphens, etc)
    if not re.match(r"^[a-zA-Z0-9]+$", cleaned):
        return False

    return True


def import_jeopardy_questions(csv_path: str):
    """Import Jeopardy questions from CSV, filtering for valid answers."""

    # Read CSV
    df = pd.read_csv(csv_path)

    # Clean column names (remove leading/trailing spaces)
    df.columns = df.columns.str.strip()

    # Filter for valid answers
    df = df[df["Answer"].apply(is_valid_answer)]

    # Initialize database
    init_database()

    # Connect and insert
    conn = sqlite3.connect(DATABASE_PATH)

    # Insert filtered questions
    inserted = 0
    for _, row in df.iterrows():
        try:
            conn.execute(
                """
                INSERT INTO questions 
                (show_number, air_date, round, category, value, question, answer)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    int(row["Show Number"]) if pd.notna(row["Show Number"]) else None,
                    row["Air Date"],
                    row["Round"],
                    row["Category"],
                    row["Value"],
                    row["Question"],
                    str(row["Answer"]).strip(),
                ),
            )
            inserted += 1
        except Exception as e:
            print(f"Error inserting row: {e}")
            continue

    conn.commit()
    conn.close()

    print(f"Successfully imported {inserted} questions")
    print(f"Original dataset had {len(pd.read_csv(csv_path))} questions")
    print(f"Filtered out {len(pd.read_csv(csv_path)) - inserted} questions")


if __name__ == "__main__":
    # Update this path to your CSV file
    csv_path = Path(__file__).parent / "jeopardy_questions.csv"
    if not csv_path.exists():
        print(f"Error: CSV file not found at {csv_path}")
        print("Please place jeopardy_questions.csv in the backend directory")
        sys.exit(1)

    import_jeopardy_questions(str(csv_path))
