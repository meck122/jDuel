/**
 * MatchTimerBar - Pill-shaped MM:SS match timer.
 * Color-shifts: green (>60s) → amber (30-60s) → red (<30s).
 * Pulses via timerPulse keyframe when critical (<30s).
 */

import { Box } from "@mui/material";

interface MatchTimerBarProps {
  remainingMs: number;
}

function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MatchTimerBar({ remainingMs }: MatchTimerBarProps) {
  const isCritical = remainingMs < 30_000;
  const isWarning = remainingMs < 60_000 && !isCritical;

  const color = isCritical
    ? "var(--color-timer-critical)"
    : isWarning
      ? "var(--color-timer-warning)"
      : "var(--color-timer-safe)";

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 3,
        py: 1,
        background: "var(--color-bg-elevated)",
        border: `1px solid ${color}`,
        borderRadius: "var(--radius-full)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--font-size-base)",
        fontWeight: 700,
        color,
        letterSpacing: "1px",
        minWidth: 72,
        justifyContent: "center",
        flexShrink: 0,
        animation: isCritical ? "timerPulse 1s ease-in-out infinite" : "none",
        transition: "border-color 0.5s, color 0.5s",
      }}
    >
      {formatMmSs(remainingMs)}
    </Box>
  );
}
