"""Pydantic round-trip tests for Speed Battle wire models."""

import pytest
from pydantic import ValidationError

from app.models.state import (
    RoomStateData,
    SpeedBattleLeaderRow,
    SpeedBattlePlayerState,
    SpeedBattleStateData,
)
from app.models.websocket_messages import AnswerMessage


class TestSpeedBattleStateData:
    def test_mid_round_state_no_leaderboard(self):
        """Mid-round state round-trips without leaderboard."""
        player_state = SpeedBattlePlayerState(
            questionIndex=5,
            correctCount=5,
            wrongCount=0,
            exhausted=False,
        )
        state = SpeedBattleStateData(matchRemainingMs=120_000, playerState=player_state)
        dumped = state.model_dump(exclude_none=True)
        assert dumped["matchRemainingMs"] == 120_000
        assert dumped["playerState"]["questionIndex"] == 5
        assert "leaderboard" not in dumped
        assert "cooldownRemainingMs" not in dumped["playerState"]
        assert "cooldownCorrectAnswer" not in dumped["playerState"]

    def test_finished_state_with_leaderboard(self):
        """FINISHED state round-trips with full leaderboard."""
        player_state = SpeedBattlePlayerState(
            questionIndex=12, correctCount=12, wrongCount=2, exhausted=False
        )
        leaderboard = [
            SpeedBattleLeaderRow(
                playerId="Alice", correctCount=12, wrongCount=2, placement=1
            )
        ]
        state = SpeedBattleStateData(
            matchRemainingMs=0, playerState=player_state, leaderboard=leaderboard
        )
        dumped = state.model_dump(exclude_none=True)
        assert dumped["matchRemainingMs"] == 0
        assert len(dumped["leaderboard"]) == 1
        assert dumped["leaderboard"][0]["playerId"] == "Alice"
        assert dumped["leaderboard"][0]["placement"] == 1

    def test_room_state_data_with_speed_battle_block(self):
        """RoomStateData round-trips with speedBattle field."""
        player_state = SpeedBattlePlayerState(
            questionIndex=3, correctCount=3, wrongCount=1, exhausted=False
        )
        speed_battle = SpeedBattleStateData(
            matchRemainingMs=60_000, playerState=player_state
        )
        state = RoomStateData(
            roomId="ABCD",
            players={},
            status="playing",
            questionIndex=0,
            speedBattle=speed_battle,
        )
        dumped = state.model_dump(exclude_none=True)
        assert "speedBattle" in dumped
        assert dumped["speedBattle"]["matchRemainingMs"] == 60_000

    def test_room_state_data_without_speed_battle_is_invisible(self):
        """Classic RoomStateData has no speedBattle in serialized output."""
        state = RoomStateData(
            roomId="ABCD",
            players={},
            status="waiting",
            questionIndex=0,
        )
        dumped = state.model_dump(exclude_none=True)
        assert "speedBattle" not in dumped

    def test_cooldown_fields_round_trip(self):
        """Cooldown reveal fields serialize when set."""
        player_state = SpeedBattlePlayerState(
            questionIndex=3,
            correctCount=2,
            wrongCount=1,
            cooldownRemainingMs=3000,
            cooldownCorrectAnswer="Paris",
            exhausted=False,
        )
        dumped = player_state.model_dump(exclude_none=True)
        assert dumped["cooldownRemainingMs"] == 3000
        assert dumped["cooldownCorrectAnswer"] == "Paris"


class TestAnswerMessage:
    def test_with_question_index(self):
        """AnswerMessage with questionIndex constructs and validates."""
        msg = AnswerMessage(type="ANSWER", answer="Paris", questionIndex=7)
        assert msg.questionIndex == 7

    def test_without_question_index_defaults_none(self):
        """Classic AnswerMessage without questionIndex has None."""
        msg = AnswerMessage(type="ANSWER", answer="Paris")
        assert msg.questionIndex is None

    def test_negative_question_index_rejected(self):
        """Negative questionIndex fails validation at wire layer (ge=0 guard)."""
        with pytest.raises(ValidationError):
            AnswerMessage(type="ANSWER", answer="Paris", questionIndex=-1)
