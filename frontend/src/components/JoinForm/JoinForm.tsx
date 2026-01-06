import { FormEvent, useState } from 'react';
import styles from './JoinForm.module.css';

interface JoinFormProps {
  onJoin: (roomId: string, playerId: string) => void;
}

export const JoinForm = ({ onJoin }: JoinFormProps) => {
  const [roomId, setRoomId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (roomId && playerId) {
      onJoin(roomId, playerId);
    }
  };

  return (
    <div className={styles.container}>
      <h1>jDuel</h1>
      <form onSubmit={handleSubmit} className={styles.joinForm}>
        <div>
          <input
            type='text'
            placeholder='Room ID'
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <input
            type='text'
            placeholder='Your Name'
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          />
        </div>
        <button type='submit'>Join Room</button>
      </form>
    </div>
  );
};
