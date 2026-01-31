"""Database operations for questions."""

import sqlite3
from pathlib import Path

from app.models.question import Question

# Database path is now relative to location of this file
DATABASE_PATH = Path(__file__).parent / "questions.db"


def init_database():
    """Initialize the SQLite database with questions table."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    cursor.execute("""
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
    """)

    conn.commit()
    conn.close()


def get_random_questions(count: int = 10) -> list[Question]:
    """Get random questions from the database.

    Args:
        count: Number of questions to retrieve

    Returns:
        List of typed Question objects
    """
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT question, answer, category, wrong_answer_1, wrong_answer_2, wrong_answer_3
        FROM questions
        ORDER BY RANDOM()
        LIMIT ?
    """,
        (count,),
    )

    questions = [
        Question(
            text=row[0],
            answer=row[1],
            category=row[2],
            wrong_answers=(row[3], row[4], row[5])
            if row[3] and row[4] and row[5]
            else None,
        )
        for row in cursor.fetchall()
    ]

    conn.close()
    return questions
