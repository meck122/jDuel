"""Game orchestrator for coordinating game flow and WebSocket communication."""

import contextlib
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.config import GAME_OVER_TIME_MS, QUESTION_TIME_MS, RESULTS_TIME_MS
from app.services.game_service import GameService
from app.services.room_manager import RoomManager
from app.services.state_builder import StateBuilder
from app.services.timer_service import TimerService

logger = logging.getLogger(__name__)

# Initialize services at module level (singletons)
room_manager = RoomManager()
game_service = GameService()
timer_service = TimerService()
state_builder = StateBuilder()

async def orchestrate_game_session(ws: WebSocket) -> None:
    """WebSocket endpoint for real-time game communication."""
    await ws.accept()

    current_room_id = None
    current_player_id = None

    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")

            if msg_type == "JOIN_ROOM":
                room_id = message["roomId"]
                player_id = message["playerId"]

                current_room_id = room_id
                current_player_id = player_id

                room_manager.add_player(room_id, player_id, ws)
                await _broadcast_room_state(room_id)

            elif msg_type == "START_GAME":
                if current_room_id:
                    room = room_manager.get_room(current_room_id)
                    if room:
                        game_service.start_game(room)
                        player_list = list(room.players.keys())
                        logger.info(
                            f"Game started: room_id={current_room_id}, players={player_list}, "
                            f"total_questions={len(room.questions)}"
                        )

                        await _broadcast_room_state(current_room_id)

                        # Start question timer
                        timer_service.start_question_timer(
                            current_room_id,
                            QUESTION_TIME_MS,
                            lambda rid=current_room_id: _on_question_timeout(rid),
                        )

            elif msg_type == "ANSWER":
                if current_room_id and current_player_id:
                    answer = message["answer"]
                    room = room_manager.get_room(current_room_id)

                    if room:
                        game_service.process_answer(room, current_player_id, answer)
                        await _broadcast_room_state(current_room_id)

                        # Check if all players have answered
                        if (
                            room.status.value == "playing"
                            and game_service.can_advance_to_results(room)
                        ):
                            # Cancel the question timer since all players answered
                            timer_service.cancel_all_room_timers(current_room_id)

                            # All players answered, advance to results immediately
                            await _transition_to_results(current_room_id)

    except WebSocketDisconnect:
        if current_room_id and current_player_id:
            logger.info(
                f"WebSocket disconnected: room_id={current_room_id}, player_id={current_player_id}"
            )
            room_manager.remove_player(current_room_id, current_player_id)
            if room_manager.get_room(current_room_id):
                await _broadcast_room_state(current_room_id)
            else:
                # Room was deleted, cancel all timers for this room
                timer_service.cancel_all_room_timers(current_room_id)

async def _broadcast_room_state(room_id: str) -> None:
    """Build and broadcast current room state."""
    room = room_manager.get_room(room_id)
    if room:
        state = state_builder.build_room_state(room)
        await room_manager.broadcast_state(room_id, state)


async def _transition_to_results(room_id: str) -> None:
    """Transition to results screen and start results timer."""
    room = room_manager.get_room(room_id)
    if room:
        game_service.show_results(room)
        await _broadcast_room_state(room_id)

        # Start results timer
        timer_service.start_results_timer(
            room_id,
            RESULTS_TIME_MS,
            lambda: _on_results_timeout(room_id),
        )

async def _on_question_timeout(room_id: str) -> None:
    """Handle question timeout - show results screen."""
    room = room_manager.get_room(room_id)
    if room and room.status.value == "playing":
        await _transition_to_results(room_id)


async def _on_results_timeout(room_id: str) -> None:
    """Handle results timeout - advance to next question or end game."""
    room = room_manager.get_room(room_id)
    if room and room.status.value == "results":
        has_next = game_service.advance_question(room)

        if has_next:
            logger.info(
                f"Advancing to question {room.question_index + 1}: room_id={room_id}"
            )
        else:
            winner = game_service.get_winner(room)
            logger.info(
                f"Game finished: room_id={room_id}, winner={winner}, final_scores={dict(room.scores)}"
            )

        await _broadcast_room_state(room_id)

        if has_next:
            # Start next question timer
            timer_service.start_question_timer(
                room_id,
                QUESTION_TIME_MS,
                lambda: _on_question_timeout(room_id),
            )
        else:
            # Game is finished, start game over timer
            timer_service.start_game_over_timer(
                room_id,
                GAME_OVER_TIME_MS,
                lambda: _on_game_over_timeout(room_id),
            )

async def _on_game_over_timeout(room_id: str) -> None:
    """Handle game over timeout - close room and disconnect players."""
    room = room_manager.get_room(room_id)
    if room:
        # Broadcast room closed message to all players
        for _player_id, ws in list(room.players.items()):
            with contextlib.suppress(Exception):
                await ws.send_json({"type": "ROOM_CLOSED"})

        # Clean up all players and close the room
        for player_id in list(room.players.keys()):
            room_manager.remove_player(room_id, player_id)

        logger.info(f"Auto-closing room after game over timeout: room_id={room_id}")

        # Cancel any remaining timers for this room
        timer_service.cancel_all_room_timers(room_id)
