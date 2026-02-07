export interface RoomConfig {
  multipleChoiceEnabled: boolean;
  difficulty: string;
}

export interface RoomState {
  roomId: string;
  players: Record<string, number>;
  status: "waiting" | "playing" | "results" | "finished";
  questionIndex: number;
  totalQuestions: number;
  hostId?: string;
  config?: RoomConfig;
  currentQuestion?: {
    text: string;
    category: string;
    options?: string[];
  };
  timeRemainingMs?: number;
  winner?: string;
  results?: {
    correctAnswer: string;
    playerAnswers: Record<string, string>;
    playerResults: Record<string, number>;
  };
  reactions?: { id: number; label: string }[];
}

export interface Reaction {
  playerId: string;
  reactionId: number;
  /** Client-assigned timestamp; used as unique key for feed items */
  receivedAt: number;
}

// Discriminated union for type-safe message handling
export type WebSocketMessage =
  | { type: "ROOM_STATE"; roomState: RoomState }
  | { type: "REACTION"; playerId: string; reactionId: number }
  | { type: "ROOM_CLOSED" }
  | { type: "ERROR"; message: string };
