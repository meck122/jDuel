/**
 * MatchTimerBar - Pill-shaped MM:SS match timer.
 * Color-shifts: green (>60s) → amber (30-60s) → red (<30s).
 * Pulses via timerPulse keyframe when critical (<30s).
 *
 * compact=true  — small pill, no progress bar (desktop top bar / sidebar)
 * fullWidth=true — full-width pill with large font and expanding progress bar
 *                  (mobile bottom anchor)
 */

import { Box } from "@mui/material";

interface MatchTimerBarProps {
  remainingMs: number;
  totalMs?: number;
  compact?: boolean;
  fullWidth?: boolean;
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
  fullWidth = false,
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
        display: fullWidth ? "flex" : "inline-flex",
        width: fullWidth ? "100%" : undefined,
        alignItems: "center",
        gap: fullWidth ? 3 : compact ? 3 : 2,
        px: fullWidth ? 4 : compact ? 2 : 3,
        py: fullWidth ? "10px" : 1,
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
      <Box
        component="span"
        sx={{ fontSize: fullWidth ? "1.4rem" : "0.9rem", lineHeight: 1, flexShrink: 0 }}
      >
        ⏱
      </Box>
      <Box
        component="span"
        sx={{
          fontFamily: "var(--font-mono)",
          fontSize: fullWidth
            ? "var(--font-size-2xl)"
            : compact
              ? "var(--font-size-lg)"
              : "var(--font-size-xl)",
          fontWeight: 700,
          color,
          letterSpacing: "2px",
          minWidth: fullWidth ? undefined : compact ? 52 : 60,
          textAlign: "center",
          flexShrink: 0,
          transition: "color 0.5s",
        }}
      >
        {formatMmSs(remainingMs)}
      </Box>

      {/* Progress bar — fullWidth stretches to fill, standard has fixed width, compact omits */}
      {(fullWidth || !compact) && (
        <Box
          sx={{
            flex: fullWidth ? 1 : undefined,
            width: fullWidth ? undefined : 72,
            height: fullWidth ? 6 : 4,
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
