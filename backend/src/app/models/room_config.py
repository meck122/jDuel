"""Room configuration model for host-controlled game settings."""

from dataclasses import dataclass


@dataclass
class RoomConfig:
    """Configuration settings for a game room.

    All settings here are host-only and can only be modified while the room
    is in WAITING status. New host-controlled settings should be added as
    fields on this dataclass — the UPDATE_CONFIG WebSocket message and
    orchestrator validation handle the rest.
    """

    multiple_choice_enabled: bool = False
    difficulty: str = "enjoyer"
