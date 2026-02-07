/**
 * HTTP API client for room management.
 *
 * Handles room creation, validation, and join operations via REST endpoints.
 * WebSocket is only used for real-time game communication after joining.
 */

import { API_URL } from "../config";

// Response types
export interface CreateRoomResponse {
  roomId: string;
  status: string;
  playerCount: number;
}

export interface JoinRoomResponse {
  roomId: string;
  playerId: string;
  status: string;
  sessionToken: string;
}

// Error types
export type ApiErrorCode =
  | "ROOM_NOT_FOUND"
  | "NAME_TAKEN"
  | "GAME_STARTED"
  | "VALIDATION_ERROR"
  | "INVALID_SESSION"
  | "NETWORK_ERROR";

// Session token storage helpers
const SESSION_TOKEN_KEY = "jduel_session_tokens";

function getStoredTokens(): Record<string, string> {
  try {
    const stored = localStorage.getItem(SESSION_TOKEN_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function storeToken(roomId: string, playerId: string, token: string): void {
  const key = `${roomId}:${playerId}`;
  const tokens = getStoredTokens();
  tokens[key] = token;
  localStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(tokens));
}

function getToken(roomId: string, playerId: string): string | undefined {
  const key = `${roomId}:${playerId}`;
  return getStoredTokens()[key];
}

export function clearToken(roomId: string, playerId: string): void {
  const key = `${roomId}:${playerId}`;
  const tokens = getStoredTokens();
  delete tokens[key];
  if (Object.keys(tokens).length === 0) {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } else {
    localStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(tokens));
  }
}

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Create a new game room.
 * @returns The created room's info
 */
export async function createRoom(): Promise<CreateRoomResponse> {
  try {
    const response = await fetch(`${API_URL}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(
        error.detail?.code || "NETWORK_ERROR",
        error.detail?.error || "Failed to create room",
        response.status
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("NETWORK_ERROR", "Network error: Unable to connect to server");
  }
}

/**
 * Pre-register a player to join a room.
 * Must be called before connecting via WebSocket.
 * Automatically handles session tokens for reconnection security.
 * @param roomId The room ID to join
 * @param playerId The player's display name
 * @returns Join confirmation including session token
 */
export async function joinRoom(roomId: string, playerId: string): Promise<JoinRoomResponse> {
  const upperRoomId = roomId.toUpperCase();

  // Check for existing session token (for reconnection)
  const existingToken = getToken(upperRoomId, playerId);

  try {
    const response = await fetch(`${API_URL}/rooms/${upperRoomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        sessionToken: existingToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(
        error.detail?.code || "NETWORK_ERROR",
        error.detail?.error || "Failed to join room",
        response.status
      );
    }

    const result: JoinRoomResponse = await response.json();

    // Store the session token for future reconnection
    storeToken(upperRoomId, playerId, result.sessionToken);

    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("NETWORK_ERROR", "Network error: Unable to connect to server");
  }
}
