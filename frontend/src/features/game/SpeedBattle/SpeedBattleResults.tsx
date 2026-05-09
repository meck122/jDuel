/**
 * SpeedBattleResults - End-of-match results screen for Speed Battle.
 *
 * Shows:
 * - TimesUpOverlay on first mount (fades in/out over ~1.2s)
 * - Confetti animation
 * - Winner/champion card (sourced from leaderboard[0])
 * - Final standings table (rank, player, correct, wrong)
 * - Play Again button (host) or waiting message (guest)
 */

import { useState } from "react";
import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { LinearTimer } from "../../../components";
import { PlayerName } from "../../../components/common/PlayerName/PlayerName";
import { SpeedBattleLeaderRow } from "../../../types";
import { Confetti } from "../Confetti";
import { FinalStandings, FinalRow } from "../FinalStandings";
import { TimesUpOverlay } from "./TimesUpOverlay";

export function SpeedBattleResults() {
  const { roomState, playerId, playAgain } = useGame();
  const [showTimesUp, setShowTimesUp] = useState(true);

  const isHost = roomState?.hostId === playerId;
  const timeRemainingMs = roomState?.timeRemainingMs;

  const leaderboard: SpeedBattleLeaderRow[] = roomState?.speedBattle?.leaderboard ?? [];

  const sorted = [...leaderboard].sort((a, b) => a.placement - b.placement);
  const winner = sorted[0] ?? null;

  const rows: FinalRow[] = sorted.map((row) => ({
    placement: row.placement,
    playerId: row.playerId,
    scoreDisplay: `${row.correctCount} correct · ${row.wrongCount} wrong`,
  }));

  return (
    <>
      {/* Times Up overlay — shown on first mount only */}
      {showTimesUp && <TimesUpOverlay onDone={() => setShowTimesUp(false)} />}

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
          Time&apos;s Up!
        </Box>

        {/* Winner card */}
        {winner && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 4, sm: 6 },
              background:
                "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(251, 191, 36, 0.08))",
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
                  color: "var(--color-accent-gold)",
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
                <PlayerName playerId={winner.playerId} />
              </Box>
              <Box
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-lg)" },
                  color: "var(--color-text-secondary)",
                  fontWeight: 600,
                }}
              >
                {winner.correctCount} correct &middot; {winner.wrongCount} wrong
              </Box>
            </Box>
          </Box>
        )}

        {/* Room closing timer */}
        {timeRemainingMs !== undefined && (
          <Box sx={{ my: { xs: 2, sm: 7 } }}>
            <LinearTimer
              timeRemainingMs={timeRemainingMs}
              resetKey={winner?.playerId ?? ""}
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

        <FinalStandings
          rows={rows}
          selfPlayerId={playerId}
          tiebreakerText="Tiebreaker: fewer wrong answers wins"
        />
      </Box>
    </>
  );
}
