/**
 * CooldownRing - SVG circular countdown ring.
 * Shows 5-second cooldown progress as a draining arc.
 */

import { Box } from "@mui/material";

interface CooldownRingProps {
  /** Remaining cooldown in ms. Max is COOLDOWN_DURATION_MS. */
  remainingMs: number;
  /** Total cooldown duration in ms (default 5000). */
  totalMs?: number;
  /** Size in px (default 48). */
  size?: number;
}

export function CooldownRing({ remainingMs, totalMs = 5000, size = 48 }: CooldownRingProps) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs));
  // Arc drains clockwise as time runs out
  const dashOffset = circumference * (1 - progress);

  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <Box
        component="svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        sx={{ transform: "rotate(-90deg)", display: "block" }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border-default)"
          strokeWidth={3}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-error)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </Box>
      {/* Center label */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--font-size-sm)",
          fontWeight: 700,
          color: "var(--color-error)",
          lineHeight: 1,
        }}
      >
        {seconds}
      </Box>
    </Box>
  );
}
