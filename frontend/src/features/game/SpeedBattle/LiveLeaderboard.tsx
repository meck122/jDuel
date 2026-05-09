/**
 * LiveLeaderboard - Live correct-count leaderboard for Speed Battle.
 *
 * compact={true} (default) → compact mobile strip: "You: N · Leader: M"
 * compact={false}          → full desktop side panel with ranked rows
 *
 * Data source: roomState.players (Record<playerId, correctCount>), sorted descending.
 * Only correct counts are shown — wrong counts are never exposed (R14 privacy contract).
 */

import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { PlayerName } from "../../../components/common/PlayerName/PlayerName";

interface LiveLeaderboardProps {
  /**
   * When true (default), renders the compact mobile strip.
   * When false, renders the full desktop side panel.
   */
  compact?: boolean;
}

export function LiveLeaderboard({ compact = true }: LiveLeaderboardProps) {
  const { roomState, playerId } = useGame();

  if (!roomState) return null;

  const players = roomState.players; // Record<playerId, correctCount>
  const myScore = players[playerId] ?? 0;

  // Sort players descending by correct count
  const sorted = Object.entries(players).sort(([, a], [, b]) => b - a);
  const leaderScore = sorted.length > 0 ? sorted[0][1] : 0;

  // ── Compact mobile strip ─────────────────────────────────────────────────
  if (compact) {
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

  // ── Desktop panel ────────────────────────────────────────────────────────
  return <LeaderboardPanel sorted={sorted} currentPlayerId={playerId} />;
}

// ── Subcomponent: desktop panel ──────────────────────────────────────────────

interface LeaderboardPanelProps {
  sorted: [string, number][];
  currentPlayerId: string;
}

function LeaderboardPanel({ sorted, currentPlayerId }: LeaderboardPanelProps) {
  const leaderScore = sorted.length > 0 ? sorted[0][1] : 0;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: "1px solid var(--color-border-subtle)",
          fontFamily: "var(--font-display)",
          fontSize: "var(--font-size-sm)",
          color: "var(--color-text-muted)",
          letterSpacing: "1.5px",
          textAlign: "center",
        }}
      >
        LEADERBOARD
      </Box>

      {/* Rows */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, px: 2, py: 2 }}>
        {sorted.map(([pid, score], i) => {
          const isLeader = i === 0 && score === leaderScore && score > 0;
          const isSelf = pid === currentPlayerId;

          return (
            <Box
              key={pid}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1,
                borderRadius: "var(--radius-sm)",
                border: "1px solid",
                borderColor: isSelf
                  ? "rgba(139, 92, 246, 0.35)"
                  : isLeader
                    ? "rgba(251, 191, 36, 0.25)"
                    : "transparent",
                background: isSelf
                  ? "rgba(139, 92, 246, 0.1)"
                  : isLeader
                    ? "rgba(251, 191, 36, 0.06)"
                    : "transparent",
                boxShadow: isLeader && !isSelf ? "0 0 8px rgba(251, 191, 36, 0.15)" : "none",
                transition:
                  "background var(--transition-base), border-color var(--transition-base)",
              }}
            >
              {/* Rank icon */}
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--font-size-xs)",
                  fontWeight: 700,
                  color: isLeader ? "var(--color-accent-gold)" : "var(--color-text-muted)",
                  minWidth: 20,
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {i === 0 ? "🥇" : i + 1}
              </Box>

              {/* Player name */}
              <Box
                component="span"
                sx={{
                  flex: 1,
                  fontSize: "var(--font-size-sm)",
                  fontWeight: isSelf ? 700 : 400,
                  color: isSelf
                    ? "var(--color-accent-purple)"
                    : isLeader
                      ? "var(--color-accent-gold)"
                      : "var(--color-text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                <PlayerName playerId={pid} />
              </Box>

              {/* Correct count badge */}
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 700,
                  color: isLeader ? "var(--color-accent-gold)" : "var(--color-accent-teal)",
                  flexShrink: 0,
                }}
              >
                {score} ✓
              </Box>
            </Box>
          );
        })}

        {sorted.length === 0 && (
          <Box
            sx={{
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "var(--font-size-xs)",
              py: 2,
            }}
          >
            No players yet
          </Box>
        )}
      </Box>

      {/* Privacy footer */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderTop: "1px solid var(--color-border-subtle)",
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text-disabled)",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.3px",
        }}
      >
        Correct answers only ✦
      </Box>
    </Box>
  );
}
