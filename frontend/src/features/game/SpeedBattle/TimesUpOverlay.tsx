/**
 * TimesUpOverlay - Full-screen animated "TIME'S UP!" announcement.
 *
 * Fades in (0.2s), holds (0.6s), fades out (0.4s), then calls onDone.
 * Total duration: ~1.2s.
 */

import { useEffect } from "react";
import { Box } from "@mui/material";

interface TimesUpOverlayProps {
  /** Called after the overlay animation completes (~1.2s) */
  onDone: () => void;
}

export function TimesUpOverlay({ onDone }: TimesUpOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.85)",
        animation: "timesUpFadeInOut 1.2s ease forwards",
        "@keyframes timesUpFadeInOut": {
          "0%": { opacity: 0 },
          "16.67%": { opacity: 1 }, // fade in complete at 0.2s / 1.2s
          "66.67%": { opacity: 1 }, // hold until 0.8s / 1.2s
          "100%": { opacity: 0 }, // fade out complete at 1.2s
        },
      }}
    >
      <Box
        component="span"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "var(--font-size-4xl)", sm: "var(--font-size-6xl)" },
          color: "var(--color-accent-gold)",
          letterSpacing: { xs: "4px", sm: "8px" },
          textShadow: "0 0 40px rgba(251, 191, 36, 0.6), 0 4px 20px rgba(0, 0, 0, 0.8)",
          userSelect: "none",
        }}
      >
        TIME&apos;S UP!
      </Box>
    </Box>
  );
}
