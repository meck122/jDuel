import { FormEvent, useState } from 'react';

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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (answer) {
      onSubmitAnswer(answer);
      setAnswer('');
    }
  };

  return (
    <div className='game-section'>
      <h2>Question {questionIndex + 1} / 10</h2>
      <p className='question'>{questionText}</p>
      <p className='timer'>
        Time remaining: {Math.ceil(timeRemainingMs / 1000)}s
      </p>

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
    </div>
  );
};
