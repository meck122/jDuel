/**
 * Reactions - Playful trash-talk emotes during results / game over.
 *
 * Renders two things:
 * - A fixed bottom button bar for firing reactions
 * - A floating feed showing reactions received from all players
 *
 * Reactions arrive via a module-level emitter (reactionEmitter) rather than
 * React context. Context state updates originating from native WebSocket
 * events are deferred by React 19's automatic batching, which would cause
 * reactions to appear one click behind. The emitter notifies this component
 * directly; the resulting local setState is batched and flushed at the end
 * of the same WebSocket onmessage event — fast enough to be imperceptible.
 *
 * Local state is naturally cleared when this component unmounts (i.e. when
 * the game leaves the results/finished phase), so no explicit reset is needed.
 *
 * Cooldown is enforced server-side (3s). The client mirrors it locally
 * to disable buttons as a UX hint.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { subscribeToReactions } from "../../../services/reactionEmitter";
import { Reaction } from "../../../types";

const COOLDOWN_MS = 3000;

export function Reactions() {
  const { sendReaction, roomState } = useGame();
  const availableReactions = roomState?.reactions ?? [];
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const lastSentAt = useRef<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Subscribe to incoming reactions from the WebSocket emitter
  useEffect(() => {
    return subscribeToReactions((reaction) => {
      setReactions((prev) => [...prev, reaction]);
    });
  }, []);

  // Cooldown countdown tick — updates button disabled state every 100ms
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        const next = prev - 100;
        return next <= 0 ? 0 : next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const handleReaction = useCallback(
    (id: number) => {
      const now = Date.now();
      if (now - lastSentAt.current < COOLDOWN_MS) return;
      lastSentAt.current = now;
      setCooldownRemaining(COOLDOWN_MS);
      sendReaction(id);
    },
    [sendReaction]
  );

  return (
    <>
      {/* Reaction feed — floating overlay, newest at top */}
      <Box
        sx={{
          position: "fixed",
          top: {
            xs: "calc(var(--navbar-height) + var(--spacing-xs))",
            sm: "calc(var(--navbar-height) + var(--spacing-sm))",
          },
          right: { xs: 0, sm: "var(--spacing-md)" },
          left: { xs: 0, sm: "auto" },
          width: { xs: "auto", sm: 260 },
          maxHeight: { xs: 120, sm: 200 },
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          zIndex: 99,
          pointerEvents: "none",
        }}
      >
        {[...reactions].reverse().map((r) => {
          const reaction = availableReactions.find((ar) => ar.id === r.reactionId);
          if (!reaction) return null;
          return (
            <Box
              key={`${r.playerId}-${r.receivedAt}`}
              sx={{
                flexShrink: 0,
                mb: 1,
                background: "rgba(34, 32, 48, 0.9)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-sm)",
                py: 1,
                px: 2,
                animation: "feedSlideIn 300ms ease forwards",
                display: "flex",
                alignItems: "baseline",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Box
                component="span"
                sx={{
                  color: "var(--color-accent-purple)",
                  fontWeight: 600,
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "var(--font-mono)",
                  whiteSpace: "nowrap",
                }}
              >
                {r.playerId}
              </Box>
              <Box
                component="span"
                sx={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {reaction.label}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Reaction button bar — fixed bottom */}
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          gap: { xs: 1, sm: 2 },
          py: { xs: 1, sm: 2 },
          px: { xs: 2, sm: 4 },
          background: "rgba(18, 16, 28, 0.92)",
          backdropFilter: "blur(8px)",
          borderTop: "1px solid var(--color-border-subtle)",
          zIndex: 100,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {availableReactions.map((reaction) => (
          <Box
            key={reaction.id}
            component="button"
            onClick={() => handleReaction(reaction.id)}
            disabled={cooldownRemaining > 0}
            sx={{
              p: { xs: "4px 8px", sm: "8px 16px" },
              fontSize: { xs: "var(--font-size-xs)", sm: "var(--font-size-sm)" },
              fontFamily: "var(--font-mono)",
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              textTransform: "none",
              letterSpacing: 0,
              "&:hover:not(:disabled)": {
                borderColor: "var(--color-accent-purple)",
                boxShadow: "0 0 8px rgba(139, 92, 246, 0.4)",
                transform: "translateY(-1px)",
                filter: "none",
              },
              "&:active:not(:disabled)": {
                transform: "translateY(0)",
              },
              "&:disabled": {
                opacity: 0.4,
                cursor: "not-allowed",
                transform: "none",
                boxShadow: "none",
              },
            }}
          >
            {reaction.label}
          </Box>
        ))}
      </Box>
    </>
  );
}
