/**
 * MatchTimerBar - Pill-shaped MM:SS match timer.
 * Color-shifts: green (>60s) → amber (30-60s) → red (<30s).
 * Pulses via timerPulse keyframe when critical (<30s).
 * compact=true hides the progress bar (used on mobile to save horizontal space).
 */

import { Box } from "@mui/material";

interface MatchTimerBarProps {
  remainingMs: number;
  totalMs?: number;
  compact?: boolean;
}

function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MatchTimerBar({
  remainingMs,
  totalMs = 180_000,
  compact = false,
}: MatchTimerBarProps) {
  const isCritical = remainingMs < 30_000;
  const isWarning = remainingMs < 60_000 && !isCritical;

  const color = isCritical
    ? "var(--color-timer-critical)"
    : isWarning
      ? "var(--color-timer-warning)"
      : "var(--color-timer-safe)";

  const borderColor = isCritical
    ? "rgba(239,68,68,0.4)"
    : isWarning
      ? "rgba(251,146,60,0.3)"
      : "rgba(45,212,191,0.2)";

  const pct = Math.max(0, Math.min(1, remainingMs / totalMs));

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 1.5 : 2,
        px: compact ? 2 : 3,
        py: 1,
        background: "var(--color-bg-elevated)",
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-full)",
        boxShadow: isCritical
          ? "0 0 12px rgba(239,68,68,0.25)"
          : isWarning
            ? "0 0 8px rgba(251,146,60,0.2)"
            : "none",
        flexShrink: 0,
        animation: isCritical ? "timerPulse 1s ease-in-out infinite" : "none",
        transition: "border-color 0.5s, box-shadow 0.5s",
      }}
    >
      <Box component="span" sx={{ fontSize: "0.9rem", lineHeight: 1 }}>
        ⏱
      </Box>
      <Box
        component="span"
        sx={{
          fontFamily: "var(--font-mono)",
          fontSize: compact ? "var(--font-size-lg)" : "var(--font-size-xl)",
          fontWeight: 700,
          color,
          letterSpacing: "2px",
          minWidth: compact ? 52 : 60,
          textAlign: "center",
          transition: "color 0.5s",
        }}
      >
        {formatMmSs(remainingMs)}
      </Box>
      {/* Progress bar — hidden on compact (mobile) */}
      {!compact && (
        <Box
          sx={{
            width: 72,
            height: 4,
            background: "var(--color-bg-hover)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${pct * 100}%`,
              background: color,
              borderRadius: 2,
              transition: "width 0.5s linear, background 0.3s",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
