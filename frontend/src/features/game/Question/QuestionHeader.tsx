/**
 * QuestionHeader - Compact inline header for Question view.
 *
 * Displays question number and category on a single line.
 * Height: ~24px (down from ~60px stacked layout)
 */

import styles from "./QuestionHeader.module.css";

interface QuestionHeaderProps {
  questionIndex: number;
  totalQuestions: number;
  category: string;
}

export function QuestionHeader({ questionIndex, totalQuestions, category }: QuestionHeaderProps) {
  return (
    <div className={styles.header}>
      <span className={styles.questionNumber}>
        Q{questionIndex + 1}/{totalQuestions}
      </span>
      <span className={styles.separator}>•</span>
      <span className={styles.category}>{category}</span>
    </div>
  );
}
