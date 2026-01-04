import { useState } from 'react';
import './App.css';
import { JoinForm } from './components/JoinForm';
import { GameRoom } from './components/GameRoom';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const [roomId, setRoomId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [joined, setJoined] = useState<boolean>(false);

  const { roomState, sendMessage, questionStartTimeRef } = useWebSocket(
    roomId,
    playerId,
    joined
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
    if (questionStartTimeRef.current) {
      const timeMs = Date.now() - questionStartTimeRef.current;
      sendMessage({
        type: 'ANSWER',
        answer: answer,
        timeMs: timeMs,
      });
      questionStartTimeRef.current = null;
    }
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
