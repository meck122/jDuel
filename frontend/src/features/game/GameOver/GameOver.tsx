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

const CONFETTI_PIECES = [
  {
    left: "5%",
    color: "var(--color-accent-purple)",
    delay: "0s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "15%",
    color: "var(--color-accent-red)",
    delay: "0.3s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "25%",
    color: "var(--color-accent-teal)",
    delay: "0.7s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "35%",
    color: "var(--color-accent-red)",
    delay: "0.15s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "45%",
    color: "var(--color-accent-purple)",
    delay: "0.9s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "55%",
    color: "var(--color-accent-teal)",
    delay: "0.2s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "65%",
    color: "var(--color-accent-red)",
    delay: "0.6s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "75%",
    color: "var(--color-accent-purple)",
    delay: "1s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "82%",
    color: "var(--color-accent-teal)",
    delay: "0.4s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "90%",
    color: "var(--color-accent-red)",
    delay: "0.8s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "10%",
    color: "var(--color-accent-purple)",
    delay: "1.8s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "50%",
    color: "var(--color-accent-red)",
    delay: "2.2s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
] as const;

export function GameOver() {
  const { roomState, playerId, playAgain } = useGame();

  const isHost = roomState?.hostId === playerId;

  const players = roomState?.players ?? {};
  const winner = roomState?.winner ?? "";
  const timeRemainingMs = roomState?.timeRemainingMs;

  const sortedPlayers = sortPlayersByScore(players);
  const firstPlace = sortedPlayers[0];

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
      <Box
        sx={{
          position: "absolute",
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {CONFETTI_PIECES.map((piece, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              left: piece.left,
              width: piece.width,
              height: piece.height,
              top: -30,
              opacity: 0,
              borderRadius: piece.borderRadius,
              background: piece.color,
              animation: `confettiFall 3.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${piece.delay} infinite`,
            }}
          />
        ))}
      </Box>

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

      {/* Final standings */}
      <Box
        sx={{
          mt: { xs: 2, sm: 8 },
          flex: { xs: 1, sm: "none" },
          minHeight: { xs: 0, sm: "auto" },
          overflowY: { xs: "auto", sm: "visible" },
        }}
      >
        <Box
          component="h3"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "var(--font-size-lg)", sm: "var(--font-size-2xl)" },
            color: "var(--color-accent-purple)",
            mb: { xs: 2, sm: 6 },
            mt: 0,
            fontWeight: 400,
            textTransform: "uppercase",
            letterSpacing: { xs: "2px", sm: "3px" },
            textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
          }}
        >
          Final Standings
        </Box>
        <Box
          sx={{
            maxWidth: { xs: "100%", sm: 500 },
            mx: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {sortedPlayers.map(([player, score], index) => (
            <Box
              key={player}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "28px 1fr auto", sm: "40px 1fr auto" },
                gap: { xs: 2, sm: 4 },
                alignItems: "center",
                background:
                  index === 0
                    ? "linear-gradient(90deg, rgba(139, 92, 246, 0.15), rgba(251, 191, 36, 0.08))"
                    : "var(--color-bg-elevated)",
                py: { xs: 1, sm: 4 },
                px: { xs: 4, sm: 5 },
                borderRadius: "var(--radius-md)",
                border: "2px solid",
                borderColor:
                  index === 0 ? "var(--color-accent-purple)" : "var(--color-border-default)",
                boxShadow: index === 0 ? "var(--shadow-glow-purple)" : "none",
                transition: "all var(--transition-base)",
                "&:hover": {
                  borderColor: "var(--color-accent-purple)",
                  transform: "translateX(4px)",
                  boxShadow: "var(--shadow-glow-purple)",
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-xl)" },
                  fontWeight: 700,
                  color: index === 0 ? "var(--color-accent-red)" : "var(--color-accent-teal)",
                  textAlign: "center",
                }}
              >
                {index + 1}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-lg)" },
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                {player}
              </Box>
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-xl)" },
                  fontWeight: 700,
                  color: index === 0 ? "var(--color-accent-red)" : "var(--color-accent-teal)",
                }}
              >
                {score}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
