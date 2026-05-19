/**
 * SpeedBattleResults - End-of-match results screen for Speed Battle.
 *
 * Shows:
 * - TimesUpOverlay on first mount (fades in/out over ~1.2s)
 * - Confetti animation
 * - "Speed Battle Over!" title
 * - Winner/champion card
 * - Room closing timer
 * - Play Again button (host) or waiting message (guest)
 * - 5-column standings table: medal | player | correct | wrong | rank
 */

import { useState } from "react";
import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { LinearTimer } from "../../../components";
import { PlayerName } from "../../../components/common/PlayerName/PlayerName";
import { SpeedBattleLeaderRow } from "../../../types";
import { Confetti } from "../Confetti";
import { TimesUpOverlay } from "./TimesUpOverlay";

const MEDALS = ["🥇", "🥈", "🥉"];

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function SpeedBattleResults() {
  const { roomState, playerId, playAgain } = useGame();
  const [showTimesUp, setShowTimesUp] = useState(true);

  const isHost = roomState?.hostId === playerId;
  const timeRemainingMs = roomState?.timeRemainingMs;

  const leaderboard: SpeedBattleLeaderRow[] = roomState?.speedBattle?.leaderboard ?? [];
  const sorted = [...leaderboard].sort((a, b) => a.placement - b.placement);
  const winner = sorted[0] ?? null;

  return (
    <>
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
        <Confetti />

        {/* Title */}
        <Box
          component="h2"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "var(--font-size-2xl)", sm: "var(--font-size-6xl)" },
            fontWeight: 400,
            mt: 0,
            mb: { xs: 2, sm: 6 },
            background: "var(--gradient-purple-teal)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: { xs: "2px", sm: "4px" },
            animation: "cardSlideUp 0.5s ease both",
          }}
        >
          Speed Battle Over!
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
              my: { xs: 2, sm: 6 },
              mx: "auto",
              maxWidth: 500,
              boxShadow: "var(--shadow-glow-purple)",
              animation: "cardSlideUp 0.5s 0.1s ease both",
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
          <Box sx={{ my: { xs: 2, sm: 6 } }}>
            <LinearTimer
              timeRemainingMs={timeRemainingMs}
              resetKey={winner?.playerId ?? ""}
              variant="subtle"
              label="Room closing in"
            />
          </Box>
        )}

        {/* Play again */}
        <Box
          sx={{
            my: { xs: 2, sm: 6 },
            textAlign: "center",
            animation: "cardSlideUp 0.5s 0.15s ease both",
          }}
        >
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
              ⚡ Play Again
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
        <Box sx={{ mt: { xs: 2, sm: 8 }, animation: "cardSlideUp 0.5s 0.2s ease both" }}>
          <Box
            component="h3"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "var(--font-size-lg)", sm: "var(--font-size-2xl)" },
              color: "var(--color-accent-purple)",
              mb: { xs: 2, sm: 4 },
              mt: 0,
              fontWeight: 400,
              letterSpacing: { xs: "2px", sm: "3px" },
            }}
          >
            Final Standings
          </Box>

          <Box sx={{ width: "100%" }}>
            {/* Column headers */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "36px 1fr 52px 44px 44px",
                  sm: "44px 1fr 70px 60px 60px",
                },
                gap: { xs: 1, sm: "6px" },
                px: { xs: 2, sm: "14px" },
                mb: 1,
              }}
            >
              <Box />
              <Box
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: "10px",
                  color: "var(--color-text-disabled)",
                  letterSpacing: "1px",
                }}
              >
                Player
              </Box>
              <Box
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: "10px",
                  color: "var(--color-accent-teal)",
                  letterSpacing: "1px",
                  textAlign: "right",
                }}
              >
                Correct
              </Box>
              <Box
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: "10px",
                  color: "var(--color-error)",
                  letterSpacing: "1px",
                  textAlign: "right",
                }}
              >
                Wrong
              </Box>
              <Box
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: "10px",
                  color: "var(--color-text-disabled)",
                  letterSpacing: "1px",
                  textAlign: "right",
                }}
              >
                Rank
              </Box>
            </Box>

            {/* Rows */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: { xs: "6px", sm: 2 },
              }}
            >
              {sorted.map((row, i) => {
                const isSelf = row.playerId === playerId;
                const isFirst = row.placement === 1;
                return (
                  <Box
                    key={row.playerId}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "36px 1fr 52px 44px 44px",
                        sm: "44px 1fr 70px 60px 60px",
                      },
                      gap: { xs: 1, sm: "6px" },
                      alignItems: "center",
                      py: { xs: 2, sm: 3 },
                      px: { xs: 2, sm: "14px" },
                      borderRadius: "var(--radius-md)",
                      border: "2px solid",
                      borderColor: isFirst
                        ? "var(--color-accent-purple)"
                        : isSelf
                          ? "rgba(139,92,246,0.4)"
                          : "var(--color-border-default)",
                      background: isFirst
                        ? "linear-gradient(90deg, rgba(139,92,246,0.12), rgba(251,191,36,0.06))"
                        : isSelf
                          ? "rgba(139,92,246,0.06)"
                          : "var(--color-bg-elevated)",
                      boxShadow: isFirst ? "var(--shadow-glow-purple)" : "none",
                      animation: `cardSlideUp 0.5s ${0.2 + i * 0.08}s ease both`,
                    }}
                  >
                    {/* Medal / rank */}
                    <Box
                      component="span"
                      sx={{ fontSize: { xs: "1rem", sm: "1.25rem" }, textAlign: "center" }}
                    >
                      {MEDALS[i] ?? row.placement}
                    </Box>

                    {/* Player name */}
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "var(--font-display)",
                        fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
                        letterSpacing: "0.5px",
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
                        fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
                        fontWeight: 700,
                        color: "var(--color-accent-teal)",
                        textAlign: "right",
                      }}
                    >
                      {row.correctCount}
                    </Box>

                    {/* Wrong count */}
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "var(--font-mono)",
                        fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
                        fontWeight: 700,
                        color: "var(--color-error)",
                        textAlign: "right",
                        opacity: 0.8,
                      }}
                    >
                      {row.wrongCount}
                    </Box>

                    {/* Rank ordinal */}
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "var(--font-mono)",
                        fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
                        fontWeight: 700,
                        color: isFirst ? "var(--color-accent-gold)" : "var(--color-text-muted)",
                        textAlign: "right",
                      }}
                    >
                      {ordinal(row.placement)}
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
          </Box>

          {/* Tiebreaker note */}
          <Box
            sx={{
              mt: { xs: 3, sm: 5 },
              textAlign: "center",
              fontFamily: "var(--font-display)",
              fontSize: "10px",
              color: "var(--color-text-disabled)",
              letterSpacing: "1px",
            }}
          >
            Tiebreaker: fewer wrong answers wins
          </Box>
        </Box>
      </Box>
    </>
  );
}
