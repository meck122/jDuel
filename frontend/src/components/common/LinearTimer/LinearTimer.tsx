/**
 * LinearTimer - Displays countdown with horizontal progress bar.
 *
 * This component:
 * - Receives time from server state
 * - Interpolates locally for smooth countdown
 * - Resets when resetKey changes (new question/phase)
 * - Shows horizontal progress bar animation
 * - Two variants: results (teal gradient bar) and subtle (text-only)
 */

import { useState, useEffect } from "react";
import styles from "./LinearTimer.module.css";

type LinearTimerVariant = "results" | "subtle";

interface LinearTimerProps {
  timeRemainingMs: number;
  resetKey: number | string;
  variant?: LinearTimerVariant;
  label?: string; // e.g., "Next question in"
}

export function LinearTimer({
  timeRemainingMs,
  resetKey,
  variant = "results",
  label,
}: LinearTimerProps) {
  const [timerState, setTimerState] = useState({
    displayTime: timeRemainingMs,
    initialTime: timeRemainingMs,
    startTime: 0,
  });

  useEffect(() => {
    const now = Date.now();
    // Timer reset requires synchronous state update when dependencies change
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimerState({
      displayTime: timeRemainingMs,
      initialTime: timeRemainingMs,
      startTime: now,
    });

    const interval = setInterval(() => {
      setTimerState((prev) => {
        const elapsed = Date.now() - prev.startTime;
        const newTime = Math.max(0, timeRemainingMs - elapsed);
        return { ...prev, displayTime: newTime };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [resetKey, timeRemainingMs]);

  const { displayTime, initialTime } = timerState;
  const seconds = Math.ceil(displayTime / 1000);
  const progress = initialTime > 0 ? (displayTime / initialTime) * 100 : 0;

  if (variant === "subtle") {
    // Text-only countdown for low-urgency contexts (GameOver)
    return (
      <div className={styles.subtleTimer}>
        {label && <span className={styles.label}>{label} </span>}
        <span className={styles.seconds}>{seconds}s</span>
      </div>
    );
  }

  // Progress bar variant for Results
  return (
    <div className={styles.resultsTimer}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.progressBarContainer}>
        <div
          className={styles.progressBar}
          style={{
            width: `${progress}%`,
          }}
        />
      </div>
      <div className={styles.timeText}>{seconds}s</div>
    </div>
  );
}
