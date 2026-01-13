# jDuel Frontend

A React-based trivia game frontend built with TypeScript, Vite, and Material UI.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material UI** - Component library and theming
- **React Router** - Client-side routing
- **CSS Modules** - Scoped styling

## Project Structure

```
src/
├── App.tsx                    # Root component with routing
├── config.tsx                 # API/WebSocket URL configuration
├── theme.ts                   # Material UI theme
│
├── components/                # Reusable UI components
│   ├── common/               # Shared components (Timer)
│   ├── layout/               # Layout components (PageContainer)
│   ├── Navigation/           # Top navigation bar
│   └── About/                # About page
│
├── contexts/                  # React contexts
│   └── GameContext.tsx       # Game state & WebSocket management
│
├── features/                  # Feature modules
│   └── game/                 # Game feature
│       ├── GameView/         # Main game orchestrator
│       ├── Lobby/            # Pre-game waiting room
│       ├── Question/         # Question & answer UI
│       ├── Results/          # Post-question results
│       └── GameOver/         # Final scores
│
├── pages/                     # Route components
│   ├── HomePage/             # Landing page
│   └── RoomPage/             # Game room
│
├── services/                  # API layer
│   └── api.ts                # HTTP client
│
├── styles/                    # Global styles
│   ├── global.css
│   ├── variables.css
│   └── components.css
│
└── types/                     # TypeScript types
    └── index.ts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Configuration

The frontend connects to the backend via environment variables:

```typescript
// src/config.tsx
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
```

## Architecture

### State Management

The app uses React Context for game state management:

- **GameContext** - Manages WebSocket connection, room state, and game actions
- No external state library needed - game state is simple and localized

### Routing

```
/              → HomePage (create/join room)
/room/:roomId  → RoomPage (game room)
/about         → About page
```

### Game Phases

The `GameView` component renders different UI based on game status:

| Status     | Component | Description                      |
| ---------- | --------- | -------------------------------- |
| `waiting`  | Lobby     | Players join, host starts game   |
| `playing`  | Question  | Display question, accept answers |
| `results`  | Results   | Show correct answer, scores      |
| `finished` | GameOver  | Winner and final scores          |

## Key Features

- **Deep Linking** - Share room URLs directly (`/room/AB3D`)
- **Session Persistence** - Player names saved in localStorage
- **Real-time Updates** - WebSocket for instant game state sync
- **Responsive Design** - Works on desktop and mobile

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Production build         |
| `npm run preview` | Preview production build |
| `npm run lint`    | Run ESLint               |

## Documentation

- [Frontend Architecture](../docs/FrontendFlow.md) - Component architecture and game flow
- [Event Protocol](../docs/EventProtocol.md) - HTTP API and WebSocket messages
