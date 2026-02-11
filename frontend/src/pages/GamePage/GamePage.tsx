/**
 * GamePage - Active game session page.
 *
 * This page handles:
 * 1. WebSocket connection management
 * 2. GameProvider context setup
 * 3. Rendering the game UI via GameView
 *
 * Players arrive here after successfully joining via HomePage.
 * URL format: /game/:roomId (player name retrieved from localStorage)
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../../contexts";
import { GameView } from "../../features/game";
import { PageContainer } from "../../components";
import { usePlayerName, useRetry } from "../../hooks";
import { joinRoom, ApiError } from "../../services/api";
import styles from "./GamePage.module.css";

// Module-level constant to avoid re-render instability with useRetry
const RETRY_OPTIONS = { maxRetries: 4, initialDelay: 2000, maxDelay: 8000 };

/**
 * Attempt joinRoom with fast NAME_TAKEN retry (500ms intervals, up to maxRetries).
 * Returns on success, throws on non-NAME_TAKEN errors (including RATE_LIMITED).
 */
async function joinWithNameTakenRetry(
  roomId: string,
  playerId: string,
  maxRetries: number
): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await joinRoom(roomId, playerId);
      return; // Success
    } catch (error) {
      if (error instanceof ApiError && error.code === "NAME_TAKEN" && attempt < maxRetries) {
        // Race condition: old WebSocket not fully disconnected yet — fast retry
        console.log(`Name taken, retrying in 500ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw error; // Non-NAME_TAKEN error or max retries exceeded
    }
  }
}

/**
 * Inner component that has access to GameContext.
 * Manages WebSocket connection and renders game UI.
 */
function GamePageContent() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { playerName } = usePlayerName();

  const [hasInitialized, setHasInitialized] = useState(false);
  // Track whether we hit a rate limit and need useRetry to take over
  const [rateLimited, setRateLimited] = useState(false);

  const { connect, isConnected, isConnecting, connectionError, roomState } = useGame();

  const roomId = urlRoomId?.toUpperCase() || "";
  const playerId = playerName.trim();

  // Register player via HTTP then connect via WebSocket
  // Follows original pattern: async function defined inside useEffect
  useEffect(() => {
    if (hasInitialized || rateLimited) return;

    if (!roomId || !playerId) {
      if (roomId) {
        navigate(`/?join=${roomId}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
      return;
    }

    let ignore = false;

    const registerAndConnect = async () => {
      if (ignore) return;

      try {
        await joinWithNameTakenRetry(roomId, playerId, 4);
        if (ignore) return;

        connect(roomId, playerId);
        setHasInitialized(true);
      } catch (error) {
        if (ignore) return;

        if (error instanceof ApiError) {
          if (error.code === "ROOM_NOT_FOUND") {
            navigate(`/?join=${roomId}`, { replace: true });
          } else if (error.code === "GAME_STARTED") {
            navigate("/", { replace: true });
          } else if (error.code === "NAME_TAKEN") {
            // NAME_TAKEN retries exhausted — truly taken
            navigate("/", { replace: true });
          } else if (error.code === "RATE_LIMITED") {
            // Hand off to useRetry for exponential backoff with countdown UI
            setRateLimited(true);
          }
        } else {
          console.error("Unexpected error during registration:", error);
          navigate(`/?join=${roomId}&error=unexpected`, { replace: true });
        }
      }
    };

    registerAndConnect();

    return () => {
      ignore = true;
    };
  }, [roomId, playerId, navigate, connect, hasInitialized, rateLimited]);

  // useRetry operation: called only after initial attempt hits rate limit
  // Handles retry loop with exponential backoff and countdown
  const retryOperation = useCallback(async () => {
    try {
      await joinWithNameTakenRetry(roomId, playerId, 4);
      connect(roomId, playerId);
      setHasInitialized(true);
      setRateLimited(false);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "ROOM_NOT_FOUND") {
          navigate(`/?join=${roomId}`, { replace: true });
          setRateLimited(false);
          return; // Don't re-throw — stop retrying
        }
        if (error.code === "GAME_STARTED" || error.code === "NAME_TAKEN") {
          navigate("/", { replace: true });
          setRateLimited(false);
          return; // Terminal
        }
        if (error.code === "RATE_LIMITED") {
          throw error; // Re-throw for useRetry to continue backoff
        }
      }
      // Unknown errors
      console.error("Unexpected error during retry:", error);
      navigate(`/?join=${roomId}&error=unexpected`, { replace: true });
      setRateLimited(false);
    }
  }, [roomId, playerId, navigate, connect]);

  const {
    isRetrying,
    currentAttempt,
    nextRetryIn,
    error: retryError,
    cancel,
    retry,
  } = useRetry(retryOperation, RETRY_OPTIONS);

  // Kick off useRetry when rate limited
  useEffect(() => {
    if (rateLimited && !isRetrying && !hasInitialized) {
      retry();
    }
  }, [rateLimited, isRetrying, hasInitialized, retry]);

  // Retrying state — auto-retry with countdown
  if (isRetrying && nextRetryIn !== null) {
    return (
      <PageContainer centered maxWidth="sm">
        <div className={styles.retryContainer}>
          <h2 className={styles.retryTitle}>Too many attempts</h2>
          <p className={styles.retryMessage}>
            Retrying in {nextRetryIn}s... (attempt {currentAttempt}/{RETRY_OPTIONS.maxRetries})
          </p>
          <button
            onClick={() => {
              cancel();
              navigate("/", { replace: true });
            }}
            className={styles.secondaryButton}
          >
            Back to Home
          </button>
        </div>
      </PageContainer>
    );
  }

  // Max retries exhausted
  if (retryError && !isRetrying && rateLimited) {
    return (
      <PageContainer centered maxWidth="sm">
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>Unable to Reconnect</h2>
          <p className={styles.errorMessage}>
            Could not reconnect after multiple attempts. The room may no longer be available.
          </p>
          <div className={styles.errorActions}>
            <button
              onClick={() => navigate(`/?join=${roomId}`, { replace: true })}
              className={styles.secondaryButton}
            >
              Try Rejoining
            </button>
            <button
              onClick={() => navigate("/", { replace: true })}
              className={styles.primaryButton}
            >
              Back to Home
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Handle WebSocket connection errors
  if (connectionError) {
    return (
      <PageContainer centered maxWidth="sm">
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>Connection Error</h2>
          <p className={styles.errorMessage}>{connectionError}</p>
          <div className={styles.errorActions}>
            <button
              onClick={() => navigate(`/?join=${roomId}`, { replace: true })}
              className={styles.secondaryButton}
            >
              Try Rejoining
            </button>
            <button
              onClick={() => navigate("/", { replace: true })}
              className={styles.primaryButton}
            >
              Back to Home
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Connecting state
  if (isConnecting || !isConnected || !roomState) {
    return (
      <PageContainer centered>
        <p className={styles.message}>Connecting to room {roomId}...</p>
      </PageContainer>
    );
  }

  // Connected - render game view
  return (
    <PageContainer centered maxWidth="lg">
      <GameView />
    </PageContainer>
  );
}

/**
 * GamePage - renders the game content.
 * GameProvider is now provided at App level.
 */
export function GamePage() {
  return <GamePageContent />;
}
