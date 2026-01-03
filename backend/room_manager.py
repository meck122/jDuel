"""Room manager for handling game rooms and state."""

from typing import Dict, Optional
from datetime import datetime
from fastapi import WebSocket

from models import Room, GameStatus
from questions import QUESTIONS
from config import QUESTION_TIME_MS, MAX_SCORE_PER_QUESTION


class RoomManager:
    """Manages all game rooms and their state."""
    
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
    
    def create_or_get_room(self, room_id: str) -> Room:
        """Create a new room or return existing one."""
        if room_id not in self.rooms:
            self.rooms[room_id] = Room(room_id, QUESTIONS)
        return self.rooms[room_id]
    
    def add_player(self, room_id: str, player_id: str, websocket: WebSocket):
        """Add a player to a room."""
        room = self.create_or_get_room(room_id)
        room.players[player_id] = websocket
        room.scores[player_id] = 0
    
    def remove_player(self, room_id: str, player_id: str):
        """Remove a player from a room and clean up empty rooms."""
        if room_id not in self.rooms:
            return
        
        room = self.rooms[room_id]
        if player_id in room.players:
            del room.players[player_id]
        if player_id in room.scores:
            del room.scores[player_id]
        
        # Clean up empty rooms
        if not room.players:
            del self.rooms[room_id]
    
    def start_game(self, room_id: str):
        """Start the game for a room."""
        room = self.rooms[room_id]
        room.status = GameStatus.PLAYING
        room.question_index = 0
        room.question_start_time = datetime.now()
        room.answered_players = set()
        
        # Reset all scores
        for player_id in room.scores:
            room.scores[player_id] = 0
    
    def submit_answer(self, room_id: str, player_id: str, answer: str, time_ms: int) -> bool:
        """
        Submit an answer for a player.
        Returns True if answer is correct, False otherwise.
        """
        room = self.rooms[room_id]
        
        # Prevent duplicate answers
        if player_id in room.answered_players:
            return False
        
        room.answered_players.add(player_id)
        
        current_question = room.questions[room.question_index]
        correct = answer.strip().lower() == current_question["answer"].strip().lower()
        
        if correct:
            # Score based on speed: max points, decreases with time
            speed_bonus = max(0, MAX_SCORE_PER_QUESTION - (time_ms // 10))
            room.scores[player_id] += speed_bonus
        
        return correct
    
    def next_question(self, room_id: str) -> bool:
        """
        Move to the next question.
        Returns True if there is a next question, False if game is finished.
        """
        room = self.rooms[room_id]
        room.question_index += 1
        room.answered_players = set()
        
        if room.question_index >= len(room.questions):
            room.status = GameStatus.FINISHED
            return False
        
        room.question_start_time = datetime.now()
        return True
    
    def get_room_state(self, room_id: str) -> dict:
        """Get the current state of a room for broadcasting to clients."""
        room = self.rooms[room_id]
        
        state = {
            "type": "ROOM_STATE",
            "roomState": {
                "players": room.scores,
                "status": room.status.value,
                "questionIndex": room.question_index
            }
        }
        
        if room.status == GameStatus.PLAYING:
            current_question = room.questions[room.question_index]
            elapsed = (datetime.now() - room.question_start_time).total_seconds() * 1000
            time_remaining = max(0, QUESTION_TIME_MS - int(elapsed))
            
            state["roomState"]["currentQuestion"] = {
                "text": current_question["text"]
            }
            state["roomState"]["timeRemainingMs"] = time_remaining
        elif room.status == GameStatus.FINISHED:
            # Show final results
            winner = max(room.scores.items(), key=lambda x: x[1])[0] if room.scores else None
            state["roomState"]["winner"] = winner
        
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
            except:
                disconnected.append(player_id)
        
        # Clean up disconnected players
        for player_id in disconnected:
            self.remove_player(room_id, player_id)
