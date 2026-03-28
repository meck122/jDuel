"""Game orchestrator for coordinating game flow."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fastapi import WebSocket

from app.config import (
    DIFFICULTY_RANGES,
    GAME_OVER_TIME_MS,
    QUESTION_TIME_MS,
    REACTION_COOLDOWN_MS,
    REACTIONS,
    RESULTS_TIME_MS,
)
from app.models import GameStatus
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

    All state-mutating methods acquire a per-room asyncio.Lock before
    modifying room state, then build a state snapshot inside the lock
    and broadcast it after releasing the lock. This prevents:
    - Interleaved coroutines corrupting room state
    - Slow WebSocket sends from blocking room mutations

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

        state_snapshot = None
        async with room.lock:
            if player_id not in room.players:
                logger.warning(
                    f"Unregistered player tried to connect: "
                    f"room_id={room_id}, player_id={player_id}"
                )
                return False

            success = self._room_manager.attach_connection(
                room_id, player_id, websocket
            )
            if success:
                state_snapshot = self._state_builder.build_room_state(room)

        if state_snapshot:
            await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())
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

        state_snapshot = None
        async with room.lock:
            if player_id != room.host_id:
                logger.warning(
                    f"Non-host game start rejected: room_id={room_id}, "
                    f"player_id={player_id}"
                )
                return

            difficulty = room.config.difficulty
            min_diff, max_diff = DIFFICULTY_RANGES.get(difficulty, (1, 2))
            self._room_manager.load_questions_by_difficulty(room_id, min_diff, max_diff)

            if not room.questions:
                logger.error(
                    f"Game start failed (no questions): room_id={room_id}, "
                    f"difficulty={difficulty}"
                )
                return

            self._game_service.start_game(room)
            player_list = list(room.players)
            logger.info(
                f"Game started: room_id={room_id}, players={player_list}, "
                f"difficulty={difficulty}, total_questions={len(room.questions)}"
            )

            state_snapshot = self._state_builder.build_room_state(room)
            self._start_question_timer(room_id)

        if state_snapshot:
            await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())

    async def handle_play_again(self, room_id: str, player_id: str) -> None:
        """Handle play again request — reset room to lobby.

        Only the host can trigger this, and only when the game is finished.
        Cancels the game-over timer, prunes disconnected players, resets
        game state, and broadcasts the fresh lobby state.

        Args:
            room_id: The room to reset
            player_id: The player requesting play again (must be host)
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        state_snapshot = None
        async with room.lock:
            if player_id != room.host_id:
                logger.warning(
                    f"Non-host play again rejected: room_id={room_id}, "
                    f"player_id={player_id}"
                )
                return

            if room.status != GameStatus.FINISHED:
                logger.warning(
                    f"Play again in wrong state: room_id={room_id}, "
                    f"status={room.status.value}"
                )
                return

            # Cancel game-over timer FIRST (prevents room deletion race)
            self._timer_service.cancel_all_timers_for_room(room_id)

            # Prune disconnected players (connection-layer concern)
            connected_ids = set(room.connections.keys())
            room.players = {pid for pid in room.players if pid in connected_ids}
            room.scores = {
                pid: score for pid, score in room.scores.items() if pid in connected_ids
            }
            room.session_tokens = {
                pid: token
                for pid, token in room.session_tokens.items()
                if pid in connected_ids
            }

            # Reset game state (pure game-rules concern)
            self._game_service.reset_game_state(room)

            logger.info(f"Play again: room_id={room_id}, resetting to lobby")
            state_snapshot = self._state_builder.build_room_state(room)

        if state_snapshot:
            await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())

    async def handle_answer(
        self,
        room_id: str,
        player_id: str,
        answer: str,
        answer_time: datetime | None = None,
    ) -> None:
        """Handle player answer submission.

        Args:
            room_id: The room ID
            player_id: The answering player's ID
            answer: The submitted answer
            answer_time: When the answer was received (before lock acquisition)
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        state_snapshot = None
        async with room.lock:
            if room.status != GameStatus.PLAYING:
                logger.warning(
                    f"Answer rejected (wrong phase): room_id={room_id}, "
                    f"player_id={player_id}, phase={room.status.value}"
                )
                return

            await self._game_service.process_answer(
                room, player_id, answer, answer_time
            )

            if self._game_service.all_players_answered(room):
                self._timer_service.cancel_all_timers_for_room(room_id)
                # Inline _transition_to_results to avoid re-entrant lock
                self._game_service.show_results(room)
                self._start_results_timer(room_id)

            state_snapshot = self._state_builder.build_room_state(room)

        if state_snapshot:
            await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())

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

        state_snapshot = None
        async with room.lock:
            if player_id != room.host_id:
                logger.warning(
                    f"Non-host config update rejected: room_id={room_id}, "
                    f"player_id={player_id}"
                )
                return

            if room.status.value != "waiting":
                logger.warning(
                    f"Config update rejected (game not waiting): " f"room_id={room_id}"
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
                        f"Invalid difficulty rejected: room_id={room_id}, "
                        f"difficulty={difficulty}"
                    )

            logger.info(
                f"Config updated: room_id={room_id}, "
                f"multiple_choice={room.config.multiple_choice_enabled}, "
                f"difficulty={room.config.difficulty}"
            )
            state_snapshot = self._state_builder.build_room_state(room)

        if state_snapshot:
            await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())

    async def handle_reaction(
        self, room_id: str, player_id: str, reaction_id: int
    ) -> None:
        """Handle a player reaction during playing or results phase.

        Validates phase, reaction_id, and per-player cooldown. On success,
        broadcasts a lightweight REACTION message directly to all connections.

        Args:
            room_id: The room ID
            player_id: The reacting player's ID
            reaction_id: Index into the REACTIONS list
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        reaction_broadcast = None
        async with room.lock:
            if room.status not in (GameStatus.RESULTS, GameStatus.FINISHED):
                return

            if reaction_id < 0 or reaction_id >= len(REACTIONS):
                logger.warning(
                    f"Invalid reaction_id: room_id={room_id}, "
                    f"player_id={player_id}, reaction_id={reaction_id}"
                )
                return

            # Enforce per-player cooldown
            now = datetime.now(UTC)
            last_time = room.last_reaction_times.get(player_id)
            if last_time is not None:
                elapsed_ms = int((now - last_time).total_seconds() * 1000)
                if elapsed_ms < REACTION_COOLDOWN_MS:
                    return  # Silent drop

            room.last_reaction_times[player_id] = now

            reaction_broadcast = {
                "type": "REACTION",
                "playerId": player_id,
                "reactionId": reaction_id,
            }

        if reaction_broadcast:
            await self._room_manager.broadcast_state(room_id, reaction_broadcast)

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

        state_snapshot = None
        async with room.lock:
            # Detach WebSocket but keep player registered (allows reconnection)
            self._room_manager.detach_connection(room_id, player_id)

            # If no players have active connections, clean up the room entirely
            if not room.connections:
                logger.info(
                    f"No active connections in room {room_id}, cleaning up room"
                )
                self._timer_service.cancel_all_timers_for_room(room_id)
                self._room_manager.delete_room(room_id)
                return

            state_snapshot = self._state_builder.build_room_state(room)

        if state_snapshot:
            await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())

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

    async def _on_question_timeout(self, room_id: str) -> None:
        """Handle question timeout."""
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        state_snapshot = None
        async with room.lock:
            if room.status.value != "playing":
                return
            # Inline _transition_to_results to avoid re-entrant lock
            self._game_service.show_results(room)
            self._start_results_timer(room_id)
            state_snapshot = self._state_builder.build_room_state(room)

        if state_snapshot:
            await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())

    async def _on_results_timeout(self, room_id: str) -> None:
        """Handle results timeout."""
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        state_snapshot = None
        async with room.lock:
            if room.status.value != "results":
                return

            has_next = self._game_service.advance_question(room)
            room.last_reaction_times.clear()

            if has_next:
                logger.info(
                    f"Advancing to question {room.question_index + 1}: "
                    f"room_id={room_id}"
                )
                self._start_question_timer(room_id)
            else:
                winner = self._game_service.get_winner(room)
                logger.info(
                    f"Game finished: room_id={room_id}, winner={winner}, "
                    f"final_scores={dict(room.scores)}"
                )
                self._start_game_over_timer(room_id)

            state_snapshot = self._state_builder.build_room_state(room)

        if state_snapshot:
            await self._room_manager.broadcast_state(room_id, state_snapshot.to_dict())

    async def _on_game_over_timeout(self, room_id: str) -> None:
        """Handle game over timeout - close the room.

        Note: close_room does its own room lookup, WebSocket sends, and
        deletion. The lock is acquired here to prevent races with other
        methods (e.g., handle_disconnect) that might also delete the room.
        """
        room = self._room_manager.get_room(room_id)
        if not room:
            return

        async with room.lock:
            await self._room_closer.close_room(room_id)
