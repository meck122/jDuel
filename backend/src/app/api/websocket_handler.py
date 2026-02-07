"""WebSocket handler for game communication."""

import json
import logging

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.middleware.rate_limiter import get_ws_message_limiter
from app.models.websocket_messages import (
    AnswerMessage,
    ReactionMessage,
    StartGameMessage,
    UpdateConfigMessage,
)

logger = logging.getLogger(__name__)


async def handle_websocket(ws: WebSocket, room_id: str, player_id: str) -> None:
    """Handle WebSocket connection for game communication.

    Players must pre-register via HTTP POST /api/rooms/{roomId}/join before
    connecting via WebSocket. The WebSocket connection binds to the registered
    player slot.

    Args:
        ws: The WebSocket connection
        room_id: The room ID to connect to (from query param)
        player_id: The player ID (from query param, must be pre-registered)
    """
    from app.services.container import get_container

    container = get_container()
    orchestrator = container.orchestrator
    room_manager = container.room_manager

    # Validate room and player before accepting connection
    room = room_manager.get_room(room_id)
    if not room:
        await ws.close(code=4004, reason="Room not found")
        return

    if player_id not in room.players:
        await ws.close(code=4003, reason="Player not registered")
        return

    # Check if player is already connected (prevent hijacking)
    if player_id in room.connections:
        await ws.close(code=4009, reason="Player already connected")
        return

    # Accept the WebSocket connection
    await ws.accept()

    # Attach the WebSocket to the registered player
    success = await orchestrator.handle_connect(room_id, player_id, ws)
    if not success:
        await ws.close(code=4000, reason="Failed to connect")
        return

    # Set up rate limiting for this connection
    rate_limiter = get_ws_message_limiter()
    connection_key = f"{room_id}:{player_id}"

    try:
        while True:
            data = await ws.receive_text()

            # Check rate limit before processing
            if not rate_limiter.check(connection_key):
                logger.warning(
                    f"Rate limit exceeded: room_id={room_id}, player_id={player_id}"
                )
                continue

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                logger.warning(
                    f"Invalid JSON received: room_id={room_id}, player_id={player_id}"
                )
                await ws.send_json(
                    {"type": "ERROR", "message": "Invalid message format"}
                )
                continue

            msg_type = message.get("type")

            try:
                if msg_type == "START_GAME":
                    StartGameMessage.model_validate(message)
                    await orchestrator.handle_start_game(room_id, player_id)

                elif msg_type == "ANSWER":
                    validated = AnswerMessage.model_validate(message)
                    await orchestrator.handle_answer(
                        room_id, player_id, validated.answer
                    )

                elif msg_type == "UPDATE_CONFIG":
                    validated = UpdateConfigMessage.model_validate(message)
                    await orchestrator.handle_config_update(
                        room_id, player_id, validated.config
                    )

                elif msg_type == "REACTION":
                    validated = ReactionMessage.model_validate(message)
                    await orchestrator.handle_reaction(
                        room_id, player_id, validated.reactionId
                    )

                else:
                    logger.warning(
                        f"Unknown message type: room_id={room_id}, "
                        f"player_id={player_id}, type={msg_type}"
                    )
                    await ws.send_json(
                        {
                            "type": "ERROR",
                            "message": f"Unknown message type: {msg_type}",
                        }
                    )

            except ValidationError as e:
                logger.warning(
                    f"Message validation failed: room_id={room_id}, "
                    f"player_id={player_id}, error={e.errors()}"
                )
                await ws.send_json(
                    {"type": "ERROR", "message": "Message validation failed"}
                )

    except WebSocketDisconnect:
        rate_limiter.reset(connection_key)
        await orchestrator.handle_disconnect(room_id, player_id)
    except Exception as e:
        logger.error(
            f"WebSocket error: room_id={room_id}, player_id={player_id}, error={e!s}",
            exc_info=True,
        )
        rate_limiter.reset(connection_key)
        await orchestrator.handle_disconnect(room_id, player_id)
