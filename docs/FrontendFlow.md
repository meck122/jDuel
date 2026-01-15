# jDuel Frontend Architecture

This document describes the React component architecture, state management, and game flow for the jDuel frontend.

## Project Structure

```
frontend/src/
├── App.tsx                    # Root component with routing
├── config.tsx                 # Environment configuration
├── theme.ts                   # MUI theme configuration
│
├── components/                # Reusable UI components
│   ├── common/               # Shared components
│   │   └── Timer/            # Countdown timer component
│   ├── layout/               # Layout components
│   │   └── PageContainer/    # Page wrapper with max-width
│   ├── Navigation/           # Top navigation bar
│   └── About/                # About page content
│
├── contexts/                  # React contexts for state
│   └── GameContext.tsx       # Game state & WebSocket management
│
├── features/                  # Feature-based modules
│   └── game/                 # Game feature
│       ├── GameView/         # Main game container/orchestrator
│       ├── Lobby/            # Pre-game waiting room
│       ├── Question/         # Question display & answer input
│       ├── Results/          # Post-question results
│       └── GameOver/         # Final scores display
│
├── hooks/                     # Custom React hooks
│   └── usePlayerName.ts      # localStorage player name management
│
├── pages/                     # Route-level components
│   ├── HomePage/             # Landing page (create/join)
│   └── GamePage/             # Active game session
│
├── services/                  # API services
│   └── api.ts                # HTTP API client
│
├── styles/                    # Global styles
│   ├── global.css            # Global CSS
│   ├── variables.css         # CSS custom properties
│   └── components.css        # Shared component styles
│
└── types/                     # TypeScript types
    └── index.ts              # Shared type definitions
```

---

## Component Architecture

```
App (Router)
├── Route "/" → HomePage
│   ├── "Host a Game" card → Create room flow
│   ├── "Join a Game" card → Join room flow
│   └── ?join=XXXX param → Auto-activate join card with room code
│
├── Route "/room/:roomId" → Redirect to /?join=:roomId
│
├── Route "/game/:roomId" → GamePage
│   └── GameProvider (context)
│       └── GamePageContent
│           ├── Error state
│           ├── Connecting state
│           └── GameView (connected)
│               ├── Lobby (status: waiting)
│               ├── Question (status: playing)
│               ├── Results (status: results)
│               └── GameOver (status: finished)
│
└── Route "/about" → About
```

---

## State Management

### GameContext

The `GameContext` provides centralized game state management, eliminating prop drilling:

```typescript
interface GameContextValue {
  // Room identification
  roomId: string;
  playerId: string;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Game state from server
  roomState: RoomState | null;

  // Actions
  connect: (roomId: string, playerId: string) => void;
  disconnect: () => void;
  startGame: () => void;
  submitAnswer: (answer: string) => void;
}
```

### Using GameContext

```tsx
// In any game component
import { useGame } from '../contexts';

function Question() {
  const { roomState, submitAnswer } = useGame();

  // Access state directly, no props needed
  const question = roomState?.currentQuestion;

  return <form onSubmit={() => submitAnswer(answer)}>{/* ... */}</form>;
}
```

---

## Player Session Persistence

Player names are stored in `localStorage` for convenience:

```javascript
const PLAYER_NAME_KEY = 'jduel_player_name';

// Save on successful join
localStorage.setItem(PLAYER_NAME_KEY, playerName);

// Load on page visit
const savedName = localStorage.getItem(PLAYER_NAME_KEY);
```

This means:

- Returning users don't need to re-enter their name
- Deep link visitors see their saved name pre-filled
- Name persists across browser sessions

---

## Complete Game Flow: Two Players

This traces the HTTP calls, WebSocket connections, and React state changes for a complete game between **Alice** (creator) and **Bob** (joiner via deep link).

---

### Phase 1: Alice Creates a Room

#### Step 1: Alice Opens App

**URL:** `http://localhost:3000/`

**Component Tree:**

```
App → HomePage
```

**User sees:** Two action cards - "Host a Game" and "Join a Game"

#### Step 2: Alice Clicks "Host a Game"

**User Action:** Alice enters name "Alice" and clicks "Create Room"

#### Step 3: HTTP Room Creation

**API Calls:**

```javascript
// 1. Create room
const room = await createRoom();
// Response: { roomId: "AB3D", status: "waiting", playerCount: 0 }

// 2. Register Alice as player
await joinRoom('AB3D', 'Alice');
// Response: { roomId: "AB3D", playerId: "Alice", status: "waiting" }
```

#### Step 4: Navigate to Game

**Navigation:**

```javascript
navigate('/game/AB3D?player=Alice');
```

**URL:** `http://localhost:3000/game/AB3D?player=Alice`

**Component Tree:**

```
App → GamePage → GameProvider → GamePageContent → GameView → Lobby
```

#### Step 5: WebSocket Connection

**GameContext connects:**

```javascript
connect('AB3D', 'Alice');
// WebSocket URL: ws://localhost:8000/ws?roomId=AB3D&playerId=Alice
```

**Server → Alice (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 0 },
    "status": "waiting",
    "questionIndex": 0
  }
}
```

---

### Phase 2: Bob Joins via Deep Link

Alice shares the link: `http://localhost:3000/room/AB3D`

#### Step 1: Bob Opens Deep Link

**URL:** `http://localhost:3000/room/AB3D`

**Router redirects to:** `http://localhost:3000/?join=AB3D`

**Component Tree:**

```
App → HomePage (with join card active, room code prefilled)
```

#### Step 2: Bob Enters Name and Joins

Bob sees the "Join a Game" card already active with room code "AB3D" prefilled.
He enters his name and clicks "Join Room".

**API Call:**

```javascript
await joinRoom('AB3D', 'Bob');
// Response: { roomId: "AB3D", playerId: "Bob", status: "waiting" }
```

#### Step 3: Navigate to Game

**Navigation:**

```javascript
navigate('/game/AB3D?player=Bob');
```

**URL:** `http://localhost:3000/game/AB3D?player=Bob`

#### Step 4: WebSocket Connection

**GameContext connects:**

```javascript
connect('AB3D', 'Bob');
```

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 0, "Bob": 0 },
    "status": "waiting",
    "questionIndex": 0
  }
}
```

---

### Phase 3: Game Start

#### Alice Clicks "Start Game"

**Action via GameContext:**

```javascript
const { startGame } = useGame();
startGame(); // Sends { type: "START_GAME" }
```

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 0, "Bob": 0 },
    "status": "playing",
    "questionIndex": 0,
    "currentQuestion": {
      "text": "What is the capital of France?",
      "category": "Geography"
    },
    "timeRemainingMs": 15000
  }
}
```

**Component Renders:**

```
GameView → Question
```

---

### Phase 4: Answering Questions

#### Both Players Submit Answers

**Alice's action:**

```javascript
const { submitAnswer } = useGame();
submitAnswer('Paris');
```

**WebSocket Message (Alice → Server):**

```json
{ "type": "ANSWER", "answer": "Paris" }
```

#### Server Shows Results

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 1000, "Bob": 0 },
    "status": "results",
    "questionIndex": 0,
    "timeRemainingMs": 5000,
    "results": {
      "correctAnswer": "Paris",
      "playerAnswers": { "Alice": "Paris", "Bob": "London" },
      "playerResults": { "Alice": 1000, "Bob": 0 }
    }
  }
}
```

**Component Renders:**

```
GameView → Results
```

---

### Phase 5: Game Over

After 10 questions:

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 6200, "Bob": 3800 },
    "status": "finished",
    "questionIndex": 9,
    "winner": "Alice",
    "timeRemainingMs": 10000
  }
}
```

**Component Renders:**

```
GameView → GameOver
```

#### Room Closes

After timeout, server sends:

```json
{ "type": "ROOM_CLOSED" }
```

**GameProvider callback:**

```javascript
onRoomClosed?.(); // Triggers navigate('/')
```

---

## Key Architectural Decisions

### 1. Feature-Based Organization

Game components live in `features/game/` rather than flat in `components/`. This:

- Groups related functionality together
- Makes the game feature self-contained
- Improves discoverability

### 2. Context Over Props

`GameContext` eliminates prop drilling for game state. Benefits:

- Components access only what they need
- Easier to add new game features
- Cleaner component interfaces

### 3. Separation of Concerns

- **HomePage**: Room creation, join flow, deep link handling
- **GamePage**: WebSocket connection, GameProvider setup
- **GameView**: Phase orchestration (which component to show)
- **Lobby/Question/Results/GameOver**: Individual phase UI

### 4. HTTP + WebSocket Hybrid

- HTTP for room creation, validation, player registration
- WebSocket for real-time game updates
- Enables proper error handling and deep linking

### 5. Deep Link via Redirect

Deep links (`/room/AB3D`) redirect to `/?join=AB3D` instead of having a separate page:

- Consolidates all entry logic in HomePage
- Simpler architecture with fewer components
- Consistent UX for all join flows

---

## Component Responsibilities

| Component  | Responsibility                                       |
| ---------- | ---------------------------------------------------- |
| `HomePage` | Room creation, join flow, deep link redirect handler |
| `GamePage` | GameProvider setup, WebSocket connection management  |
| `GameView` | Renders correct phase component based on status      |
| `Lobby`    | Show players, share link, start game button          |
| `Question` | Display question, timer, answer form                 |
| `Results`  | Show correct answer, scores, player answers          |
| `GameOver` | Winner announcement, final scores                    |
| `Timer`    | Local countdown interpolation                        |
