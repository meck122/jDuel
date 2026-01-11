import { FormEvent, useState } from "react";
import styles from "./JoinForm.module.css";

interface JoinFormProps {
  onCreateRoom: (playerId: string) => void;
  onJoin: (roomId: string, playerId: string) => void;
  errorMessage?: string;
}

export const JoinForm = ({
  onCreateRoom,
  onJoin,
  errorMessage,
}: JoinFormProps) => {
  const [roomId, setRoomId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");

  const handleOnSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nativeEvent = e.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;

    if (!submitter) return;

    const action = submitter.name;

    if (action === "create") {
      onCreateRoom(playerId);
    } else if (action == "join") {
      onJoin(roomId, playerId);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.logo}>
        <span className={styles.logoJ}>j</span>
        <span className={styles.logoDuel}>Duel</span>
      </h1>
      {errorMessage && (
        <div
          style={{ color: "red", marginBottom: "1rem", textAlign: "center" }}
        >
          {errorMessage}
        </div>
      )}
      <form onSubmit={handleOnSubmit} className={styles.joinForm}>
        <div>
          <input
            type="text"
            placeholder="Your Name"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          />
        </div>
        <button type="submit" name="create" disabled={!playerId || !!roomId}>
          Create Room
        </button>
        <div>
          <input
            type="text"
            style={{ textTransform: "uppercase" }}
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            autoFocus
          />
        </div>
        <button type="submit" name="join" disabled={!roomId || !playerId}>
          Join Existing Room
        </button>
      </form>
    </div>
  );
};
