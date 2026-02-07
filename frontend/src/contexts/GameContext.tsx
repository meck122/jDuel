/**
 * GameContext - Centralized game state management.
 *
 * This context provides:
 * - Room and player identification
 * - WebSocket connection state and methods
 * - Game state from the server
 *
 * This eliminates prop drilling and creates a single source of truth
 * for game state across all components.
 */

import { createContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { RoomConfig, RoomState, WebSocketMessage } from "../types";
import { WS_URL } from "../config";
import { clearToken } from "../services/api";
import { emitReaction } from "../services/reactionEmitter";

export interface GameContextValue {
  // Room identification
  roomId: string;
  playerId: string;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Game state from server
  roomState: RoomState | null;

  // Reactions
  sendReaction: (reactionId: number) => void;

  // Actions
  connect: (roomId: string, playerId: string) => void;
  disconnect: () => void;
  startGame: () => void;
  submitAnswer: (answer: string) => void;
  updateConfig: (config: Partial<RoomConfig>) => void;
}

// Context must be exported for useGame hook in separate file
// eslint-disable-next-line react-refresh/only-export-components
export const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
  onRoomClosed?: () => void;
}

export function GameProvider({ children, onRoomClosed }: GameProviderProps) {
  const [roomId, setRoomId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const onRoomClosedRef = useRef(onRoomClosed);

  // Keep callback ref updated
  useEffect(() => {
    onRoomClosedRef.current = onRoomClosed;
  }, [onRoomClosed]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setRoomState(null);
  }, []);

  const connect = useCallback(
    (newRoomId: string, newPlayerId: string) => {
      // Clean up existing connection
      disconnect();

      if (!newRoomId || !newPlayerId) {
        return;
      }

      setRoomId(newRoomId);
      setPlayerId(newPlayerId);
      setIsConnecting(true);
      setConnectionError(null);

      const wsUrl = `${WS_URL}?roomId=${encodeURIComponent(newRoomId)}&playerId=${encodeURIComponent(newPlayerId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Only update state if this is still the active WebSocket
        if (wsRef.current !== ws) return;
        console.log(`WebSocket connected to room ${newRoomId} as ${newPlayerId}`);
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        // Only process messages from the active WebSocket
        if (wsRef.current !== ws) return;
        const data: WebSocketMessage = JSON.parse(event.data);

        switch (data.type) {
          case "ROOM_STATE":
            setRoomState(data.roomState);
            setConnectionError(null); // Clear any previous errors on successful state update
            break;
          case "REACTION":
            // Bypass context entirely — emit directly to the Reactions
            // component's local subscription. Context state updates from
            // native WebSocket events are deferred by React 19's automatic
            // batching, causing reactions to appear one click behind.
            emitReaction({
              playerId: data.playerId,
              reactionId: data.reactionId,
              receivedAt: Date.now(),
            });
            break;
          case "ROOM_CLOSED":
            clearToken(newRoomId, newPlayerId);
            onRoomClosedRef.current?.();
            break;
          case "ERROR":
            setConnectionError(data.message);
            break;
        }
      };

      ws.onerror = (error) => {
        // Only handle errors from the active WebSocket
        if (wsRef.current !== ws) return;
        console.error("WebSocket error:", error);
        setConnectionError("Connection error occurred");
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        // Only handle close from the active WebSocket
        if (wsRef.current !== ws) return;
        console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
        setIsConnected(false);
        setIsConnecting(false);

        // Handle server-side rejection
        if (event.code === 4004) {
          setConnectionError("Room not found");
        } else if (event.code === 4003) {
          setConnectionError("Player not registered");
        }
      };
    },
    [disconnect]
  );

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not ready, message not sent:", message);
    }
  }, []);

  const startGame = useCallback(() => {
    sendMessage({ type: "START_GAME" });
  }, [sendMessage]);

  const submitAnswer = useCallback(
    (answer: string) => {
      sendMessage({ type: "ANSWER", answer });
    },
    [sendMessage]
  );

  const updateConfig = useCallback(
    (config: Partial<RoomConfig>) => {
      sendMessage({ type: "UPDATE_CONFIG", config });
    },
    [sendMessage]
  );

  const sendReaction = useCallback(
    (reactionId: number) => {
      sendMessage({ type: "REACTION", reactionId });
    },
    [sendMessage]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value: GameContextValue = {
    roomId,
    playerId,
    isConnected,
    isConnecting,
    connectionError,
    roomState,
    sendReaction,
    connect,
    disconnect,
    startGame,
    submitAnswer,
    updateConfig,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
