# jDuel Event Protocol

This document describes the complete HTTP API and WebSocket message protocol for the jDuel game.

## Architecture Overview

jDuel uses a **hybrid HTTP/WebSocket architecture**:

- **HTTP REST API**: Room creation, validation, and player registration
- **WebSocket**: Real-time game communication after joining

This separation enables:

- Deep linking (shareable room URLs like `/room/AB3D`)
- Proper HTTP error handling (404, 409 status codes)
- Cleaner state management

---

## HTTP REST API

### Endpoints

| Method | Endpoint                   | Purpose           | Request Body      | Response             |
| ------ | -------------------------- | ----------------- | ----------------- | -------------------- |
| `POST` | `/api/rooms`               | Create a new room | None              | `CreateRoomResponse` |
| `GET`  | `/api/rooms/{roomId}`      | Get room info     | None              | `RoomInfoResponse`   |
| `POST` | `/api/rooms/{roomId}/join` | Register player   | `JoinRoomRequest` | `JoinRoomResponse`   |

### Request/Response Schemas

#### POST /api/rooms

Creates a new game room.

**Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "status": "waiting",
  "playerCount": 0
}
```

#### GET /api/rooms/{roomId}

Gets information about a room. Used to validate room exists before connecting.

**Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "status": "waiting",
  "playerCount": 2,
  "players": ["Alice", "Bob"]
}
```

**Response (404 Not Found):**

```json
{
  "error": "Room not found",
  "code": "ROOM_NOT_FOUND"
}
```

#### POST /api/rooms/{roomId}/join

Pre-registers a player to join a room. Must be called before WebSocket connection.

**Request:**

```json
{
  "playerId": "Alice"
}
```

**Response (200 OK):**

```json
{
  "roomId": "AB3D",
  "playerId": "Alice",
  "status": "waiting"
}
```

**Error Responses:**

- **404**: `{ "error": "Room not found", "code": "ROOM_NOT_FOUND" }`
- **409**: `{ "error": "Name 'Alice' is already taken", "code": "NAME_TAKEN" }`
- **409**: `{ "error": "Game has already started", "code": "GAME_STARTED" }`

---

## WebSocket Protocol

### Connection

Connect to WebSocket with room and player info as query parameters:

```
ws://localhost:8000/ws?roomId=AB3D&playerId=Alice
```

**Prerequisites:**

- Room must exist (created via `POST /api/rooms`)
- Player must be registered (via `POST /api/rooms/{roomId}/join`)

**Connection Errors:**

- Code `4004`: Room not found
- Code `4003`: Player not registered

### Message Types Overview

#### Client → Server Messages

| Message Type | Purpose          | Required Fields |
| ------------ | ---------------- | --------------- |
| `START_GAME` | Start the game   | None            |
| `ANSWER`     | Submit an answer | `answer`        |

#### Server → Client Messages

| Message Type  | Purpose                      | Payload            |
| ------------- | ---------------------------- | ------------------ |
| `ROOM_STATE`  | Broadcast current room state | `roomState` object |
| `ERROR`       | Error occurred               | `message` string   |
| `ROOM_CLOSED` | Room was closed by server    | None               |

### Message Schema Details

#### Client Messages

##### START_GAME

```json
{
  "type": "START_GAME"
}
```

##### ANSWER

```json
{
  "type": "ANSWER",
  "answer": "Tokyo"
}
```

#### Server Messages

##### ROOM_STATE

```json
{
  "type": "ROOM_STATE",
  "roomState": {
    "roomId": "AB3D",
    "players": {
      "Alice": 1200,
      "Bob": 800
    },
    "status": "playing",
    "questionIndex": 2,
    "currentQuestion": {
      "text": "What is the capital of Japan?",
      "category": "Geography"
    },
    "timeRemainingMs": 15000
  }
}
```

**Room State Fields:**

- `roomId` (string): The room code
- `players` (object): Map of playerIds to scores
- `status` (string): Current game phase
  - `"waiting"`: Lobby, waiting for host to start
  - `"playing"`: Question is displayed, accepting answers
  - `"results"`: Showing answers and correct answer
  - `"finished"`: Game over, final scores displayed
- `questionIndex` (number): Current question number (0-based)
- `currentQuestion` (object, optional): Only present during "playing" status
  - `text`: The question text
  - `category`: The question category
- `timeRemainingMs` (number, optional): Countdown timer in milliseconds
- `winner` (string, optional): Only present in "finished" status
- `results` (object, optional): Only present in "results" status
  - `correctAnswer`: The correct answer
  - `playerAnswers`: Map of playerIds to their submitted answers
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

#### Step 1: Bob opens deep link, enters name

Frontend fetches room info:

```
GET /api/rooms/AB3D
```

**HTTP Response (200):**

```json
{
  "roomId": "AB3D",
  "status": "waiting",
  "playerCount": 1,
  "players": ["Alice"]
}
```

#### Step 2: Bob registers as player

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

#### Step 3: Bob connects WebSocket

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
