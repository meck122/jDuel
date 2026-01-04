import { RoomState } from '../types';
import { Scoreboard } from './Scoreboard';
import { WaitingRoom } from './WaitingRoom';
import { QuestionView } from './QuestionView';
import { GameOver } from './GameOver';

interface GameRoomProps {
  roomId: string;
  playerId: string;
  roomState: RoomState;
  onStartGame: () => void;
  onSubmitAnswer: (answer: string) => void;
}

export const GameRoom = ({
  roomId,
  playerId,
  roomState,
  onStartGame,
  onSubmitAnswer,
}: GameRoomProps) => {
  return (
    <div className='container'>
      <h1>Trivia Duel - Room: {roomId}</h1>

      <Scoreboard players={roomState.players} currentPlayerId={playerId} />

      {roomState.status === 'waiting' && (
        <WaitingRoom onStartGame={onStartGame} />
      )}

      {roomState.status === 'playing' &&
        roomState.currentQuestion &&
        roomState.timeRemainingMs !== undefined && (
          <QuestionView
            questionIndex={roomState.questionIndex}
            questionText={roomState.currentQuestion.text}
            timeRemainingMs={roomState.timeRemainingMs}
            onSubmitAnswer={onSubmitAnswer}
          />
        )}

      {roomState.status === 'finished' && roomState.winner && (
        <GameOver winner={roomState.winner} players={roomState.players} />
      )}
    </div>
  );
};
