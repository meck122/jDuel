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
import { PlayerName } from "../../../components/common/PlayerName/PlayerName";
import { SpeedBattleLeaderRow } from "../../../types";
import { Confetti } from "../Confetti";
import { TimesUpOverlay } from "./TimesUpOverlay";

function rankEmoji(placement: number): string {
  if (placement === 1) return "🥇";
  if (placement === 2) return "🥈";
  if (placement === 3) return "🥉";
  return String(placement);
}

export function SpeedBattleResults() {
  const { roomState, playerId, playAgain } = useGame();
  const [showTimesUp, setShowTimesUp] = useState(true);

  const isHost = roomState?.hostId === playerId;

  const leaderboard: SpeedBattleLeaderRow[] = roomState?.speedBattle?.leaderboard ?? [];

  // Sort by placement ascending (server assigns placement; 1 = winner)
  const sorted = [...leaderboard].sort((a, b) => a.placement - b.placement);
  const winner = sorted[0] ?? null;

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

        {/* Final standings table */}
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

          {/* Table header */}
          <Box
            sx={{
              maxWidth: { xs: "100%", sm: 560 },
              mx: "auto",
              mb: 2,
              display: "grid",
              gridTemplateColumns: { xs: "36px 1fr 60px 60px", sm: "48px 1fr 80px 80px" },
              gap: { xs: 2, sm: 3 },
              px: { xs: 4, sm: 5 },
            }}
          >
            {["Rank", "Player", "Correct", "Wrong"].map((heading) => (
              <Box
                key={heading}
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  textAlign: heading === "Player" ? "left" : "center",
                }}
              >
                {heading}
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              maxWidth: { xs: "100%", sm: 560 },
              mx: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {sorted.map((row) => {
              const isSelf = row.playerId === playerId;
              const isWinner = row.placement === 1;

              return (
                <Box
                  key={row.playerId}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "36px 1fr 60px 60px",
                      sm: "48px 1fr 80px 80px",
                    },
                    gap: { xs: 2, sm: 3 },
                    alignItems: "center",
                    background: isSelf
                      ? "linear-gradient(90deg, rgba(139, 92, 246, 0.18), rgba(139, 92, 246, 0.05))"
                      : isWinner
                        ? "linear-gradient(90deg, rgba(139, 92, 246, 0.12), rgba(251, 191, 36, 0.06))"
                        : "var(--color-bg-elevated)",
                    py: { xs: 2, sm: 4 },
                    px: { xs: 4, sm: 5 },
                    borderRadius: "var(--radius-md)",
                    border: "2px solid",
                    borderColor: isSelf
                      ? "var(--color-accent-purple)"
                      : isWinner
                        ? "var(--color-accent-purple)"
                        : "var(--color-border-default)",
                    boxShadow: isSelf
                      ? "var(--shadow-glow-purple)"
                      : isWinner
                        ? "var(--shadow-glow-purple)"
                        : "none",
                    transition: "all var(--transition-base)",
                    "&:hover": {
                      borderColor: "var(--color-accent-purple)",
                      transform: "translateX(4px)",
                      boxShadow: "var(--shadow-glow-purple)",
                    },
                  }}
                >
                  {/* Rank */}
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "var(--font-mono)",
                      fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-xl)" },
                      fontWeight: 700,
                      color:
                        row.placement === 1
                          ? "var(--color-accent-gold)"
                          : "var(--color-accent-teal)",
                      textAlign: "center",
                    }}
                  >
                    {rankEmoji(row.placement)}
                  </Box>

                  {/* Player name */}
                  <Box
                    component="span"
                    sx={{
                      fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-lg)" },
                      fontWeight: isSelf ? 700 : 600,
                      color: isSelf ? "var(--color-accent-purple)" : "var(--color-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    <PlayerName playerId={row.playerId} />
                  </Box>

                  {/* Correct count */}
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "var(--font-mono)",
                      fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-xl)" },
                      fontWeight: 700,
                      color: "var(--color-success-light)",
                      textAlign: "center",
                    }}
                  >
                    {row.correctCount}
                  </Box>

                  {/* Wrong count */}
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "var(--font-mono)",
                      fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-xl)" },
                      fontWeight: 700,
                      color: "var(--color-error-light)",
                      textAlign: "center",
                    }}
                  >
                    {row.wrongCount}
                  </Box>
                </Box>
              );
            })}

            {sorted.length === 0 && (
              <Box
                sx={{
                  textAlign: "center",
                  color: "var(--color-text-muted)",
                  fontSize: "var(--font-size-sm)",
                  py: 4,
                }}
              >
                No results available
              </Box>
            )}
          </Box>

          {/* Tiebreaker footnote */}
          <Box
            sx={{
              mt: { xs: 3, sm: 5 },
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-disabled)",
              letterSpacing: "0.5px",
            }}
          >
            Tiebreaker: fewer wrong answers wins
          </Box>
        </Box>
      </Box>
    </>
  );
}
