"""Game orchestrator for coordinating game flow."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import WebSocket

from app.config import (
    DIFFICULTY_RANGES,
    GAME_OVER_TIME_MS,
    QUESTION_TIME_MS,
    RESULTS_TIME_MS,
)
from app.models import GameStatus, RoomStateMessage
from app.services.orchestration.protocols import RoomCloser
from app.services.orchestration.state_builder import StateBuilder

if TYPE_CHECKING:
    from app.services.core import GameService, RoomManager, TimerService

logger = logging.getLogger(__name__)


class GameOrchestrator:
    """Coordinates game flow between services.

    This class acts as the central coordinator for game logic, managing
    the interaction between room management, game rules, timers, and
    state broadcasting.

    The join flow is now two-phase:
    1. HTTP: Player registers via POST /api/rooms/{roomId}/join
    2. WebSocket: Player connects and handle_connect() binds the connection
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

    async def handle_connect(
        self, room_id: str, player_id: str, websocket: WebSocket
    ) -> bool:
        """Handle WebSocket connection for a pre-registered player.

        This is the second phase of the join flow. The player must have
        already registered via HTTP POST /api/rooms/{roomId}/join.

        Args:
            room_id: The room to connect to
            player_id: The player's identifier (must be pre-registered)
            websocket: The player's WebSocket connection

        Returns:
            bool: True if connection was successful
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            logger.warning(
                f"Player tried to connect to non-existent room: "
                f"room_id={room_id}, player_id={player_id}"
            )
            return False

        if player_id not in room.players:
            logger.warning(
                f"Unregistered player tried to connect: "
                f"room_id={room_id}, player_id={player_id}"
            )
            return False

        # Attach the WebSocket connection to the registered player
        success = self._room_manager.attach_connection(room_id, player_id, websocket)
        if success:
            await self._broadcast_room_state(room_id)
        return success

    async def handle_start_game(self, room_id: str, player_id: str) -> None:
        """Handle game start request.

        Only the host can start the game. Questions are loaded at game start
        based on the selected difficulty.

        Args:
            room_id: The room to start
            player_id: The player requesting the start (must be host)
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        # Only the host can start the game
        if player_id != room.host_id:
            logger.warning(
                f"Non-host game start rejected: room_id={room_id}, player_id={player_id}"
            )
            return

        # Load questions based on selected difficulty
        difficulty = room.config.difficulty
        min_diff, max_diff = DIFFICULTY_RANGES.get(difficulty, (1, 2))
        self._room_manager.load_questions_by_difficulty(room_id, min_diff, max_diff)

        # Validate questions loaded successfully
        if not room.questions:
            logger.error(
                f"Game start failed (no questions): room_id={room_id}, difficulty={difficulty}"
            )
            return

        self._game_service.start_game(room)
        player_list = list(room.players)
        logger.info(
            f"Game started: room_id={room_id}, players={player_list}, "
            f"difficulty={difficulty}, total_questions={len(room.questions)}"
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

        # Reject answers when not in playing phase
        if room.status != GameStatus.PLAYING:
            logger.warning(
                f"Answer rejected (wrong phase): room_id={room_id}, "
                f"player_id={player_id}, phase={room.status.value}"
            )
            return

        self._game_service.process_answer(room, player_id, answer)

        if self._game_service.all_players_answered(room):
            self._timer_service.cancel_all_timers_for_room(room_id)
            await self._transition_to_results(room_id)

    async def handle_config_update(
        self, room_id: str, player_id: str, config_data: dict
    ) -> None:
        """Handle a host config update request.

        Only the host can update config, and only while the room is waiting.

        Args:
            room_id: The room ID
            player_id: The player requesting the update
            config_data: Dict of config fields to update
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        if player_id != room.host_id:
            logger.warning(
                f"Non-host config update rejected: room_id={room_id}, player_id={player_id}"
            )
            return

        if room.status.value != "waiting":
            logger.warning(
                f"Config update rejected (game not waiting): room_id={room_id}"
            )
            return

        if "multipleChoiceEnabled" in config_data:
            room.config.multiple_choice_enabled = bool(
                config_data["multipleChoiceEnabled"]
            )

        if "difficulty" in config_data:
            difficulty = config_data["difficulty"]
            if difficulty in DIFFICULTY_RANGES:
                room.config.difficulty = difficulty
            else:
                logger.warning(
                    f"Invalid difficulty rejected: room_id={room_id}, difficulty={difficulty}"
                )

        logger.info(
            f"Config updated: room_id={room_id}, "
            f"multiple_choice={room.config.multiple_choice_enabled}, "
            f"difficulty={room.config.difficulty}"
        )
        await self._broadcast_room_state(room_id)

    async def handle_disconnect(self, room_id: str, player_id: str) -> None:
        """Handle player disconnect.

        Players are kept registered to allow reconnection (e.g., page refresh).
        We only detach the WebSocket connection. If all players disconnect,
        the room will be cleaned up including canceling any active timers.

        Args:
            room_id: The room the player was in
            player_id: The disconnected player's ID
        """
        logger.info(f"WebSocket disconnected: room_id={room_id}, player_id={player_id}")
        room = self._room_manager.get_room(room_id)

        if not room:
            return

        # Detach WebSocket but keep player registered (allows reconnection)
        self._room_manager.detach_connection(room_id, player_id)

        # If no players have active connections, clean up the room entirely
        if not room.connections:
            logger.info(f"No active connections in room {room_id}, cleaning up room")
            # Cancel all timers for this room (stops game progression)
            self._timer_service.cancel_all_timers_for_room(room_id)
            # Delete the room entirely
            self._room_manager.delete_room(room_id)
            return

        # Broadcast updated state to remaining players
        await self._broadcast_room_state(room_id)

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
