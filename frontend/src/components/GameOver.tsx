import { Timer } from './Timer';

interface GameOverProps {
  winner: string;
  players: Record<string, number>;
  timeRemainingMs?: number;
}

export const GameOver = ({ winner, players, timeRemainingMs }: GameOverProps) => {
  return (
    <div className='game-section'>
      <h2>Game Over!</h2>
      <p className='winner'>Winner: {winner} 🎉</p>
      
      {timeRemainingMs !== undefined && (
        <Timer
          timeRemainingMs={timeRemainingMs}
          resetKey={winner}
          className='game-over-timer'
          label='Room closing in'
        />
      )}
      
      <h3>Final Scores:</h3>
      <div className='final-scores'>
        {Object.entries(players)
          .sort(([, a], [, b]) => b - a)
          .map(([player, score]) => (
            <div key={player} className='final-score-item'>
              <span>{player}</span>
              <span>{score}</span>
            </div>
          ))}
      </div>
    </div>
  );
};
