import { Timer } from "../Timer/Timer";
import styles from "./GameOver.module.css";

interface GameOverProps {
  winner: string;
  players: Record<string, number>;
  timeRemainingMs?: number;
}

export const GameOver = ({
  winner,
  players,
  timeRemainingMs,
}: GameOverProps) => {
  return (
    <div className={styles.gameSection}>
      <h2 className={styles.gameOverHeader}>Game Over!</h2>
      <p className={styles.winner}>
        <span className={styles.winnerLabel}>Winner:</span> {winner} 🎉
      </p>

      {timeRemainingMs !== undefined && (
        <Timer
          timeRemainingMs={timeRemainingMs}
          resetKey={winner}
          className="game-over-timer"
          label="Room closing in"
        />
      )}

      <h3>Final Scores:</h3>
      <div className={styles.finalScores}>
        {Object.entries(players)
          .sort(([, a], [, b]) => b - a)
          .map(([player, score]) => (
            <div key={player} className={styles.finalScoreItem}>
              <span>{player}</span>
              <span>{score}</span>
            </div>
          ))}
      </div>
    </div>
  );
};
