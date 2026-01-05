import { useState } from 'react';
import './App.css';
import { JoinForm } from './components/JoinForm';
import { GameRoom } from './components/GameRoom';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const [roomId, setRoomId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [joined, setJoined] = useState<boolean>(false);

  const { roomState, sendMessage } = useWebSocket(
    roomId,
    playerId,
    joined,
    () => {
      // Room was closed, reset to join form
      setJoined(false);
      setRoomId('');
      setPlayerId('');
    }
  );

  const handleJoin = (newRoomId: string, newPlayerId: string) => {
    setRoomId(newRoomId);
    setPlayerId(newPlayerId);
    setJoined(true);
  };

  const handleStartGame = () => {
    sendMessage({ type: 'START_GAME' });
  };

  const handleSubmitAnswer = (answer: string) => {
    sendMessage({
      type: 'ANSWER',
      answer: answer,
    });
  };

  if (!joined) {
    return <JoinForm onJoin={handleJoin} />;
  }

  if (!roomState) {
    return <div className='container'>Connecting...</div>;
  }

  return (
    <GameRoom
      roomId={roomId}
      playerId={playerId}
      roomState={roomState}
      onStartGame={handleStartGame}
      onSubmitAnswer={handleSubmitAnswer}
    />
  );
}

export default App;
