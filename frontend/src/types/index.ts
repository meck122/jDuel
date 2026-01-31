export interface RoomConfig {
  multipleChoiceEnabled: boolean;
}

export interface RoomState {
  roomId: string;
  players: Record<string, number>;
  status: "waiting" | "playing" | "results" | "finished";
  questionIndex: number;
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
}

// Discriminated union for type-safe message handling
export type WebSocketMessage =
  | { type: "ROOM_STATE"; roomState: RoomState }
  | { type: "ROOM_CLOSED" }
  | { type: "ERROR"; message: string };
