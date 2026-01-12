import { Timer } from "../Timer/Timer";
import styles from "./ResultsView.module.css";

interface ResultsViewProps {
  players: Record<string, number>;
  correctAnswer: string;
  playerAnswers: Record<string, string>;
  playerResults: Record<string, number>;
  timeRemainingMs: number;
  currentPlayerId: string;
}

export const ResultsView = ({
  players,
  correctAnswer,
  playerAnswers,
  playerResults,
  timeRemainingMs,
  currentPlayerId,
}: ResultsViewProps) => {
  return (
    <div className={styles.gameSection}>
      <h2 className={styles.resultsHeader}>
        <span className={styles.resultsQuestion}>Question Results</span>
      </h2>
      <Timer
        timeRemainingMs={timeRemainingMs}
        resetKey={correctAnswer}
        className="results-timer"
        label="Next question in"
      />

      <div className={styles.correctAnswerBanner}>
        <span className={styles.correctLabel}>Correct Answer:</span>
        <span className={styles.correctValue}>{correctAnswer}</span>
      </div>

      <div className={styles.resultsContainer}>
        <div className={styles.resultsBox}>
          <h3>Scoreboard</h3>
          <div className={styles.resultsScores}>
            {Object.entries(players)
              .sort(([, a], [, b]) => b - a)
              .map(([player, score]) => (
                <div key={player} className={styles.resultsScoreItem}>
                  <span className={styles.resultsPlayerName}>
                    {player} {player === currentPlayerId && "(you)"}
                  </span>
                  <span className={styles.resultsPlayerScore}>{score}</span>
                </div>
              ))}
          </div>
        </div>

        <div className={styles.resultsBox}>
          <h3>Player Answers</h3>
          <div className={styles.resultsAnswers}>
            {Object.entries(playerAnswers).map(([player, answer]) => {
              const pointsGained = playerResults[player];
              const isCorrect = pointsGained !== undefined && pointsGained > 0;
              return (
                <div
                  key={player}
                  className={`${styles.resultsAnswerItem} ${
                    isCorrect ? styles.correct : styles.incorrect
                  }`}
                >
                  <span className={styles.resultsAnswerPlayer}>
                    {player} {player === currentPlayerId && "(you)"}
                  </span>
                  <span className={styles.resultsAnswerText}>
                    {answer || "(no answer)"}
                  </span>
                  <div className={styles.resultsAnswerRight}>
                    {pointsGained !== undefined && pointsGained > 0 && (
                      <span className={styles.resultsPointsGained}>
                        +{pointsGained}
                      </span>
                    )}
                    <span className={styles.resultsAnswerIndicator}>
                      {isCorrect ? "✓" : "✗"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
