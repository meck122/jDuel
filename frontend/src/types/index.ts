export interface RoomState {
  players: Record<string, number>;
  status: 'waiting' | 'playing' | 'finished';
  questionIndex: number;
  currentQuestion?: {
    text: string;
  };
  timeRemainingMs?: number;
  winner?: string;
}

export interface WebSocketMessage {
  type: string;
  roomState?: RoomState;
}
