"""HTTP REST API routes for room management."""

import logging
import re
import secrets
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field, field_validator

from app.api.dependencies import RateLimitRoomCreate, RateLimitRoomJoin, Services
from app.config import ROOM_ID_PATTERN

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["rooms"])


# Request/Response Models
class CreateRoomResponse(BaseModel):
    """Response for room creation."""

    roomId: str
    status: str
    playerCount: int


# Characters that are not allowed in player names
_ZERO_WIDTH_CHARS = frozenset(["\u200b", "\u200c", "\u200d", "\ufeff"])
_HTML_PATTERNS = re.compile(r"<|>|script|javascript", re.IGNORECASE)


class JoinRoomRequest(BaseModel):
    """Request to join a room."""

    playerId: str = Field(..., min_length=1, max_length=20)
    sessionToken: str | None = Field(
        default=None, description="Session token for reconnection"
    )

    @field_validator("playerId")
    @classmethod
    def validate_player_id(cls, v: str) -> str:
        """Validate player name for security.

        Rejects:
        - Control characters (ord < 32)
        - Zero-width characters (U+200B, U+200C, U+200D, U+FEFF)
        - HTML-like patterns (<, >, script, javascript)
        """
        # Check for control characters
        if any(ord(c) < 32 for c in v):
            raise ValueError("Player name contains invalid control characters")

        # Check for zero-width characters
        if any(c in _ZERO_WIDTH_CHARS for c in v):
            raise ValueError("Player name contains invisible characters")

        # Check for HTML-like patterns
        if _HTML_PATTERNS.search(v):
            raise ValueError("Player name contains invalid characters")

        # Ensure name is not just whitespace
        if not v.strip():
            raise ValueError("Player name cannot be empty or whitespace only")

        return v.strip()


class JoinRoomResponse(BaseModel):
    """Response for successful join."""

    roomId: str
    playerId: str
    status: str
    sessionToken: str = Field(..., description="Token required for reconnection")


class ErrorResponse(BaseModel):
    """Error response."""

    error: str
    code: Literal[
        "ROOM_NOT_FOUND",
        "NAME_TAKEN",
        "GAME_STARTED",
        "VALIDATION_ERROR",
        "INVALID_SESSION",
    ]


# Room ID path parameter with validation
RoomIdPath = Annotated[
    str,
    Path(
        pattern=ROOM_ID_PATTERN,
        description="4-6 character alphanumeric room code",
        examples=["AB3D", "XYZ123"],
    ),
]


@router.post("/rooms", response_model=CreateRoomResponse)
def create_room(
    services: Services, _rate_limit: RateLimitRoomCreate
) -> CreateRoomResponse:
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
    room_id: RoomIdPath,
    request: JoinRoomRequest,
    services: Services,
    _rate_limit: RateLimitRoomJoin,
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

        # Player exists but disconnected - verify session token for reconnection
        stored_token = room.session_tokens.get(request.playerId)

        # If a token exists, require it to match for security
        if stored_token and request.sessionToken != stored_token:
            logger.warning(
                f"Session token mismatch for reconnection: "
                f"room_id={room_id_upper}, player_id={request.playerId}"
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Invalid session token for reconnection",
                    "code": "INVALID_SESSION",
                },
            )

        # Generate token if not already stored (backward compatibility)
        if not stored_token:
            stored_token = secrets.token_urlsafe(32)
            room.session_tokens[request.playerId] = stored_token

        # Valid reconnection - return token
        logger.info(
            f"Player reconnecting (was disconnected): "
            f"room_id={room_id_upper}, player_id={request.playerId}"
        )
        return JoinRoomResponse(
            roomId=room_id_upper,
            playerId=request.playerId,
            status=room.status.value,
            sessionToken=stored_token,
        )

    # Generate session token for new player
    session_token = secrets.token_urlsafe(32)

    # Pre-register the player (without WebSocket connection)
    services.room_manager.register_player(room_id_upper, request.playerId)

    # Store session token
    room.session_tokens[request.playerId] = session_token

    logger.info(
        f"Player pre-registered via HTTP: room_id={room_id_upper}, player_id={request.playerId}"
    )

    return JoinRoomResponse(
        roomId=room_id_upper,
        playerId=request.playerId,
        status=room.status.value,
        sessionToken=session_token,
    )
