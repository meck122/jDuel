import { ReactNode } from "react";
import { Box } from "@mui/material";
import { PlayerName } from "../../components/common/PlayerName/PlayerName";

export interface FinalRow {
  placement: number;
  playerId: string;
  scoreDisplay: ReactNode;
}

interface FinalStandingsProps {
  rows: FinalRow[];
  selfPlayerId?: string;
  tiebreakerText?: string;
}

function rankEmoji(placement: number): string {
  if (placement === 1) return "🥇";
  if (placement === 2) return "🥈";
  if (placement === 3) return "🥉";
  return String(placement);
}

export function FinalStandings({ rows, selfPlayerId, tiebreakerText }: FinalStandingsProps) {
  return (
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
        {rows.map((row) => {
          const isSelf = selfPlayerId !== undefined && row.playerId === selfPlayerId;
          const isWinner = row.placement === 1;

          return (
            <Box
              key={row.playerId}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "28px 1fr auto", sm: "40px 1fr auto" },
                gap: { xs: 2, sm: 4 },
                alignItems: "center",
                background: isSelf
                  ? "linear-gradient(90deg, rgba(139, 92, 246, 0.18), rgba(139, 92, 246, 0.05))"
                  : isWinner
                    ? "linear-gradient(90deg, rgba(139, 92, 246, 0.15), rgba(251, 191, 36, 0.08))"
                    : "var(--color-bg-elevated)",
                py: { xs: 2, sm: 4 },
                px: { xs: 4, sm: 5 },
                borderRadius: "var(--radius-md)",
                border: "2px solid",
                borderColor:
                  isSelf || isWinner ? "var(--color-accent-purple)" : "var(--color-border-default)",
                boxShadow: isSelf || isWinner ? "var(--shadow-glow-purple)" : "none",
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
                  color: isWinner ? "var(--color-accent-gold)" : "var(--color-accent-teal)",
                  textAlign: "center",
                }}
              >
                {rankEmoji(row.placement)}
              </Box>

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

              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-xl)" },
                  fontWeight: 700,
                  color: isWinner ? "var(--color-accent-gold)" : "var(--color-accent-teal)",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {row.scoreDisplay}
              </Box>
            </Box>
          );
        })}

        {rows.length === 0 && (
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

      {tiebreakerText && (
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
          {tiebreakerText}
        </Box>
      )}
    </Box>
  );
}
