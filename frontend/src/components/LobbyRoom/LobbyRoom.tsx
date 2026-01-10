import styles from "./LobbyRoom.module.css";

interface LobbyRoomProps {
  players: Record<string, number>;
  currentPlayerId: string;
  onStartGame: () => void;
}

export const LobbyRoom = ({
  players,
  currentPlayerId,
  onStartGame,
}: LobbyRoomProps) => {
  const playerCount = Object.keys(players).length;

  return (
    <div className={styles.lobbyContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Players in Lobby</h2>
        <div className={styles.playerCount}>
          {playerCount} Player{playerCount !== 1 ? "s" : ""} Joined
        </div>
      </div>

      <div className={styles.playersGrid}>
        {Object.keys(players).map((player) => (
          <div
            key={player}
            className={`${styles.playerCard} ${player === currentPlayerId ? styles.currentPlayer : ""}`}
          >
            <div className={styles.playerIcon}>👤</div>
            <div className={styles.playerName}>
              {player}
              {player === currentPlayerId && (
                <span className={styles.youBadge}>(You)</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.waitingSection}>
        <p className={styles.waitingText}>Waiting for players to join...</p>
        <button onClick={onStartGame} className={styles.startButton}>
          Start Game
        </button>
      </div>
    </div>
  );
};
