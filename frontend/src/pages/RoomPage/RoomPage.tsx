/**
 * RoomPage - Game room page with connection management.
 *
 * This page handles:
 * 1. Room validation via URL params (/room/:roomId?player=Name)
 * 2. Deep link flow (prompting for name if not provided)
 * 3. HTTP registration before WebSocket connection
 * 4. GameProvider setup for child components
 *
 * The actual game UI is delegated to GameView via GameContext.
 */

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { GameProvider, useGame } from "../../contexts";
import { GameView } from "../../features/game";
import { PageContainer } from "../../components/layout/PageContainer";
import { getRoom, joinRoom, ApiError } from "../../services/api";
import styles from "./RoomPage.module.css";

const PLAYER_NAME_KEY = "jduel_player_name";

type PageState =
  | "loading"
  | "name-prompt"
  | "connecting"
  | "connected"
  | "error";

/**
 * Inner component that has access to GameContext.
 * Manages connection state and renders appropriate UI.
 */
function RoomPageContent() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [roomId, setRoomId] = useState<string>("");
  const [playerNameInput, setPlayerNameInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const { connect, isConnected, isConnecting, connectionError, roomState } =
    useGame();

  // Initial load: validate room and check for player in URL
  useEffect(() => {
    const initRoom = async () => {
      if (!urlRoomId) {
        navigate("/", { replace: true });
        return;
      }

      const normalizedRoomId = urlRoomId.toUpperCase(); // TODO: does this need to be normalize?
      setRoomId(normalizedRoomId);

      try {
        const room = await getRoom(normalizedRoomId);
        if (!room) {
          setErrorMessage("Room not found");
          setPageState("error");
          return;
        }

        const playerIdFromUrl = searchParams.get("player");

        // Check if game already started for new joiners
        if (
          room.status !== "waiting" &&
          playerIdFromUrl &&
          !room.players.includes(playerIdFromUrl)
        ) {
          setErrorMessage("This game has already started");
          setPageState("error");
          return;
        }

        if (playerIdFromUrl) {
          if (room.players.includes(playerIdFromUrl)) {
            // Already registered, just connect
            connect(normalizedRoomId, playerIdFromUrl);
            setPageState("connecting");
          } else {
            // Need to register first
            setIsJoining(true);
            try {
              await joinRoom(normalizedRoomId, playerIdFromUrl);
              connect(normalizedRoomId, playerIdFromUrl);
              setPageState("connecting");
            } catch (err) {
              if (err instanceof ApiError) {
                if (err.code === "NAME_TAKEN") {
                  setPlayerNameInput(playerIdFromUrl);
                  setPageState("name-prompt");
                } else {
                  setErrorMessage(err.message);
                  setPageState("error");
                }
              } else {
                setErrorMessage("Failed to join room");
                setPageState("error");
              }
            }
            setIsJoining(false);
          }
        } else {
          // No player in URL - show name prompt
          const savedName = localStorage.getItem(PLAYER_NAME_KEY);
          if (savedName) {
            setPlayerNameInput(savedName);
          }
          setPageState("name-prompt");
        }
      } catch (err) {
        setErrorMessage("Failed to connect to server");
        setPageState("error");
      }
    };

    initRoom();
  }, [urlRoomId, searchParams, navigate, connect]);

  // Update page state based on connection
  useEffect(() => {
    if (isConnected && roomState && pageState === "connecting") {
      setPageState("connected");
    }
  }, [isConnected, roomState, pageState]);

  // Handle connection errors from context
  useEffect(() => {
    if (connectionError && pageState !== "error") {
      setErrorMessage(connectionError);
      setPageState("error");
    }
  }, [connectionError, pageState]);

  // Handle name submission (deep link flow)
  const handleNameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!playerNameInput.trim() || !roomId) return;

    setIsJoining(true);
    setErrorMessage("");

    try {
      const trimmedName = playerNameInput.trim();
      await joinRoom(roomId, trimmedName);

      localStorage.setItem(PLAYER_NAME_KEY, trimmedName);
      setSearchParams({ player: trimmedName });
      connect(roomId, trimmedName);
      setPageState("connecting");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "NAME_TAKEN") {
          setErrorMessage("That name is already taken in this room");
        } else if (err.code === "GAME_STARTED") {
          setErrorMessage("This game has already started");
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Failed to join room");
      }
    }

    setIsJoining(false);
  };

  // Loading state
  if (pageState === "loading") {
    return (
      <PageContainer centered>
        <p className={styles.message}>Loading...</p>
      </PageContainer>
    );
  }

  // Error state
  if (pageState === "error") {
    return (
      <PageContainer centered maxWidth="sm">
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>Unable to Join Room</h2>
          <p className={styles.errorMessage}>{errorMessage}</p>
          <button onClick={() => navigate("/")} className={styles.homeButton}>
            Back to Home
          </button>
        </div>
      </PageContainer>
    );
  }

  // Name prompt state (deep link flow)
  if (pageState === "name-prompt") {
    return (
      <PageContainer centered maxWidth="sm">
        <div className={styles.namePrompt}>
          <h2 className={styles.promptTitle}>Join Room {roomId}</h2>
          <p className={styles.promptDescription}>
            Enter your name to join the game
          </p>

          {errorMessage && <div className={styles.error}>{errorMessage}</div>}

          <form onSubmit={handleNameSubmit} className={styles.form}>
            <input
              type="text"
              placeholder="Your Name"
              value={playerNameInput}
              onChange={(e) => setPlayerNameInput(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <button
              type="submit"
              disabled={!playerNameInput.trim() || isJoining}
            >
              {isJoining ? "Joining..." : "Join Game"}
            </button>
          </form>
        </div>
      </PageContainer>
    );
  }

  // Connecting state
  if (pageState === "connecting" || isConnecting || !roomState) {
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
 * RoomPage wrapper that provides GameContext.
 */
export function RoomPage() {
  const navigate = useNavigate();

  const handleRoomClosed = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <GameProvider onRoomClosed={handleRoomClosed}>
      <RoomPageContent />
    </GameProvider>
  );
}
