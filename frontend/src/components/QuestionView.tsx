import { FormEvent, useState, useEffect } from 'react';
import { Timer } from './Timer';

interface QuestionViewProps {
  questionIndex: number;
  questionText: string;
  timeRemainingMs: number;
  onSubmitAnswer: (answer: string) => void;
}

export const QuestionView = ({
  questionIndex,
  questionText,
  timeRemainingMs,
  onSubmitAnswer,
}: QuestionViewProps) => {
  const [answer, setAnswer] = useState<string>('');
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  // Reset submission state when question changes
  useEffect(() => {
    setHasSubmitted(false);
    setAnswer('');
  }, [questionIndex]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (answer && !hasSubmitted) {
      onSubmitAnswer(answer);
      setHasSubmitted(true);
    }
  };

  return (
    <div className='game-section'>
      <h2>Question {questionIndex + 1} / 10</h2>
      <p className='question'>{questionText}</p>
      <Timer
        timeRemainingMs={timeRemainingMs}
        resetKey={questionIndex}
        className='timer'
        label='Time remaining'
      />

      {!hasSubmitted ? (
        <form onSubmit={handleSubmit} className='answer-form'>
          <input
            type='text'
            placeholder='Your answer'
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
          />
          <button type='submit'>Submit</button>
        </form>
      ) : (
        <div className='answer-submitted'>
          <p>✓ Answer submitted!</p>
          <p className='waiting-text'>Waiting for next question...</p>
        </div>
      )}
    </div>
  );
};
