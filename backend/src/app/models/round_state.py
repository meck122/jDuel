"""State model for a single question round."""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class RoundState:
    """State for a single question round.

    This groups all per-question state that gets reset between questions:
    - question_start_time: When the current question started
    - answered_players: Players who have submitted an answer
    - player_answers: The actual answers submitted by each player
    - correct_players: Players who answered correctly
    - question_points: Points earned by each player this round
    """

    question_start_time: datetime | None = None
    answered_players: set[str] = field(default_factory=set)
    player_answers: dict[str, str] = field(default_factory=dict)
    correct_players: set[str] = field(default_factory=set)
    question_points: dict[str, int] = field(default_factory=dict)

    def reset(self) -> None:
        """Reset round state for the next question."""
        self.question_start_time = None
        self.answered_players = set()
        self.player_answers = {}
        self.correct_players = set()
        self.question_points = {}
