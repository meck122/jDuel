import { useEffect, useState, useRef } from 'react';
import './App.css';

function App() {
  const [roomId, setRoomId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [joined, setJoined] = useState(false);
  const [roomState, setRoomState] = useState(null);
  const [answer, setAnswer] = useState('');
  const wsRef = useRef(null);
  const questionStartTimeRef = useRef(null);

  useEffect(() => {
    if (!joined) return;

    const ws = new WebSocket('ws://localhost:8000/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          roomId: roomId,
          playerId: playerId,
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ROOM_STATE') {
        setRoomState(data.roomState);

        // Track when question starts for timing
        if (
          data.roomState.status === 'playing' &&
          data.roomState.currentQuestion
        ) {
          if (!questionStartTimeRef.current) {
            questionStartTimeRef.current = Date.now();
          }
        } else {
          questionStartTimeRef.current = null;
        }
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [joined, roomId, playerId]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomId && playerId) {
      setJoined(true);
    }
  };

  const handleStartGame = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'START_GAME' }));
    }
  };

  const handleSubmitAnswer = (e) => {
    e.preventDefault();
    if (wsRef.current && answer && questionStartTimeRef.current) {
      const timeMs = Date.now() - questionStartTimeRef.current;
      wsRef.current.send(
        JSON.stringify({
          type: 'ANSWER',
          answer: answer,
          timeMs: timeMs,
        })
      );
      setAnswer('');
      questionStartTimeRef.current = null;
    }
  };

  if (!joined) {
    return (
      <div className='container'>
        <h1>Trivia Duel</h1>
        <form onSubmit={handleJoin} className='join-form'>
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
  }

  if (!roomState) {
    return <div className='container'>Connecting...</div>;
  }

  return (
    <div className='container'>
      <h1>Trivia Duel - Room: {roomId}</h1>

      <div className='scoreboard'>
        <h2>Scores</h2>
        {Object.entries(roomState.players).map(([player, score]) => (
          <div key={player} className='score-item'>
            <span className='player-name'>
              {player} {player === playerId && '(you)'}
            </span>
            <span className='player-score'>{score}</span>
          </div>
        ))}
      </div>

      {roomState.status === 'waiting' && (
        <div className='game-section'>
          <p>Waiting for players...</p>
          <button onClick={handleStartGame} className='start-button'>
            Start Game
          </button>
        </div>
      )}

      {roomState.status === 'playing' && (
        <div className='game-section'>
          <h2>Question {roomState.questionIndex + 1} / 10</h2>
          <p className='question'>{roomState.currentQuestion.text}</p>
          <p className='timer'>
            Time remaining: {Math.ceil(roomState.timeRemainingMs / 1000)}s
          </p>

          <form onSubmit={handleSubmitAnswer} className='answer-form'>
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
      )}

      {roomState.status === 'finished' && (
        <div className='game-section'>
          <h2>Game Over!</h2>
          <p className='winner'>Winner: {roomState.winner} 🎉</p>
          <h3>Final Scores:</h3>
          <div className='final-scores'>
            {Object.entries(roomState.players)
              .sort(([, a], [, b]) => b - a)
              .map(([player, score]) => (
                <div key={player} className='final-score-item'>
                  <span>{player}</span>
                  <span>{score}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
