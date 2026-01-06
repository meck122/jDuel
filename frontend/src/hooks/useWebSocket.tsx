import { useEffect, useRef, useState } from 'react';
import { RoomState, WebSocketMessage } from '../types';
import { WS_URL } from '../config';

export const useWebSocket = (
  roomId: string,
  playerId: string,
  joined: boolean,
  onRoomClosed?: () => void
) => {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!joined) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          roomId: roomId,
          playerId: playerId,
        })
      );
    };

    ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);
      if (data.type === 'ROOM_STATE' && data.roomState) {
        setRoomState(data.roomState);
      } else if (data.type === 'ROOM_CLOSED') {
        if (onRoomClosed) {
          onRoomClosed();
        }
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [joined, roomId, playerId]);

  const sendMessage = (message: object) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { roomState, sendMessage };
};
