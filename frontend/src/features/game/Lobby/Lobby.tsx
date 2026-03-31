/**
 * Lobby - Waiting room displayed before game starts.
 *
 * Shows:
 * - Room code and share link
 * - List of joined players with host badge
 * - Difficulty selector (host only)
 * - Multiple choice toggle (host only)
 * - Start game button (host only)
 */

import { useState } from "react";
import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { PlayerName } from "../../../components";
import { GameSettings } from "../GameSettings";
import { sxCard } from "../../../styles/sxPatterns";

export function Lobby() {
  const { roomId, playerId, roomState, startGame } = useGame();
  const [copied, setCopied] = useState(false);

  const players = roomState?.players ?? {};
  const playerCount = Object.keys(players).length;
  const isHost = roomState?.hostId === playerId;
  const hostId = roomState?.hostId;
  const shareUrl = `${window.location.origin}/room/${roomId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        gap: 6,
        alignItems: { xs: "stretch", md: "start" },
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      {/* Main lobby card */}
      <Box
        sx={{
          ...sxCard,
          p: { xs: 4, sm: 5, md: 7 },
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            textAlign: "center",
            mb: 6,
            pb: 5,
            borderBottom: "2px solid var(--color-accent-purple)",
          }}
        >
          <Box
            component="h2"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: {
                xs: "var(--font-size-xl)",
                sm: "var(--font-size-2xl)",
                md: "var(--font-size-5xl)",
              },
              fontWeight: 400,
              color: "var(--color-accent-purple)",
              m: 0,
              mb: 2,
              letterSpacing: { xs: "2px", md: "4px" },
              textShadow: "0 2px 12px rgba(139, 92, 246, 0.4)",
            }}
          >
            Room {roomId}
          </Box>
          <Box
            component="span"
            sx={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text-primary)",
              fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-xl)" },
              letterSpacing: "1px",
            }}
          >
            {playerCount} Player{playerCount !== 1 ? "s" : ""} Joined
          </Box>
        </Box>

        {/* Share Section */}
        <Box
          sx={{
            background: "var(--color-bg-elevated)",
            border: "2px solid var(--color-border-default)",
            borderRadius: "var(--radius-md)",
            p: { xs: 4, sm: 5 },
            mb: 6,
            textAlign: "center",
          }}
        >
          <Box
            component="p"
            sx={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text-dim)",
              fontSize: "var(--font-size-sm)",
              m: 0,
              mb: 2,
              letterSpacing: "0.5px",
            }}
          >
            Invite friends to join:
          </Box>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "center",
              flexWrap: "wrap",
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <Box
              component="code"
              sx={{
                background: "var(--color-bg-primary)",
                py: 2,
                px: { xs: 2, sm: 4 },
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-mono)",
                fontSize: { xs: "var(--font-size-xs)", sm: "var(--font-size-sm)" },
                color: "var(--color-accent-purple)",
                wordBreak: "break-all",
                textAlign: { xs: "center", sm: "left" },
              }}
            >
              {shareUrl}
            </Box>
            <Box
              component="button"
              onClick={handleCopyLink}
              title="Copy invite link"
              sx={{
                py: { xs: "12px", sm: 2 },
                px: 4,
                fontSize: "var(--font-size-sm)",
                whiteSpace: "nowrap",
                background: "transparent",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-secondary)",
                width: { xs: "100%", sm: "auto" },
                "&:hover": {
                  borderColor: "var(--color-accent-purple)",
                  background: "rgba(139, 92, 246, 0.1)",
                  boxShadow: "none",
                  transform: "none",
                  filter: "none",
                },
              }}
            >
              {copied ? "✓ Copied!" : "📋 Copy"}
            </Box>
          </Box>
        </Box>

        {/* Players grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: { xs: 4, md: 5 },
            my: 6,
          }}
        >
          {Object.keys(players).map((player) => {
            const isCurrentPlayer = player === playerId;
            return (
              <Box
                key={player}
                sx={{
                  background: isCurrentPlayer
                    ? "rgba(139, 92, 246, 0.1)"
                    : "var(--color-bg-elevated)",
                  border: isCurrentPlayer
                    ? "3px solid var(--color-accent-purple)"
                    : "2px solid var(--color-border-default)",
                  borderRadius: "var(--radius-md)",
                  py: 2,
                  px: { xs: 2, sm: 4 },
                  transition: "all var(--transition-base)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  boxShadow: isCurrentPlayer ? "var(--shadow-glow-purple)" : "none",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "var(--shadow-glow-purple)",
                    borderColor: "var(--color-accent-purple)",
                  },
                }}
              >
                <Box
                  sx={{
                    fontSize: "1.25rem",
                    width: 40,
                    height: 40,
                    background: "var(--color-bg-hover)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid var(--color-border-subtle)",
                  }}
                >
                  👤
                </Box>
                <Box
                  sx={{
                    color: "var(--color-text-primary)",
                    fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
                    fontWeight: 600,
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  <PlayerName playerId={player} />
                  {player === hostId && (
                    <Box
                      component="span"
                      sx={{
                        color: "var(--color-accent-gold)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                      }}
                    >
                      Host
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Waiting / Start */}
        <Box
          sx={{
            textAlign: "center",
            mt: { xs: 5, sm: 7 },
            pt: { xs: 4, sm: 6 },
            borderTop: "2px solid var(--color-border-default)",
          }}
        >
          <Box
            component="p"
            sx={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text-primary)",
              fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-lg)" },
              m: 0,
              mb: 5,
              letterSpacing: "0.5px",
            }}
          >
            {isHost
              ? "Press Start when everyone's ready!"
              : "Waiting for host to start the game..."}
          </Box>
          {isHost && (
            <Box
              component="button"
              onClick={startGame}
              sx={{
                py: 4,
                px: { xs: 6, md: 8 },
                fontSize: { xs: "var(--font-size-lg)", md: "var(--font-size-xl)" },
                background: "var(--gradient-gold)",
                color: "rgb(14, 12, 22)",
                letterSpacing: "3px",
                width: { xs: "100%", sm: "auto" },
                "&:hover": {
                  boxShadow: "var(--shadow-glow-gold)",
                  filter: "brightness(1.05)",
                },
              }}
            >
              Start Game
            </Box>
          )}
        </Box>

        {/* Settings inline (mobile only) */}
        <Box
          sx={{
            display: { xs: "block", md: "none" },
            mt: 5,
            pt: 5,
            borderTop: "2px solid var(--color-border-default)",
          }}
        >
          <GameSettings />
        </Box>
      </Box>

      {/* Settings side panel (desktop only) */}
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <GameSettings />
      </Box>
    </Box>
  );
}
