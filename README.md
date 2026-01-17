# jDuel

A real-time multiplayer trivia game built with React and FastAPI.

## Project Overview

jDuel is a multiplayer trivia game where players compete in real-time to answer questions. Players can create or join game rooms using short alphanumeric codes, answer timed trivia questions, and see live scoreboards.

### Key Features

- **Room-based Multiplayer**: Create or join rooms with 4-character uppercase room codes (e.g., "AB3D")
- **Deep Linking**: Share room URLs (e.g., `/room/AB3D`) that redirect to home page with room code prefilled
- **Real-time Gameplay**: WebSocket-powered instant updates for all players
- **Live Results**: See all player answers and correct answer after each question
- **Player Persistence**: Names saved in localStorage for returning players
- **Automatic Cleanup**: Rooms auto-close 60 seconds after game completion

## Architecture

### Hybrid HTTP/WebSocket Design

jDuel uses a hybrid architecture:

- **HTTP REST API**: Room creation, validation, and player registration
- **WebSocket**: Real-time game communication after joining

This enables deep linking, proper error handling, and clean state management.

## Getting Started

### Prerequisites

- **Backend**: Python 3.13+, uv package manager
- **Frontend**: Node.js 18+, npm or yarn

### Installation

**Backend:**

```bash
cd backend
uv sync  # Install dependencies
```

**Frontend:**

```bash
cd frontend
npm install
```

### Running the Application

**Backend:**

```bash
cd backend
uv run uvicorn app.main:app --reload
# Server runs at http://localhost:8000
```

**Frontend:**

```bash
cd frontend
npm run dev
# App runs at http://localhost:3000
```

Open `http://localhost:3000` in two browser windows to test multiplayer functionality.

### Tech Stack

**Frontend:**

- React 19 with TypeScript
- React Router for page navigation and deep links
- Vite for build tooling
- Material-UI (MUI) components
- CSS Modules for styling
- HTTP fetch for API calls
- WebSocket for real-time communication

**Backend:**

- FastAPI (Python 3.13+)
- REST API for room management
- WebSockets for bidirectional game communication
- In-memory data structures (no database)
- Pandas for CSV question import
- **Answer Verification**:
  - spaCy for NLP and lemmatization
  - sentence-transformers for semantic similarity
  - RapidFuzz for fuzzy string matching
- Uvicorn ASGI server

### General Project Structure

```
jDuel/
├── backend/
│   ├── pyproject.toml          # Python dependencies (uv package manager)
│   └── src/
│       ├── app/
│       │   ├── main.py         # FastAPI app entry point + lifespan
│       │   ├── config/         # Configuration package
│       │   │   ├── __init__.py
│       │   │   ├── game.py     # Game constants (timing, scoring)
│       │   │   ├── environment.py  # CORS and environment settings
│       │   │   └── logging.py  # Logging configuration
│       │   ├── api/
│       │   │   ├── routes.py   # HTTP REST endpoints
│       │   │   └── websocket_handler.py  # WebSocket message handling
│       │   ├── db/
│       │   │   └── database.py # Question loading from CSV
│       │   ├── models/
│       │   │   ├── game.py     # Room, Player, Question models
│       │   │   ├── question.py # Question data structures
│       │   │   └── state.py    # Room state messages
│       │   └── services/
│       │       ├── container.py         # Service container (DI)
│       │       ├── answer/              # Answer verification package
│       │       │   ├── __init__.py
│       │       │   ├── answer_service.py  # NLP-based answer verification
│       │       │   └── loader.py          # Model loading utilities
│       │       ├── core/                # Core game services
│       │       │   ├── __init__.py
│       │       │   ├── game_service.py    # Game logic & scoring
│       │       │   ├── room_manager.py    # Room/player management
│       │       │   └── timer_service.py   # Question/results timers
│       │       └── orchestration/       # Game flow coordination
│       │           ├── __init__.py
│       │           ├── orchestrator.py    # Coordinates game flow
│       │           └── state_builder.py   # State message construction
│       └── scripts/
│           ├── import_questions.py      # CSV import utility
│           ├── answer_service_testing.py # Answer checking tests
│           └── jeopardy_questions.csv   # Question database
│
└── frontend/
    ├── package.json            # npm dependencies
    ├── vite.config.ts          # Vite configuration
    └── src/
        ├── main.tsx            # React entry point
        ├── App.tsx             # Router setup
        ├── config.tsx          # API/WebSocket URLs
        ├── theme.ts            # MUI theme configuration
        ├── services/
        │   └── api.ts          # HTTP API client
        ├── contexts/
        │   └── GameContext.tsx # Game state & WebSocket management
        ├── hooks/
        │   └── usePlayerName.ts # Player name localStorage hook
        ├── pages/
        │   ├── HomePage/       # Landing page (create/join + deep link)
        │   └── GamePage/       # Active game session
        ├── features/
        │   └── game/           # Game feature components
        │       ├── GameView/   # Main game orchestrator
        │       ├── Lobby/      # Waiting room + share link
        │       ├── Question/   # Question display
        │       ├── Results/    # Answer results
        │       └── GameOver/   # Final scores
        ├── components/
        │   ├── common/         # Shared components (Timer)
        │   ├── layout/         # Layout components (PageContainer)
        │   ├── Navigation/     # Top navigation bar
        │   └── About/          # About page content
        ├── styles/             # Global CSS
        └── types/
            └── index.ts        # TypeScript interfaces
```

## Communication Protocol

### HTTP REST API

Used for room management:

- `POST /api/rooms` - Create a new room
- `GET /api/rooms/:roomId` - Get room info (validation)
- `POST /api/rooms/:roomId/join` - Register player before WebSocket

### WebSocket Protocol

Used for real-time game communication after joining.

**Client → Server:**

- `START_GAME` - Host starts the game
- `ANSWER` - Submit an answer with `answer` field

**Server → Client:**

- `ROOM_STATE` - Broadcast current game state (on every change)
- `ERROR` - Error occurred with `message` field
- `ROOM_CLOSED` - Room closed by server

See [EventProtocol.md](docs/EventProtocol.md) for complete protocol details.

## Game Flow

### User Journey

1. **Create/Join Room** (HomePage):

   - Host: Enter name → Create room → Navigate to `/game/:roomId`
   - Joiner: Enter name + room code → Join room → Navigate to `/game/:roomId`
   - Deep Link: Visit `/room/AB3D` → Redirects to `/?join=AB3D` → Prefills room code

2. **Lobby Phase** (GamePage → Lobby):

   - WebSocket connects
   - Shows room code and shareable link
   - Displays all joined players
   - Any player can click "Start Game"

3. **Question Phase** (GamePage → Question):

   - Question text and category displayed
   - 15-second countdown timer
   - Players submit answers once
   - Transitions to results when timer expires

4. **Results Phase** (GamePage → Results):

   - Shows correct answer
   - Displays all player answers with AI-verified correctness
   - Color-coded: green ✓ for correct, red ✗ for incorrect
   - Shows points gained
   - 10-second display, auto-advances to next question

5. **Game Over** (GamePage → GameOver):
   - Final scores displayed
   - Winner announced
   - Room auto-closes after 60 seconds, redirects to home

## Key Implementation Details

### Backend Services

The backend services are organized into modular packages for better maintainability:

**Configuration (`config/`)**:

- **game.py**: Game constants (timing, scoring rules)
- **environment.py**: CORS origins and environment-specific settings
- **logging.py**: Centralized logging configuration

**Answer Verification (`services/answer/`)**:

- **AnswerService**: AI-powered answer verification using:
  - Fuzzy string matching (RapidFuzz) for typo tolerance
  - Semantic similarity (sentence-transformers embeddings) for synonyms
  - Lemmatization (spaCy) for grammatical variations
  - Exact matching for numeric answers
- **loader.py**: Dedicated model loading utility for clean startup

**Core Services (`services/core/`)**:

- **RoomManager**: Manages room lifecycle, player connections, generates room codes, handles duplicate name detection
- **GameService**: Validates answers through AnswerService, calculates scores (time-based bonus), tracks correct/incorrect answers
- **TimerService**: Manages question timers and results timers per room

**Orchestration (`services/orchestration/`)**:

- **GameOrchestrator**: Coordinates game flow between all services, handles state transitions
- **StateBuilder**: Constructs room state messages with current question, timer, results, and correct player tracking

**Dependency Injection**:

- **ServiceContainer**: Manages all service instances using the Composition Root pattern for clean dependency management

### Frontend Architecture

- **GameContext**: Centralized game state management with WebSocket connection
- **usePlayerName**: Custom hook for localStorage player name persistence
- **Feature-based structure**: Game components organized in `features/game/`
- **React Router**: Client-side routing with deep link redirect support

### State Management

- **Backend**: In-memory dictionaries keyed by room ID (no persistence)
- **Frontend**: GameContext provides centralized state via React Context API
- **WebSocket**: Connection managed by GameContext, state updates via `ROOM_STATE` messages
- **localStorage**: Player names persisted for convenience across sessions

### Validation & Error Handling

- **Non-existent room**: Error message, user stays on join form
- **Duplicate player name**: Error message, user must choose different name
- **Invalid room code format**: Input enforced to uppercase on frontend
- **Disconnections**: Players auto-removed from rooms, empty rooms deleted

### Timing Configuration

Timing configuration constants in `backend/src/app/config/game.py`:

- `QUESTION_TIME_MS = 15000` (15 seconds per question)
- `RESULTS_TIME_MS = 10000` (10 seconds for results display)
- `GAME_OVER_TIME_MS = 60000` (60 seconds before room auto-closes)

## Environment Variables

Current config has no ENV vars.

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

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 License.

Commercial use is prohibited.

## Contributors

Mark Liao  
Joshua Strutt  
Justin Cedillo
