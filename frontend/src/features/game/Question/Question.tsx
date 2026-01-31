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
import { Timer } from "../../../components";
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
      <div className={styles.questionHeader}>
        <span className={styles.questionNumber}>
          Question {questionIndex + 1}
        </span>
        <span className={styles.questionTotal}>of 10</span>
      </div>
      <div className={styles.questionCategory}>
        <span className={styles.categoryLabel}>Category:</span>
        <span className={styles.categoryValue}>{currentQuestion.category}</span>
      </div>
      <div className={styles.questionBox}>
        <p className={styles.question}>{currentQuestion.text}</p>
      </div>
      <Timer timeRemainingMs={timeRemainingMs} resetKey={questionIndex} />

      {!hasSubmitted ? (
        currentQuestion.options ? (
          <div className={styles.optionsGrid}>
            {currentQuestion.options.map((option, index) => (
              <button
                key={option}
                className={styles.optionButton}
                onClick={() => {
                  submitAnswer(option);
                  setHasSubmitted(true);
                }}
              >
                <span className={styles.optionLetter}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span className={styles.optionText}>{option}</span>
              </button>
            ))}
          </div>
        ) : (
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
        )
      ) : (
        <div className={styles.answerSubmitted}>
          <p>✓ Answer submitted!</p>
          <p className={styles.waitingText}>Waiting for next question...</p>
        </div>
      )}
    </div>
  );
}
