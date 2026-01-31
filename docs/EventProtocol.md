# jDuel Event Protocol

This document describes the complete HTTP API and WebSocket message protocol for the jDuel game.

## Architecture Overview

jDuel uses a **hybrid two-phase HTTP/WebSocket architecture**:

**Phase 1 - HTTP REST API**: Room creation, validation, and player pre-registration  
**Phase 2 - WebSocket**: Real-time game communication after registration

This separation enables:

- **Deep linking**: Shareable room URLs like `/room/AB3D` that redirect to home with room code prefilled
- **Proper error handling**: HTTP status codes (404 for room not found, 409 for name conflicts, game started)
- **Reconnection support**: Players can refresh page and reconnect to their slot
- **Clean state management**: Server validates all actions before accepting WebSocket connections

---

## HTTP REST API

### Endpoints Overview

| Method | Endpoint                   | Purpose                  | Auth Required |
| ------ | -------------------------- | ------------------------ | ------------- |
| `POST` | `/api/rooms`               | Create a new room        | No            |
| `GET`  | `/api/rooms/{roomId}`      | Get room info/validation | No            |
| `POST` | `/api/rooms/{roomId}/join` | Pre-register player      | No            |
| `GET`  | `/health`                  | Health check             | No            |

### Detailed Endpoint Specifications

---

#### POST /api/rooms

Creates a new game room with auto-generated room code and default question set.

**Request:**

```http
POST /api/rooms HTTP/1.1
Content-Type: application/json
```

No request body required.

**Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "status": "waiting",
  "playerCount": 0
}
```

**Response Fields:**

- `roomId` (string): 4-character alphanumeric room code (auto-generated)
- `status` (string): Always `"waiting"` for new rooms
- `playerCount` (number): Always `0` for new rooms

**Notes:**

- Room is created empty with no players
- Room ID is guaranteed unique across all active rooms
- Questions are loaded from default question set during room creation
- Room persists until all players disconnect or game finishes and auto-closes

---

#### GET /api/rooms/{roomId}

Gets information about a room. Used by clients to validate room exists before attempting to join.

**Request:**

```http
GET /api/rooms/AB3D HTTP/1.1
```

**Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "status": "waiting",
  "playerCount": 2,
  "players": ["Alice", "Bob"]
}
```

**Response Fields:**

- `roomId` (string): The room code
- `status` (string): Current game phase (`"waiting"`, `"playing"`, `"results"`, `"finished"`)
- `playerCount` (number): Number of registered players
- `players` (array of strings): List of player names in the room

**Response (404 Not Found):**

```json
{
  "error": "Room not found",
  "code": "ROOM_NOT_FOUND"
}
```

**Error Fields:**

- `error` (string): Human-readable error message
- `code` (string): Machine-readable error code for client handling

**Notes:**

- This endpoint is optional - clients can skip directly to POST `/api/rooms/{roomId}/join`
- Useful for "Check Room" buttons or validation flows

---

#### POST /api/rooms/{roomId}/join

Pre-registers a player to join a room. **Must be called before WebSocket connection.** This reserves the player slot and validates the player can join.

**Request:**

```http
POST /api/rooms/AB3D/join HTTP/1.1
Content-Type: application/json

{
  "playerId": "Alice"
}
```

**Request Fields:**

- `playerId` (string, required): Player name (1-20 characters)

**Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "playerId": "Alice",
  "status": "waiting"
}
```

**Response Fields:**

- `roomId` (string): The room code (normalized to uppercase)
- `playerId` (string): The registered player name
- `status` (string): Current room status after join

**Error Response (404 Not Found):**

```json
{
  "error": "Room not found",
  "code": "ROOM_NOT_FOUND"
}
```

**Error Response (409 Conflict - Name Taken):**

```json
{
  "error": "Name 'Alice' is already taken",
  "code": "NAME_TAKEN"
}
```

**Error Response (409 Conflict - Game Started):**

```json
{
  "error": "Game has already started",
  "code": "GAME_STARTED"
}
```

**Error Response (422 Unprocessable Entity - Validation Error):**

```json
{
  "error": "Player name must be 1-20 characters",
  "code": "VALIDATION_ERROR"
}
```

**Notes:**

- **Reconnection allowed**: If a player with the same name exists but is **disconnected** (WebSocket closed), the join request succeeds and allows reconnection
- **Active connection prevention**: If a player with the same name has an **active WebSocket connection**, the request fails with `NAME_TAKEN` to prevent hijacking
- **Game in progress**: New players cannot join after the game has started (`status != "waiting"`)
- **Race condition handling**: Clients should retry with 500ms delay if `NAME_TAKEN` occurs during page refresh (up to 4 retries) to handle old WebSocket cleanup delays
- Room IDs are case-insensitive and normalized to uppercase

---

## WebSocket Protocol

### Connection

Connect to WebSocket **after** successful HTTP pre-registration:

```
ws://localhost:8000/ws?roomId=AB3D&playerId=Alice
```

**Query Parameters:**

- `roomId` (required): The room code (case-insensitive, normalized to uppercase)
- `playerId` (required): The player name (must match pre-registration)

**Prerequisites:**

- Room must exist (created via `POST /api/rooms`)
- Player must be pre-registered (via `POST /api/rooms/{roomId}/join`)

**Connection Success:**

- Server sends initial `ROOM_STATE` message with current game state
- Player's WebSocket is attached to their registered slot
- All other players receive updated `ROOM_STATE` showing the new player

**Connection Errors (WebSocket Close Codes):**

- **Code 4003**: Player not pre-registered (must call HTTP join endpoint first)
- **Code 4004**: Room not found
- **Code 4009**: Player already connected (prevents hijacking, refresh may cause this briefly)
- **Code 4000**: Generic connection failure

**Example Connection Flow:**

```javascript
// 1. Pre-register player
await fetch('http://localhost:8000/api/rooms/AB3D/join', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playerId: 'Alice' }),
});

// 2. Connect WebSocket
const ws = new WebSocket('ws://localhost:8000/ws?roomId=AB3D&playerId=Alice');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle ROOM_STATE, ERROR, ROOM_CLOSED
};
```

---

### Message Types Overview

#### Client → Server Messages

| Message Type | Purpose                              | Required Fields | When to Send                     |
| ------------ | ------------------------------------ | --------------- | -------------------------------- |
| `START_GAME` | Start the game from lobby            | None            | Lobby phase, any player          |
| `ANSWER`     | Submit an answer to current question | `answer`        | Playing phase, once per question |

#### Server → Client Messages

| Message Type  | Purpose                      | When Sent                                                                |
| ------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `ROOM_STATE`  | Broadcast current room state | On every state change (player joins, answer submitted, phase transition) |
| `ERROR`       | Error occurred               | Validation error or unexpected error                                     |
| `ROOM_CLOSED` | Room was closed by server    | Game ends after 60s timeout or all players leave                         |

---

### Message Schema Details

#### Client → Server Messages

##### START_GAME

Starts the game from the lobby phase. Can be sent by any player in the room.

**Message:**

```json
{
  "type": "START_GAME"
}
```

**Validation:**

- Room must be in `"waiting"` status
- At least one player must be connected
- Ignored if game already started

**Server Response:**

- Broadcasts `ROOM_STATE` with `status: "playing"` and first question
- Starts question timer (15 seconds by default)

**Example:**

```javascript
ws.send(JSON.stringify({ type: 'START_GAME' }));
```

---

##### ANSWER

Submits an answer to the current question.

**Message:**

```json
{
  "type": "ANSWER",
  "answer": "Tokyo"
}
```

**Fields:**

- `type` (string): Always `"ANSWER"`
- `answer` (string, required): The player's answer text

**Validation:**

- Room must be in `"playing"` status
- Player can only answer once per question (subsequent answers ignored)
- Answer is trimmed and processed by AI verification system

**Server Processing:**

1. Records answer in `playerAnswers` map
2. Validates answer using multi-stage AI verification:
   - Exact match (case-insensitive, normalized)
   - Fuzzy matching (85% threshold, handles typos)
   - Semantic similarity (0.8 cosine similarity, handles synonyms)
   - Lemmatization (handles grammatical variations)
3. If correct, calculates time-based score:
   - 1st correct: 1000 points
   - 2nd correct: 500 points
   - 3rd correct: 250 points
   - Nth correct: halves each time
4. If all players answered OR answer comes after timer expires, no points awarded
5. If all players have answered, immediately transitions to results (cancels timer)
6. Otherwise, waits for timer expiration

**Example:**

```javascript
ws.send(
  JSON.stringify({
    type: 'ANSWER',
    answer: userInput.trim(),
  }),
);
```

---

#### Server → Client Messages

##### ROOM_STATE

The primary message type that broadcasts the complete current state of the room to all connected players. Sent on every state change.

**Message:**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 1500,
      "Bob": 800
    },
    "status": "playing",
    "questionIndex": 2,
    "currentQuestion": {
      "text": "What is the capital of Japan?",
      "category": "Geography"
    },
    "timeRemainingMs": 12000
  }
}
```

**Root Fields:**

- `type` (string): Always `"ROOM_STATE"`
- `roomState` (object): The complete room state (see below)

**RoomState Fields:**

- `roomId` (string): The room code
- `players` (object): Map of playerIds to current scores
  - Key: Player name
  - Value: Current score (integer)
- `status` (string): Current game phase
  - `"waiting"`: Lobby, waiting for players and game start
  - `"playing"`: Question is displayed, accepting answers
  - `"results"`: Showing answers and correct answer after question
  - `"finished"`: Game over, displaying final scores
- `questionIndex` (number): Current question number (0-based)
- `currentQuestion` (object, optional): Only present during `"playing"` status
  - `text` (string): The question text
  - `category` (string): The question category (e.g., "Geography", "History")
- `timeRemainingMs` (number, optional): Countdown timer in milliseconds
  - Present during `"playing"` (question timer, default 15000ms)
  - Present during `"results"` (results display timer, default 10000ms)
  - Present during `"finished"` (auto-close timer, default 60000ms)
  - Not present during `"waiting"` status
- `winner` (string, optional): Player name of the winner
  - Only present when `status: "finished"`
  - Determined by highest score (first player in case of tie)
- `results` (object, optional): Answer results after a question
  - Only present when `status: "results"`
  - See ResultsData schema below

**ResultsData Schema (when status = "results"):**

```json
"results": {
  "correctAnswer": "Tokyo",
  "playerAnswers": {
    "Alice": "Tokyo",
    "Bob": "Kyoto"
  },
  "playerResults": {
    "Alice": 1000,
    "Bob": 0
  }
}
```

- `correctAnswer` (string): The correct answer to the question
- `playerAnswers` (object): Map of playerIds to their submitted answers
  - Only includes players who answered (missing if no answer)
- `playerResults` (object): Map of playerIds to points gained this round
  - 0 if incorrect or did not answer
  - Time-based score if correct (1000, 500, 250, etc.)

**Timing Notes:**

- `timeRemainingMs` updates are sent periodically (implementation-dependent)
- Clients should interpolate timer locally for smooth countdown
- Server timer is authoritative for scoring and phase transitions

**Example States by Phase:**

**Lobby (waiting):**

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

**Question (playing):**

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

**Results (results):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 1000, "Bob": 500 },
    "status": "results",
    "questionIndex": 0,
    "timeRemainingMs": 10000,
    "results": {
      "correctAnswer": "Paris",
      "playerAnswers": { "Alice": "Paris", "Bob": "paris" },
      "playerResults": { "Alice": 1000, "Bob": 500 }
    }
  }
}
```

**Game Over (finished):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 6200, "Bob": 3800 },
    "status": "finished",
    "questionIndex": 10,
    "winner": "Alice",
    "timeRemainingMs": 60000
  }
}
```

---

##### ERROR

Sent when an error occurs during message processing.

**Message:**

```json
{
  "type": "ERROR",
  "message": "Invalid message format"
}
```

**Fields:**

- `type` (string): Always `"ERROR"`
- `message` (string): Human-readable error description

**Common Error Messages:**

- `"Invalid message format"`: Malformed JSON or missing required fields
- `"Room not found"`: Room was deleted while player was connected
- `"Game not started"`: Tried to answer before game started
- `"Already answered"`: Tried to answer the same question twice

**Client Handling:**

- Display error message to user
- Log error for debugging
- Do not disconnect - connection remains active

---

##### ROOM_CLOSED

Sent when the server closes the room. All players are disconnected after receiving this message.

**Message:**

```json
{
  "type": "ROOM_CLOSED"
}
```

**When Sent:**

- Game finished and 60-second auto-close timer expired
- All players disconnected (last player leaves)
- Room manually deleted by admin (future feature)

**Client Handling:**

- Display "Room closed" message
- Close WebSocket connection
- Redirect to home page or lobby

**Example:**

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'ROOM_CLOSED') {
    alert('Room has been closed');
    ws.close();
    window.location.href = '/';
  }
};
```

---

## Complete Game Sequence Example

This example shows all HTTP and WebSocket events for a complete game between **Alice** (room creator) and **Bob** (joiner via deep link).

---

### Phase 1: Room Creation (Alice)

#### Step 1: Alice creates a room

**HTTP Request:**

```http
POST /api/rooms HTTP/1.1
Host: localhost:8000
```

**HTTP Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "status": "waiting",
  "playerCount": 0
}
```

---

#### Step 2: Alice pre-registers as player

**HTTP Request:**

```http
POST /api/rooms/AB3D/join HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "playerId": "Alice"
}
```

**HTTP Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "playerId": "Alice",
  "status": "waiting"
}
```

---

#### Step 3: Alice connects WebSocket

**WebSocket Connection:**

```
ws://localhost:8000/ws?roomId=AB3D&playerId=Alice
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

**Alice's UI:** Lobby with room code "AB3D", shareable link, player list showing ["Alice"], "Start Game" button enabled.

---

### Phase 2: Bob Joins via Deep Link

Alice shares the link: `http://localhost:5173/room/AB3D`

Frontend redirects to: `http://localhost:5173/?join=AB3D` (room code prefilled)

---

#### Step 1: Bob pre-registers

**HTTP Request:**

```http
POST /api/rooms/AB3D/join HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "playerId": "Bob"
}
```

**HTTP Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "playerId": "Bob",
  "status": "waiting"
}
```

---

#### Step 2: Bob connects WebSocket

**WebSocket Connection:**

```
ws://localhost:8000/ws?roomId=AB3D&playerId=Bob
```

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

**Both players' UI:** Lobby showing ["Alice", "Bob"] in player list.

---

### Phase 3: Starting the Game

#### Alice clicks "Start Game"

**Client (Alice) → Server:**

```json
{
  "type": "START_GAME"
}
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
      "text": "What is the capital of Japan?",
      "category": "Geography"
    },
    "timeRemainingMs": 15000
  }
}
```

**Both players' UI:** Question screen with "What is the capital of Japan?", timer counting down from 15 seconds, answer input field.

---

### Phase 4: Question 1 - Both Answer Correctly

#### Bob answers first (at ~10 seconds remaining)

**Client (Bob) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "Tokyo"
}
```

**Bob's UI:** Answer input disabled, "Waiting for other players..." message, timer continues.

---

#### Alice answers second (at ~7 seconds remaining)

**Client (Alice) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "tokyo"
}
```

**Server immediately transitions to results** (all players answered, timer cancelled).

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 500, "Bob": 1000 },
    "status": "results",
    "questionIndex": 0,
    "timeRemainingMs": 10000,
    "results": {
      "correctAnswer": "Tokyo",
      "playerAnswers": { "Alice": "tokyo", "Bob": "Tokyo" },
      "playerResults": { "Alice": 500, "Bob": 1000 }
    }
  }
}
```

**Both players' UI:** Results screen showing:

- Correct answer: "Tokyo"
- Alice: "tokyo" ✓ (green) +500 points (answered 2nd)
- Bob: "Tokyo" ✓ (green) +1000 points (answered 1st, faster)
- Updated scores: Alice (500), Bob (1000)
- Timer: 10 seconds countdown

---

### Phase 5: Question 2 - Timeout Scenario

After 10 seconds on results, server auto-advances to next question.

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 500, "Bob": 1000 },
    "status": "playing",
    "questionIndex": 1,
    "currentQuestion": {
      "text": "Who painted the Mona Lisa?",
      "category": "Art"
    },
    "timeRemainingMs": 15000
  }
}
```

**Both players' UI:** New question displayed, timer reset to 15 seconds.

---

#### Only Alice answers

**Client (Alice) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "Leonardo da Vinci"
}
```

**Alice's UI:** Answer submitted, waiting message displayed.

**Bob's UI:** Timer continues counting down (Bob hasn't answered).

---

#### Timer expires (Bob didn't answer)

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 1500, "Bob": 1000 },
    "status": "results",
    "questionIndex": 1,
    "timeRemainingMs": 10000,
    "results": {
      "correctAnswer": "Leonardo da Vinci",
      "playerAnswers": { "Alice": "Leonardo da Vinci" },
      "playerResults": { "Alice": 1000 }
    }
  }
}
```

**Both players' UI:** Results screen showing:

- Correct answer: "Leonardo da Vinci"
- Alice: "Leonardo da Vinci" ✓ (green) +1000 points
- Bob: (no answer shown) +0 points
- Updated scores: Alice (1500), Bob (1000)

---

### Phase 6: Question 3 - Wrong Answer

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 1500, "Bob": 1000 },
    "status": "playing",
    "questionIndex": 2,
    "currentQuestion": {
      "text": "What is the smallest prime number?",
      "category": "Mathematics"
    },
    "timeRemainingMs": 15000
  }
}
```

---

#### Both players answer (Bob gets it wrong)

**Client (Alice) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "2"
}
```

**Client (Bob) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "1"
}
```

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 2500, "Bob": 1000 },
    "status": "results",
    "questionIndex": 2,
    "timeRemainingMs": 10000,
    "results": {
      "correctAnswer": "2",
      "playerAnswers": { "Alice": "2", "Bob": "1" },
      "playerResults": { "Alice": 1000, "Bob": 0 }
    }
  }
}
```

**Both players' UI:** Results screen showing:

- Correct answer: "2"
- Alice: "2" ✓ (green) +1000 points
- Bob: "1" ✗ (red) +0 points
- Updated scores: Alice (2500), Bob (1000)

---

### Phase 7: Game Over

Assuming that was the last question...

**Server → All Players (ROOM_STATE):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 2500, "Bob": 1000 },
    "status": "finished",
    "questionIndex": 3,
    "winner": "Alice",
    "timeRemainingMs": 60000
  }
}
```

**Both players' UI:** Game Over screen showing:

- Winner: "Alice wins!" with celebration animation
- Final scores: Alice (2500), Bob (1000)
- Timer: 60 seconds until room closes

---

#### Room auto-closes after 60 seconds

**Server → All Players:**

```json
{
  "type": "ROOM_CLOSED"
}
```

**Both players:** WebSocket closes, redirected to home page.

---

## Error Scenarios

### Scenario 1: Joining Non-Existent Room

**HTTP Request:**

```http
POST /api/rooms/ZZZZZZ/join HTTP/1.1
Content-Type: application/json

{
  "playerId": "Charlie"
}
```

**HTTP Response (404 Not Found):**

```json
{
  "error": "Room not found",
  "code": "ROOM_NOT_FOUND"
}
```

**Client behavior:** Display error, user stays on join form.

---

### Scenario 2: Duplicate Player Name (Active Connection)

**HTTP Request:**

```http
POST /api/rooms/AB3D/join HTTP/1.1
Content-Type: application/json

{
  "playerId": "Alice"
}
```

**HTTP Response (409 Conflict):**

```json
{
  "error": "Name 'Alice' is already taken",
  "code": "NAME_TAKEN"
}
```

**Client behavior:** Display error, prompt user to choose different name.

---

### Scenario 3: Joining Game In Progress

**HTTP Request:**

```http
POST /api/rooms/AB3D/join HTTP/1.1
Content-Type: application/json

{
  "playerId": "Charlie"
}
```

**HTTP Response (409 Conflict):**

```json
{
  "error": "Game has already started",
  "code": "GAME_STARTED"
}
```

**Client behavior:** Display error, redirect to home or show spectator option (future feature).

---

### Scenario 4: WebSocket Connection Without Pre-Registration

**WebSocket Connection Attempt:**

```
ws://localhost:8000/ws?roomId=AB3D&playerId=NotRegistered
```

**Server closes connection with code 4003:**

```
Close Code: 4003
Close Reason: Player not registered
```

**Client behavior:** Display error: "Please join the room first", redirect to join flow.

---

### Scenario 5: Page Refresh (Reconnection)

**Scenario:** Alice refreshes page mid-game.

**Step 1:** WebSocket disconnects (browser page reload).

**Server:** Detaches Alice's WebSocket, keeps her registration in `room.players`.

**Step 2:** GamePage re-initializes after refresh.

**HTTP Request:**

```http
POST /api/rooms/AB3D/join HTTP/1.1
Content-Type: application/json

{
  "playerId": "Alice"
}
```

**HTTP Response (200 OK):** _(Allows reconnection since Alice is registered but disconnected)_

```json
{
  "roomId": "AB3D",
  "playerId": "Alice",
  "status": "playing"
}
```

**Step 3:** WebSocket reconnects.

**WebSocket Connection:**

```
ws://localhost:8000/ws?roomId=AB3D&playerId=Alice
```

**Server → Alice (ROOM_STATE with current game state):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": { "Alice": 1500, "Bob": 2000 },
    "status": "playing",
    "questionIndex": 5,
    "currentQuestion": {
      /* current question */
    },
    "timeRemainingMs": 8000
  }
}
```

**Alice's UI:** Resumes at current game state (question 6, her score 1500, timer at 8s). No disruption to Bob.

---

## State Transition Diagram

```
┌──────────┐
│          │
│  WAITING │ ◄─── Players join via HTTP + WebSocket
│          │      (ROOM_STATE broadcasts after each join)
└────┬─────┘
     │
     │ START_GAME message from any player
     │
     ▼
┌──────────┐
│          │
│ PLAYING  │ ◄─── Display question + 15s timer
│          │      Players send ANSWER messages
│          │      (ROOM_STATE updates as answers arrive)
└────┬─────┘
     │
     │ All answered OR timer expires
     │
     ▼
┌──────────┐
│          │
│ RESULTS  │ ◄─── Show correct answer + scores (10s timer)
│          │      (ROOM_STATE with results data)
└────┬─────┘
     │
     │ Timer expires
     │
     ├─── More questions? ───YES──► Back to PLAYING (next question)
     │
     └─── NO (game complete)
          │
          ▼
     ┌──────────┐
     │          │
     │ FINISHED │ ◄─── Display winner + final scores (60s timer)
     │          │
     └────┬─────┘
          │
          │ Timer expires
          │
          ▼
     ROOM_CLOSED message → All players disconnected → Redirect to home
```

---

## Key Protocol Rules

1. **Two-phase connection**: Players must pre-register via HTTP before WebSocket connection. This enables error handling, validation, and reconnection support.

2. **Server is authoritative**: All game state lives on the server. Clients never modify state directly - they only send action messages (START_GAME, ANSWER).

3. **Broadcast on every change**: Most state changes trigger a `ROOM_STATE` broadcast to all players in the room. This keeps all clients synchronized.

4. **Idempotent answers**: Players can only answer each question once. Subsequent `ANSWER` messages for the same question are silently ignored.

5. **AI-powered answer verification**: Server uses multi-stage verification (fuzzy matching, semantic embeddings, lemmatization) to accept typos, synonyms, and grammatical variations.

6. **Time-based scoring**: First correct answer gets 1000 points, second gets 500, third gets 250, etc. (halves each time). Server calculates score based on actual answer timestamps for security.

7. **Timer enforcement**: Server enforces all timers. Client timers are only for smooth visual display (interpolation).

8. **Automatic progression**: Game auto-advances through questions and to game over. No manual control needed after START_GAME.

9. **Room cleanup**:
   - Empty rooms (all players disconnected) are immediately deleted
   - Finished games auto-close after 60 seconds
   - All timers are cancelled on room deletion

10. **Reconnection support**: Players can refresh page and reconnect to their slot (HTTP join allows reconnection if player is registered but disconnected).

11. **Connection tracking**: Each WebSocket connection is tied to one player in one room. Server prevents multiple connections with same playerId (code 4009).

---

## Implementation Notes

### Question Timer Behavior

- **Duration**: 15 seconds (configurable via `QUESTION_TIME_MS` in `backend/src/app/config/game.py`)
- **Start**: When `status` transitions to `"playing"`
- **Cancellation**: If all players submit answers before timer expires
- **Expiration**: Transitions to `"results"` status
- **Updates**: Server may send periodic `ROOM_STATE` updates with decreasing `timeRemainingMs` for client synchronization
- **Security**: Server-side calculation for scoring (prevents client manipulation)

### Results Timer Behavior

- **Duration**: 10 seconds (configurable via `RESULTS_TIME_MS`)
- **Start**: When `status` transitions to `"results"`
- **Purpose**: Give players time to review answers before next question
- **Expiration**:
  - If more questions remain: transitions to `"playing"` with next question
  - If no more questions: transitions to `"finished"`

### Game Over Timer Behavior

- **Duration**: 60 seconds (configurable via `GAME_OVER_TIME_MS`)
- **Start**: When `status` transitions to `"finished"`
- **Purpose**: Give players time to view final scores before room closes
- **Expiration**: Server sends `ROOM_CLOSED`, deletes room, disconnects all players

### WebSocket Connection Lifecycle

1. **Pre-registration**: Client calls `POST /api/rooms/{roomId}/join` (HTTP)
2. **Connection**: Client opens WebSocket with `roomId` and `playerId` query params
3. **Validation**: Server validates room exists and player is pre-registered
4. **Attachment**: Server attaches WebSocket to player's slot in room
5. **Initial state**: Server sends `ROOM_STATE` with current game state
6. **Message flow**: Bidirectional communication (START_GAME, ANSWER, ROOM_STATE, etc.)
7. **Disconnection**:
   - Client closes connection (page close, navigation away, error)
   - Server detaches WebSocket but keeps player registration (allows reconnection)
   - If no players remain connected, room is deleted
8. **Error handling**: Server sends `ERROR` message but keeps connection open (client can retry)

### Answer Verification Pipeline

Server processes answers through multi-stage verification:

1. **Normalization**: Lowercase, strip whitespace, remove punctuation
2. **Exact match**: If normalized answer == normalized correct answer → correct
3. **Fuzzy matching**: RapidFuzz with 85% threshold → handles typos ("Parris" = "Paris")
4. **Semantic similarity**: Sentence embeddings with 0.8 cosine similarity → handles synonyms ("United States" = "USA")
5. **Lemmatization**: spaCy lemmatization + comparison → handles grammar ("ran" = "run", "cities" = "city")

This ensures fair gameplay while accepting reasonable variations.

### Room ID Generation

- **Length**: 4 characters
- **Format**: Alphanumeric (uppercase letters + digits)
- **Uniqueness**: Guaranteed unique across all active rooms
- **Collision handling**: Regenerates if collision occurs (rare)
- **Example**: `AB3D`, `XY7Z`, `A1B2`

### Message Ordering Guarantees

- **WebSocket**: Messages are delivered in order over a single connection
- **Broadcast**: Server broadcasts `ROOM_STATE` to all players in parallel (no guaranteed order between different clients)
- **Client handling**: Clients should handle messages idempotently based on `status` and `questionIndex` rather than message order

---

## API Versioning

Current API version: **v1.0.0**

- No versioning in URL paths (e.g., no `/api/v1/rooms`)
- Breaking changes will be announced with migration guide
- Future: Version negotiation via WebSocket subprotocol or HTTP headers

---

## Rate Limiting (Future)

Currently no rate limiting implemented. Future considerations:

- HTTP: 100 requests/minute per IP
- WebSocket messages: 10 messages/second per connection
- Room creation: 5 rooms/minute per IP

---

## Security Considerations

1. **No authentication**: Current version has no user accounts or authentication
2. **Name-based identity**: Players identified by name only (honor system)
3. **Server-side validation**: All game logic and scoring happens server-side (prevents cheating)
4. **Timer enforcement**: Timers enforced server-side (prevents time manipulation)
5. **Connection hijacking prevention**: WebSocket close code 4009 prevents duplicate connections
6. **Input sanitization**: Player names and answers sanitized on server
7. **CORS**: Configured origins in `backend/src/app/config/environment.py`

**Future improvements:**

- User authentication with JWT tokens
- Rate limiting and abuse prevention
- Input validation middleware
- Encrypted WebSocket (WSS) in production

---

## Debugging Tips

### Logging WebSocket Messages (Client)

```javascript
const ws = new WebSocket('ws://localhost:8000/ws?roomId=AB3D&playerId=Alice');

ws.onopen = () => console.log('[WS] Connected');
ws.onclose = (e) => console.log('[WS] Closed:', e.code, e.reason);
ws.onerror = (e) => console.error('[WS] Error:', e);
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('[WS] Received:', msg.type, msg);
};

const send = (msg) => {
  console.log('[WS] Sending:', msg.type, msg);
  ws.send(JSON.stringify(msg));
};
```

### Common Issues

**Issue**: WebSocket closes immediately with code 4003  
**Solution**: Call `POST /api/rooms/{roomId}/join` before connecting WebSocket

**Issue**: HTTP join returns 409 NAME_TAKEN during page refresh  
**Solution**: Retry with 500ms delay (up to 4 times) to allow old WebSocket cleanup

**Issue**: Answers not registering  
**Solution**: Check `status === "playing"` and player hasn't already answered

**Issue**: Room not found after creation  
**Solution**: Ensure room ID is uppercase (case-insensitive but normalized)

### Server-Side Logging

Backend logs show:

- Room creation/deletion
- Player registration/connection/disconnection
- Game state transitions (waiting → playing → results → finished)
- Answer submissions and verification results
- Timer events (start, cancel, expire)

Set `LOG_LEVEL=DEBUG` for verbose logging.

---

## Related Documentation

- [README.md](../README.md): Project overview, setup, and architecture
- [FrontendFlow.md](FrontendFlow.md): Frontend component architecture and game flow
- [Deployment.md](Deployment.md): Production deployment instructions
- [Development.md](Development.md): Development setup and workflow

---

## Change Log

### v1.0.0 (Current)

- Two-phase HTTP/WebSocket architecture
- AI-powered answer verification (fuzzy matching, embeddings, lemmatization)
- Time-based scoring (1000, 500, 250, ...)
- Automatic game progression
- Reconnection support
- Room auto-close after game ends
  - `playerResults`: Map of playerIds to points gained (0 if incorrect)

##### ERROR

```json
{
  "type": "ERROR",
  "message": "Room AB3D does not exist"
}
```

##### ROOM_CLOSED

```json
{
  "type": "ROOM_CLOSED"
}
```

---

## Complete Game Sequence Example

This example shows all HTTP and WebSocket events for a complete game between **Alice** (creator) and **Bob** (joiner via deep link).

### Phase 1: Room Creation (Alice)

#### Step 1: Alice creates a room

**HTTP Request:**

```
POST /api/rooms
```

**HTTP Response (200):**

```json
{
  "roomId": "AB3D",
  "status": "waiting",
  "playerCount": 0
}
```

#### Step 2: Alice registers as player

**HTTP Request:**

```
POST /api/rooms/AB3D/join
Content-Type: application/json

{ "playerId": "Alice" }
```

**HTTP Response (200):**

```json
{
  "roomId": "AB3D",
  "playerId": "Alice",
  "status": "waiting"
}
```

#### Step 3: Alice connects WebSocket

**WebSocket Connect:**

```
ws://localhost:8000/ws?roomId=AB3D&playerId=Alice
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

### Phase 2: Bob Joins via Deep Link

Alice shares the link: `https://jduel.com/room/AB3D`

The frontend redirects this to `/?join=AB3D`, which prefills the room code on the HomePage.

#### Step 1: Bob enters name and joins

**HTTP Request:**

```
POST /api/rooms/AB3D/join
Content-Type: application/json

{ "playerId": "Bob" }
```

**HTTP Response (200):**

```json
{
  "roomId": "AB3D",
  "playerId": "Bob",
  "status": "waiting"
}
```

#### Step 2: Bob connects WebSocket

**WebSocket Connect:**

```
ws://localhost:8000/ws?roomId=AB3D&playerId=Bob
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

    "players": {
      "Alice": 0
    },
    "status": "waiting",
    "questionIndex": 0

}
}

````

_Alice sees the lobby with room code "AB3D" and is waiting for other players._

---

#### Event 2: Bob joins the room

**Client (Bob) → Server:**

```json
{
  "type": "JOIN_ROOM",
  "roomId": "AB3D",
  "playerId": "Bob"
}
````

**Server → All Clients (Alice + Bob):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 0,
      "Bob": 0
    },
    "status": "waiting",
    "questionIndex": 0
  }
}
```

_Both Alice and Bob see each other in the lobby._

---

### Phase 2: Starting the Game

#### Event 3: Alice starts the game

**Client (Alice) → Server:**

```json
{
  "type": "START_GAME"
}
```

**Server → All Clients (Alice + Bob):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 0,
      "Bob": 0
    },
    "status": "playing",
    "questionIndex": 0,
    "currentQuestion": {
      "text": "What is the capital of Japan?",
      "category": "Geography"
    },
    "timeRemainingMs": 15000
  }
}
```

_Timer starts counting down from N seconds. Both players see Question #1._

---

### Phase 3: Question 1 - Answering

#### Event 4: Bob submits answer (at ~5 seconds remaining)

**Client (Bob) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "Tokyo"
}
```

_Bob's answer is recorded but not yet revealed. UI shows Bob has answered._

---

#### Event 5: Alice submits answer (at ~3 seconds remaining)

**Client (Alice) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "tokyo"
}
```

**Server → All Clients (Alice + Bob):**

Since both players have answered, the game immediately transitions to results (timer is canceled).

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 500,
      "Bob": 1000
    },
    "status": "results",
    "questionIndex": 0,
    "results": {
      "correctAnswer": "Tokyo",
      "playerAnswers": {
        "Alice": "tokyo",
        "Bob": "Tokyo"
      },
      "playerResults": {
        "Alice": 500,
        "Bob": 1000
      }
    },
    "timeRemainingMs": 10000
  }
}
```

_Results screen shows:_

- Correct answer: "Tokyo"
- Alice answered "tokyo" (correct, green) → earned 500 points
- Bob answered "Tokyo" (correct, green) → earned 1000 points (faster = more points)
- 10-second results timer starts

---

### Phase 4: Question 2 - Timeout Scenario

#### Event 6: Next question starts automatically

After 10 seconds on the results screen:

**Server → All Clients (Alice + Bob):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 500,
      "Bob": 1000
    },
    "status": "playing",
    "questionIndex": 1,
    "currentQuestion": {
      "text": "Who painted the Mona Lisa?",
      "category": "Art"
    },
    "timeRemainingMs": 15000
  }
}
```

_Question #2 appears with fresh N-second timer._

---

#### Event 7: Only Alice answers this time

**Client (Alice) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "Leonardo da Vinci"
}
```

_Alice has answered, but Bob hasn't. Timer continues counting down..._

---

#### Event 8: Timer expires (Bob didn't answer)

After timer reaches 0:

**Server → All Clients (Alice + Bob):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 1500,
      "Bob": 1000
    },
    "status": "results",
    "questionIndex": 1,
    "results": {
      "correctAnswer": "Leonardo da Vinci",
      "playerAnswers": {
        "Alice": "Leonardo da Vinci"
      },
      "playerResults": {
        "Alice": 1000
      }
    },
    "timeRemainingMs": 10000
  }
}
```

_Results screen shows:_

- Alice answered correctly → earned 1000 points (total: 1500)
- Bob didn't answer → earned 0 points (total: 1000)

---

### Phase 5: Question 3 - Wrong Answer

#### Event 9: Question 3 starts

**Server → All Clients (Alice + Bob):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 1500,
      "Bob": 1000
    },
    "status": "playing",
    "questionIndex": 2,
    "currentQuestion": {
      "text": "What is the smallest prime number?",
      "category": "Mathematics"
    },
    "timeRemainingMs": 15000
  }
}
```

---

#### Event 10: Both players answer (Bob gets it wrong)

**Client (Alice) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "2"
}
```

**Client (Bob) → Server:**

```json
{
  "type": "ANSWER",
  "answer": "1"
}
```

**Server → All Clients (Alice + Bob):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 3000,
      "Bob": 1000
    },
    "status": "results",
    "questionIndex": 2,
    "results": {
      "correctAnswer": "2",
      "playerAnswers": {
        "Alice": "2",
        "Bob": "1"
      },
      "playerResults": {
        "Alice": 1000,
        "Bob": 0
      }
    },
    "timeRemainingMs": 10000
  }
}
```

_Results screen shows:_

- Alice answered "2" (correct, green) → earned 1000 points
- Bob answered "1" (incorrect, red) → earned 0 points

---

### Phase 6: Game Over

Assuming this was the last question (question 3 of 3):

#### Event 11: Game ends after results timer

After 10 seconds on results screen:

**Server → All Clients (Alice + Bob):**

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 3000,
      "Bob": 1000
    },
    "status": "finished",
    "questionIndex": 3,
    "winner": "Alice",
    "timeRemainingMs": 60000
  }
}
```

_Game Over screen shows:_

- Final scores: Alice (3000), Bob (1000)
- Winner: Alice 🎉

---

#### Event 12: Room auto-closes after 60 seconds

After 60 seconds on game over screen:

**Server → All Clients (Alice + Bob):**

```json
{
  "type": "ROOM_CLOSED"
}
```

_Both clients are disconnected and redirected back to join form._

---

## Error Scenarios

### Scenario 1: Joining Non-Existent Room

**Client → Server:**

```json
{
  "type": "JOIN_ROOM",
  "roomId": "ZZZZ",
  "playerId": "Charlie"
}
```

**Server → Client:**

```json
{
  "type": "ERROR",
  "message": "Room ZZZZ does not exist"
}
```

_Client stays on join form, displays error message._

---

### Scenario 2: Duplicate Player Name

**Client → Server:**

```json
{
  "type": "JOIN_ROOM",
  "roomId": "AB3D",
  "playerId": "Alice"
}
```

**Server → Client:**

```json
{
  "type": "ERROR",
  "message": "Name 'Alice' is already taken in this room"
}
```

_Client stays on join form, displays error message._

---

## State Transition Diagram

```
┌──────────┐
│          │
│  WAITING │ ◄─── Players join
│          │      (ROOM_STATE broadcasts)
└────┬─────┘
     │
     │ START_GAME
     │
     ▼
┌──────────┐
│          │
│ PLAYING  │ ◄─── Showing question + timer
│          │      Players submit ANSWER
└────┬─────┘      (ROOM_STATE updates)
     │
     │ All answered OR timer expired
     │
     ▼
┌──────────┐
│          │
│ RESULTS  │ ◄─── Showing answers (10s)
│          │      (ROOM_STATE with results)
└────┬─────┘
     │
     │ More questions?
     ├─── YES ──► Back to PLAYING
     │
     └─── NO ───► ┌──────────┐
                  │          │
                  │ FINISHED │ ◄─── Game over (60s)
                  │          │
                  └────┬─────┘
                       │
                       │ Auto-close
                       ▼
                  ROOM_CLOSED
```

---

## Key Protocol Rules

1. **Server is authoritative**: All game state lives on the server. Client never modifies state directly.

2. **Broadcast on most changes**: Most state changes triggers a `ROOM_STATE` broadcast to all players in the room.

3. **Idempotent answers**: Players can only answer each question once. Subsequent `ANSWER` messages are ignored.

4. **Case-insensitive answers**: Backend normalizes answer comparison (e.g., "tokyo" = "Tokyo").

5. **Timer enforcement**: Server enforces all timers. Client timers are only for display.

6. **Automatic progression**: Game auto-advances through questions and to game over. No manual control needed after start.

7. **Room cleanup**: Empty rooms are deleted immediately. Finished rooms auto-close after 60 seconds.

8. **Connection tracking**: Each WebSocket connection is tied to one player in one room. Disconnection removes player from room.

---

## Implementation Notes

### Question Timer Behavior

- Starts at N seconds when question is displayed
- Broadcasts `ROOM_STATE` with updated `timeRemainingMs` (implementation may vary)
- Canceled immediately if all players answer
- On expiration: transitions to results phase

### WebSocket Connection Lifecycle

1. Client connects: `new WebSocket(ws://localhost:8000/ws)`
2. Client sends `CREATE_ROOM` or `JOIN_ROOM`
3. Server registers connection with room/player
4. Messages flow bidirectionally
5. On disconnect: server removes player, broadcasts updated state
6. On error: server sends `ERROR`, client can retry without reconnecting
