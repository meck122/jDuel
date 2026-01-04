interface WaitingRoomProps {
  onStartGame: () => void;
}

export const WaitingRoom = ({ onStartGame }: WaitingRoomProps) => {
  return (
    <div className='game-section'>
      <p>Waiting for players...</p>
      <button onClick={onStartGame} className='start-button'>
        Start Game
      </button>
    </div>
  );
};
