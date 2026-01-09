"""Room manager for handling game rooms and state."""

import logging
from datetime import UTC, datetime

from fastapi import WebSocket

from app.config import (
    GAME_OVER_TIME_MS,
    MAX_SCORE_PER_QUESTION,
    QUESTION_TIME_MS,
    RESULTS_TIME_MS,
)
from app.db import get_random_questions
from app.models import GameStatus, Room


class RoomManager:
    """Manages all game rooms and their state."""

    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.logger = logging.getLogger(__name__)

    def create_or_get_room(self, room_id: str) -> Room:
        """Create a new room or return existing one."""
        if room_id not in self.rooms:
            # Get random questions from database
            questions = get_random_questions(count=10)
            self.rooms[room_id] = Room(room_id, questions)
            self.logger.info(f"Room created: room_id={room_id}")
        return self.rooms[room_id]

    def add_player(self, room_id: str, player_id: str, websocket: WebSocket):
        """Add a player to a room."""
        room = self.create_or_get_room(room_id)
        room.players[player_id] = websocket
        room.scores[player_id] = 0
        self.logger.info(
            f"Player joined: room_id={room_id}, player_id={player_id}, total_players={len(room.players)}"
        )

    def remove_player(self, room_id: str, player_id: str):
        """Remove a player from a room and clean up empty rooms."""
        if room_id not in self.rooms:
            return

        room = self.rooms[room_id]
        if player_id in room.players:
            del room.players[player_id]
        if player_id in room.scores:
            del room.scores[player_id]

        self.logger.info(
            f"Player left: room_id={room_id}, player_id={player_id}, remaining_players={len(room.players)}"
        )

        # Clean up empty rooms
        if not room.players:
            self.logger.info(f"Room deleted (empty): room_id={room_id}")
            del self.rooms[room_id]

    def start_game(self, room_id: str):
        """Start the game for a room."""
        room = self.rooms[room_id]
        room.status = GameStatus.PLAYING
        room.question_index = 0
        room.question_start_time = datetime.now(UTC)
        room.answered_players = set()
        room.player_answers = {}

        # Reset all scores
        for player_id in room.scores:
            room.scores[player_id] = 0

        player_list = list(room.players.keys())
        self.logger.info(
            f"Game started: room_id={room_id}, players={player_list}, total_questions={len(room.questions)}"
        )

    def submit_answer(self, room_id: str, player_id: str, answer: str) -> bool:
        """Submit an answer for a player.
        Returns True if answer is correct, False otherwise.
        """
        room = self.rooms[room_id]

        # Prevent duplicate answers
        if player_id in room.answered_players:
            return False

        room.answered_players.add(player_id)
        room.player_answers[player_id] = answer

        current_question = room.questions[room.question_index]
        correct = answer.strip().lower() == current_question["answer"].strip().lower()

        if correct:
            # Calculate time on server side for security
            elapsed = (
                datetime.now(UTC) - room.question_start_time
            ).total_seconds() * 1000
            time_ms = int(elapsed)

            # Validate time is within bounds
            if time_ms <= QUESTION_TIME_MS:
                # Score based on speed: max points, decreases with time
                speed_bonus = max(0, MAX_SCORE_PER_QUESTION - (time_ms // 10))
                room.scores[player_id] += speed_bonus

        return correct

    def show_results(self, room_id: str):
        """Show results for the current question."""
        room = self.rooms[room_id]
        room.status = GameStatus.RESULTS
        room.results_start_time = datetime.now(UTC)

    def next_question(self, room_id: str) -> bool:
        """Move to the next question.
        Returns True if there is a next question, False if game is finished.
        """
        room = self.rooms[room_id]
        room.question_index += 1
        room.answered_players = set()
        room.player_answers = {}

        if room.question_index >= len(room.questions):
            room.status = GameStatus.FINISHED
            room.finish_time = datetime.now(UTC)
            winner = (
                max(room.scores.items(), key=lambda x: x[1])[0] if room.scores else None
            )
            self.logger.info(
                f"Game finished: room_id={room_id}, winner={winner}, final_scores={dict(room.scores)}"
            )
            return False

        room.status = GameStatus.PLAYING
        room.question_start_time = datetime.now(UTC)
        return True

    def get_room_state(self, room_id: str) -> dict:
        """Get the current state of a room for broadcasting to clients."""
        room = self.rooms[room_id]

        state = {  # TODO: should this be a proper typed object?
            "type": "ROOM_STATE",
            "roomState": {
                "players": room.scores,
                "status": room.status.value,
                "questionIndex": room.question_index,
            },
        }

        if room.status == GameStatus.PLAYING:
            current_question = room.questions[room.question_index]
            elapsed = (
                datetime.now(UTC) - room.question_start_time
            ).total_seconds() * 1000
            time_remaining = max(0, QUESTION_TIME_MS - int(elapsed))

            state["roomState"]["currentQuestion"] = {
                "text": current_question["text"],
                "category": current_question["category"],
            }
            state["roomState"]["timeRemainingMs"] = time_remaining
        elif room.status == GameStatus.RESULTS:
            # Show results from previous question
            previous_question = room.questions[room.question_index]
            elapsed = (
                datetime.now(UTC) - room.results_start_time
            ).total_seconds() * 1000
            time_remaining = max(0, RESULTS_TIME_MS - int(elapsed))

            state["roomState"]["results"] = {
                "correctAnswer": previous_question["answer"],
                "playerAnswers": room.player_answers,
            }
            state["roomState"]["timeRemainingMs"] = time_remaining
        elif room.status == GameStatus.FINISHED:
            # Show final results
            winner = (
                max(room.scores.items(), key=lambda x: x[1])[0] if room.scores else None
            )
            state["roomState"]["winner"] = winner

            # Include time until room closes if we have a finish time
            if hasattr(room, "finish_time") and room.finish_time:
                elapsed = (datetime.now(UTC) - room.finish_time).total_seconds() * 1000
                time_remaining = max(0, GAME_OVER_TIME_MS - int(elapsed))
                state["roomState"]["timeRemainingMs"] = time_remaining

        return state

    async def broadcast_state(self, room_id: str):
        """Broadcast the current room state to all connected players."""
        if room_id not in self.rooms:
            return

        room = self.rooms[room_id]
        state = self.get_room_state(room_id)

        disconnected = []
        for player_id, ws in room.players.items():
            try:
                await ws.send_json(state)
            except Exception as e:
                self.logger.warning(
                    f"Failed to broadcast to player: room_id={room_id}, player_id={player_id}, error={e!s}"
                )
                disconnected.append(player_id)

        # Clean up disconnected players
        for player_id in disconnected:
            self.remove_player(room_id, player_id)
