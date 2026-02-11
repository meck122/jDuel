/**
 * Question - Displays current question and accepts answers.
 *
 * Shows:
 * - Question number and category
 * - Question text
 * - Timer countdown
 * - Answer input form
 */

import { FormEvent, useState, useRef, useEffect } from "react";
import { useGame } from "../../../contexts";
import { Timer } from "../../../components";
import { QuestionHeader } from "./QuestionHeader";
import styles from "./Question.module.css";

export function Question() {
  const { roomState, submitAnswer } = useGame();
  const [answer, setAnswer] = useState<string>("");
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  const questionIndex = roomState?.questionIndex ?? 0;
  const currentQuestion = roomState?.currentQuestion;
  const timeRemainingMs = roomState?.timeRemainingMs ?? 0;

  // Reset submission state when question changes
  const prevQuestionIndexRef = useRef<number>(questionIndex);
  if (prevQuestionIndexRef.current !== questionIndex) {
    prevQuestionIndexRef.current = questionIndex;
    setHasSubmitted(false);
    setAnswer("");
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (answer && !hasSubmitted) {
      submitAnswer(answer);
      setHasSubmitted(true);
    }
  };

  // Lock scroll on mobile while question is visible
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className={styles.gameSection}>
      <QuestionHeader
        questionIndex={questionIndex}
        totalQuestions={roomState?.totalQuestions ?? 10}
        category={currentQuestion.category}
      />
      <Timer timeRemainingMs={timeRemainingMs} resetKey={questionIndex} />
      <div className={styles.questionBox}>
        <p className={styles.question}>{currentQuestion.text}</p>
      </div>

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
                <span className={styles.optionLetter}>{String.fromCharCode(65 + index)}</span>
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
