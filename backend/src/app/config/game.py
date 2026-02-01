"""Game-related configuration constants."""

# Timing configuration (milliseconds)
QUESTION_TIME_MS = 15000  # 15 seconds per question
RESULTS_TIME_MS = 10000  # 10 seconds for results screen
GAME_OVER_TIME_MS = 60000  # 60 seconds before closing room

# Scoring configuration
MAX_SCORE_PER_QUESTION = 1000

# Difficulty tier ranges (min, max) - inclusive
DIFFICULTY_RANGES: dict[str, tuple[int, int]] = {
    "enjoyer": (1, 2),
    "master": (2, 4),
    "beast": (4, 5),
}

# Rate limiting (max requests, window in seconds)
RATE_LIMIT_ROOM_CREATE = (5, 60)  # 5 rooms per minute per IP
RATE_LIMIT_ROOM_JOIN = (10, 60)  # 10 joins per minute per IP
RATE_LIMIT_WS_MESSAGES = (30, 60)  # 30 messages per minute per connection

# Input validation
MAX_ANSWER_LENGTH = 500
MAX_PLAYER_NAME_LENGTH = 20
ROOM_ID_PATTERN = r"^[A-Z0-9]{4,6}$"

# Reactions
REACTION_COOLDOWN_MS = 3000  # 3 seconds between reactions per player
REACTIONS = [
    {"id": 0, "label": "nice try! >:)"},
    {"id": 1, "label": "ah man! :("},
    {"id": 2, "label": "better luck next time :p"},
]
