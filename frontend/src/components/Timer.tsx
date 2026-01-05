import { useState, useEffect } from 'react';

interface TimerProps {
  timeRemainingMs: number;
  resetKey: number | string;
  className?: string;
  label?: string;
}

export const Timer = ({
  timeRemainingMs,
  resetKey,
  className = 'timer',
  label = 'Time remaining',
}: TimerProps) => {
  const [displayTime, setDisplayTime] = useState<number>(timeRemainingMs);

  useEffect(() => {
    setDisplayTime(timeRemainingMs);

    const interval = setInterval(() => {
      setDisplayTime((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemainingMs, resetKey]);

  return (
    <p className={className}>
      {label}: {Math.ceil(displayTime / 1000)}s
    </p>
  );
};
