# jDuel

A real-time multiplayer Jeopardy-style trivia game built with React and FastAPI.

## Project Overview

jDuel is a WebSocket-based multiplayer trivia game where players compete in real-time to answer questions. Players can create or join game rooms using short alphanumeric codes, answer timed trivia questions, and see live scoreboards.

### Key Features

- **Room-based Multiplayer**: Create or join rooms with 4-character uppercase room codes (e.g., "AB3D")
- **Real-time Gameplay**: WebSocket-powered instant updates for all players
- **Live Results**: See all player answers and correct answer after each question
- **Automatic Cleanup**: Rooms auto-close 60 seconds after game completion

## Architecture

### Tech Stack

**Frontend:**

- React 19 with TypeScript
- Vite for build tooling
- Material-UI (MUI) components
- CSS Modules for styling
- WebSocket for real-time communication

**Backend:**

- FastAPI (Python 3.13+)
- WebSockets for bidirectional communication
- In-memory data structures (no database)
- Pandas for CSV question import
- Uvicorn ASGI server

### Project Structure

```
jDuel/
├── backend/
│   ├── pyproject.toml          # Python dependencies (uv package manager)
│   └── src/
│       ├── app/
│       │   ├── main.py         # FastAPI app entry point
│       │   ├── config.py       # Configuration constants
│       │   ├── api/
│       │   │   └── websocket_handler.py  # WebSocket message handling
│       │   ├── db/
│       │   │   └── database.py # Question loading from CSV
│       │   ├── models/
│       │   │   ├── game.py     # Room, Player, Question models
│       │   │   ├── question.py # Question data structures
│       │   │   └── state.py    # Room state messages
│       │   └── services/
│       │       ├── game_service.py      # Game logic (answers, scoring)
│       │       ├── orchestrator.py      # Game flow coordination
│       │       ├── room_manager.py      # Room/player management
│       │       ├── state_builder.py     # State message construction
│       │       └── timer_service.py     # Question/results timers
│       └── scripts/
│           ├── import_questions.py      # CSV import utility
│           └── jeopardy_questions.csv   # Question database
│
└── frontend/
    ├── package.json            # npm dependencies
    ├── vite.config.ts          # Vite configuration
    └── src/
        ├── main.tsx            # React entry point
        ├── App.tsx             # Router setup
        ├── config.tsx          # API/WebSocket URLs
        ├── components/
        │   ├── JoinForm/       # Room creation/join UI
        │   ├── LobbyRoom/      # Waiting room UI
        │   ├── GameRoom/       # Main game coordinator
        │   ├── QuestionView/   # Question display
        │   ├── ResultsView/    # Answer results
        │   ├── GameOver/       # Final scores
        │   ├── Scoreboard/     # Live player scores
        │   └── Timer/          # Countdown display
        ├── hooks/
        │   └── useWebSocket.tsx # WebSocket hook
        ├── pages/
        │   └── GamePage.tsx    # Main game page
        └── types/
            └── index.ts        # TypeScript interfaces
```

## WebSocket Protocol

The game uses WebSocket for all real-time communication.

### Client → Server Messages

```typescript
// Create a new room
{ type: "CREATE_ROOM", playerId: string }

// Join an existing room
{ type: "JOIN_ROOM", roomId: string, playerId: string }

// Start the game (host only)
{ type: "START_GAME" }

// Submit an answer
{ type: "ANSWER", answer: string }
```

### Server → Client Messages

```typescript
// Room state update (sent on every state change)
{
  type: "ROOM_STATE",
  roomState: {
    roomId: string,
    players: { [playerId: string]: score },
    status: "waiting" | "playing" | "results" | "finished",
    questionIndex: number,
    currentQuestion?: { text: string, category: string },
    timeRemainingMs?: number,
    winner?: string,
    results?: {
      correctAnswer: string,
      playerAnswers: { [playerId: string]: answer }
    }
  }
}

// Error occurred (e.g., room doesn't exist, name taken)
{ type: "ERROR", message: string }

// Room was closed by server
{ type: "ROOM_CLOSED" }
```

## Game Flow

1. **Lobby Phase** (`status: "waiting"`):

   - Players join the room
   - Host can see all players and start the game
   - Room code displayed for sharing

2. **Question Phase** (`status: "playing"`):

   - Question displayed with category
   - 15-second countdown timer
   - Players submit answers once
   - Transitions to results when all answer or timer expires

3. **Results Phase** (`status: "results"`):

   - Shows correct answer
   - Displays all player answers (color-coded: green=correct, red=incorrect)
   - 10-second display
   - Auto-advances to next question or game over

4. **Game Over** (`status: "finished"`):
   - Final scores displayed
   - Winner announced
   - Room auto-closes after 60 seconds

## Key Implementation Details

### Backend Services

- **RoomManager**: Manages room lifecycle, player connections, generates room codes, handles duplicate name detection
- **GameService**: Validates answers (case-insensitive), calculates scores (time-based bonus), tracks answered players
- **GameOrchestrator**: Coordinates game flow between services, handles state transitions
- **TimerService**: Manages question timers and results timers per room
- **StateBuilder**: Constructs room state messages with current question, timer, results

### Frontend Hooks

- **useWebSocket**: Manages WebSocket connection, message handling, auto-reconnect prevention using refs to avoid dependency issues

### State Management

- Backend: In-memory dictionaries keyed by room ID (no persistence)
- Frontend: React state with WebSocket-driven updates
- WebSocket connection lifecycle tied to `joined` state only (not `roomId` or `playerId` to prevent reconnection loops)

### Validation & Error Handling

- **Non-existent room**: Error message, user stays on join form
- **Duplicate player name**: Error message, user must choose different name
- **Invalid room code format**: Input enforced to uppercase on frontend
- **Disconnections**: Players auto-removed from rooms, empty rooms deleted

### Timing Configuration

Timing configuration constants in `backend/src/app/config.py`:

## Environment Variables

**Backend** (`backend/.env`):

```bash
LOG_LEVEL=INFO                           # DEBUG, INFO, WARNING, ERROR
FRONTEND_URL=http://localhost:5173       # For CORS configuration
```

**Frontend** (`frontend/src/config.tsx`):

```typescript
export const WS_URL = 'ws://localhost:8000/ws';
```

## Testing

Currently no automated tests. Manual testing workflow:

1. Open two browser windows (or incognito + normal)
2. Create room in window 1, note room code
3. Join with room code in window 2
4. Start game from window 1
5. Both players answer questions
6. Verify scores, results, and game over screen

## Future Enhancements

- [ ] Persistent storage (database)
- [ ] User authentication
- [ ] Room settings (question count, time limits)
- [ ] Question categories filter
- [ ] Spectator mode
- [ ] Leaderboards
- [ ] Mobile-responsive design improvements
- [ ] Sound effects and animations
- [ ] Automated testing suite

## License

[Add appropriate license]

## Contributors

Mark Liao
Joshua Strutt
