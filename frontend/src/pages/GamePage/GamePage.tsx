/**
 * GamePage - Active game session page.
 *
 * This page handles:
 * 1. WebSocket connection management
 * 2. GameProvider context setup
 * 3. Rendering the game UI via GameView
 *
 * Players arrive here after successfully joining via HomePage.
 * URL format: /game/:roomId?player=PlayerName
 */

import { useEffect, useCallback, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { GameProvider, useGame } from "../../contexts";
import { GameView } from "../../features/game";
import { PageContainer } from "../../components/layout/PageContainer";
import styles from "./GamePage.module.css";

/**
 * Inner component that has access to GameContext.
 * Manages WebSocket connection and renders game UI.
 */
function GamePageContent() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [hasInitialized, setHasInitialized] = useState(false);

  const { connect, isConnected, isConnecting, connectionError, roomState } =
    useGame();

  const roomId = urlRoomId?.toUpperCase() || "";
  const playerId = searchParams.get("player") || "";

  // Validate URL params and connect
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

    connect(roomId, playerId);
    setHasInitialized(true);
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
    <PageContainer centered maxWidth="md">
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
