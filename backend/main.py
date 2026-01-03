"""Main FastAPI application for the trivia game."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio

from room_manager import RoomManager
from config import CORS_ORIGINS, QUESTION_TIME_MS

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

room_manager = RoomManager()


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
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
                await room_manager.broadcast_state(room_id)
            
            elif msg_type == "START_GAME":
                if current_room_id:
                    room_manager.start_game(current_room_id)
                    await room_manager.broadcast_state(current_room_id)
                    
                    # Start question timer
                    asyncio.create_task(question_timer(current_room_id))
            
            elif msg_type == "ANSWER":
                if current_room_id and current_player_id:
                    answer = message["answer"]
                    time_ms = message["timeMs"]
                    
                    room_manager.submit_answer(current_room_id, current_player_id, answer, time_ms)
                    await room_manager.broadcast_state(current_room_id)
    
    except WebSocketDisconnect:
        if current_room_id and current_player_id:
            room_manager.remove_player(current_room_id, current_player_id)
            if current_room_id in room_manager.rooms:
                await room_manager.broadcast_state(current_room_id)


async def question_timer(room_id: str):
    """Auto-advance to next question after time expires."""
    await asyncio.sleep(QUESTION_TIME_MS / 1000)
    
    if room_id in room_manager.rooms:
        room = room_manager.rooms[room_id]
        if room.status.value == "playing":
            has_next = room_manager.next_question(room_id)
            await room_manager.broadcast_state(room_id)
            
            if has_next:
                asyncio.create_task(question_timer(room_id))
