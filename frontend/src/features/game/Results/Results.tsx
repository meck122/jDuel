/**
 * Results - Displays results after each question.
 *
 * Shows:
 * - Correct answer
 * - Player answers with correct/incorrect indicators
 * - Current scores
 * - Timer until next question
 */

import { useGame } from "../../../contexts";
import { LinearTimer, PlayerName } from "../../../components";
import { sortPlayersByScore } from "../../../utils";
import styles from "./Results.module.css";

export function Results() {
  const { roomState } = useGame();

  const players = roomState?.players ?? {};
  const results = roomState?.results;
  const timeRemainingMs = roomState?.timeRemainingMs ?? 0;

  if (!results) {
    return null;
  }

  const { correctAnswer, playerAnswers, playerResults } = results;

  return (
    <div className={styles.gameSection}>
      <div className={styles.resultsHeader}>
        <span className={styles.resultsTitle}>Round Results</span>
      </div>

      {/* 1. Correct Answer (most important - immediate feedback) */}
      <div className={styles.correctAnswerBanner}>
        <span className={styles.correctLabel}>Correct Answer:</span>
        <span className={styles.correctValue}>{correctAnswer}</span>
      </div>

      <div className={styles.resultsContainer}>
        {/* 2. Player Answers (engaging moment - who got it right?) */}
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
                  <PlayerName playerId={player} className={styles.resultsAnswerPlayer} />
                  <span className={styles.resultsAnswerText}>{answer || "(no answer)"}</span>
                  <div className={styles.resultsAnswerRight}>
                    {pointsGained !== undefined && pointsGained > 0 && (
                      <span className={styles.resultsPointsGained}>+{pointsGained}</span>
                    )}
                    <span className={styles.resultsAnswerIndicator}>{isCorrect ? "✓" : "✗"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Scoreboard (secondary - competitive standings) */}
        <div className={styles.resultsBox}>
          <h3>Scoreboard</h3>
          <div className={styles.resultsScores}>
            {sortPlayersByScore(players).map(([player, score]) => (
              <div key={player} className={styles.resultsScoreItem}>
                <PlayerName playerId={player} className={styles.resultsPlayerName} />
                <span className={styles.resultsPlayerScore}>{score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Timer (least important - just waiting) */}
      <div className={styles.timerSection}>
        <LinearTimer
          timeRemainingMs={timeRemainingMs}
          resetKey={correctAnswer}
          variant="results"
          label="Next question in"
        />
      </div>
    </div>
  );
}
