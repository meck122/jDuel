# jDuel Frontend Architecture

This document describes the React component architecture, state management, and game flow for the jDuel frontend.

## Project Structure

```
frontend/src/
├── App.tsx                    # Root component with React Router setup
├── config.ts                  # Environment configuration (API/WebSocket URLs)
├── theme.ts                   # MUI theme configuration
├── main.tsx                   # React app entry point
│
├── components/                # Reusable UI components
│   ├── common/               # Shared components
│   │   ├── PlayerName/       # Player name display component
│   │   └── Timer/            # Countdown timer component
│   ├── layout/               # Layout components
│   │   └── PageContainer/    # Page wrapper with consistent max-width
│   └── ui/                   # UI components
│       └── Navigation/       # Top navigation bar
│
├── contexts/                  # React contexts for state management
│   └── GameContext.tsx       # Game state & WebSocket connection management
│
├── features/                  # Feature-based modules
│   └── game/                 # Game feature
│       ├── GameView/         # Main game container/phase orchestrator
│       ├── Lobby/            # Pre-game waiting room with shareable link
│       ├── Question/         # Question display & answer input
│       ├── Results/          # Post-question results with all answers
│       └── GameOver/         # Final scores and winner display
│
├── hooks/                     # Custom React hooks
│   └── usePlayerName.ts      # localStorage player name persistence
│
├── pages/                     # Route-level page components
│   ├── HomePage/             # Landing page (create/join + deep link handling)
│   ├── GamePage/             # Active game session wrapper
│   └── AboutPage/            # About page
│
├── services/                  # External service interactions
│   └── api.ts                # HTTP API client functions
│
├── styles/                    # Global CSS styles
│   ├── global.css            # Global styles and resets
│   ├── variables.css         # CSS custom properties
│   └── components.css        # Shared component styles
│
└── types/                     # TypeScript type definitions
    └── index.ts              # Shared type definitions
```

---

## Component Architecture

```
App (Router + Theme)
├── Route "/" → HomePage
│   ├── "Host a Game" card → Create room → HTTP POST /api/rooms → Navigate to /game/:roomId
│   ├── "Join a Game" card → Join room → HTTP POST /api/rooms/:roomId/join → Navigate to /game/:roomId
│   └── ?join=XXXX param → Auto-activates join card with room code prefilled
│
├── Route "/room/:roomId" → RoomRedirect → Navigate to "/?join=:roomId" (deep link handling)
│
├── Route "/game/:roomId" → GamePage
│   ├── HTTP: POST /api/rooms/:roomId/join (pre-registration with retry logic)
│   └── GameProvider (WebSocket context)
│       └── GamePageContent
│           ├── Connecting state (loading spinner)
│           ├── Connection error state (error message with retry)
│           └── GameView (connected and ready)
│               ├── status="waiting" → Lobby
│               ├── status="playing" → Question
│               ├── status="results" → Results
│               └── status="finished" → GameOver
│
└── Route "/about" → AboutPage
```

---

## State Management

### GameContext

The `GameContext` provides centralized game state management using React Context API, eliminating prop drilling and creating a single source of truth:

```typescript
interface GameContextValue {
  // Room identification
  roomId: string;
  playerId: string;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Game state from server (updated via WebSocket)
  roomState: RoomState | null;

  // Actions
  connect: (roomId: string, playerId: string) => void;
  disconnect: () => void;
  startGame: () => void;
  submitAnswer: (answer: string) => void;
}
```

**Key Features:**

- **WebSocket Management**: Handles connection lifecycle, reconnection, and error recovery
- **State Broadcasting**: All state updates come from server via `ROOM_STATE` messages
- **Message Handling**: Parses and dispatches WebSocket messages to update React state
- **Auto-cleanup**: Closes WebSocket on unmount or navigation away

### Using GameContext

```tsx
// In any game component (no props needed!)
import { useGame } from '../../contexts';

function Question() {
  const { roomState, submitAnswer, playerId } = useGame();

  const question = roomState?.currentQuestion;
  const timeRemaining = roomState?.timeRemainingMs;

  const handleSubmit = (answer: string) => {
    submitAnswer(answer); // Sends WebSocket message
  };

  return (
    <div>
      <h2>{question?.text}</h2>
      <Timer timeRemainingMs={timeRemaining} />
      <form onSubmit={handleSubmit}>{/* ... */}</form>
    </div>
  );
}
```

---

## Player Session Persistence

Player names are stored in `localStorage` via the `usePlayerName` hook:

```typescript
const PLAYER_NAME_KEY = 'jduel_player_name';

export function usePlayerName() {
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  });

  const savePlayerName = (name: string) => {
    localStorage.setItem(PLAYER_NAME_KEY, name);
    setPlayerName(name);
  };

  return { playerName, savePlayerName };
}
```

**Benefits:**

- Returning users don't need to re-enter their name
- Deep link visitors see their saved name pre-filled
- Name persists across browser sessions and page refreshes
- Used on HomePage for join/create forms

---

## Complete Game Flow: Two Players

This traces the HTTP calls, WebSocket connections, and React state changes for a complete game between **Alice** (room creator) and **Bob** (joiner via deep link).

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

**User Action:**

1. Alice enters name "Alice" in the input field
2. Alice clicks "Create Room" button

**API Calls (HomePage):**

```javascript
// 1. Create room
const room = await createRoom();
// POST /api/rooms
// Response: { roomId: "AB3D", status: "waiting", playerCount: 0 }

// 2. Pre-register Alice as player
await joinRoom('AB3D', 'Alice');
// POST /api/rooms/AB3D/join
// Body: { playerId: "Alice" }
// Response: { roomId: "AB3D", playerId: "Alice", status: "waiting" }

// 3. Save name to localStorage
savePlayerName('Alice');

// 4. Navigate to game page
navigate('/game/AB3D');
```

#### Step 3: GamePage Initialization

**URL:** `http://localhost:3000/game/AB3D`

**Component Tree:**

```
App → GamePage → GameProvider → GamePageContent → "Connecting..." loader
```

**GamePage Logic:**

```javascript
// 1. Get roomId from URL params
const { roomId } = useParams(); // "AB3D"

// 2. Get playerId from localStorage
const { playerName } = usePlayerName(); // "Alice"

// 3. Verify registration (already done in HomePage, but retries allowed)
await joinRoom(roomId, playerName); // Allows reconnection

// 4. Connect WebSocket via GameContext
connect(roomId, playerName);
```

#### Step 4: WebSocket Connection

**GameContext initiates connection:**

```javascript
const wsUrl = `ws://localhost:8000/ws?roomId=AB3D&playerId=Alice`;
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  setIsConnected(true);
  setIsConnecting(false);
};
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

**Component Updates:**

```
GamePageContent → GameView → Lobby
```

**Lobby displays:**

- Room code: "AB3D"
- Shareable link: `http://localhost:3000/room/AB3D`
- Player list: ["Alice"]
- "Start Game" button (enabled since Alice is connected)

---

### Phase 2: Bob Joins via Deep Link

Alice shares the link: `http://localhost:3000/room/AB3D`

#### Step 1: Bob Opens Deep Link

**URL:** `http://localhost:3000/room/AB3D`

**Router matching:**

```tsx
<Route path='/room/:roomId' element={<RoomRedirect />} />
```

**RoomRedirect component:**

```tsx
function RoomRedirect() {
  const { roomId } = useParams(); // "AB3D"
  return <Navigate to={`/?join=${roomId}`} replace />;
}
```

**Redirects to:** `http://localhost:3000/?join=AB3D`

**Component Tree:**

```
App → HomePage (with ?join=AB3D query param)
```

#### Step 2: HomePage Auto-activates Join Form

**HomePage useEffect:**

```tsx
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const joinParam = params.get('join'); // "AB3D"

  if (joinParam) {
    setActiveCard('join');
    setRoomCode(joinParam.toUpperCase());
  }
}, [location.search]);
```

**User sees:**

- "Join a Game" card is expanded and active
- Room code input is prefilled with "AB3D"
- Player name input shows saved name (if any) from localStorage
- Bob enters his name "Bob" and clicks "Join Room"

#### Step 3: Bob Joins Room

**API Call (HomePage):**

```javascript
await joinRoom('AB3D', 'Bob');
// POST /api/rooms/AB3D/join
// Body: { playerId: "Bob" }
// Response: { roomId: "AB3D", playerId: "Bob", status: "waiting" }

savePlayerName('Bob');
navigate('/game/AB3D');
```

#### Step 4: Bob's WebSocket Connection

**GamePage for Bob:**

```javascript
// Verify registration
await joinRoom('AB3D', 'Bob');

// Connect WebSocket
connect('AB3D', 'Bob');
```

**WebSocket URL:** `ws://localhost:8000/ws?roomId=AB3D&playerId=Bob`

**Server → All Players (ROOM_STATE broadcast):**

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

**Both players' components update:**

```
GameView → Lobby (showing both Alice and Bob in player list)
```

---

### Phase 3: Game Start

#### Alice Clicks "Start Game"

**Lobby component:**

```tsx
const { startGame } = useGame();

<Button onClick={startGame}>Start Game</Button>;
```

**GameContext sends WebSocket message:**

```javascript
ws.send(JSON.stringify({ type: 'START_GAME' }));
```

**Server processes start, broadcasts new state:**

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

**GameView evaluates status:**

```tsx
if (roomState.status === 'playing') {
  return <Question />;
}
```

**Both players see:**

```
GameView → Question
```

**Question component displays:**

- Question text: "What is the capital of France?"
- Category: "Geography"
- Timer: 15 seconds (countdown from `timeRemainingMs`)
- Answer input field
- Submit button

---

### Phase 4: Answering Questions

#### Alice Submits First

**User action:** Alice types "Paris" and clicks submit

**Question component:**

```tsx
const { submitAnswer, playerId, roomState } = useGame();
const hasAnswered =
  roomState?.currentRound?.answeredPlayers?.includes(playerId);

const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  submitAnswer(answer);
  setAnswered(true); // Local UI state to disable form
};
```

**WebSocket Message (Alice → Server):**

```json
{ "type": "ANSWER", "answer": "Paris" }
```

**Alice's Question component after submit:**

- Answer input is disabled
- Shows "Waiting for other players..." message
- Timer continues counting down

#### Bob Submits Second (Wrong Answer)

**User action:** Bob types "London" and clicks submit

**WebSocket Message (Bob → Server):**

```json
{ "type": "ANSWER", "answer": "London" }
```

#### Server Evaluates Answers & Shows Results

Server's AnswerService checks:

- Alice's "Paris" → Correct (1000 points as 1st correct answer)
- Bob's "London" → Incorrect (0 points)

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 1000, "Bob": 0 },
    "status": "results",
    "questionIndex": 0,
    "timeRemainingMs": 10000,
    "results": {
      "correctAnswer": "Paris",
      "playerAnswers": { "Alice": "Paris", "Bob": "London" },
      "playerResults": { "Alice": 1000, "Bob": 0 }
    }
  }
}
```

**GameView transitions:**

```tsx
if (roomState.status === 'results') {
  return <Results />;
}
```

**Both players see:**

```
GameView → Results
```

**Results component displays:**

- Correct answer: "Paris" (highlighted)
- Player answers with color coding:
  - Alice: "Paris" ✓ (green) +1000 points
  - Bob: "London" ✗ (red) +0 points
- Updated leaderboard:
  - Alice: 1000
  - Bob: 0
- Timer: 10 seconds countdown
- Auto-advances to next question when timer expires

#### Next Question

After 10 seconds (RESULTS_TIME_MS), server auto-advances:

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 1000, "Bob": 0 },
    "status": "playing",
    "questionIndex": 1,
    "currentQuestion": {
      "text": "Who wrote Romeo and Juliet?",
      "category": "Literature"
    },
    "timeRemainingMs": 15000
  }
}
```

**Cycle repeats for all questions...**

---

### Phase 5: Game Over

After all questions are answered (default: 10 questions):

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
    "timeRemainingMs": 60000
  }
}
```

**GameView transitions:**

```tsx
if (roomState.status === 'finished') {
  return <GameOver />;
}
```

**Both players see:**

```
GameView → GameOver
```

**GameOver component displays:**

- Winner announcement: "Alice wins!" with celebration
- Final leaderboard:
  - Alice: 6200 points
  - Bob: 3800 points
- "Back to Home" button
- Timer: 60 seconds until auto-close

#### Room Auto-Close

After 60 seconds (GAME_OVER_TIME_MS), server closes room:

**Server → All Players:**

```json
{ "type": "ROOM_CLOSED" }
```

**GameContext handles message:**

```tsx
if (message.type === 'ROOM_CLOSED') {
  onRoomClosed?.(); // Callback triggers navigation
}
```

**GamePage's onRoomClosed callback:**

```tsx
<GameProvider onRoomClosed={() => navigate('/')}>
```

**Both players automatically navigate to:** `http://localhost:3000/`

**WebSocket connections close gracefully**

---

## Page Refresh & Reconnection Flow

jDuel supports seamless reconnection after page refresh:

### Scenario: Alice Refreshes During Game

#### Step 1: WebSocket Disconnects

**Browser:** Page refresh destroys WebSocket connection

**Server detects disconnect:**

- Removes Alice's WebSocket from `room.connections`
- Alice's registration remains in `room.players`
- Game continues (Bob can still play)

#### Step 2: GamePage Re-initializes

**After refresh, GamePage runs:**

```javascript
// 1. Get room and player from URL and localStorage
const roomId = 'AB3D';
const playerId = 'Alice';

// 2. Attempt HTTP re-registration
await joinRoom(roomId, playerId);
// Server allows this because Alice is registered but disconnected

// 3. Reconnect WebSocket
connect(roomId, playerId);
```

**Retry Logic (handles race conditions):**

```javascript
try {
  await joinRoom(roomId, playerId);
} catch (error) {
  if (error.code === 'NAME_TAKEN' && retryCount < 4) {
    // Old WebSocket not fully disconnected yet, retry
    setTimeout(() => registerAndConnect(retryCount + 1), 500);
  }
}
```

#### Step 3: State Resumes

**Server → Alice (ROOM_STATE on reconnect):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 3500, "Bob": 2100 },
    "status": "playing",
    "questionIndex": 5,
    "currentQuestion": {
      /* current question */
    },
    "timeRemainingMs": 8000
  }
}
```

**Alice's UI instantly shows current game state:**

- Current question (question 6)
- Her score: 3500
- Timer at 8 seconds
- She can answer if she hasn't already

**No game disruption for other players**

---

## Key Architectural Decisions

### 1. Feature-Based Organization

Game components live in `features/game/` rather than flat in `components/`. This:

- Groups related functionality together
- Makes the game feature self-contained and portable
- Improves code discoverability
- Reduces import path complexity

### 2. Context Over Props (No Prop Drilling)

`GameContext` eliminates prop drilling for game state. Benefits:

- Components access only what they need via `useGame()` hook
- Easier to add new game features without refactoring props
- Cleaner component interfaces
- Single source of truth for game state
- WebSocket connection managed in one place

### 3. Separation of Concerns

- **HomePage**: Room creation, join flow, deep link redirect handling, player name management
- **GamePage**: WebSocket connection lifecycle, HTTP pre-registration with retry logic, error boundary
- **GameView**: Phase orchestration based on `roomState.status` (which component to render)
- **Lobby/Question/Results/GameOver**: Individual phase UI (pure presentational logic)
- **GameContext**: WebSocket communication, state management, message parsing

### 4. HTTP + WebSocket Hybrid

**Why two protocols?**

- **HTTP**: Room creation, validation, player pre-registration
  - Enables proper error handling (404, 409 HTTP status codes)
  - Supports deep linking (shareable URLs before WebSocket)
  - Allows reconnection validation
- **WebSocket**: Real-time game updates
  - Instant state synchronization
  - Low latency for answers and timers
  - Efficient for frequent updates

**Two-Phase Join Flow:**

1. HTTP `POST /api/rooms/:roomId/join` → Pre-register player
2. WebSocket `ws://...?roomId=X&playerId=Y` → Attach connection

This prevents WebSocket connection issues from creating invalid state.

### 5. Deep Link via Redirect

Deep links (`/room/AB3D`) redirect to `/?join=AB3D` instead of having a separate page:

- **Consolidates entry logic**: All join flows use the same HomePage component
- **Simpler architecture**: Fewer components to maintain
- **Consistent UX**: Same join form for direct visits and deep links
- **URL preservation**: Query param `?join=AB3D` shows intent in address bar
- **Shareable state**: Users can copy URL from address bar after redirect

### 6. Timer Synchronization

**Client-side interpolation from server time:**

```tsx
// Server sends timeRemainingMs updates periodically
<Timer timeRemainingMs={roomState.timeRemainingMs} />;

// Timer component interpolates locally for smooth countdown
useEffect(() => {
  const interval = setInterval(() => {
    setLocalTime((prev) => Math.max(0, prev - 100));
  }, 100);
}, []);
```

**Benefits:**

- Smooth visual countdown (no jitter)
- Server authoritative (prevents cheating)
- Handles network latency gracefully

---

## Component Responsibilities

| Component     | Responsibility                                                                  |
| ------------- | ------------------------------------------------------------------------------- |
| `App`         | Router setup, theme provider, global layout with Navigation                     |
| `HomePage`    | Room creation, join flow with validation, deep link query param handling        |
| `GamePage`    | HTTP pre-registration with retry, GameProvider setup, connection error handling |
| `GameView`    | Phase orchestration (renders correct child based on roomState.status)           |
| `Lobby`       | Display players, shareable link with copy button, start game button             |
| `Question`    | Display question/category, countdown timer, answer form with submit             |
| `Results`     | Show correct answer, all player answers color-coded, points gained, leaderboard |
| `GameOver`    | Winner announcement, final scores leaderboard, back to home button              |
| `Timer`       | Local countdown interpolation from server timeRemainingMs                       |
| `Navigation`  | Top nav bar with app title and links                                            |
| `GameContext` | WebSocket lifecycle, state management, message parsing, action methods          |

---

## Error Handling

### Connection Errors

**WebSocket close codes:**

- `4003`: Player not pre-registered → Show error, redirect to home with join param
- `4004`: Room not found → Show error, redirect to home
- `4009`: Player already connected → Show error (prevent hijacking)

**Handled in GameContext:**

```tsx
ws.onclose = (event) => {
  if (event.code === 4003) {
    setConnectionError('Not registered. Please rejoin.');
  } else if (event.code === 4004) {
    setConnectionError('Room not found.');
  }
  // Trigger error UI in GamePageContent
};
```

### HTTP API Errors

**Handled in HomePage and GamePage:**

```tsx
try {
  await joinRoom(roomId, playerId);
} catch (error) {
  if (error.code === 'ROOM_NOT_FOUND') {
    setError('Room not found. Please check the code.');
  } else if (error.code === 'NAME_TAKEN') {
    setError('Name already taken. Choose another.');
  } else if (error.code === 'GAME_STARTED') {
    setError('Game already in progress.');
  }
}
```

### Validation

**Input validation (HomePage):**

- Player name: 1-20 characters, required
- Room code: Auto-uppercase, 6 characters, alphanumeric

**Real-time feedback:**

- Disabled submit buttons until valid input
- Error messages below form fields
- Loading states during API calls

---

## Type Definitions

**Key TypeScript interfaces ([types/index.ts](../frontend/src/types/index.ts)):**

```typescript
export interface RoomState {
  roomId: string;
  players: Record<string, number>; // playerId → score
  status: 'waiting' | 'playing' | 'results' | 'finished';
  questionIndex: number;
  currentQuestion?: CurrentQuestion;
  timeRemainingMs?: number;
  winner?: string;
  results?: ResultsData;
}

export interface CurrentQuestion {
  text: string;
  category: string;
}

export interface ResultsData {
  correctAnswer: string;
  playerAnswers: Record<string, string>; // playerId → answer
  playerResults: Record<string, number>; // playerId → points gained
}

export interface WebSocketMessage {
  type: 'ROOM_STATE' | 'ERROR' | 'ROOM_CLOSED';
  roomState?: RoomState;
  message?: string;
}
```

---

## Performance Considerations

### WebSocket Message Frequency

**Server broadcasts `ROOM_STATE` on every state change:**

- Player joins/leaves
- Game starts
- Answer submitted
- Question ends → Results
- Results end → Next question
- Game finishes

**Optimization:** Server only sends changed state, not full room object every time.

### React Re-renders

**GameContext optimization:**

```tsx
const [roomState, setRoomState] = useState<RoomState | null>(null);

// Only update if state actually changed
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'ROOM_STATE') {
    setRoomState(message.roomState); // React shallow comparison
  }
};
```

**Component memoization where needed:**

```tsx
const MemoizedResults = React.memo(Results);
```

### Timer Performance

**Smooth countdown without excessive renders:**

```tsx
// Update every 100ms (10 FPS) instead of every ms
useEffect(() => {
  const interval = setInterval(() => {
    setLocalTime((prev) => Math.max(0, prev - 100));
  }, 100);
  return () => clearInterval(interval);
}, []);
```

---

## Future Frontend Enhancements

- [ ] Animations for score changes and winner announcement
- [ ] Sound effects for correct/incorrect answers
- [ ] Mobile-responsive design improvements
- [ ] Progressive Web App (PWA) support for offline capability
- [ ] Dark mode toggle
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)
- [ ] Question category display with icons
- [ ] Spectator mode UI (watch games without playing)
- [ ] Player avatars or color themes
- [ ] Chat feature for lobby

  connect: (roomId: string, playerId: string) => void;
  disconnect: () => void;
  startGame: () => void;
  submitAnswer: (answer: string) => void;
  }

````

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
````

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
