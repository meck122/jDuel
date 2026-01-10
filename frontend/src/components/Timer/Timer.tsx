import { useState, useEffect } from "react";
import styles from "./Timer.module.css";

interface TimerProps {
  timeRemainingMs: number;
  resetKey: number | string;
  className?: string;
  label?: string;
}

export const Timer = ({
  timeRemainingMs,
  resetKey,
  className,
  label = "Time remaining",
}: TimerProps) => {
  const [displayTime, setDisplayTime] = useState<number>(timeRemainingMs);

  useEffect(() => {
    setDisplayTime(timeRemainingMs);

    const interval = setInterval(() => {
      setDisplayTime((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemainingMs, resetKey]);

  // Map className prop to appropriate module style
  const getTimerClass = () => {
    if (className === "results-timer") return styles.resultsTimer;
    if (className === "game-over-timer") return styles.gameOverTimer;
    return styles.timer;
  };

  return (
    <p className={getTimerClass()}>
      {label}: {Math.ceil(displayTime / 1000)}s
    </p>
  );
};
