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
}

// Error types
export type ApiErrorCode =
  | "ROOM_NOT_FOUND"
  | "NAME_TAKEN"
  | "GAME_STARTED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public statusCode?: number,
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
        response.status,
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "NETWORK_ERROR",
      "Network error: Unable to connect to server",
    );
  }
}

/**
 * Pre-register a player to join a room.
 * Must be called before connecting via WebSocket.
 * @param roomId The room ID to join
 * @param playerId The player's display name
 * @returns Join confirmation
 */
export async function joinRoom(
  roomId: string,
  playerId: string,
): Promise<JoinRoomResponse> {
  try {
    const response = await fetch(
      `${API_URL}/rooms/${roomId.toUpperCase()}/join`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(
        error.detail?.code || "NETWORK_ERROR",
        error.detail?.error || "Failed to join room",
        response.status,
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "NETWORK_ERROR",
      "Network error: Unable to connect to server",
    );
  }
}
