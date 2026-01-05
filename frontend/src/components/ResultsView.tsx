import { Timer } from './Timer';

interface ResultsViewProps {
  players: Record<string, number>;
  correctAnswer: string;
  playerAnswers: Record<string, string>;
  timeRemainingMs: number;
  currentPlayerId: string;
}

export const ResultsView = ({
  players,
  correctAnswer,
  playerAnswers,
  timeRemainingMs,
  currentPlayerId,
}: ResultsViewProps) => {
  return (
    <div className='game-section'>
      <h2>Question Results</h2>
      <Timer
        timeRemainingMs={timeRemainingMs}
        resetKey={correctAnswer}
        className='results-timer'
        label='Next question in'
      />

      <div className='correct-answer-banner'>
        <span className='correct-label'>Correct Answer:</span>
        <span className='correct-value'>{correctAnswer}</span>
      </div>

      <div className='results-container'>
        <div className='results-box'>
          <h3>Scoreboard</h3>
          <div className='results-scores'>
            {Object.entries(players)
              .sort(([, a], [, b]) => b - a)
              .map(([player, score]) => (
                <div key={player} className='results-score-item'>
                  <span className='results-player-name'>
                    {player} {player === currentPlayerId && '(you)'}
                  </span>
                  <span className='results-player-score'>{score}</span>
                </div>
              ))}
          </div>
        </div>

        <div className='results-box'>
          <h3>Player Answers</h3>
          <div className='results-answers'>
            {Object.entries(playerAnswers).map(([player, answer]) => {
              const isCorrect =
                answer.toLowerCase() === correctAnswer.toLowerCase();
              return (
                <div
                  key={player}
                  className={`results-answer-item ${
                    isCorrect ? 'correct' : 'incorrect'
                  }`}
                >
                  <span className='results-answer-player'>
                    {player} {player === currentPlayerId && '(you)'}
                  </span>
                  <span className='results-answer-text'>
                    {answer || '(no answer)'}
                  </span>
                  <span className='results-answer-indicator'>
                    {isCorrect ? '✓' : '✗'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
