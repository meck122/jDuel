/**
 * GameView - Main game container that orchestrates game phases.
 *
 * Dispatches on both config.gameMode and status:
 *
 * classic  / waiting  → Lobby
 * classic  / playing  → Question
 * classic  / results  → Results
 * classic  / finished → GameOver
 *
 * speed_battle / waiting  → Lobby (MC gate active)
 * speed_battle / playing  → SpeedBattleRound (countdown + cooldown + leaderboard)
 * speed_battle / finished → SpeedBattleResults (Time's Up + final leaderboard)
 * speed_battle / results  → unreachable (log + render nothing)
 */

import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { Lobby } from "../Lobby/Lobby";
import { Question } from "../Question/Question";
import { Results } from "../Results/Results";
import { GameOver } from "../GameOver/GameOver";
import { Reactions } from "../Reactions/Reactions";
import { SpeedBattleRound, SpeedBattleResults } from "../SpeedBattle";

export function GameView() {
  const { roomState } = useGame();

  if (!roomState) {
    return null;
  }

  const gameMode = roomState.config?.gameMode ?? "speed_battle";
  const { status } = roomState;

  return (
    <Box sx={{ width: "100%", p: { xs: 0, sm: 6 }, textAlign: "center" }}>
      {status === "waiting" && <Lobby />}

      {gameMode === "classic" &&
        status === "playing" &&
        roomState.currentQuestion &&
        roomState.timeRemainingMs !== undefined && <Question />}

      {gameMode === "classic" &&
        status === "results" &&
        roomState.results &&
        roomState.timeRemainingMs !== undefined && <Results />}

      {gameMode === "classic" && status === "finished" && roomState.winner && <GameOver />}

      {gameMode === "speed_battle" && status === "playing" && <SpeedBattleRound />}

      {gameMode === "speed_battle" && status === "finished" && <SpeedBattleResults />}

      {gameMode === "speed_battle" &&
        status === "results" &&
        // Speed Battle has no per-question results phase — this status is unreachable
        // from the backend but guarded here to catch regressions early.
        (() => {
          console.warn("GameView: unexpected status=results for speed_battle");
          return null;
        })()}

      {/* Reactions: Classic shows on results+finished; Speed Battle only on finished */}
      {gameMode === "classic" && (status === "results" || status === "finished") && <Reactions />}
      {gameMode === "speed_battle" && status === "finished" && <Reactions />}
    </Box>
  );
}
