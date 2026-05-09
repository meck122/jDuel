/**
 * SBBadge - "⚡ Speed Battle" badge pill for the top bar.
 */

import { Box } from "@mui/material";

export function SBBadge() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: 3,
        py: 1,
        background: "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(45,212,191,0.15) 100%)",
        border: "1px solid var(--color-accent-purple)",
        borderRadius: "var(--radius-full)",
        fontFamily: "var(--font-display)",
        fontSize: "var(--font-size-sm)",
        color: "var(--color-accent-purple)",
        letterSpacing: "1px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      ⚡ SPEED BATTLE
    </Box>
  );
}
