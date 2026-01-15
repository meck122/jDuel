/**
 * GameView - Main game container that orchestrates game phases.
 *
 * This component:
 * - Displays the game header with room info
 * - Renders the appropriate phase component based on game status
 * - Uses GameContext for all state (no prop drilling)
 *
 * Game phases:
 * - waiting: Lobby (waiting for host to start)
 * - playing: Question (answering questions)
 * - results: Results (showing answers after each question)
 * - finished: GameOver (final scores)
 */

import { useGame } from "../../../contexts";
import { Lobby } from "../Lobby";
import { Question } from "../Question";
import { Results } from "../Results";
import { GameOver } from "../GameOver";
import styles from "./GameView.module.css";

export function GameView() {
  const { roomState } = useGame();

  if (!roomState) {
    return null;
  }

  return (
    <div className={styles.container}>
      {roomState.status === "waiting" && <Lobby />}

      {roomState.status === "playing" &&
        roomState.currentQuestion &&
        roomState.timeRemainingMs !== undefined && <Question />}

      {roomState.status === "results" &&
        roomState.results &&
        roomState.timeRemainingMs !== undefined && <Results />}

      {roomState.status === "finished" && roomState.winner && <GameOver />}
    </div>
  );
}
