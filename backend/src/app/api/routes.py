"""HTTP REST API routes for room management."""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import Services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["rooms"])


# Request/Response Models
class CreateRoomResponse(BaseModel):
    """Response for room creation."""

    roomId: str
    status: str
    playerCount: int


class JoinRoomRequest(BaseModel):
    """Request to join a room."""

    playerId: str = Field(..., min_length=1, max_length=20)


class JoinRoomResponse(BaseModel):
    """Response for successful join."""

    roomId: str
    playerId: str
    status: str


class ErrorResponse(BaseModel):
    """Error response."""

    error: str
    code: Literal["ROOM_NOT_FOUND", "NAME_TAKEN", "GAME_STARTED", "VALIDATION_ERROR"]


@router.post("/rooms", response_model=CreateRoomResponse)
def create_room(services: Services) -> CreateRoomResponse:
    """Create a new game room.

    Args:
        services: Injected service container

    Returns:
        CreateRoomResponse: The created room's ID, status, and player count
    """
    room = services.room_manager.create_room()

    logger.info(f"Room created via HTTP: room_id={room.room_id}")

    return CreateRoomResponse(
        roomId=room.room_id,
        status=room.status.value,
        playerCount=0,
    )


@router.post("/rooms/{room_id}/join", response_model=JoinRoomResponse)
def join_room(
    room_id: str, request: JoinRoomRequest, services: Services
) -> JoinRoomResponse:
    """Pre-register a player to join a room.

    This validates and reserves the player name before WebSocket connection.
    The player must then connect via WebSocket to complete the join.

    Reconnection is allowed if a player with the same name exists but is
    currently disconnected (e.g., after a page refresh). If the player is
    actively connected, the request is rejected to prevent hijacking.

    Args:
        room_id: The room ID to join
        request: The join request containing playerId
        services: Injected service container

    Returns:
        JoinRoomResponse: Confirmation of successful registration

    Raises:
        HTTPException: 404 if room not found, 409 if name taken or game started
    """
    room_id_upper = room_id.upper()
    room = services.room_manager.get_room(room_id_upper)

    if not room:
        raise HTTPException(
            status_code=404,
            detail={"error": "Room not found", "code": "ROOM_NOT_FOUND"},
        )

    # Check if game already started for NEW players
    # Allow reconnection for existing players even if game started
    is_existing_player = request.playerId in room.players
    if room.status.value != "waiting" and not is_existing_player:
        raise HTTPException(
            status_code=409,
            detail={"error": "Game has already started", "code": "GAME_STARTED"},
        )

    # Check if player name already exists
    if request.playerId in room.players:
        # Check if player is currently connected (has active WebSocket)
        if request.playerId in room.connections:
            # Player is actively connected - reject to prevent hijacking
            logger.warning(
                f"NAME_TAKEN: player_id={request.playerId}, "
                f"all_connections={list(room.connections.keys())}, "
                f"all_players={list(room.players)}"
            )
            raise HTTPException(
                status_code=409,
                detail={
                    "error": f"Name '{request.playerId}' is already taken",
                    "code": "NAME_TAKEN",
                },
            )
        else:
            # Player exists but disconnected - allow reconnection
            logger.info(
                f"Player reconnecting (was disconnected): room_id={room_id_upper}, player_id={request.playerId}"
            )
            return JoinRoomResponse(
                roomId=room_id_upper,
                playerId=request.playerId,
                status=room.status.value,
            )

    # Pre-register the player (without WebSocket connection)
    services.room_manager.register_player(room_id_upper, request.playerId)

    logger.info(
        f"Player pre-registered via HTTP: room_id={room_id_upper}, player_id={request.playerId}"
    )

    return JoinRoomResponse(
        roomId=room_id_upper,
        playerId=request.playerId,
        status=room.status.value,
    )
