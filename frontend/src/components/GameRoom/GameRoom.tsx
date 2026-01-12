import { RoomState } from "../../types";
import { LobbyRoom } from "../LobbyRoom/LobbyRoom";
import { QuestionView } from "../QuestionView/QuestionView";
import { GameOver } from "../GameOver/GameOver";
import { ResultsView } from "../ResultsView/ResultsView";
import styles from "./GameRoom.module.css";

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
    <div className={styles.container}>
      <h1 className={styles.title}>
        <span className={styles.titleJ}>j</span>
        <span className={styles.titleDuel}>Duel</span>
        <span className={styles.titleRoom}> - Room: {roomId}</span>
      </h1>

      {roomState.status === "waiting" && (
        <LobbyRoom
          players={roomState.players}
          currentPlayerId={playerId}
          onStartGame={onStartGame}
        />
      )}

      {roomState.status === "playing" &&
        roomState.currentQuestion &&
        roomState.timeRemainingMs !== undefined && (
          <QuestionView
            questionIndex={roomState.questionIndex}
            questionText={roomState.currentQuestion.text}
            questionCategory={roomState.currentQuestion.category}
            timeRemainingMs={roomState.timeRemainingMs}
            onSubmitAnswer={onSubmitAnswer}
          />
        )}

      {roomState.status === "results" &&
        roomState.results &&
        roomState.timeRemainingMs !== undefined && (
          <ResultsView
            players={roomState.players}
            correctAnswer={roomState.results.correctAnswer}
            playerAnswers={roomState.results.playerAnswers}
            playerResults={roomState.results.playerResults}
            timeRemainingMs={roomState.timeRemainingMs}
            currentPlayerId={playerId}
          />
        )}

      {roomState.status === "finished" && roomState.winner && (
        <GameOver
          winner={roomState.winner}
          players={roomState.players}
          timeRemainingMs={roomState.timeRemainingMs}
        />
      )}
    </div>
  );
};
