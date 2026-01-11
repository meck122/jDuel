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
  const onRoomClosedRef = useRef(onRoomClosed);
  const onErrorRef = useRef(onError);

  // Need this "queue" if this client creates the room
  // client has to setJoined(true) and wait for ws connection
  // then sends message "CREATE_ROOM"
  // then client receives normal roomState broadcast for lobby
  const pendingMessageRef = useRef<object | null>(null);

  // good practice useEffect to update callbacks
  useEffect(() => {
    onRoomClosedRef.current = onRoomClosed;
    onErrorRef.current = onError;
  }, [onRoomClosed, onError]);

  useEffect(() => {
    if (!joined) {
      // Clear room state when not joined (when prev game finishes and room is created again)
      setRoomState(null);
      return;
    }

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
      } else if (data.type === "ROOM_CLOSED") {
        onRoomClosedRef.current();
      } else if (data.type === "ERROR" && data.message) {
        onErrorRef.current(data.message);
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
