"""Game orchestrator for coordinating game flow."""

import logging
from typing import Protocol

from fastapi import WebSocket

from app.config import GAME_OVER_TIME_MS, QUESTION_TIME_MS, RESULTS_TIME_MS
from app.models import Room, RoomStateMessage
from app.services.game_service import GameService
from app.services.room_manager import RoomManager
from app.services.state_builder import StateBuilder
from app.services.timer_service import TimerService

logger = logging.getLogger(__name__)


class RoomCloser(Protocol):
    """Protocol for closing rooms and notifying clients."""

    async def close_room(self, room_id: str) -> None:
        """Close room and notify all connected clients."""
        ...


class GameOrchestrator:
    """Coordinates game flow between services.

    This class acts as the central coordinator for game logic, managing
    the interaction between room management, game rules, timers, and
    state broadcasting.
    """

    def __init__(
        self,
        room_manager: RoomManager,
        game_service: GameService,
        timer_service: TimerService,
        state_builder: StateBuilder,
        room_closer: RoomCloser,
    ):
        self._room_manager = room_manager
        self._game_service = game_service
        self._timer_service = timer_service
        self._state_builder = state_builder
        self._room_closer = room_closer

    async def handle_create_room(
        self, player_id: int, websocket: WebSocket
    ) -> tuple[str, str]:
        """Handle creating a room and player joining the new room

        Args:
            player_id: The player's identifier
            websocket: The player's WebSocket connection

        Returns:
            tuple: (room_id, player_id) - The room ID and player's unique identifier
        """
        room: Room = self._room_manager.create_room()
        await self.handle_join(room.room_id, player_id, websocket)
        return room.room_id, player_id

    async def handle_join(
        self, room_id: str, player_id: str, websocket: WebSocket
    ) -> bool:
        """Handle player joining a room.

        Args:
            room_id: The room to join
            player_id: The player's identifier
            websocket: The player's WebSocket connection

        Returns:
            bool: True if join was successful, False if room doesn't exist
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            logger.warning(
                f"Player tried to join non-existent room: room_id={room_id}, player_id={player_id}"
            )
            await websocket.send_json(
                {"type": "ERROR", "message": f"Room {room_id} does not exist"}
            )
            return False

        # Check if player name already exists in the room
        if player_id in room.players:
            logger.warning(
                f"Player tried to join with duplicate name: room_id={room_id}, player_id={player_id}"
            )
            await websocket.send_json(
                {
                    "type": "ERROR",
                    "message": f"Name '{player_id}' is already taken in this room",
                }
            )
            return False

        self._room_manager.add_player(room_id, player_id, websocket)
        await self._broadcast_room_state(room_id)
        return True

    async def handle_start_game(self, room_id: str) -> None:
        """Handle game start request.

        Args:
            room_id: The room to start
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        self._game_service.start_game(room)
        player_list = list(room.players.keys())
        logger.info(
            f"Game started: room_id={room_id}, players={player_list}, "
            f"total_questions={len(room.questions)}"
        )

        await self._broadcast_room_state(room_id)
        self._start_question_timer(room_id)

    async def handle_answer(self, room_id: str, player_id: str, answer: str) -> None:
        """Handle player answer submission.

        Args:
            room_id: The room ID
            player_id: The answering player's ID
            answer: The submitted answer
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        self._game_service.process_answer(room, player_id, answer)
        await self._broadcast_room_state(room_id)

        if self._game_service.all_players_answered(room):
            self._timer_service.cancel_all_room_timers(room_id)
            await self._transition_to_results(room_id)

    async def handle_disconnect(self, room_id: str, player_id: str) -> None:
        """Handle player disconnect.

        Args:
            room_id: The room the player was in
            player_id: The disconnected player's ID
        """
        logger.info(f"WebSocket disconnected: room_id={room_id}, player_id={player_id}")
        self._room_manager.remove_player(room_id, player_id)

        if self._room_manager.get_room(room_id):
            await self._broadcast_room_state(room_id)
        else:
            self._timer_service.cancel_all_room_timers(room_id)

    async def _broadcast_room_state(self, room_id: str) -> None:
        """Build and broadcast current room state."""
        room = self._room_manager.get_room(room_id)
        if room:
            state: RoomStateMessage = self._state_builder.build_room_state(room)
            await self._room_manager.broadcast_state(room_id, state.to_dict())

    def _start_question_timer(self, room_id: str) -> None:
        """Start the question timer for a room."""
        self._timer_service.start_question_timer(
            room_id,
            QUESTION_TIME_MS,
            lambda: self._on_question_timeout(room_id),
        )

    def _start_results_timer(self, room_id: str) -> None:
        """Start the results timer for a room."""
        self._timer_service.start_results_timer(
            room_id,
            RESULTS_TIME_MS,
            lambda: self._on_results_timeout(room_id),
        )

    def _start_game_over_timer(self, room_id: str) -> None:
        """Start the game over timer for a room."""
        self._timer_service.start_game_over_timer(
            room_id,
            GAME_OVER_TIME_MS,
            lambda: self._on_game_over_timeout(room_id),
        )

    async def _transition_to_results(self, room_id: str) -> None:
        """Transition to results screen and start results timer."""
        room = self._room_manager.get_room(room_id)
        if room:
            self._game_service.show_results(room)
            self._start_results_timer(room_id)
            await self._broadcast_room_state(room_id)

    async def _on_question_timeout(self, room_id: str) -> None:
        """Handle question timeout."""
        room = self._room_manager.get_room(room_id)
        if room and room.status.value == "playing":
            await self._transition_to_results(room_id)

    async def _on_results_timeout(self, room_id: str) -> None:
        """Handle results timeout."""
        room = self._room_manager.get_room(room_id)
        if not room or room.status.value != "results":
            return

        has_next = self._game_service.advance_question(room)

        if has_next:
            logger.info(
                f"Advancing to question {room.question_index + 1}: room_id={room_id}"
            )
            await self._broadcast_room_state(room_id)
            self._start_question_timer(room_id)
        else:
            winner = self._game_service.get_winner(room)
            logger.info(
                f"Game finished: room_id={room_id}, winner={winner}, "
                f"final_scores={dict(room.scores)}"
            )
            await self._broadcast_room_state(room_id)
            self._start_game_over_timer(room_id)

    async def _on_game_over_timeout(self, room_id: str) -> None:
        """Handle game over timeout - close the room."""
        await self._room_closer.close_room(room_id)
