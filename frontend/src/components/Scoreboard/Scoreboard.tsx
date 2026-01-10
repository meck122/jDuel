import styles from "./Scoreboard.module.css";

interface ScoreboardProps {
  players: Record<string, number>;
  currentPlayerId: string;
}

export const Scoreboard = ({ players, currentPlayerId }: ScoreboardProps) => {
  return (
    <div className={styles.scoreboard}>
      {Object.entries(players).map(([player, score]) => (
        <div key={player} className={styles.scoreItem}>
          <span className={styles.playerName}>
            {player} {player === currentPlayerId && "(you)"}
          </span>
          <span className={styles.playerScore}>{score}</span>
        </div>
      ))}
    </div>
  );
};
