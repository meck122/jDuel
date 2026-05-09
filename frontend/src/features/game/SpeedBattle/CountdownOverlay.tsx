/**
 * CountdownOverlay - 3→2→1→GO! animation shown at round start.
 * Calls onDone after ~3.2s. Uses countdownPop keyframe from animations.css.
 */

import { useState, useEffect } from "react";
import { Box } from "@mui/material";

interface CountdownOverlayProps {
  onDone: () => void;
}

const STEPS = ["3", "2", "1", "GO!"];
const STEP_DURATION_MS = 800;

export function CountdownOverlay({ onDone }: CountdownOverlayProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      onDone();
      return;
    }

    const id = setTimeout(() => {
      setStep((s) => s + 1);
    }, STEP_DURATION_MS);

    return () => clearTimeout(id);
  }, [step, onDone]);

  if (step >= STEPS.length) return null;

  const label = STEPS[step];
  const isGo = label === "GO!";

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(18, 16, 28, 0.85)",
        backdropFilter: "blur(4px)",
      }}
    >
      <Box
        key={step}
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "var(--font-size-6xl)", sm: "10rem" },
          fontWeight: 900,
          letterSpacing: "4px",
          color: isGo ? "var(--color-accent-teal)" : "var(--color-text-primary)",
          textShadow: isGo
            ? "0 0 40px rgba(45, 212, 191, 0.6)"
            : "0 0 30px rgba(139, 92, 246, 0.5)",
          animation: "countdownPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          lineHeight: 1,
        }}
      >
        {label}
      </Box>
    </Box>
  );
}
