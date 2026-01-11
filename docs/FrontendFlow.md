# jDuel Frontend Flow

This document describes the React component lifecycle, state changes, and hook behaviors throughout a complete game session.

## Component Architecture

```
App (Router)
└── GamePage
    ├── useWebSocket hook
    └── Conditional Rendering:
        ├── JoinForm (if !joined)
        ├── "Connecting..." (if joined && !roomState)
        └── GameRoom (if joined && roomState)
            ├── LobbyRoom (status: waiting)
            ├── QuestionView (status: playing)
            ├── ResultsView (status: results)
            └── GameOver (status: finished)
```

---

## Complete Game Flow: Two Players

This traces React state changes and component renders for a complete game between **Alice** (creator) and **Bob** (joiner).

---

### Phase 1: Initial Load

#### Alice Opens App

**Component Tree:**

```
App → GamePage → JoinForm
```

**GamePage State:**

```javascript
{
  roomId: "",
  playerId: "",
  joined: false,
  errorMessage: ""
}
```

**useWebSocket State:**

```javascript
{
  roomState: null,
  wsRef.current: null
}
```

**Rendered Components:**

- `<JoinForm />` with empty inputs

**User Action:** Alice types "Alice" in the name field

**State Update:**

```javascript
// JoinForm local state
setPlayerId('Alice');
```

---

### Phase 2: Room Creation

#### Alice Clicks "Create Room"

**Handler Called:** `handleCreateRoom("Alice")`

**GamePage State Changes:**

```javascript
setErrorMessage(''); // Clear any previous errors
setJoined(true); // ✅ Triggers WebSocket connection
setPlayerId('Alice');
```

**useWebSocket Effect Triggered:**

```javascript
useEffect(() => {
  if (!joined) return; // Now joined = true, so continues

  const ws = new WebSocket(WS_URL);
  wsRef.current = ws;

  ws.onopen = () => {
    // Sends pending CREATE_ROOM message
  };

  ws.onmessage = (event) => {
    // Listens for ROOM_STATE
  };
}, [joined]); // ← joined changed from false → true
```

**Message Sent:** `sendMessage({ type: "CREATE_ROOM", playerId: "Alice" })`

**Component Re-render:**

```
App → GamePage → PageContainer → "Connecting..."
```

**Why "Connecting"?** Because `joined = true` but `roomState = null`

---

#### Server Responds with ROOM_STATE

**WebSocket Message Received:**

```javascript
ws.onmessage fires with:
{
  type: "ROOM_STATE",
  roomState: {
    roomId: "AB3D",
    players: { "Alice": 0 },
    status: "waiting",
    questionIndex: 0
  }
}
```

**useWebSocket State Update:**

```javascript
setRoomState({
  roomId: 'AB3D',
  players: { Alice: 0 },
  status: 'waiting',
  questionIndex: 0,
});
```

**GamePage useEffect Triggered:**

```javascript
useEffect(() => {
  if (roomState?.roomId && !roomId) {
    setRoomId('AB3D'); // ✅ Captures room code
  }
}, [roomState?.roomId, roomId]);
```

**Final GamePage State:**

```javascript
{
  roomId: "AB3D",
  playerId: "Alice",
  joined: true,
  errorMessage: ""
}
```

**Component Re-render:**

```
App → GamePage → GameRoom → LobbyRoom
```

**LobbyRoom Props:**

```javascript
{
  roomId: "AB3D",
  playerId: "Alice",
  roomState: {
    roomId: "AB3D",
    players: { "Alice": 0 },
    status: "waiting",
    questionIndex: 0
  },
  onStartGame: handleStartGame
}
```

**Rendered UI:**

- Room code: "AB3D" displayed
- Player list: "Alice (You)" shown
- "Start Game" button visible (Alice is host)

---

### Phase 3: Bob Joins

#### Bob Opens App in New Browser

**Component Tree:**

```
App → GamePage → JoinForm
```

**Bob's Initial State:** (Same as Alice's initial state)

**User Actions:**

1. Bob types "Bob" in name field
2. Bob types "AB3D" in room code field

**JoinForm Local State:**

```javascript
{
  playerId: "Bob",
  roomId: "AB3D"  // Converted to uppercase via onChange
}
```

---

#### Bob Clicks "Join Existing Room"

**Handler Called:** `handleJoin("AB3D", "Bob")`

**Bob's GamePage State Changes:**

```javascript
setErrorMessage('');
setJoined(true); // ✅ Triggers WebSocket
setPlayerId('Bob');
setRoomId('AB3D'); // Already set before WS connects
```

**Bob's useWebSocket Effect:**

- WebSocket connects
- Sends: `{ type: "JOIN_ROOM", roomId: "AB3D", playerId: "Bob" }`

**Bob's Component:** Shows "Connecting..."

---

#### Server Broadcasts Updated ROOM_STATE to Both Clients

**Alice's Browser Receives:**

```javascript
ws.onmessage fires with:
{
  type: "ROOM_STATE",
  roomState: {
    roomId: "AB3D",
    players: { "Alice": 0, "Bob": 0 },
    status: "waiting",
    questionIndex: 0
  }
}
```

**Alice's useWebSocket Update:**

```javascript
setRoomState({
  roomId: 'AB3D',
  players: { Alice: 0, Bob: 0 }, // ← Bob added
  status: 'waiting',
  questionIndex: 0,
});
```

**Alice's Component Re-render:**

```
App → GamePage → GameRoom → LobbyRoom
```

**Alice's LobbyRoom now shows:**

- "Alice (You)"
- "Bob"

---

**Bob's Browser Receives:** (Same ROOM_STATE)

**Bob's useWebSocket Update:** Same as Alice

**Bob's Component Transition:**

```
"Connecting..." → GameRoom → LobbyRoom
```

**Bob's LobbyRoom shows:**

- "Alice"
- "Bob (You)"
- No "Start Game" button (Bob is not host)

---

### Phase 4: Starting the Game

#### Alice Clicks "Start Game"

**Handler Called:** `handleStartGame()`

**Message Sent:** `sendMessage({ type: "START_GAME" })`

**No Local State Change** - Waiting for server response

---

#### Server Broadcasts Playing State

**Both Clients Receive:**

```javascript
{
  type: "ROOM_STATE",
  roomState: {
    roomId: "AB3D",
    players: { "Alice": 0, "Bob": 0 },
    status: "playing",  // ← Status changed
    questionIndex: 0,
    currentQuestion: {
      text: "What is the capital of Japan?",
      category: "Geography"
    },
    timeRemainingMs: 15000
  }
}
```

**Both Clients' useWebSocket Update:**

```javascript
setRoomState({
  /* new state */
});
```

**Both Clients Re-render:**

```
App → GamePage → GameRoom → QuestionView
```

**QuestionView Props:**

```javascript
{
  roomState: { /* current state */ },
  playerId: "Alice" | "Bob",
  onSubmitAnswer: handleSubmitAnswer
}
```

**QuestionView Internal State:**

```javascript
{
  answer: "",
  hasAnswered: false
}
```

**Rendered UI:**

- Question text displayed
- Category badge shown
- Answer input field (empty)
- Timer component showing 15 seconds
- Submit button (disabled until input has text)
- Scoreboard showing both players at 0 points

---

### Phase 5: Answering Question

#### Timer Component Behavior

**Timer receives:** `timeRemainingMs: 15000`

**Timer Internal State:**

```javascript
{
  timeRemaining: 15000;
}
```

**Timer useEffect:**

```javascript
useEffect(() => {
  const interval = setInterval(() => {
    setDisplayTime((prev) => Math.max(0, prev - 1000));
  }, 1000);

  return () => clearInterval(interval);
}, []);
```

**Timer Updates:** Decrements locally every second for smooth animation

**Note:** Timer is purely presentational. Server enforces actual timeout.

---

#### Bob Types Answer (5 seconds elapsed)

**QuestionView Local State Update:**

```javascript
// Bob's QuestionView state
setAnswer('Tokyo');
```

**Submit button:** Enabled (answer is not empty)

---

#### Bob Clicks Submit

**Handler Called:** `handleSubmitAnswer("Tokyo")`

**Message Sent:** `sendMessage({ type: "ANSWER", answer: "Tokyo" })`

**Bob's QuestionView State Update:**

```javascript
setHasAnswered(true);
```

**Bob's UI Changes:**

- Input field: Disabled
- Submit button: Hidden
- Shows: "Waiting for other players..."

**Bob's Component:** No re-render from parent (still in "playing" status)

---

#### Alice Types and Submits (3 seconds later)

**Same Flow as Bob:**

1. `setAnswer("tokyo")`
2. `handleSubmitAnswer("tokyo")`
3. `setHasAnswered(true)`

---

#### Server Broadcasts Results State

**Both Clients Receive:**

```javascript
{
  type: "ROOM_STATE",
  roomState: {
    roomId: "AB3D",
    players: { "Alice": 500, "Bob": 1000 },  // ← Scores updated
    status: "results",  // ← Status changed
    questionIndex: 0,
    results: {
      correctAnswer: "Tokyo",
      playerAnswers: {
        "Alice": "tokyo",
        "Bob": "Tokyo"
      }
    }
  }
}
```

**Both Clients' useWebSocket Update:**

```javascript
setRoomState({
  /* new state with results */
});
```

**Both Clients Re-render:**

```
App → GamePage → GameRoom → ResultsView
```

**ResultsView Props:**

```javascript
{
  roomState: { /* state with results */ },
  playerId: "Alice" | "Bob"
}
```

**ResultsView Rendered UI:**

- Correct answer: "Tokyo" (highlighted)
- Alice's answer: "tokyo" (green checkmark, +500 points)
- Bob's answer: "Tokyo" (green checkmark, +1000 points)
- Scoreboard shows updated scores
- No timer component

---

### Phase 6: Next Question

#### 10 Seconds Later - Server Broadcasts Next Question

**Both Clients Receive:**

```javascript
{
  type: "ROOM_STATE",
  roomState: {
    roomId: "AB3D",
    players: { "Alice": 500, "Bob": 1000 },
    status: "playing",  // ← Back to playing
    questionIndex: 1,   // ← Next question
    currentQuestion: {
      text: "Who painted the Mona Lisa?",
      category: "Art"
    },
    timeRemainingMs: 15000
  }
}
```

**Both Clients Re-render:**

```
App → GamePage → GameRoom → QuestionView
```

**QuestionView Component Behavior:**

**Key Question:** Does QuestionView reset its state?

**Answer:** Yes! Component re-renders with new `roomState.currentQuestion`, triggering:

```javascript
useEffect(() => {
  setAnswer('');
  setHasAnswered(false);
}, [roomState.currentQuestion]); // ← Question changed
```

**Fresh UI State:**

- Empty answer input
- Submit button disabled
- hasAnswered = false
- New timer at 15 seconds

---

### Phase 7: Question Timeout Scenario

#### Only Alice Answers This Time

**Alice's Flow:**

1. Types "Leonardo da Vinci"
2. Submits → `setHasAnswered(true)`
3. Shows "Waiting for other players..."

**Bob:** Doesn't answer, just watches timer countdown

---

#### Timer Expires on Bob's Screen

**Bob's Timer Component:**

```javascript
setDisplayTime(0);
```

**Bob's UI:** Timer shows "0s"

**Bob's QuestionView:** Still showing answer input (not disabled)

**Note:** Bob can't answer anymore - server has moved on

---

#### Server Broadcasts Results (Bob Didn't Answer)

**Both Clients Receive:**

```javascript
{
  type: "ROOM_STATE",
  roomState: {
    roomId: "AB3D",
    players: { "Alice": 1500, "Bob": 1000 },
    status: "results",
    questionIndex: 1,
    results: {
      correctAnswer: "Leonardo da Vinci",
      playerAnswers: {
        "Alice": "Leonardo da Vinci"
        // Bob is missing from playerAnswers
      }
    }
  }
}
```

**Both Clients Render ResultsView:**

- Alice's answer shown (green, +1000 points)
- Bob's answer: Not shown (no entry in playerAnswers)
- UI clearly indicates Bob didn't answer

---

### Phase 8: Game Over

#### After Final Question Results

**Both Clients Receive:**

```javascript
{
  type: "ROOM_STATE",
  roomState: {
    roomId: "AB3D",
    players: { "Alice": 2500, "Bob": 1500 },
    status: "finished",  // ← Game over
    questionIndex: 3,
    winner: "Alice"
  }
}
```

**Both Clients Re-render:**

```
App → GamePage → GameRoom → GameOver
```

**GameOver Props:**

```javascript
{
  roomState: {
    players: { "Alice": 2500, "Bob": 1500 },
    winner: "Alice"
  },
  playerId: "Alice" | "Bob"
}
```

**GameOver Rendered UI:**

- Winner announcement: "Alice Wins! 🎉"
- Final scores displayed
- "Alice (You)" or "Bob (You)" highlighted
- No actions available

---

### Phase 9: Room Closure

#### 60 Seconds Later - Server Closes Room

**Both Clients Receive:**

```javascript
{
  type: 'ROOM_CLOSED';
}
```

**useWebSocket Handler:**

```javascript
ws.onmessage fires with:
{
  type: "ROOM_CLOSED"
}

if (data.type === 'ROOM_CLOSED') {
  if (onRoomClosedRef.current) {
    onRoomClosedRef.current();  // ← Calls callback
  }
}
```

**GamePage Callback Executes:**

```javascript
const handleOnRoomClosed = () => {
  setJoined(false);
  setRoomId('');
  setPlayerId('');
};
```

**useWebSocket Cleanup:**

```javascript
useEffect(() => {
  if (!joined) return;

  // ... WebSocket setup ...

  return () => {
    ws.close(); // ← WebSocket closed
    wsRef.current = null;
  };
}, [joined]); // ← joined changed true → false
```

**Both Clients Re-render:**

```
App → GamePage → JoinForm
```

**Fresh State:** Both Alice and Bob back at join screen, ready to play again

---

## Error Handling Flow

### Scenario: Bob Tries to Join Non-Existent Room

#### Bob Enters "ZZZZ" and Clicks Join

**Handler Called:** `handleJoin("ZZZZ", "Bob")`

**State Changes:**

```javascript
setErrorMessage('');
setJoined(true); // ← WebSocket connects
setPlayerId('Bob');
setRoomId('ZZZZ');
```

**Message Sent:** `{ type: "JOIN_ROOM", roomId: "ZZZZ", playerId: "Bob" }`

**Component:** Shows "Connecting..."

---

#### Server Sends Error

**Bob's Browser Receives:**

```javascript
{
  type: "ERROR",
  message: "Room ZZZZ does not exist"
}
```

**useWebSocket Handler:**

```javascript
if (data.type === 'ERROR') {
  if (onErrorRef.current && data.message) {
    onErrorRef.current(data.message); // ← Calls error callback
  }
}
```

**GamePage Error Callback Executes:**

```javascript
const handleOnError = (message: string) => {
  // Error occurred (e.g., room doesn't exist)
  setErrorMessage(message);
  setJoined(false);
  setRoomId('');
};
```

**Component Re-render:**

```
App → GamePage → JoinForm (with error message)
```

**JoinForm Rendered UI:**

- Red error message: "Room ZZZZ does not exist"
- Input fields still populated: name="Bob", roomId="ZZZZ"
- Bob can correct room code and try again

**WebSocket:** Closes due to `joined` becoming `false`

---

## Key React Patterns Used

### 1. Conditional Rendering Based on State

```javascript
if (!joined) {
  return <JoinForm />;
}

if (!roomState) {
  return <div>Connecting...</div>;
}

return <GameRoom />;
```

**Why:** Clean separation of concerns - each UI state has its own component

---

### 2. Nested Conditional Rendering in GameRoom

```javascript
switch (roomState.status) {
  case 'waiting':
    return <LobbyRoom />;
  case 'playing':
    return <QuestionView />;
  case 'results':
    return <ResultsView />;
  case 'finished':
    return <GameOver />;
}
```

**Why:** Single GameRoom component coordinates game phases without unmounting

---

### 3. WebSocket Lifecycle Tied to Single State

```javascript
useEffect(() => {
  if (!joined) return;

  const ws = new WebSocket(WS_URL);
  // ... setup ...

  return () => {
    ws.close();
  };
}, [joined]); // ← ONLY depends on joined
```

**Why:** Prevents reconnection loops. Callbacks use refs to avoid triggering reconnects.

---

### 4. Callback Refs Pattern

```javascript
const onRoomClosedRef = useRef(onRoomClosed);
const onErrorRef = useRef(onError);

useEffect(() => {
  onRoomClosedRef.current = onRoomClosed;
  onErrorRef.current = onError;
}, [onRoomClosed, onError]);

// Later in WebSocket handler:
onRoomClosedRef.current(); // ← Always calls latest version
```

**Why:** Allows callbacks to change without triggering WebSocket reconnection

---

### 5. One-Time Effect for Room ID Capture

```javascript
useEffect(() => {
  if (roomState?.roomId && !roomId) {
    // ← Only when roomId is empty
    setRoomId(roomState.roomId);
  }
}, [roomState?.roomId, roomId]);
```

**Why:** Runs once after CREATE_ROOM, never during normal gameplay

---

### 6. Component-Local State for Form Inputs

```javascript
// QuestionView
const [answer, setAnswer] = useState('');
const [hasAnswered, setHasAnswered] = useState(false);
```

**Why:** Answer typing is local until submitted. No need to lift state up.

---

### 7. Reset Local State on Question Change

```javascript
useEffect(() => {
  setAnswer('');
  setHasAnswered(false);
}, [roomState.currentQuestion]);
```

**Why:** Ensures fresh state for each new question without unmounting component

---

## State Flow Summary

### GamePage State Flow

```
Initial:    { joined: false, roomId: "", playerId: "", errorMessage: "" }
Create:     { joined: true,  roomId: "", playerId: "Alice", ... }
Joined:     { joined: true,  roomId: "AB3D", playerId: "Alice", ... }
Error:      { joined: false, roomId: "", playerId: "", errorMessage: "..." }
Closed:     { joined: false, roomId: "", playerId: "", errorMessage: "" }
```

### useWebSocket State Flow

```
Initial:    { roomState: null, wsRef: null }
Connected:  { roomState: null, wsRef: <WebSocket> }
In Game:    { roomState: { status: "playing", ... }, wsRef: <WebSocket> }
```

### QuestionView Local State Flow

```
Initial:    { answer: "", hasAnswered: false }
Typing:     { answer: "Tokyo", hasAnswered: false }
Submitted:  { answer: "Tokyo", hasAnswered: true }
Next Q:     { answer: "", hasAnswered: false }  ← Reset
```

---

## Performance Considerations

1. **Minimal Re-renders:** Only state that changed triggers re-render
2. **WebSocket Ref:** `wsRef` doesn't cause re-renders (it's a ref, not state)
3. **Component Unmounting:** GameRoom stays mounted during game, only child components swap
4. **Timer Independence:** Timer updates locally without WebSocket traffic
5. **Callback Memoization:** Using refs prevents recreation of WebSocket connection

---
