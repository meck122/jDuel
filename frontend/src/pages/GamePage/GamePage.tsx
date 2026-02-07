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

import { useEffect, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GameProvider, useGame } from "../../contexts";
import { GameView } from "../../features/game";
import { PageContainer } from "../../components";
import { usePlayerName } from "../../hooks";
import { joinRoom, ApiError } from "../../services/api";
import styles from "./GamePage.module.css";

/**
 * Inner component that has access to GameContext.
 * Manages WebSocket connection and renders game UI.
 */
function GamePageContent() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { playerName } = usePlayerName();

  const [hasInitialized, setHasInitialized] = useState(false);

  const { connect, isConnected, isConnecting, connectionError, roomState } = useGame();

  const roomId = urlRoomId?.toUpperCase() || "";
  const playerId = playerName.trim();

  // Register player via HTTP then connect via WebSocket
  useEffect(() => {
    if (hasInitialized) return;

    if (!roomId || !playerId) {
      // Missing required params - redirect to home with join param
      if (roomId) {
        navigate(`/?join=${roomId}`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
      return;
    }

    let ignore = false;
    let retryTimeout: number | null = null;

    // Register/verify player before WebSocket connection (enables reconnection)
    const registerAndConnect = async (retryCount = 0) => {
      if (ignore) return;

      try {
        await joinRoom(roomId, playerId);
        if (ignore) return; // Check after async operation (handles Strict Mode)

        connect(roomId, playerId);
        setHasInitialized(true);
      } catch (error) {
        if (ignore) return;

        if (error instanceof ApiError) {
          if (error.code === "ROOM_NOT_FOUND") {
            navigate(`/?join=${roomId}`, { replace: true });
          } else if (error.code === "GAME_STARTED") {
            // Game already started but player not registered - can't join
            navigate("/", { replace: true });
          } else if (error.code === "NAME_TAKEN" && retryCount < 4) {
            // Race condition: old WebSocket not fully disconnected yet
            // Wait and retry (happens on page refresh)
            console.log(`Name taken, retrying in 500ms (attempt ${retryCount + 1}/4)...`);
            retryTimeout = setTimeout(() => registerAndConnect(retryCount + 1), 500);
          } else if (error.code === "NAME_TAKEN") {
            // Max retries exceeded - truly taken
            navigate("/", { replace: true });
          }
        } else {
          console.error("Unexpected error during registration:", error);
          navigate(`/?join=${roomId}&error=unexpected`, { replace: true });
        }
      }
    };

    registerAndConnect();

    // Cleanup on unmount or re-run (handles Strict Mode)
    return () => {
      ignore = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [roomId, playerId, navigate, connect, hasInitialized]);

  // Handle connection errors
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
 * GamePage wrapper that provides GameContext.
 */
export function GamePage() {
  const navigate = useNavigate();

  const handleRoomClosed = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <GameProvider onRoomClosed={handleRoomClosed}>
      <GamePageContent />
    </GameProvider>
  );
}
