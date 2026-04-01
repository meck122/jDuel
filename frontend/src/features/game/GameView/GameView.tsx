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

import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { Lobby } from "../Lobby/Lobby";
import { Question } from "../Question/Question";
import { Results } from "../Results/Results";
import { GameOver } from "../GameOver/GameOver";
import { Reactions } from "../Reactions/Reactions";

export function GameView() {
  const { roomState } = useGame();

  if (!roomState) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", p: { xs: 0, sm: 6 }, textAlign: "center" }}>
      {roomState.status === "waiting" && <Lobby />}

      {roomState.status === "playing" &&
        roomState.currentQuestion &&
        roomState.timeRemainingMs !== undefined && <Question />}

      {roomState.status === "results" &&
        roomState.results &&
        roomState.timeRemainingMs !== undefined && <Results />}

      {roomState.status === "finished" && roomState.winner && <GameOver />}

      {(roomState.status === "results" || roomState.status === "finished") && <Reactions />}
    </Box>
  );
}
