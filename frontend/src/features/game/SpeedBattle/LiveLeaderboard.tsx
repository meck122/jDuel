/**
 * LiveLeaderboard - Live correct-count leaderboard for Speed Battle.
 *
 * compact={true} (default) → top-3 mini-podium strip with 🥇🥈🥉 slots.
 *   If you're outside the top 3, slot 3 shows your rank instead.
 *   Center slot (1st) is elevated visually.
 * compact={false} → full desktop side panel with ranked rows.
 *
 * Data source: roomState.players (Record<playerId, correctCount>), sorted descending.
 * Only correct counts are shown — wrong counts are never exposed (R14 privacy contract).
 */

import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { PlayerName } from "../../../components/common/PlayerName/PlayerName";

interface LiveLeaderboardProps {
  compact?: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function LiveLeaderboard({ compact = true }: LiveLeaderboardProps) {
  const { roomState, playerId } = useGame();

  if (!roomState) return null;

  const players = roomState.players;
  const sorted = Object.entries(players).sort(([, a], [, b]) => b - a);
  const leaderScore = sorted.length > 0 ? sorted[0][1] : 0;

  // ── Compact mobile strip: top-3 mini-podium ──────────────────────────────
  if (compact) {
    const myRank = sorted.findIndex(([pid]) => pid === playerId) + 1;
    const meInTop3 = myRank >= 1 && myRank <= 3;

    // Slots: [1st, 2nd, 3rd]. If I'm outside top 3, replace 3rd with me.
    const slots = sorted.slice(0, 3);
    while (slots.length < 3) slots.push(["", 0]);
    const slotRanks = [1, 2, 3];

    if (!meInTop3 && myRank > 0) {
      const myEntry = sorted[myRank - 1] ?? [playerId, 0];
      slots[2] = myEntry;
      slotRanks[2] = myRank;
    }

    return (
      <Box
        sx={{
          display: { xs: "grid", sm: "none" },
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "6px",
          px: 3,
          py: 2,
          mt: { xs: 3, sm: 0 },
          background: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-subtle)",
          flexShrink: 0,
        }}
      >
        {slots.map(([pid, score], idx) => {
          const rank = slotRanks[idx];
          const isMe = pid === playerId;
          const isFirst = rank === 1;
          const elevated = idx === 0;

          const accentColor =
            rank === 1
              ? "var(--color-accent-gold)"
              : rank === 2
                ? "rgba(220,220,235,0.85)"
                : rank === 3
                  ? "rgba(205,127,50,0.95)"
                  : "var(--color-accent-purple)";

          return (
            <Box
              key={`${pid}-${idx}`}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: elevated ? 1.5 : 1,
                px: 1,
                background: isMe
                  ? "rgba(139,92,246,0.12)"
                  : elevated
                    ? "rgba(251,191,36,0.06)"
                    : "var(--color-bg-elevated)",
                border: "1px solid",
                borderColor: isMe
                  ? "var(--color-accent-purple)"
                  : isFirst
                    ? "rgba(251,191,36,0.35)"
                    : "var(--color-border-subtle)",
                borderRadius: "var(--radius-md)",
                boxShadow: isMe ? "var(--shadow-glow-purple)" : "none",
                gap: "2px",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "3px",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                <Box component="span" sx={{ fontSize: "0.8rem" }}>
                  {MEDALS[rank - 1] ?? `#${rank}`}
                </Box>
                <Box
                  component="span"
                  sx={{
                    color: isMe ? "var(--color-accent-purple)" : "var(--color-text-primary)",
                    maxWidth: 56,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.3px",
                  }}
                >
                  {pid ? isMe ? "You" : <PlayerName playerId={pid} /> : "—"}
                </Box>
              </Box>
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontSize: elevated ? "var(--font-size-xl)" : "var(--font-size-lg)",
                  fontWeight: 700,
                  color: accentColor,
                  letterSpacing: 0,
                  lineHeight: 1,
                }}
              >
                {pid ? score : "—"}
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  }

  // ── Desktop panel ────────────────────────────────────────────────────────
  return <LeaderboardPanel sorted={sorted} currentPlayerId={playerId} leaderScore={leaderScore} />;
}

// ── Subcomponent: desktop panel ──────────────────────────────────────────────

interface LeaderboardPanelProps {
  sorted: [string, number][];
  currentPlayerId: string;
  leaderScore: number;
}

function LeaderboardPanel({ sorted, currentPlayerId, leaderScore }: LeaderboardPanelProps) {
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
          color: "var(--color-accent-purple)",
          letterSpacing: "1.5px",
          textAlign: "center",
        }}
      >
        Live Leaderboard
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
                transition:
                  "background var(--transition-base), border-color var(--transition-base)",
              }}
            >
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
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </Box>
              <Box
                component="span"
                sx={{
                  flex: 1,
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--font-size-sm)",
                  letterSpacing: "0.5px",
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
              fontFamily: "var(--font-display)",
              letterSpacing: "1px",
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
          pt: 3,
          pb: 2,
          borderTop: "1px solid var(--color-border-subtle)",
          fontSize: "10px",
          color: "var(--color-text-disabled)",
          textAlign: "center",
          fontFamily: "var(--font-display)",
          letterSpacing: "1px",
        }}
      >
        Correct answers only
      </Box>
    </Box>
  );
}
