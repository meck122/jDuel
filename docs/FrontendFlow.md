# Frontend Architecture

This document covers the React component architecture and game flow for the jDuel frontend. For the full HTTP + WebSocket protocol reference, see [EventProtocol.md](EventProtocol.md).

## Project Structure

```
frontend/src/
├── App.tsx                    # Root component with React Router setup
├── config.ts                  # Environment configuration (API/WebSocket URLs)
├── theme.ts                   # MUI theme configuration
├── main.tsx                   # React app entry point
├── components/                # Reusable UI components
│   ├── common/               # PlayerName, Timer
│   ├── layout/               # PageContainer
│   └── ui/                   # Navigation
├── contexts/                  # GameContext (state + WebSocket management)
├── features/game/             # Game feature modules
│   ├── GameView/             # Phase orchestrator
│   ├── Lobby/                # Pre-game waiting room
│   ├── Question/             # Question display & answer input
│   ├── Results/              # Post-question results
│   ├── GameOver/             # Final scores
│   ├── GameSettings/         # Host configuration UI
│   └── Reactions/            # Player reactions
├── hooks/                     # usePlayerName (localStorage persistence)
├── pages/                     # HomePage, GamePage, AboutPage
├── services/                  # api.ts (HTTP), reactionEmitter.ts
├── styles/                    # CSS variables, global styles
├── types/                     # TypeScript interfaces
└── utils/                     # Game utility functions
```

## Component Responsibilities

| Component     | Responsibility                                                                  |
| ------------- | ------------------------------------------------------------------------------- |
| `App`         | Router setup, theme provider, global layout with Navigation                     |
| `HomePage`    | Room creation, join flow with validation, deep link query param handling         |
| `GamePage`    | HTTP pre-registration with retry, GameProvider setup, connection error handling  |
| `GameView`    | Phase orchestration (renders correct child based on roomState.status)            |
| `Lobby`       | Display players, shareable link with copy button, start game button (host-only) |
| `Question`    | Display question/category, countdown timer, answer form or multiple choice      |
| `Results`     | Correct answer, all player answers color-coded, points gained, leaderboard      |
| `GameOver`    | Winner announcement, final scores leaderboard, back to home button              |
| `Timer`       | Local countdown interpolation from server timeRemainingMs                       |
| `Navigation`  | Top nav bar with app title and links                                            |
| `GameContext` | WebSocket lifecycle, state management, message parsing, action methods           |
| `Reactions`   | Reaction buttons with cooldown, floating reaction feed from all players          |

## Error Handling

### WebSocket Close Codes

- `4003`: Player not pre-registered - show error, redirect to home
- `4004`: Room not found - show error, redirect to home
- `4009`: Player already connected - prevent hijacking

### HTTP API Errors

- `ROOM_NOT_FOUND`: Room doesn't exist
- `NAME_TAKEN`: Player name in use (retries on page refresh race condition)
- `GAME_STARTED`: Game in progress, new players can't join
- `INVALID_SESSION`: Session token mismatch on reconnection

### Input Validation

- Player name: 1-20 characters, no control/zero-width chars, no HTML patterns
- Room code: Auto-uppercase, 4-6 characters, alphanumeric

## Key Architectural Decisions

1. **Feature-Based Organization** - Game components in `features/game/` for self-contained feature modules
2. **Context Over Props** - `GameContext` eliminates prop drilling for game state
3. **Separation of Concerns** - HomePage (room setup), GamePage (connection), GameView (phase routing)
4. **HTTP + WebSocket Hybrid** - HTTP for room/player registration, WebSocket for real-time game state
5. **Deep Link via Redirect** - `/room/AB3D` redirects to `/?join=AB3D` (consolidates entry logic in HomePage)
6. **Server-Driven Data** - Reactions, question count, and config come from `RoomStateData` (no hardcoded values)

## Performance

- **Timer**: Local interpolation (100ms ticks) from server `timeRemainingMs` - smooth countdown without server round-trips
- **WebSocket**: Server broadcasts `ROOM_STATE` on every state change; React batches updates
- **Reactions**: Module-level emitter bypasses React context batching for immediate UI updates
