/**
 * Shared sx pattern objects — replacements for global.css `composes:` classes.
 *
 * These mirror the reusable component classes in global.css (.card, .game-section,
 * etc.) for use in MUI `sx` props as components migrate away from CSS modules.
 *
 * Usage:
 *   import { sxCard } from '../styles/sxPatterns';
 *   <Box sx={{ ...sxCard, p: 4 }}>
 */

import type { SxProps, Theme } from "@mui/material/styles";

/** Equivalent of .card in global.css */
export const sxCard: SxProps<Theme> = {
  background: "var(--color-bg-secondary)",
  border: "2px solid var(--color-border-default)",
  borderRadius: "var(--radius-lg)",
  p: 6, // --spacing-xl = 32px = spacing(6)
  boxShadow: "var(--shadow-lg)",
  transition: "all var(--transition-base)",
  "&:hover": {
    borderColor: "var(--color-accent-purple)",
    boxShadow: "var(--shadow-glow-purple)",
  },
};

/** Equivalent of .game-section in global.css */
export const sxGameSection: SxProps<Theme> = {
  my: 6, // --spacing-xl margin top/bottom
  width: "100%",
};

/** Equivalent of .game-header in global.css */
export const sxGameHeader: SxProps<Theme> = {
  fontSize: "var(--font-size-3xl)",
  fontWeight: 700,
  mb: 5, // --spacing-lg
  textShadow: "0 2px 4px rgba(0,0,0,0.5)",
  background: "var(--gradient-purple-teal)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

/** Equivalent of .content-box in global.css */
export const sxContentBox: SxProps<Theme> = {
  background: "var(--color-bg-elevated)",
  p: 5, // --spacing-lg
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--color-border-subtle)",
};

/** Equivalent of .score-item in global.css */
export const sxScoreItem: SxProps<Theme> = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  px: 4, // --spacing-md
  py: 2, // --spacing-sm
  background: "var(--color-bg-secondary)",
  borderRadius: "var(--radius-sm)",
  borderLeft: "3px solid var(--color-accent-teal)",
  transition: "all var(--transition-base)",
  "&:hover": {
    background: "var(--color-bg-hover)",
    transform: "translateX(4px)",
  },
};

/** Equivalent of .player-grid in global.css */
export const sxPlayerGrid: SxProps<Theme> = {
  display: "grid",
  gridTemplateColumns: {
    xs: "repeat(auto-fill, minmax(150px, 1fr))",
    md: "repeat(auto-fill, minmax(200px, 1fr))",
  },
  gap: { xs: 4, md: 5 }, // md=spacing(4)=16px, lg=spacing(5)=24px
  my: 6, // --spacing-xl
};
