/**
 * GameOver - Final game screen showing winner and scores.
 *
 * Shows:
 * - Winner announcement
 * - Final scores for all players
 * - Room closing countdown
 */

import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { LinearTimer } from "../../../components";
import { sortPlayersByScore } from "../../../utils";
import { Confetti } from "../Confetti";
import { FinalStandings, FinalRow } from "../FinalStandings";

export function GameOver() {
  const { roomState, playerId, playAgain } = useGame();

  const isHost = roomState?.hostId === playerId;

  const players = roomState?.players ?? {};
  const winner = roomState?.winner ?? "";
  const timeRemainingMs = roomState?.timeRemainingMs;

  const sortedPlayers = sortPlayersByScore(players);
  const firstPlace = sortedPlayers[0];

  const rows: FinalRow[] = sortedPlayers.map(([pid, score], i) => ({
    placement: i + 1,
    playerId: pid,
    scoreDisplay: `${score} pts`,
  }));

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        mt: { xs: 2, sm: 6 },
        mb: 6,
        pt: { xs: 2, sm: 6 },
        pb: { xs: "var(--reactions-bar-height)", sm: 0 },
        px: { xs: 4, sm: 0 },
        display: { xs: "flex", sm: "block" },
        flexDirection: "column",
      }}
    >
      {/* Confetti overlay */}
      <Confetti />

      {/* Title */}
      <Box
        component="h2"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "var(--font-size-2xl)", sm: "var(--font-size-6xl)" },
          fontWeight: 400,
          mt: 0,
          mb: { xs: 1, sm: 7 },
          textShadow: "0 4px 16px rgba(0, 0, 0, 0.6)",
          background: "var(--gradient-purple-teal)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          letterSpacing: { xs: "2px", sm: "4px" },
        }}
      >
        Game Over!
      </Box>

      {/* Winner card */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 4, sm: 6 },
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(251, 191, 36, 0.08))",
          border: "2px solid var(--color-accent-purple)",
          borderRadius: "var(--radius-lg)",
          py: { xs: 4, sm: 7 },
          px: { xs: 5, sm: 7 },
          my: { xs: 2, sm: 7 },
          mx: "auto",
          maxWidth: 500,
          boxShadow: "var(--shadow-glow-purple)",
        }}
      >
        <Box
          sx={{
            fontSize: { xs: "2.5rem", sm: "4rem" },
            animation: "bounce 2s infinite",
            flexShrink: 0,
          }}
        >
          🏆
        </Box>
        <Box sx={{ flex: 1, textAlign: "left" }}>
          <Box
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-accent-red)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "3px",
              mb: 1,
            }}
          >
            Champion
          </Box>
          <Box
            sx={{
              fontSize: { xs: "var(--font-size-xl)", sm: "var(--font-size-3xl)" },
              color: "var(--color-text-primary)",
              fontWeight: 700,
              mb: 1,
            }}
          >
            {winner}
          </Box>
          {firstPlace && (
            <Box
              sx={{
                fontFamily: "var(--font-mono)",
                fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-lg)" },
                color: "var(--color-accent-red)",
                fontWeight: 600,
              }}
            >
              {firstPlace[1]} points
            </Box>
          )}
        </Box>
      </Box>

      {/* Room closing timer */}
      {timeRemainingMs !== undefined && (
        <Box sx={{ my: { xs: 2, sm: 7 } }}>
          <LinearTimer
            timeRemainingMs={timeRemainingMs}
            resetKey={winner}
            variant="subtle"
            label="Room closing in"
          />
        </Box>
      )}

      {/* Play again */}
      <Box sx={{ my: { xs: 2, sm: 6 }, textAlign: "center" }}>
        {isHost ? (
          <Box
            component="button"
            onClick={playAgain}
            sx={{
              py: 4,
              px: { xs: 6, sm: 8 },
              fontSize: { xs: "var(--font-size-lg)", sm: "var(--font-size-xl)" },
              width: { xs: "100%", sm: "auto" },
              background: "var(--gradient-gold)",
              color: "rgb(14, 12, 22)",
              letterSpacing: "3px",
              "&:hover": {
                boxShadow: "var(--shadow-glow-gold)",
                filter: "brightness(1.05)",
              },
            }}
          >
            Play Again
          </Box>
        ) : (
          <Box
            component="p"
            sx={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text-muted)",
              fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-md)" },
              letterSpacing: "1px",
              m: 0,
            }}
          >
            Waiting for host to start a new game...
          </Box>
        )}
      </Box>

      <FinalStandings rows={rows} selfPlayerId={playerId} />
    </Box>
  );
}
