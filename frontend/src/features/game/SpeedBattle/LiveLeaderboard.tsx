/**
 * LiveLeaderboard - Compact mobile strip showing live correct counts.
 *
 * Compact mode (U4): "You: N · Leader: M" strip for mobile (<700px).
 * Panel mode is reserved for U5 (desktop side panel).
 */

import { Box } from "@mui/material";
import { useGame } from "../../../contexts";

interface LiveLeaderboardProps {
  /** If true, render the desktop panel layout (U5 fills this; U4 passes false). */
  panelMode?: boolean;
}

export function LiveLeaderboard({ panelMode = false }: LiveLeaderboardProps) {
  const { roomState, playerId } = useGame();

  if (!roomState) return null;

  const players = roomState.players; // Record<playerId, correctCount>
  const myScore = players[playerId] ?? 0;

  // Find leader score (highest correctCount among all players)
  const scores = Object.values(players);
  const leaderScore = scores.length > 0 ? Math.max(...scores) : 0;

  if (panelMode) {
    // U5 will implement this; for now return nothing to avoid breaking builds
    return null;
  }

  // Compact strip: "You: N · Leader: M"
  return (
    <Box
      sx={{
        display: { xs: "flex", sm: "none" },
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        px: 4,
        py: 1.5,
        background: "var(--color-bg-elevated)",
        borderBottom: "1px solid var(--color-border-subtle)",
        fontSize: "var(--font-size-sm)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
      }}
    >
      <Box component="span">
        <Box component="span" sx={{ color: "var(--color-accent-teal)", fontWeight: 700 }}>
          You:{" "}
        </Box>
        <Box component="span" sx={{ color: "var(--color-text-primary)", fontWeight: 700 }}>
          {myScore}
        </Box>
      </Box>
      <Box component="span" sx={{ color: "var(--color-border-emphasis)" }}>
        ·
      </Box>
      <Box component="span">
        <Box component="span" sx={{ color: "var(--color-accent-gold)", fontWeight: 700 }}>
          Leader:{" "}
        </Box>
        <Box component="span" sx={{ color: "var(--color-text-primary)", fontWeight: 700 }}>
          {leaderScore}
        </Box>
      </Box>
    </Box>
  );
}
