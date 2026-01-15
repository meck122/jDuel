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

interface TimerProps {
  timeRemainingMs: number;
  resetKey: number | string;
  className?: string;
}

export function Timer({ timeRemainingMs, resetKey, className }: TimerProps) {
  const [displayTime, setDisplayTime] = useState<number>(timeRemainingMs);
  const [initialTime, setInitialTime] = useState<number>(timeRemainingMs);
  const [startTime, setStartTime] = useState<number>(Date.now());

  useEffect(() => {
    setDisplayTime(timeRemainingMs);
    setInitialTime(timeRemainingMs);
    setStartTime(Date.now());

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newTime = Math.max(0, timeRemainingMs - elapsed);
      setDisplayTime(newTime);
    }, 100);

    return () => clearInterval(interval);
  }, [timeRemainingMs, resetKey]);

  const seconds = Math.ceil(displayTime / 1000);
  const progress = (displayTime / initialTime) * 100;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determine color based on time remaining
  const getColor = () => {
    if (seconds <= 3) return "var(--color-error)";
    if (seconds <= 7) return "var(--color-warning)";
    return "var(--color-success)";
  };

  // Map className prop to appropriate wrapper style
  const getTimerClass = () => {
    if (className === "results-timer") return styles.resultsTimerWrapper;
    if (className === "game-over-timer") return styles.gameOverTimerWrapper;
    return styles.timerWrapper;
  };

  return (
    <div className={getTimerClass()}>
      <svg className={styles.timerSvg} viewBox="0 0 100 100">
        <circle
          className={styles.timerCircleBackground}
          cx="50"
          cy="50"
          r="45"
        />
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
