import { FormEvent, useState, useEffect } from "react";
import { Timer } from "../Timer/Timer";
import styles from "./QuestionView.module.css";

interface QuestionViewProps {
  questionIndex: number;
  questionText: string;
  questionCategory: string;
  timeRemainingMs: number;
  onSubmitAnswer: (answer: string) => void;
}

export const QuestionView = ({
  questionIndex,
  questionText,
  questionCategory,
  timeRemainingMs,
  onSubmitAnswer,
}: QuestionViewProps) => {
  const [answer, setAnswer] = useState<string>("");
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  // Reset submission state when question changes
  useEffect(() => {
    setHasSubmitted(false);
    setAnswer("");
  }, [questionIndex]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (answer && !hasSubmitted) {
      onSubmitAnswer(answer);
      setHasSubmitted(true);
    }
  };

  return (
    <div className={styles.gameSection}>
      <h2 className={styles.questionHeader}>
        Question {questionIndex + 1} / 10
      </h2>
      <p className={styles.questionCategory}>
        <span className={styles.categoryLabel}>Category:</span>{" "}
        {questionCategory}
      </p>
      <p className={styles.question}>{questionText}</p>
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
};
