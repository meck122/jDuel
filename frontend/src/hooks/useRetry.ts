/**
 * useRetry - Generic retry hook with exponential backoff and rate limit handling
 *
 * Provides automatic retry logic with:
 * - Exponential backoff (500ms -> 1s -> 2s -> 4s -> 8s max)
 * - Jitter (±20%) to prevent thundering herd
 * - Rate limit override (respects retryAfter from ApiError, used as floor)
 * - Real-time countdown timer for UI
 * - Manual retry/cancel controls
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ApiError } from "../services/api";

export interface UseRetryOptions {
  maxRetries: number; // Default: 4
  initialDelay: number; // Default: 500ms
  maxDelay: number; // Default: 8000ms
  exponential: boolean; // Default: true
  jitter: boolean; // Default: true
}

export interface UseRetryState {
  isRetrying: boolean;
  currentAttempt: number;
  nextRetryIn: number | null; // Seconds remaining
  error: Error | null;
}

const DEFAULT_OPTIONS: UseRetryOptions = {
  maxRetries: 4,
  initialDelay: 500,
  maxDelay: 8000,
  exponential: true,
  jitter: true,
};

/**
 * Calculate delay for retry attempt with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  exponential: boolean,
  jitter: boolean
): number {
  const baseDelay = exponential ? initialDelay * Math.pow(2, attempt) : initialDelay;
  const cappedDelay = Math.min(baseDelay, maxDelay);

  if (jitter) {
    // Add ±20% randomization to prevent thundering herd
    const jitterAmount = cappedDelay * 0.2;
    return cappedDelay + (Math.random() * 2 - 1) * jitterAmount;
  }

  return cappedDelay;
}

export function useRetry(
  operation: () => Promise<void>,
  options?: Partial<UseRetryOptions>
): UseRetryState & {
  retry: () => void;
  cancel: () => void;
  reset: () => void;
} {
  // Memoize options to avoid dependency issues
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);

  const [isRetrying, setIsRetrying] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const retryTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const nextRetryTimestampRef = useRef<number | null>(null);
  const executeWithRetryRef = useRef<((attemptNumber: number) => Promise<void>) | null>(null);

  // Clean up timers on unmount or when retrying stops
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (!isRetrying || nextRetryTimestampRef.current === null) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      const remaining = Math.ceil((nextRetryTimestampRef.current! - Date.now()) / 1000);
      setNextRetryIn(Math.max(0, remaining));

      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [isRetrying]);

  // Define executeWithRetry function
  useEffect(() => {
    executeWithRetryRef.current = async (attemptNumber: number) => {
      setCurrentAttempt(attemptNumber + 1);

      try {
        await operation();
        // Success - reset state
        setIsRetrying(false);
        setCurrentAttempt(0);
        setNextRetryIn(null);
        setError(null);
        nextRetryTimestampRef.current = null;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        // Check if we should retry
        if (attemptNumber < opts.maxRetries) {
          setIsRetrying(true);

          // Calculate delay: use max(serverRetryAfter, backoff) to prevent thundering herd
          const backoffDelay = calculateDelay(
            attemptNumber,
            opts.initialDelay,
            opts.maxDelay,
            opts.exponential,
            opts.jitter
          );
          let delay: number;
          if (error instanceof ApiError && error.retryAfter) {
            delay = Math.max(error.retryAfter * 1000, backoffDelay);
          } else {
            delay = backoffDelay;
          }

          // Set up countdown
          nextRetryTimestampRef.current = Date.now() + delay;
          setNextRetryIn(Math.ceil(delay / 1000));

          // Schedule retry
          retryTimeoutRef.current = window.setTimeout(() => {
            executeWithRetryRef.current?.(attemptNumber + 1);
          }, delay);
        } else {
          // Max retries exceeded
          setIsRetrying(false);
          setNextRetryIn(null);
          nextRetryTimestampRef.current = null;
        }
      }
    };
  }, [operation, opts]);

  const retry = useCallback(() => {
    // Cancel any existing retry
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Start retry from attempt 0
    setError(null);
    setCurrentAttempt(0);
    setNextRetryIn(null);
    nextRetryTimestampRef.current = null;
    executeWithRetryRef.current?.(0);
  }, []);

  const cancel = useCallback(() => {
    // Cancel any pending retry
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setIsRetrying(false);
    setNextRetryIn(null);
    nextRetryTimestampRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    setCurrentAttempt(0);
    setError(null);
  }, [cancel]);

  return {
    isRetrying,
    currentAttempt,
    nextRetryIn,
    error,
    retry,
    cancel,
    reset,
  };
}
