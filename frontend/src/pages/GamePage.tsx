import { useState } from "react";
import { JoinForm } from "../components/JoinForm/JoinForm";
import { GameRoom } from "../components/GameRoom/GameRoom";
import { PageContainer } from "../components/layout/PageContainer";
import { useWebSocket } from "../hooks/useWebSocket";
import styles from "./GamePage.module.css";

export function GamePage() {
  const [roomId, setRoomId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [joined, setJoined] = useState<boolean>(false);

  const { roomState, sendMessage } = useWebSocket(
    roomId,
    playerId,
    joined,
    () => {
      // Room was closed, reset to join form
      setJoined(false);
      setRoomId("");
      setPlayerId("");
    },
  );

  const handleJoin = (newRoomId: string, newPlayerId: string) => {
    setRoomId(newRoomId);
    setPlayerId(newPlayerId);
    setJoined(true);
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
        <JoinForm onJoin={handleJoin} />
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
