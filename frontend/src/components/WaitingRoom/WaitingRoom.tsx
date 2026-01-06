import styles from './WaitingRoom.module.css';

interface WaitingRoomProps {
  onStartGame: () => void;
}

export const WaitingRoom = ({ onStartGame }: WaitingRoomProps) => {
  return (
    <div className={styles.gameSection}>
      <p>Waiting for players...</p>
      <button onClick={onStartGame} className={styles.startButton}>
        Start Game
      </button>
    </div>
  );
};
