import { useState, useEffect } from "react";
import { JoinForm } from "../components/JoinForm/JoinForm";
import { GameRoom } from "../components/GameRoom/GameRoom";
import { PageContainer } from "../components/layout/PageContainer";
import { useWebSocket } from "../hooks/useWebSocket";
import styles from "./GamePage.module.css";

export function GamePage() {
  const [roomId, setRoomId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [joined, setJoined] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // WS hook receives ws messages and translates it to RoomState and allows the client to sendMessage through sendMessage callback
  const { roomState, sendMessage } = useWebSocket(
    joined,
    () => {
      // Room was closed, reset to join form
      setJoined(false);
      setRoomId("");
      setPlayerId("");
    },
    (message: string) => {
      // Error occurred (e.g., room doesn't exist)
      setErrorMessage(message);
      setJoined(false);
      setRoomId("");
    },
  );

  // Update roomId when we receive room state
  useEffect(() => {
    if (roomState?.roomId && roomState.roomId !== roomId) {
      setRoomId(roomState.roomId);
    }
  }, [roomState, roomId]);

  const handleCreateRoom = (playerId: string) => {
    setErrorMessage("");
    setJoined(true);
    setPlayerId(playerId);

    sendMessage({ type: "CREATE_ROOM", playerId: playerId });
  };

  const handleJoin = (roomId: string, newPlayerId: string) => {
    setErrorMessage("");
    setJoined(true);
    setPlayerId(newPlayerId);
    setRoomId(roomId);
    sendMessage({ type: "JOIN_ROOM", roomId: roomId, playerId: newPlayerId });
  };

  const handleStartGame = () => {
    sendMessage({ type: "START_GAME" });
  };

  const handleSubmitAnswer = (answer: string) => {
    sendMessage({
      type: "ANSWER",
      answer: answer,
    });
  };

  if (!joined) {
    return (
      <PageContainer centered maxWidth="sm">
        <JoinForm
          onJoin={handleJoin}
          onCreateRoom={handleCreateRoom}
          errorMessage={errorMessage}
        />
      </PageContainer>
    );
  }

  if (!roomState) {
    return (
      <PageContainer centered>
        <p className={styles.connecting}>Connecting...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer centered maxWidth="md">
      <GameRoom
        roomId={roomId}
        playerId={playerId}
        roomState={roomState}
        onStartGame={handleStartGame}
        onSubmitAnswer={handleSubmitAnswer}
      />
    </PageContainer>
  );
}
