interface ScoreboardProps {
  players: Record<string, number>;
  currentPlayerId: string;
}

export const Scoreboard = ({ players, currentPlayerId }: ScoreboardProps) => {
  return (
    <div className='scoreboard'>
      <h2>Scores</h2>
      {Object.entries(players).map(([player, score]) => (
        <div key={player} className='score-item'>
          <span className='player-name'>
            {player} {player === currentPlayerId && '(you)'}
          </span>
          <span className='player-score'>{score}</span>
        </div>
      ))}
    </div>
  );
};
