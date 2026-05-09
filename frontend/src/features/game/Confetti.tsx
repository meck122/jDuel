/**
 * Confetti - Decorative confetti animation overlay.
 *
 * Renders a set of falling confetti pieces as an absolute-positioned
 * overlay. Parent must have `position: relative` and `overflow: hidden`.
 */

import { Box } from "@mui/material";

const CONFETTI_PIECES = [
  {
    left: "5%",
    color: "var(--color-accent-purple)",
    delay: "0s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "15%",
    color: "var(--color-accent-red)",
    delay: "0.3s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "25%",
    color: "var(--color-accent-teal)",
    delay: "0.7s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "35%",
    color: "var(--color-accent-red)",
    delay: "0.15s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "45%",
    color: "var(--color-accent-purple)",
    delay: "0.9s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "55%",
    color: "var(--color-accent-teal)",
    delay: "0.2s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "65%",
    color: "var(--color-accent-red)",
    delay: "0.6s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "75%",
    color: "var(--color-accent-purple)",
    delay: "1s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "82%",
    color: "var(--color-accent-teal)",
    delay: "0.4s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
  {
    left: "90%",
    color: "var(--color-accent-red)",
    delay: "0.8s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "10%",
    color: "var(--color-accent-purple)",
    delay: "1.8s",
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  {
    left: "50%",
    color: "var(--color-accent-red)",
    delay: "2.2s",
    width: 10,
    height: 24,
    borderRadius: "0%",
  },
] as const;

export function Confetti() {
  return (
    <Box
      sx={{
        position: "absolute",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {CONFETTI_PIECES.map((piece, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            left: piece.left,
            width: piece.width,
            height: piece.height,
            top: -30,
            opacity: 0,
            borderRadius: piece.borderRadius,
            background: piece.color,
            animation: `confettiFall 3.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${piece.delay} infinite`,
          }}
        />
      ))}
    </Box>
  );
}
