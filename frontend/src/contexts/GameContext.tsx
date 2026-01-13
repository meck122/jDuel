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

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { RoomState, WebSocketMessage } from "../types";
import { WS_URL } from "../config";

interface GameContextValue {
  // Room identification
  roomId: string;
  playerId: string;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Game state from server
  roomState: RoomState | null;

  // Actions
  connect: (roomId: string, playerId: string) => void;
  disconnect: () => void;
  startGame: () => void;
  submitAnswer: (answer: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

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
        console.log(
          `WebSocket connected to room ${newRoomId} as ${newPlayerId}`,
        );
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        // Only process messages from the active WebSocket
        if (wsRef.current !== ws) return;
        const data: WebSocketMessage = JSON.parse(event.data);

        if (data.type === "ROOM_STATE" && data.roomState) {
          setRoomState(data.roomState);
        } else if (data.type === "ROOM_CLOSED") {
          onRoomClosedRef.current?.();
        } else if (data.type === "ERROR" && data.message) {
          setConnectionError(data.message);
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
        console.log(
          `WebSocket closed: code=${event.code}, reason=${event.reason}`,
        );
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
    [disconnect],
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
    [sendMessage],
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
    connect,
    disconnect,
    startGame,
    submitAnswer,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/**
 * Hook to access game context.
 * Must be used within a GameProvider.
 */
export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
