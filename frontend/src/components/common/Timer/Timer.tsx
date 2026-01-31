/**
 * Timer - Displays animated countdown timer with circular progress.
 *
 * This component:
 * - Receives time from server state
 * - Interpolates locally for smooth countdown
 * - Resets when resetKey changes (new question/phase)
 * - Shows circular progress animation
 */

import { useState, useEffect } from "react";
import styles from "./Timer.module.css";

type TimerVariant = "default" | "results" | "game-over";

interface TimerProps {
  timeRemainingMs: number;
  resetKey: number | string;
  variant?: TimerVariant;
}

export function Timer({ timeRemainingMs, resetKey, variant = "default" }: TimerProps) {
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
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determine color based on time remaining
  const getColor = () => {
    if (seconds <= 3) return "var(--color-timer-critical)";
    if (seconds <= 7) return "var(--color-timer-warning)";
    return "var(--color-timer-safe)";
  };

  const isCritical = seconds <= 3;
  const isWarning = seconds <= 7 && !isCritical;

  const variantStyles: Record<TimerVariant, string> = {
    default: styles.timerWrapper,
    results: styles.resultsTimerWrapper,
    "game-over": styles.gameOverTimerWrapper,
  };

  const wrapperClass = [
    variantStyles[variant],
    isCritical ? styles.critical : "",
    isWarning ? styles.warning : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
      <svg className={styles.timerSvg} viewBox="0 0 100 100">
        <circle className={styles.timerCircleBackground} cx="50" cy="50" r="45" />
        <circle
          className={styles.timerCircleProgress}
          cx="50"
          cy="50"
          r="45"
          stroke={getColor()}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className={styles.timerText} style={{ color: getColor() }}>
        {seconds}
      </div>
    </div>
  );
}
