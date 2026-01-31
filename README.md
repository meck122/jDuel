# jDuel

A real-time multiplayer trivia game built with React and FastAPI featuring AI-powered answer verification at https://jduel.xyz/

## Project Overview

jDuel is a WebSocket-based multiplayer trivia game where 2-8 players compete in real-time to answer questions. Players can create or join game rooms using short room codes, answer timed questions, and see live results with intelligent answer checking.

### Key Features

- **Room-based Multiplayer**: Create or join rooms with auto-generated 4-character alphanumeric room codes
- **Deep Linking**: Share room URLs (e.g., `/room/AB3D`) that redirect to home page with room code prefilled
- **Real-time Gameplay**: WebSocket-powered instant updates for all players
- **AI Answer Verification**: Intelligent answer checking using NLP (spaCy), semantic embeddings (sentence-transformers), and fuzzy matching (RapidFuzz)
- **Time-based Scoring**: First correct answer gets 1000 points, second gets 500, third gets 250, etc.
- **Live Results**: See all player answers with AI-verified correctness after each question
- **Player Persistence**: Names saved in localStorage for returning players
- **Automatic Reconnection**: Players can reconnect after page refresh without losing their spot
- **Automatic Cleanup**: Rooms auto-close 60 seconds after game completion; empty rooms deleted immediately

## Architecture

### Hybrid HTTP/WebSocket Design

jDuel uses a two-phase connection architecture:

**Phase 1 - HTTP REST API**: Room creation, validation, and player pre-registration
**Phase 2 - WebSocket**: Real-time game communication after registration

This design enables:

- Deep linking with shareable room URLs
- Proper HTTP error handling (404, 409 status codes)
- Clean reconnection flow (players can refresh without losing their spot)
- Secure state management (server validates all actions)

## Getting Started

### Prerequisites

- **Backend**: Python 3.13+, uv package manager
- **Frontend**: Node.js 18+, npm

### Installation

**Backend:**

```bash
cd backend
uv sync  # Install dependencies and download ML models
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
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

**Frontend:**

```bash
cd frontend
npm run dev
# App runs at http://localhost:3000
```

Open `http://localhost:3000` in multiple browser windows to test multiplayer functionality.

### Tech Stack

**Frontend:**

- React 19 with TypeScript
- React Router 7 for page navigation and deep links
- Vite 7 for build tooling and development server
- Material-UI (MUI) 7 components and styling
- CSS Modules for component-scoped styles
- Native Fetch API for HTTP requests
- Native WebSocket API for real-time communication

**Backend:**

- FastAPI for REST API and WebSocket endpoints
- Python 3.13+ with modern async/await patterns
- Pydantic for data validation and serialization
- In-memory data structures (no database persistence)
- **AI Answer Verification System**:
  - spaCy (`en_core_web_sm`) for NLP and lemmatization
  - sentence-transformers (`all-MiniLM-L6-v2`) for semantic similarity embeddings
  - RapidFuzz for fuzzy string matching with typo tolerance
  - Multi-stage verification: exact match → fuzzy match (85% threshold) → semantic similarity (0.8 threshold) → lemmatized comparison
- Pandas for CSV question import
- Uvicorn ASGI server
- Ruff for linting and code formatting

### Project Structure

```
jDuel/
├── backend/
│   ├── pyproject.toml          # Python dependencies (uv package manager)
│   └── src/
│       ├── app/
│       │   ├── main.py         # FastAPI app entry point + lifespan management
│       │   ├── config/         # Configuration package
│       │   │   ├── environment.py  # CORS origins and environment settings
│       │   │   ├── game.py     # Game constants (timing, scoring)
│       │   │   └── logging.py  # Logging configuration
│       │   ├── api/
│       │   │   ├── dependencies.py  # FastAPI dependency injection
│       │   │   ├── routes.py   # HTTP REST endpoints
│       │   │   └── websocket_handler.py  # WebSocket connection & message handling
│       │   ├── db/
│       │   │   └── database.py # Question loading from CSV
│       │   ├── models/
│       │   │   ├── game.py     # Room and GameStatus models
│       │   │   ├── question.py # Question data structure
│       │   │   ├── room_config.py  # Room configuration settings
│       │   │   ├── round_state.py  # Per-question round state
│       │   │   ├── state.py    # WebSocket message models (RoomStateData, etc.)
│       │   │   └── websocket_messages.py  # Client-to-server message validation
│       │   └── services/
│       │       ├── container.py         # Service container for dependency injection
│       │       ├── answer/              # AI answer verification package
│       │       │   ├── answer_service.py  # Multi-stage NLP answer verification
│       │       │   └── loader.py          # Model loading with memory tracking
│       │       ├── core/                # Core game services
│       │       │   ├── connection_manager.py  # WebSocket connection tracking
│       │       │   ├── game_service.py    # Game logic, scoring, and answer processing
│       │       │   ├── question_provider.py  # Question loading and caching
│       │       │   ├── room_manager.py    # Room lifecycle and player management
│       │       │   ├── room_repository.py # Room storage abstraction
│       │       │   └── timer_service.py   # Async question/results timers
│       │       └── orchestration/       # Game flow coordination
│       │           ├── orchestrator.py    # Main game flow coordinator
│       │           ├── protocols.py       # Interface definitions
│       │           └── state_builder.py   # Room state message construction
│       └── scripts/
│           ├── import_questions.py      # CSV import utility
│           ├── answer_service_testing.py # Answer verification testing
│           └── processed_trivia.csv     # Question database
│
└── frontend/
    ├── package.json            # npm dependencies
    ├── vite.config.ts          # Vite build configuration
    ├── tsconfig.json           # TypeScript configuration
    └── src/
        ├── main.tsx            # React app entry point
        ├── App.tsx             # Router and theme setup
        ├── config.ts           # API/WebSocket URLs
        ├── theme.ts            # MUI theme configuration
        ├── services/
        │   └── api.ts          # HTTP API client functions
        ├── contexts/
        │   └── GameContext.tsx # Game state & WebSocket management
        ├── hooks/
        │   └── usePlayerName.ts # localStorage player name hook
        ├── pages/
        │   ├── HomePage/       # Landing page (create/join + deep link handling)
        │   ├── GamePage/       # Active game session wrapper
        │   └── AboutPage/      # About page
        ├── features/
        │   └── game/           # Game feature components
        │       ├── GameView/   # Main game phase orchestrator
        │       ├── Lobby/      # Waiting room with shareable link
        │       ├── Question/   # Question display and answer submission
        │       ├── Results/    # Answer results after each question
        │       └── GameOver/   # Final scores and winner
        ├── components/
        │   ├── common/         # Shared components
        │   │   ├── PlayerName/ # Player name display component
        │   │   └── Timer/      # Countdown timer component
        │   ├── layout/         # Layout components
        │   │   └── PageContainer/  # Page wrapper with consistent styling
        │   └── ui/             # UI components
        │       └── Navigation/ # Top navigation bar
        ├── styles/             # Global CSS
        │   ├── global.css      # Global styles
        │   ├── variables.css   # CSS custom properties
        │   └── components.css  # Shared component styles
        └── types/
            └── index.ts        # TypeScript type definitions
```

## Communication Protocol

### HTTP REST API

Used for room management before WebSocket connection:

- `POST /api/rooms` - Create a new room, returns room ID
- `GET /api/rooms/:roomId` - Validate room exists (used before joining)
- `POST /api/rooms/:roomId/join` - Pre-register player before WebSocket connection

### WebSocket Protocol

Used for real-time game communication after player pre-registration.

**Connection**: `ws://localhost:8000/ws?roomId=AB3D&playerId=Alice`

**Client → Server Messages:**

- `START_GAME` - Any player can start the game from lobby
- `ANSWER` - Submit an answer with `answer` field
- `UPDATE_CONFIG` - Host can update room configuration (difficulty, multiple choice) in lobby

**Server → Client Messages:**

- `ROOM_STATE` - Broadcast current game state on every change (status, question, timer, scores, results)
- `ERROR` - Error occurred with `message` field
- `ROOM_CLOSED` - Room was closed by server (triggers redirect to home)

See [EventProtocol.md](docs/EventProtocol.md) for complete protocol details and message schemas.

## Game Flow

### User Journey

1. **Create/Join Room** (HomePage):
   - **Host**: Enter name → Click "Create Room" → HTTP creates room → Navigate to `/game/:roomId`
   - **Joiner**: Enter name + room code → Click "Join Game" → HTTP validates room → Navigate to `/game/:roomId`
   - **Deep Link**: Visit `/room/AB3D` → Redirects to `/?join=AB3D` → Room code prefilled in join form

2. **Connection & Lobby** (GamePage → Lobby):
   - HTTP pre-registration via `POST /api/rooms/:roomId/join`
   - WebSocket connects with `roomId` and `playerId` query params
   - Lobby displays room code, shareable link, and list of connected players
   - Any player can click "Start Game" button
   - New players cannot join after game starts

3. **Question Phase** (Question component):
   - Question text and category displayed
   - 15-second countdown timer (live updates from server)
   - Players submit answers once per question
   - Auto-advances to results when all players answer OR timer expires
   - Timer managed server-side for security

4. **Results Phase** (Results component):
   - Displays correct answer
   - Shows all player answers with color-coded correctness (✓ green for correct, ✗ red for incorrect)
   - Displays points gained this round (1000 for 1st correct, 500 for 2nd, 250 for 3rd, etc.)
   - Shows updated leaderboard scores
   - 10-second display timer, then auto-advances to next question
   - After last question, transitions to Game Over

5. **Game Over** (GameOver component):
   - Final leaderboard with all player scores
   - Winner announced with celebration
   - Room auto-closes after 60 seconds
   - All players redirected to home page
   - WebSocket connections closed gracefully

### Reconnection Flow

Players can reconnect after disconnection (e.g., page refresh):

1. Player's registration persists in room after WebSocket disconnects
2. On page refresh, GamePage re-attempts HTTP join (server allows if same playerId)
3. WebSocket reconnects and player resumes from current game state
4. If all players disconnect, room is immediately deleted to prevent orphaned rooms

## Key Implementation Details

### Backend Services

The backend uses a **Service Container** pattern for dependency injection with modular services:

**Configuration (`app/config/`)**:

- **game.py**: Game timing constants (`QUESTION_TIME_MS`, `RESULTS_TIME_MS`, `GAME_OVER_TIME_MS`) and scoring rules
- **environment.py**: CORS configuration and environment-specific settings
- **logging.py**: Centralized logging setup

**Answer Verification (`app/services/answer/`)**:

- **AnswerService**: Multi-stage AI answer verification:
  1. **Exact match** (case-insensitive, normalized)
  2. **Fuzzy matching** (RapidFuzz with 85% threshold) - handles typos
  3. **Semantic similarity** (sentence-transformers with 0.8 cosine similarity) - handles synonyms
  4. **Lemmatized comparison** (spaCy) - handles grammatical variations ("ran" = "run")
- **loader.py**: Lazy model loading with memory usage tracking

**Core Services (`app/services/core/`)**:

- **RoomManager**: Room lifecycle (create, delete), player registration, duplicate name prevention, connection attachment/detachment
- **GameService**: Answer validation via AnswerService, time-based scoring calculation, game state transitions, winner determination
- **TimerService**: Async timers for question countdown and results display, per-room timer tracking and cancellation
- **ConnectionManager**: WebSocket connection tracking and broadcasting
- **QuestionProvider**: Question loading from CSV with caching
- **RoomRepository**: In-memory room storage abstraction

**Orchestration (`app/services/orchestration/`)**:

- **GameOrchestrator**: Main coordinator handling:
  - Two-phase join flow (HTTP registration → WebSocket connection)
  - Start game, answer submission, disconnection handling
  - State transitions (waiting → playing → results → finished)
  - Timer coordination
  - Room cleanup on empty rooms
- **StateBuilder**: Constructs `RoomStateData` messages with current question, timer, results, and scores
- **protocols.py**: Interface definitions for loose coupling

**Dependency Injection**:

- **ServiceContainer**: Composition Root pattern for clean dependency management and testability

### Frontend Architecture

- **GameContext**: Centralized game state management providing WebSocket connection, room state, and action methods (startGame, submitAnswer) to all child components
- **usePlayerName**: Custom React hook for localStorage persistence of player names across sessions
- **Feature-based structure**: Game components organized in `features/game/` for modularity
- **React Router**: Client-side routing with deep link redirect (`/room/:roomId` → `/?join=:roomId`)
- **Material-UI theming**: Custom Jeopardy-inspired theme with consistent typography and colors

### State Management

- **Backend**: In-memory dictionaries keyed by room ID (no database persistence)
  - Rooms stored in `RoomRepository`
  - Each `Room` contains: players (set), scores (dict), connections (dict), game state, round state
  - `RoundState` tracks per-question data: answers, correct players, points earned
- **Frontend**: GameContext provides centralized state via React Context API
  - Eliminates prop drilling
  - Single source of truth for `roomState`, `isConnected`, `connectionError`
  - WebSocket connection managed by context
- **WebSocket**: State updates broadcast via `ROOM_STATE` messages on every change
- **localStorage**: Player names persisted for convenience

### Validation & Error Handling

**HTTP API Errors** (before WebSocket connection):

- **404 Room Not Found**: Room doesn't exist, user stays on join form
- **409 Name Taken**: Duplicate player name in room (unless player is disconnected and reconnecting)
- **409 Game Started**: Game already in progress, new players cannot join

**WebSocket Connection Errors**:

- **Code 4004**: Room not found
- **Code 4003**: Player not registered (must call HTTP join first)
- **Code 4009**: Player already connected (prevents hijacking)

**Automatic Retries**:

- Frontend retries HTTP join up to 4 times (500ms delay) on NAME_TAKEN to handle race conditions during reconnection

**Room Cleanup**:

- Empty rooms (no active WebSocket connections) are immediately deleted
- Finished games auto-close after 60 seconds, redirecting all players home
- All timers cancelled on room deletion to prevent memory leaks

### Timing Configuration

All timing constants in [backend/src/app/config/game.py](backend/src/app/config/game.py):

- `QUESTION_TIME_MS = 15000` (15 seconds to answer each question)
- `RESULTS_TIME_MS = 10000` (10 seconds to view results before next question)
- `GAME_OVER_TIME_MS = 60000` (60 seconds before finished room auto-closes)
- `MAX_SCORE_PER_QUESTION = 1000` (first correct answer points, halves for each subsequent)

### Scoring System

Time-based scoring rewards speed and accuracy:

- **1st correct answer**: 1000 points
- **2nd correct answer**: 500 points
- **3rd correct answer**: 250 points
- **4th+ correct answers**: 125, 62, 31, etc. (halves each time)
- **Incorrect answers**: 0 points
- **Late answers** (after timer expires): 0 points

AI verification ensures fair scoring by accepting synonyms, typos, and grammatical variations.

## Environment Variables

Configuration is minimal. Environment variable options:

- `LOG_LEVEL`: Logging level (default: `INFO`, options: `DEBUG`, `WARNING`, `ERROR`)
- Frontend URLs configured in [frontend/src/config.ts](frontend/src/config.ts)
- Backend CORS origins configured in [backend/src/app/config/environment.py](backend/src/app/config/environment.py)

## Testing

Manual testing workflow (automated tests not currently implemented):

1. Open multiple browser windows (or incognito + normal mode)
2. Window 1: Create room, note the room code
3. Window 2: Join with room code
4. Either window: Click "Start Game"
5. Both players answer questions
6. Verify:
   - Answer correctness (test AI with typos, synonyms)
   - Time-based scoring (1st correct = 1000, 2nd = 500)
   - Results display with all answers
   - Final scores and winner
   - Room auto-close after 60 seconds
7. Test reconnection: Refresh page mid-game, verify player reconnects successfully

## Deployment

See [docs/Deployment.md](docs/Deployment.md) for production deployment instructions including:

- Nginx reverse proxy setup
- SystemD service configuration
- HTTPS with Let's Encrypt

## Future Enhancements

- [ ] Persistent storage with database (PostgreSQL/SQLite)
- [ ] User authentication and accounts
- [ ] Room settings (custom question count, time limits, categories)
- [ ] Question category filtering
- [ ] Spectator mode (watch games without playing)
- [ ] Leaderboards and statistics
- [ ] Mobile-responsive design improvements
- [ ] Sound effects and victory animations
- [ ] Automated testing suite (pytest for backend, Vitest for frontend)
- [ ] Custom question sets (user-uploaded questions)

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 License.

Commercial use is prohibited.

## Contributors

Mark Liao
Joshua Strutt
Justin Cedillo
