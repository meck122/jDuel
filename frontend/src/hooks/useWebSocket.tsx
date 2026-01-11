import { useEffect, useRef, useState } from "react";
import { RoomState, WebSocketMessage } from "../types";
import { WS_URL } from "../config";

export const useWebSocket = (
  joined: boolean,
  onRoomClosed: () => void,
  onError: (message: string) => void,
) => {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingMessageRef = useRef<object | null>(null);

  useEffect(() => {
    if (!joined) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (pendingMessageRef.current) {
        ws.send(JSON.stringify(pendingMessageRef.current));
        pendingMessageRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);
      if (data.type === "ROOM_STATE" && data.roomState) {
        setRoomState(data.roomState);
      } else if (data.type === "ROOM_CREATED" && data.playerId) {
        // TODO: set playerId
      } else if (data.type === "ROOM_CLOSED") {
        if (onRoomClosed) {
          onRoomClosed();
        }
      } else if (data.type === "ERROR" && data.message) {
        onError(data.message);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [joined]);

  const sendMessage = (message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      pendingMessageRef.current = message;
    }
  };

  return { roomState, sendMessage };
};
