import { useState, useEffect, useCallback } from "react";
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

  const handleOnRoomClosed = useCallback(() => {
    setJoined(false);
    setRoomId("");
    setPlayerId("");
  }, []);

  const handleOnError = useCallback((message: string) => {
    // Error occurred (e.g., room doesn't exist)
    setErrorMessage(message);
    setJoined(false);
    setRoomId("");
  }, []);

  // WS hook receives ws messages and translates it to RoomState and allows the client to sendMessage through sendMessage callback
  const { roomState, sendMessage } = useWebSocket(
    joined,
    handleOnRoomClosed,
    handleOnError,
  );

  // Capture roomId from first ROOM_STATE message after client is joined (only needed for CREATE_ROOM flow)
  useEffect(() => {
    if (joined && roomState?.roomId && !roomId) {
      setRoomId(roomState.roomId);
    }
  }, [joined, roomState?.roomId, roomId]);

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
