---
name: game-flow
description: Complete end-to-end walkthrough of jDuel game progression through all screens and phases. Use when testing UI changes across views, automating Playwright sessions, debugging state transitions, or understanding player experience at each game phase.
---

# Game Flow Navigation

End-to-end walkthrough of how a jDuel game progresses through every screen. Use this when you need to test UI changes across views, automate a Playwright game session, or reason about what the player sees at each phase.

## Phase Overview

```
HomePage → (host) → Lobby → Question → Results → … → GameOver
                  ↑                        │
                  └── (repeat Q+R) ────────┘
```

The backend drives phase transitions via `ROOM_STATE` WebSocket broadcasts. The frontend's `GameView` component routes to the correct view based on `roomState.status`.

| Phase | `roomState.status` | Component | Key UI Elements |
|-------|-------------------|-----------|-----------------|
| Pre-game | `waiting` | `Lobby` | Player list, share link, Multiple Choice toggle, Start Game button |
| Active question | `playing` | `Question` | Question text, timer, multiple choice buttons OR free-text input |
| Between rounds | `results` | `Results` | Correct answer banner, scoreboard, player answers with ✓/✗ |
| Game finished | `finished` | `GameOver` | Winner card, confetti, final standings, room-closing countdown |

## Playwright Automation Walkthrough

### 1. Homepage — Host a Game
- URL: `http://localhost:3000`
- Click the **Host a Game** card to expand the form
- The name input may be pre-filled from `localStorage` (key: `playerName`)
- Fill name → click **Create Room**
- Navigates to `/game/{ROOM_CODE}` (4-char alphanumeric, e.g. `F9O1`)

### 2. Lobby
- WebSocket connects automatically on mount
- **Multiple Choice toggle** — only visible/interactive if you are the host (first player registered). Click the label or checkbox to toggle.
- Click **Start Game** to send `START_GAME` over WebSocket
- The server transitions `status` to `playing` and broadcasts `ROOM_STATE`

### 3. Question View
- Appears when `status === "playing"`
- **Multiple choice mode:** 4 option buttons rendered in a single-column grid on mobile (2-col on desktop). Each button has a letter prefix (A/B/C/D) and option text. Click any option to submit — it sends an `ANSWER` message and immediately shows a green "Answer Submitted" confirmation. No further interaction is possible until the next phase.
- **Free-text mode:** A text input + Submit button. Type answer, press Submit or Enter.
- A **circular countdown timer** runs down from 15 seconds. If time expires without an answer, the player gets 0 points for that round.
- After all players answer (or timeout), the server transitions to `results`.

### 4. Results View
- Shows for ~10 seconds before auto-advancing
- Contains: correct answer banner (green), a scoreboard (sorted by score), and a player-answers list showing each player's submission with a ✓ or ✗ indicator and points gained
- A smaller countdown timer shows "Next question in …"
- After the timer, the server either transitions back to `playing` (next question) or to `finished` (after question 10)

### 5. GameOver View
- Appears when `status === "finished"`
- Shows the champion (winner card with trophy + name + score), confetti animation, and final standings ranked list
- A "Room closing in" countdown (60 seconds) runs. When it hits zero the room is destroyed server-side and the WebSocket emits `ROOM_CLOSED`, which redirects the client back to the homepage.

## Timing Constants (from `backend/src/app/config/game.py`)

| Constant | Value | Where it matters |
|----------|-------|-----------------|
| Question time | 15s | Timer on Question view |
| Results display | 10s | Auto-advance timer on Results view |
| Room cleanup | 60s | Countdown on GameOver view |
| Total questions | 10 (default) | Progress indicator "Question X of Y" (dynamic from `roomState.totalQuestions`) |

## Key Files

| File | Role |
|------|------|
| `frontend/src/features/game/GameView/GameView.tsx` | Phase router — switches component based on `roomState.status` |
| `frontend/src/features/game/Lobby/Lobby.tsx` | Pre-game lobby UI |
| `frontend/src/features/game/Question/Question.tsx` | Active question + answer submission |
| `frontend/src/features/game/Results/Results.tsx` | Round results display |
| `frontend/src/features/game/GameOver/GameOver.tsx` | Final screen with winner + standings |
| `frontend/src/contexts/GameContext.tsx` | WebSocket connection, `startGame()`, `submitAnswer()` |
| `backend/src/app/services/orchestration/orchestrator.py` | Server-side phase transitions and state broadcasts |
| `backend/src/app/config/game.py` | Timing constants |

## Mobile Notes

- All views are designed mobile-first (390px viewport). Option buttons have 56px min-height tap targets. Inputs and submit buttons are full-width on mobile. The results grid collapses to single column below 600px.
- The nav bar logo ("jDuel") has explicit left padding so it doesn't crowd the edge on small screens.
- Toggle switches in the Lobby are oversized (56×30px) for thumb-friendliness on mobile.
