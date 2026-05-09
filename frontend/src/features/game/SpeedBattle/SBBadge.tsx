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
        background: "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.08) 100%)",
        border: "1px solid rgba(251,191,36,0.5)",
        borderRadius: "var(--radius-full)",
        fontFamily: "var(--font-display)",
        fontSize: "var(--font-size-sm)",
        color: "var(--color-accent-gold)",
        letterSpacing: "1px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      ⚡ SPEED BATTLE
    </Box>
  );
}
