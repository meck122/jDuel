/**
 * Question - Displays current question and accepts answers.
 *
 * Shows:
 * - Question number and category
 * - Question text
 * - Timer countdown
 * - Answer input form
 */

import { FormEvent, useState, useEffect } from "react";
import { useGame } from "../../../contexts";
import { Timer } from "../../../components/common/Timer";
import styles from "./Question.module.css";

export function Question() {
  const { roomState, submitAnswer } = useGame();
  const [answer, setAnswer] = useState<string>("");
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  const questionIndex = roomState?.questionIndex ?? 0;
  const currentQuestion = roomState?.currentQuestion;
  const timeRemainingMs = roomState?.timeRemainingMs ?? 0;

  // Reset submission state when question changes
  useEffect(() => {
    setHasSubmitted(false);
    setAnswer("");
  }, [questionIndex]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (answer && !hasSubmitted) {
      submitAnswer(answer);
      setHasSubmitted(true);
    }
  };

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className={styles.gameSection}>
      <h2 className={styles.questionHeader}>
        Question {questionIndex + 1} / 10
      </h2>
      <p className={styles.questionCategory}>
        <span className={styles.categoryLabel}>Category:</span>{" "}
        {currentQuestion.category}
      </p>
      <p className={styles.question}>{currentQuestion.text}</p>
      <Timer
        timeRemainingMs={timeRemainingMs}
        resetKey={questionIndex}
        className="timer"
        label="Time remaining"
      />

      {!hasSubmitted ? (
        <form onSubmit={handleSubmit} className={styles.answerForm}>
          <input
            type="text"
            placeholder="Your answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
          />
          <button type="submit">Submit</button>
        </form>
      ) : (
        <div className={styles.answerSubmitted}>
          <p>✓ Answer submitted!</p>
          <p className={styles.waitingText}>Waiting for next question...</p>
        </div>
      )}
    </div>
  );
}
