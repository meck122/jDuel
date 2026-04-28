---
date: 2026-04-26
topic: speed-battle-game-mode
---

# Speed Battle Game Mode

## Problem Frame

jDuel today has exactly one game shape: a synchronized "duel" where every player sees the same question on the same 15s timer, then a shared results screen, repeating until the question pool is exhausted. The pace is fixed by the slowest player and the timer; players who *know* the answer quickly are gated by the timer rather than rewarded by it. There is no mode that rewards speed-of-thought, and no mode where each player races at their own pace.

**Speed Battle** is a second game mode, selectable in the lobby alongside the existing Multiple Choice and Difficulty settings. In Speed Battle, every player is racing solo against the clock, all answering the same ordered question stream, but at their own pace. Whoever answers the most questions correctly within a fixed time window wins. Wrong answers cost the player time (a forced cooldown) and reveal the correct answer, so accuracy and speed both matter.

This is a meaningful product expansion (a new mode of play, not a tweak to Classic) and the synchronization assumptions baked into the orchestrator make it a meaningful architectural change as well. The user has explicitly approved doing the refactor required to support it cleanly.

This is an explicit product bet on game-mode replayability and a different competitive feel — not a response to measured demand. There is no formal kill criterion; the 4-PR ship plan is short enough that retiring or hiding the toggle in a future v1.1 is cheap if adoption is low.

**Identity shift, accepted:** shipping a second mode positions jDuel as "a trivia game with modes" rather than "a quick trivia duel." Future features will need to answer "which modes does this apply to?" — that's an ongoing carrying cost we accept for the replayability gain.

## Requirements

**Mode Selection (Lobby)**

- R1. The host sees a new "Game Mode" toggle in `GameSettings`, alongside Difficulty and Multiple Choice, with two values: **Classic** (current behavior) and **Speed Battle**.
- R2. Game Mode and the existing Multiple Choice toggle are **orthogonal**: any combination is valid (Classic+MC, Classic+Text, Speed Battle+MC, Speed Battle+Text). Difficulty applies to both modes.
- R3. Game Mode is host-only and editable only while the room is in `WAITING` status, matching the existing `RoomConfig` rules.
- R4. Selecting Speed Battle (or switching back to Classic) is broadcast to all players via the existing `UPDATE_CONFIG` → `ROOM_STATE` flow; non-host players see the change reflected in the lobby UI.
- R4a. **Lobby rules copy:** when Speed Battle is selected, a short rule blurb appears inline below the toggle, visible to all players in the lobby (host and guests). Suggested copy: "3-minute race — answer as many as you can. Wrong answers lock you for 5s and reveal the correct answer." Final copy is a planning-time call.

**Speed Battle Round Mechanics**

- R5. The match is a single 3-minute (180s) wall-clock round. There are no per-question timers within the round.
- R5a. **Round-start UX:** when the host starts a Speed Battle round, all clients show a brief 3→2→1 countdown overlay (3 seconds total). When it ends, the first question and the 180s match timer appear simultaneously and the clock begins. The 180s timer is persistent and visible at the top of the screen for the entire round (and on the leaderboard panel).
- R6. All players see the **same ordered question stream** (player A's question 1 = player B's question 1, etc.). Player progress diverges based on speed, not content. Determinism mechanism: a single shared `room.questions` list is loaded once at match start (matching Classic's existing pattern) and each player's per-player Speed Battle state holds a private `current_index` walking that shared list. No round-seed or per-player shuffle is needed; determinism comes for free from in-memory list sharing.
- R7. The question pool for the round is **exactly 100 questions**, drawn from the same question source as Classic mode and filtered by the room's current Difficulty setting. If the difficulty filter yields fewer than 100 questions, the round refuses to start and the host sees a clear error (e.g., "Not enough questions in this difficulty for Speed Battle"). This is a fail-fast contract: the DB must maintain ≥100 questions per difficulty tier to support Speed Battle.
- R8. A player advances to the next question immediately upon submitting a **correct** answer.
- R9. On a **wrong** answer: the player enters a 5-second cooldown during which the correct answer for that question is revealed. Submission is locked. After 5 seconds, the player auto-advances to the next question in the stream — wrong questions are not retried.
- R9a. **Cooldown UX:** the existing question card stays in place. The correct answer is highlighted inline (green outline on the correct MC choice; correct text shown below the input field for text-input questions). A circular 5→0 countdown ring sits in the card corner. All answer inputs are disabled with a locked visual state for the duration of the cooldown.
- R10. The wrong question still consumes that player's slot in the question stream (their next question is N+1, not N).
- R11. The match ends with a **hard cut** at T=180s: all players are immediately frozen, submissions and cooldowns are cancelled, and the final leaderboard is shown. In-flight answers do not count.
- R11a. **Cutoff rule:** an ANSWER counts iff the server's monotonic-clock receive timestamp is strictly less than `match_start + 180000ms`. Network latency is the player's risk — fast connections benefit on borderline submissions, slow connections lose late-game answers. The match clock authoritative source is `time.monotonic()` (or `asyncio.get_event_loop().time()`) anchored at round-start; clients display an estimated remaining time but the server is authoritative for all timing decisions.
- R11b. **Cooldowns crossing the match boundary:** if a player is mid-cooldown when the hard cut fires at T=180s, the cooldown is cancelled along with everything else and the player is frozen with whatever score they had at the boundary. This is intentional — late-match wrong answers carry real cost (you may spend the final seconds locked). The "don't risk a wrong answer late" strategic meta is accepted as part of the mode's design.
- R12. If a player exhausts all 100 questions before T=180s, the question area is replaced by a full-width leaderboard view with the player's final correct count called out (e.g., "You answered all 100 — N correct"). The match timer keeps counting down. The player cannot earn additional points. This state is an edge case (it implies near-cheating-grade speed) and is intentionally low-polish — meeting the spec is enough; design fidelity here is not v1 priority.
- R29. **Server is authoritative on correctness.** The client receives only the current question text/choices; the correct answer for any question is never sent to the client until **after** that player has submitted (or as part of the wrong-answer reveal in R9). The next question is fetched on advance, never pre-streamed. WebSocket frame contents must be assumed visible to the player.
- R30. **Server-side answer guard is idempotent.** For each (player, question_index), the server accepts at most one ANSWER; duplicate submissions for the same question are dropped silently. ANSWER messages received during a wrong-answer cooldown, after the match has ended (T≥180s), or after the player has exhausted the 100-question pool are likewise dropped silently with no `ERROR` reply — the client UI prevents these in normal use, but the server treats them as no-ops to remain idempotent against stale clients.

**Live Leaderboard**

- R13. During the round, every player sees a live leaderboard showing each player's correct count, updating in near-real-time as players answer.
- R13a. **Leaderboard layout:** desktop shows a persistent right-column panel alongside the question card; mobile collapses the leaderboard into a top strip showing "You: N — Leader: M" with a tap-to-expand drawer for the full list. Always present on desktop, on-demand on mobile.
- R14. The leaderboard reveals only correct count per player mid-round. It does not show which question another player is currently on, what they just answered, or their wrong-answer count. **Acknowledged:** correct count implies a lower bound on the player's question position (a player at 30 correct has seen ≥30 questions). This is accepted — privacy beyond "exact count exposed" is not a v1 goal.
- R15. After the hard cut at T=180s, the final leaderboard reveals correct count, wrong count, and final placement for each player.
- R15a. **End-of-round transition:** at T=180s, a brief (~1s) full-screen "Time's up!" overlay appears, then the final leaderboard renders as a full-screen view (distinct from the mid-round panel layout in R13a). The transition punctuates the shift from "live race" to "final result."

**Scoring and Tiebreakers**

- R16. Score is the count of correct answers in the round. Wrong answers do not subtract from the score (the cooldown is the only wrong-answer penalty).
- R17. **Tiebreaker:** if two or more players finish with the same correct count, the player with **fewer wrong answers** wins. Further ties are displayed as a shared placement.

**Match Lifecycle**

- R18. Speed Battle uses the same lobby → in-progress → over lifecycle as Classic. The host starts the round; non-hosts wait in the lobby.
- R19. A single player can start a Speed Battle round, matching the existing solo-allowed behavior in Classic. Solo Speed Battle effectively becomes a time-attack against the clock — the leaderboard shows only the player. This is deliberate: it doubles as practice without needing a separate practice mode. No special UI handling for the solo case is required for v1.
- R20. Late join: once a Speed Battle round is in progress, new players cannot join (consistent with Classic's current behavior — verify during planning).
- R21. Reconnect: if a player disconnects mid-round and reconnects within their existing session, they resume at their own current question index and remaining cooldown (if any). The match clock continues running through the disconnect — disconnected time is lost time. Cooldown remaining time is **server-authoritative** — stored in per-player room state, not connection state. Disconnect/reconnect does not pause, reset, or skip the cooldown; the server refuses ANSWER messages until `cooldown_expires_at <= now` regardless of what the client claims.
- R21a. **Reconnect UX:** the player lands directly on their current question (or the active cooldown reveal if mid-cooldown), with the 180s match timer at its current value and the live leaderboard already in place. The cooldown countdown ring resumes from `remaining_ms` (computed from the server-authoritative `cooldown_expires_at`). No "you reconnected" modal or toast — the timer states are self-evident.

**Architecture (high-level direction, approved)**

The current orchestrator, timer service, and state builder all assume one shared question index and one shared question timer. Speed Battle requires per-player state and a per-player cooldown timer, with a single global match timer. Two extreme approaches were considered and rejected: scattered `if game_mode == ...` branches in the orchestrator (debt grows with every future mode), and a full strategy protocol (`GameModeHandler` + `ClassicModeHandler` + `SpeedBattleModeHandler`) (premature for a 2-mode system; protocol shape is best derived from two real concrete cases when a third mode arrives, not designed speculatively now). The approved direction is a **minimal seam**: a dedicated `SpeedBattleHandler` class owns Speed Battle's new state and lifecycle, the orchestrator delegates at a small number of mode-aware call sites, and Classic logic is left untouched.

- R22. The orchestrator must not grow scattered `if game_mode == ...` branches. Speed Battle's new state and divergent flow live in a dedicated handler; Classic stays in the orchestrator as-is.
- R23. Add a `SpeedBattleHandler` class (likely under `services/orchestration/`) that owns Speed Battle's per-player state (current question index, correct count, wrong count, cooldown_expires_at), its match-timer lifecycle, leaderboard projection, and answer handling. The handler is created when a Speed Battle round starts and torn down at match end / room close. Concrete state shape: the handler holds `dict[room_id, SpeedBattleRoundState]`, where `SpeedBattleRoundState` carries the round-level fields (match_start, question_list reference) and a `per_player: dict[player_id, PlayerProgress]` mapping. The `Room` dataclass is **not** modified — Speed Battle state lives entirely in the handler and is cleaned up by the same room-close paths that cancel the handler's timers.
- R24. The orchestrator gains a small number of mode-aware delegation points (round start, handle_answer, match-tick, connect). When `room.config.game_mode == "speed_battle"`, control delegates to the handler at those points; Classic mode paths in the orchestrator are unchanged.
- R24a. **Reconnect delegation:** when a player connects to a room with `game_mode == "speed_battle"` and a round in progress, `handle_connect` delegates to `SpeedBattleHandler.build_state_for_player(player_id)` and sends that single payload only to the reconnecting socket (not a broadcast to all). Classic's connect path is unchanged.
- R25. `RoomConfig` gains `game_mode: Literal["classic", "speed_battle"] = "classic"`.
- R26. `TimerService` is extended to support per-player cooldown timers and a single global match timer, in addition to its existing shared-question timer used by Classic. Cleanup paths (room close, disconnect) cancel both. Concrete shape: keep the existing 3-slot dict for Classic untouched, add a separate `_player_cooldowns: dict[(room_id, player_id), Task]` and `_match_timers: dict[room_id, Task]` for Speed Battle. `cancel_all_timers_for_room` is extended to clean up all three structures.
- R27. `StateBuilder` adds a per-recipient code path for Speed Battle that produces a `ROOM_STATE` snapshot containing (a) the recipient's own private question + cooldown state and (b) the shared leaderboard summary (R13). Classic continues to use the existing single-broadcast path.
- R27a. **ConnectionManager API:** add a new method `broadcast_per_recipient(room_id, build_state)` that takes a callable `(player_id) -> dict` and sends each connected player their own payload. The existing `broadcast(room_id, state)` is unchanged and continues to serve Classic. Speed Battle's per-recipient state never leaves the server as a single combined payload — each player's private state is sent only to that player.
- R27b. **Broadcast cadence:** v1 ships **no throttling** — every correct answer triggers an immediate per-recipient leaderboard broadcast. Math at the "100 concurrent users" target (most rooms 2–4 players) keeps aggregate per-recipient state-builder work well under capacity, and the WS sends themselves are cheap. PR 4's metrics will surface real-world load; debouncing (e.g., 4Hz / 250ms coalescing) can be added in a follow-on if a worst-case 20-player room measurably strains the per-recipient state-builder. Consistent with the "ship simpler, add complexity when measured" pattern elsewhere in this doc.
- R28. Frontend: a new Speed Battle question view (single-question + cooldown reveal per R9a + live leaderboard panel per R13a) and a final-leaderboard results screen. The existing Classic Question / Results / GameOver views are unchanged. Mode is dispatched from `GameView` based on `roomState.config.gameMode`.
- R28a. **Persistent mode indicator:** the Speed Battle in-round view shows a subtle "Speed Battle" badge or label in the top header alongside the match timer, so players who skim the lobby still know which mode they're playing.

## Success Criteria

- A host can select Speed Battle in the lobby, and all players see the change before the round starts.
- Starting Speed Battle drops the room into a 3-minute round in which each player progresses independently and sees the same questions in the same order.
- A wrong answer locks submission for 5 seconds, reveals the correct answer, then auto-advances; the wrong question is not retried.
- The live leaderboard updates as players score correct answers, with no leakage of question position or wrong count during the round.
- The round ends cleanly at exactly T=180s for everyone, with a final leaderboard that resolves ties by fewer wrong answers.
- The Classic mode test suite passes unchanged after PR 2 (Speed Battle backend), proving no regressions to the untouched Classic path.
- After Speed Battle ships, switching modes in the lobby is the only visible change for hosts who don't use it; Classic-only users notice nothing.

## Scope Boundaries

- **Out:** host-configurable match length or wrong-answer cooldown. Both are constants in `config/game.py` for v1; revisit after real play data.
- **Out:** per-question time bonuses, streak multipliers, or any non-binary scoring. Score = count of correct answers. Tiebreaker = fewer wrong answers.
- **Out:** retry-the-wrong-question variants (and other cooldown alternatives explored in brainstorm).
- **Out:** in-flight grace at match end. T=180s is a hard cut.
- **Out:** mid-round join. Late joiners wait for the next round.
- **Out:** mode-specific difficulty curves, custom question pools, or "infinite mode". The 100-question pool is generous against the practical ~30–40 ceiling for honest play; running out signals cheating or a bug.
- **Out:** persisting Speed Battle stats across rooms (no DB exists, no scope to add one here).
- **Out:** spectator mode for late arrivals during a Speed Battle round.
- **Out (deferred):** observable metrics for the new mode are explicitly scoped into PR 4, not the core mode work.

## Key Decisions

- **Orthogonal mode and answer-type axes** — Speed Battle works with both MC and text input. Both axes are independent host settings. **Known risk:** Speed Battle + Text Input combines a 3-minute speed race with NLP fuzzy-match verification latency. An ~800ms verification call inside a speed race burns time and can create "I was robbed" moments on ambiguously-correct answers. Accepted for v1 with the planner instructed to (a) keep verification on the existing async path so it doesn't block other players, (b) consider an optimistic-UI advance with reconciliation if verification disagrees, and (c) measure verification p95 latency in PR 4's metrics.
- **Live leaderboard during the round** — Showing other players' correct counts in real time is a defining feature of "battle" framing. Hiding it would make Speed Battle feel like solo practice with extra steps. **Tension acknowledged:** the live leaderboard is intentionally pressure-creating, which sits in productive tension with "racing solo at your own pace." That tension is the mode's identity — Classic remains the pressure-free option (or a single-player Speed Battle round, see R19/Solo).
- **Skip + reveal correct answer** on wrong — Educational dimension chosen over pure punishment ("skip to next") and over correctness loops ("retry same question"). Reveals turn each wrong answer into a learning moment without slowing pace beyond the cooldown.
- **Hard cut at T=180s** — Predictable and fair. Grace windows or "finish current question" extensions create asymmetry where slower players get more time than faster ones, which inverts the mode's intent.
- **Tiebreaker: fewer wrong answers** — Rewards accuracy as the secondary axis after speed. Cheap to compute, easy to explain to players. Considered and rejected: weighting by `questions_attempted` to penalize disconnects/AFK. Rationale: when correct counts already tie, accuracy is the right secondary signal — a disconnected player with 5/0 was, in that window, more accurate than an engaged player with 5/8, and rewarding accuracy is consistent with the mode's framing. The pathological 0/0 vs 0/0 case ties everyone at the bottom of the board, which doesn't matter.
- **Fixed timing in v1** — 180s match + 5s cooldown are constants. Adding host-configurable timing is doable later if real play shows demand; shipping with fixed values is the minimum viable surface.
- **Minimal-seam architecture (over full protocol or scattered if-branches)** — Speed Battle's new state and divergent flow live in a dedicated `SpeedBattleHandler` class. The orchestrator delegates at ~3-4 mode-aware call sites; Classic logic is unchanged. A full `GameModeHandler` protocol with a `ClassicModeHandler` sibling was rejected as premature for a 2-mode system — the protocol shape is best derived from two real concrete cases when a third mode arrives, not designed speculatively now. Pure if-branches were also rejected because Speed Battle's per-player state and per-player timers want class ownership.
- **4-PR ship plan** — (1) `game_mode` config field + lobby toggle (no-op behavior) — explicitly synchronizes `RoomConfigData` (Pydantic), the frontend TS `RoomConfig` type, `GameSettings.tsx`, and the `UPDATE_CONFIG` handler's config-key mapping per the `type-system-alignment` skill; (2) `SpeedBattleHandler` backend — orchestrator delegation seam + handler class + per-player state + per-player cooldown timer + global match timer + per-recipient state-builder path. Classic regression tests run unchanged before any Speed Battle code path is reachable; (3) Speed Battle frontend — toggle wiring, Speed Battle question view (R9a), live leaderboard (R13a), final-leaderboard results screen. Implements the visual designs in `docs/design/2026-04-26-speed-battle/` (token-mapping pass required: prototype uses `--purple`/`--font-d`/`--r-lg`/`--bg0..3`/`--fg`/`--gold`/`--teal` etc., existing codebase uses `--color-accent-purple`/`--font-display`/`--radius-lg`; gold and teal tokens are net-new). The prototype's Lobby includes CSS-level refinements to the existing Classic Lobby — bundle them into PR 3 by default since they're polish-not-redesign; extract a separate PR only if review surfaces concerns; (4) metrics + polish.

## Dependencies / Assumptions

- The question source (`services/core/question_provider.py` backed by `db/database.py` + `questions.db`) must yield ≥100 questions per difficulty tier. R7's fail-fast contract makes this an enforced runtime check rather than an unverified assumption — if a tier has fewer than 100, Speed Battle refuses to start with a clear error.
- Difficulty filtering applies to Speed Battle the same way it applies to Classic. No new difficulty tiers required.
- Per-player Speed Battle state lives in `SpeedBattleHandler` (per R23), not in the `Room` dataclass — no schema changes to existing models, no persistence (no DB for game state).
- The existing UPDATE_CONFIG flow can carry an enum-valued `game_mode` field with a small adjustment; the host-only / waiting-state-only validation already in place in the orchestrator covers it.
- The questions-DB extraction work (plan 2026-04-11-001, status: completed) is independent of Speed Battle — Speed Battle reads through the stable `question_provider.py` API.

## Outstanding Questions

### Resolve Before Planning

_(none — all product decisions are resolved)_

### Deferred to Planning

- [Affects R20][Needs research] Confirm Classic's actual late-join behavior in code today (room status check + connection handling), so Speed Battle can mirror it.
- [Affects R28][Technical] Should the Speed Battle question view reuse `Question.tsx` with a mode-aware variant, or be a separate sibling component? Driven by how much code overlaps once written; revisit during the frontend PR.
- [Affects R5, R9][Needs research] Confirm `config/game.py` is the right home for `SPEED_BATTLE_MATCH_TIME_MS = 180_000` and `SPEED_BATTLE_WRONG_COOLDOWN_MS = 5_000` (verify by reading the file's existing constants).
- [Affects R28a][Design] Final visual treatment of the persistent "Speed Battle" header badge — color, placement, copy. Planner's call.
- [Affects R4a][Copy] Final wording of the lobby rules blurb when Speed Battle is selected. Planner's call.

## Design Assets

Visual designs for Speed Battle are in [`docs/design/2026-04-26-speed-battle/`](../design/2026-04-26-speed-battle/README.md). The bundle includes an interactive HTML prototype, the design-conversation transcript, and a token-mapping table flagging where prototype tokens diverge from the existing codebase. PR 3 (Speed Battle frontend) should treat these as the visual + structural reference.

## Next Steps

-> `/ce-plan` for structured implementation planning, starting with PR 1 (`game_mode` config field + lobby toggle).
