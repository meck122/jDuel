"""WebSocket endpoint handlers for game communication."""

import json
import asyncio
from fastapi import WebSocket, WebSocketDisconnect

from app.services.room_manager import RoomManager
from app.config import QUESTION_TIME_MS, RESULTS_TIME_MS, GAME_OVER_TIME_MS


async def websocket_endpoint(ws: WebSocket, room_manager: RoomManager):
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
                    asyncio.create_task(question_timer(current_room_id, room_manager))
            
            elif msg_type == "ANSWER":
                if current_room_id and current_player_id:
                    answer = message["answer"]
                    
                    room_manager.submit_answer(current_room_id, current_player_id, answer)
                    await room_manager.broadcast_state(current_room_id)
    
    except WebSocketDisconnect:
        if current_room_id and current_player_id:
            room_manager.remove_player(current_room_id, current_player_id)
            if current_room_id in room_manager.rooms:
                await room_manager.broadcast_state(current_room_id)


async def question_timer(room_id: str, room_manager: RoomManager):
    """Auto-advance to next question after time expires."""
    await asyncio.sleep(QUESTION_TIME_MS / 1000)
    
    if room_id in room_manager.rooms:
        room = room_manager.rooms[room_id]
        if room.status.value == "playing":
            # Show results screen
            room_manager.show_results(room_id)
            await room_manager.broadcast_state(room_id)
            
            # Start results timer
            asyncio.create_task(results_timer(room_id, room_manager))


async def results_timer(room_id: str, room_manager: RoomManager):
    """Auto-advance from results to next question after time expires."""
    await asyncio.sleep(RESULTS_TIME_MS / 1000)
    
    if room_id in room_manager.rooms:
        room = room_manager.rooms[room_id]
        if room.status.value == "results":
            has_next = room_manager.next_question(room_id)
            await room_manager.broadcast_state(room_id)
            
            if has_next:
                asyncio.create_task(question_timer(room_id, room_manager))
            else:
                # Game is finished, start game over timer
                asyncio.create_task(game_over_timer(room_id, room_manager))


async def game_over_timer(room_id: str, room_manager: RoomManager):
    """Auto-close room after game over timeout."""
    await asyncio.sleep(GAME_OVER_TIME_MS / 1000)
    
    if room_id in room_manager.rooms:
        room = room_manager.rooms[room_id]
        # Broadcast room closed message to all players
        for player_id, ws in list(room.players.items()):
            try:
                await ws.send_json({"type": "ROOM_CLOSED"})
            except:
                pass
        
        # Clean up all players and close the room
        for player_id in list(room.players.keys()):
            room_manager.remove_player(room_id, player_id)
