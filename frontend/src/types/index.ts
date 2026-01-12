export interface RoomState {
  roomId: string;
  players: Record<string, number>;
  status: "waiting" | "playing" | "results" | "finished";
  questionIndex: number;
  currentQuestion?: {
    text: string;
    category: string;
  };
  timeRemainingMs?: number;
  winner?: string;
  results?: {
    correctAnswer: string;
    playerAnswers: Record<string, string>;
    playerResults: Record<string, number>;
  };
}

export interface WebSocketMessage {
  type: string;
  roomState?: RoomState;
  playerId?: string;
  message?: string;
}
