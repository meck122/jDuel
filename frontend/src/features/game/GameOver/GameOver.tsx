/**
 * GameOver - Final game screen showing winner and scores.
 *
 * Shows:
 * - Winner announcement
 * - Final scores for all players
 * - Room closing countdown
 */

import { useGame } from "../../../contexts";
import { Timer } from "../../../components";
import { sortPlayersByScore } from "../../../utils";
import styles from "./GameOver.module.css";

export function GameOver() {
  const { roomState } = useGame();

  const players = roomState?.players ?? {};
  const winner = roomState?.winner ?? "";
  const timeRemainingMs = roomState?.timeRemainingMs;

  const sortedPlayers = sortPlayersByScore(players);
  const firstPlace = sortedPlayers[0];

  return (
    <div className={styles.gameSection}>
      <div className={styles.confetti}>
        <div className={styles.confettiPiece} />
        <div className={styles.confettiPiece} />
        <div className={styles.confettiPiece} />
        <div className={styles.confettiPiece} />
        <div className={styles.confettiPiece} />
      </div>

      <h2 className={styles.gameOverHeader}>Game Over!</h2>

      <div className={styles.winnerCard}>
        <div className={styles.trophy}>🏆</div>
        <div className={styles.winnerContent}>
          <div className={styles.winnerLabel}>Champion</div>
          <div className={styles.winnerName}>{winner}</div>
          {firstPlace && (
            <div className={styles.winnerScore}>{firstPlace[1]} points</div>
          )}
        </div>
      </div>

      {timeRemainingMs !== undefined && (
        <div className={styles.timerSection}>
          <p className={styles.closingText}>Room closing in</p>
          <Timer
            timeRemainingMs={timeRemainingMs}
            resetKey={winner}
            variant="game-over"
          />
        </div>
      )}

      <div className={styles.finalScoresSection}>
        <h3 className={styles.finalScoresHeader}>Final Standings</h3>
        <div className={styles.finalScores}>
          {sortedPlayers.map(([player, score], index) => (
            <div
              key={player}
              className={`${styles.finalScoreItem} ${
                index === 0 ? styles.firstPlace : ""
              }`}
            >
              <span className={styles.rank}>{index + 1}</span>
              <span className={styles.playerName}>{player}</span>
              <span className={styles.score}>{score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
