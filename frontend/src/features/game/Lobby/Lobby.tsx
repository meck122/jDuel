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
  const isSpeedBattle = roomState?.config?.gameMode === "speed_battle";

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
            mb: 5,
            pb: 5,
            borderBottom: "2px solid var(--color-accent-purple)",
          }}
        >
          <Box
            component="p"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-muted)",
              m: 0,
              mb: 1,
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            Room Code
          </Box>
          <Box
            component="h2"
            sx={{
              fontFamily: "var(--font-mono)",
              fontSize: {
                xs: "var(--font-size-2xl)",
                sm: "var(--font-size-3xl)",
                md: "var(--font-size-5xl)",
              },
              fontWeight: 700,
              color: "var(--color-accent-gold)",
              m: 0,
              mb: 2,
              letterSpacing: { xs: "6px", md: "10px" },
              textShadow: "0 2px 16px rgba(251, 191, 36, 0.35)",
            }}
          >
            {roomId}
          </Box>
          <Box
            component="span"
            sx={{
              fontFamily: "var(--font-display)",
              color: "var(--color-text-secondary)",
              fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-lg)" },
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
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-md)",
            p: { xs: 3, sm: 4 },
            mb: 5,
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
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: { xs: 3, md: 4 },
            my: 5,
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
                    ? "2px solid var(--color-accent-purple)"
                    : "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-md)",
                  py: 3,
                  px: { xs: 2, sm: 3 },
                  transition: "all var(--transition-base)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  boxShadow: isCurrentPlayer ? "var(--shadow-glow-purple)" : "none",
                  "&:hover": {
                    background: "var(--color-bg-hover)",
                    transform: "translateY(-2px)",
                    boxShadow: "var(--shadow-glow-purple)",
                    borderColor: "var(--color-accent-purple)",
                  },
                }}
              >
                <Box
                  sx={{
                    fontSize: "1.1rem",
                    width: 36,
                    height: 36,
                    background: "var(--color-bg-hover)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--color-border-subtle)",
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
                  {/* Reserve badge height on every card so rows align */}
                  <Box
                    component="span"
                    sx={{
                      color: "var(--color-accent-gold)",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      visibility: player === hostId ? "visible" : "hidden",
                    }}
                  >
                    Host
                  </Box>
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
              {isSpeedBattle ? "⚡ Start Speed Battle" : "Start Game"}
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
