/**
 * Results - Displays results after each question.
 *
 * Shows:
 * - Correct answer
 * - Player answers with correct/incorrect indicators
 * - Current scores
 * - Timer until next question
 */

import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { Timer, PlayerName } from "../../../components";
import { sortPlayersByScore } from "../../../utils";
import { sxContentBox, sxScoreItem } from "../../../styles/sxPatterns";

export function Results() {
  const { roomState } = useGame();

  const players = roomState?.players ?? {};
  const results = roomState?.results;
  const timeRemainingMs = roomState?.timeRemainingMs ?? 0;

  if (!results) {
    return null;
  }

  const { correctAnswer, playerAnswers, playerResults } = results;

  return (
    <Box
      sx={{
        width: "100%",
        mt: { xs: 2, sm: 6 },
        mb: { xs: 0, sm: 6 },
        pb: { xs: "var(--reactions-bar-height)", sm: 0 },
        display: { xs: "flex", sm: "block" },
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          mb: { xs: 2, sm: 4 },
        }}
      >
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "var(--font-size-2xl)", sm: "var(--font-size-4xl)" },
            fontWeight: 400,
            color: "var(--color-accent-purple)",
            letterSpacing: "2px",
            textShadow: "0 2px 8px rgba(139, 92, 246, 0.3)",
          }}
        >
          Round Results
        </Box>
      </Box>

      {/* Correct Answer Banner */}
      <Box
        sx={{
          background: "var(--gradient-success)",
          py: { xs: 2, sm: 4 },
          px: { xs: 4, sm: 6 },
          borderRadius: "var(--radius-md)",
          my: { xs: 2, sm: 4 },
          boxShadow: "0 4px 6px rgba(3, 116, 45, 0.3)",
          display: "flex",
          alignItems: { xs: "center", sm: "baseline" },
          justifyContent: "center",
          gap: 2,
          flexWrap: "wrap",
          flexDirection: { xs: "column", sm: "row" },
          textAlign: { xs: "center", sm: "left" },
        }}
      >
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-lg)",
            color: "rgba(255, 255, 255, 0.9)",
            letterSpacing: "0.5px",
          }}
        >
          Correct Answer:
        </Box>
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-mono)",
            fontSize: { xs: "var(--font-size-lg)", sm: "var(--font-size-xl)" },
            fontWeight: "bold",
            color: "var(--color-text-primary)",
          }}
        >
          {correctAnswer}
        </Box>
      </Box>

      {/* 2-column results grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 2, sm: 4 },
          my: { xs: 4, sm: 4 },
        }}
      >
        {/* Player Answers */}
        <Box sx={{ ...sxContentBox, p: { xs: 4, sm: 5 } }}>
          <Box
            component="h3"
            sx={{
              mt: 0,
              mb: 4,
              color: "var(--color-accent-purple)",
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-xl)",
              letterSpacing: "1px",
            }}
          >
            Player Answers
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(playerAnswers).map(([player, answer]) => {
              const pointsGained = playerResults[player];
              const isCorrect = pointsGained !== undefined && pointsGained > 0;
              return (
                <Box
                  key={player}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(60px, 0.8fr) 1.5fr auto",
                      sm: "minmax(80px, 1fr) minmax(120px, 2fr) auto",
                    },
                    gap: { xs: 2, sm: 4 },
                    alignItems: "center",
                    py: 2,
                    px: 4,
                    minHeight: 52,
                    background: isCorrect ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: `3px solid ${isCorrect ? "var(--color-success)" : "var(--color-error)"}`,
                    fontSize: "var(--font-size-base)",
                    transition: "all var(--transition-base)",
                    "&:hover": {
                      background: "var(--color-bg-hover)",
                    },
                  }}
                >
                  {/* Player name column */}
                  <Box
                    component="span"
                    sx={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      fontSize: "var(--font-size-sm)",
                    }}
                  >
                    <PlayerName playerId={player} />
                  </Box>

                  {/* Answer text column */}
                  <Box
                    component="span"
                    sx={{
                      display: "block",
                      color: "var(--color-text-primary)",
                      fontWeight: { xs: 600, sm: 500 },
                      fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: { xs: "nowrap", sm: "normal" },
                      wordBreak: { xs: "normal", sm: "break-word" },
                    }}
                  >
                    {answer || "(no answer)"}
                  </Box>

                  {/* Points + indicator column */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      flexShrink: 0,
                      justifyContent: "flex-end",
                    }}
                  >
                    {pointsGained !== undefined && pointsGained > 0 && (
                      <Box
                        component="span"
                        sx={{
                          fontFamily: "var(--font-mono)",
                          fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-md)" },
                          fontWeight: "bold",
                          color: "var(--color-success-light)",
                          background: "rgba(34, 197, 94, 0.15)",
                          py: "2px",
                          px: { xs: "6px", sm: "8px" },
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        +{pointsGained}
                      </Box>
                    )}
                    <Box
                      component="span"
                      sx={{
                        fontSize: { xs: "var(--font-size-lg)", sm: "var(--font-size-xl)" },
                        fontWeight: "bold",
                        textAlign: "center",
                        width: { xs: 24, sm: 30 },
                        color: isCorrect ? "var(--color-success-light)" : "var(--color-error)",
                      }}
                    >
                      {isCorrect ? "✓" : "✗"}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Scoreboard */}
        <Box sx={{ ...sxContentBox, p: { xs: 4, sm: 5 } }}>
          <Box
            component="h3"
            sx={{
              mt: 0,
              mb: 4,
              color: "var(--color-accent-purple)",
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-xl)",
              letterSpacing: "1px",
            }}
          >
            Scoreboard
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sortPlayersByScore(players).map(([player, score]) => (
              <Box key={player} sx={{ ...sxScoreItem, minHeight: 52 }}>
                <Box
                  component="span"
                  sx={{
                    fontWeight: 600,
                    color: "var(--color-accent-purple)",
                    fontSize: "var(--font-size-md)",
                  }}
                >
                  <PlayerName playerId={player} />
                </Box>
                <Box
                  component="span"
                  sx={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--font-size-xl)",
                    fontWeight: "bold",
                    color: "var(--color-accent-teal)",
                  }}
                >
                  {score}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Timer */}
      <Box sx={{ my: 2, flexShrink: 0, textAlign: "center" }}>
        <Box
          component="p"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-muted)",
            m: 0,
            mb: 1,
            letterSpacing: "1px",
          }}
        >
          Next question in
        </Box>
        <Timer timeRemainingMs={timeRemainingMs} resetKey={correctAnswer} variant="results" />
      </Box>
    </Box>
  );
}
