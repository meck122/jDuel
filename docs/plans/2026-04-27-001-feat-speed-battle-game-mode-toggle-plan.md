---
title: "feat: Speed Battle game-mode config + lobby toggle (PR 1 of 4)"
type: feat
status: active
date: 2026-04-27
origin: docs/brainstorms/2026-04-26-speed-battle-game-mode-requirements.md
---

# feat: Speed Battle game-mode config + lobby toggle (PR 1 of 4)

## Overview

Add a new `game_mode` field to `RoomConfig` (values `"classic"` | `"speed_battle"`, default `"classic"`) and surface it as a host-only **Game Mode** toggle in the lobby's `GameSettings`, alongside the existing Difficulty and Multiple Choice controls. The change propagates through the existing `UPDATE_CONFIG` → `ROOM_STATE` flow with no new wire-protocol additions.

PR 1 is **type-plumbing only — no behavioral change**: selecting "Speed Battle" in the lobby has zero runtime effect because no backend code reads `room.config.game_mode` yet. PR 2 adds the `SpeedBattleHandler` and orchestrator delegation seam that activates it.

This is the foundation PR of a 4-PR ship plan (origin doc, "4-PR ship plan" decision in Key Decisions). Landing this first lets PR 2 (`SpeedBattleHandler` backend) merge in isolation, and lets PR 3 (frontend Speed Battle views) gate-check `roomState.config.gameMode` from a known-real field.

## Problem Frame

The host-config code path (`UPDATE_CONFIG` handler + `RoomConfigData` Pydantic mirror + TypeScript `RoomConfig` interface + `GameSettings` lobby UI) is well-known and deliberately kept narrow — adding a field is a 6-touchpoint sync that the `host-config-pattern` and `type-system-alignment` skills already document. The work is mechanical, but doing it as a standalone first PR of the Speed Battle rollout matters: it gives reviewers a small, behavior-free diff to validate the contract change in isolation, before any of PR 2's per-player-state plumbing or PR 3's new views land. It also unblocks the host UX (the toggle is visible in the lobby) so PR 2 + PR 3 can be tested end-to-end against a real `gameMode` selection rather than a hardcoded value.

## Requirements Trace

The origin doc enumerates 6 requirements that PR 1 fully satisfies and 1 that PR 1 partially satisfies (toggle visible, behavior in PR 2):

- **R1.** New "Game Mode" toggle in `GameSettings`, with values **Classic** / **Speed Battle** (see origin: `docs/brainstorms/2026-04-26-speed-battle-game-mode-requirements.md`).
- **R2.** Game Mode is orthogonal to Multiple Choice and Difficulty — any combination is valid. PR 1 does not couple the new toggle to any other setting.
- **R3.** Game Mode is host-only and editable only while the room is in `WAITING` status. The existing `handle_config_update` gates (host check, status check) cover this for free.
- **R4.** Selecting Speed Battle (or switching back to Classic) is broadcast to all players via `UPDATE_CONFIG` → `ROOM_STATE`. The existing broadcast path covers this — `RoomConfigData` is included in every `ROOM_STATE` snapshot.
- **R4a.** **Lobby rules copy** — when Speed Battle is selected, an inline rules blurb appears below the toggle, visible to host and non-host players. PR 1 commits the final copy (see Key Technical Decisions § 6).
- **R25.** `RoomConfig` gains `game_mode: Literal["classic", "speed_battle"] = "classic"`.
- **R28** *(partial — toggle UI ships in PR 1; the actual `GameView` mode dispatch lands in PR 3)*: PR 1 introduces the field that `GameView` will eventually branch on.

## Scope Boundaries

PR 1 is intentionally narrow. Everything Speed-Battle-runtime ships in PR 2 / PR 3.

### Deferred to Separate Tasks

- **`SpeedBattleHandler` class, per-player state, per-player cooldown timer, global match timer, per-recipient state-builder, orchestrator delegation seam** (R23, R24, R24a, R26, R27, R27a, R27b) → **PR 2**.
- **Speed Battle question view, live leaderboard, final-leaderboard results screen, persistent ⚡ badge** (R5a, R8, R9, R9a, R11, R11a, R11b, R12, R13, R13a, R14, R15, R15a, R28a, R29, R30) → **PR 3**.
- **Question pool selection / 100-question fail-fast contract** (R6, R7) → **PR 2** (handler reads from `question_provider`).
- **Reconnect mid-cooldown UX** (R21, R21a) → **PR 2** (server-authoritative cooldown), **PR 3** (UX).
- **Tiebreaker logic / final-leaderboard sort** (R17) → **PR 2** (handler), **PR 3** (display).
- **Prometheus metrics for the new mode** → **PR 4** (per origin doc, Scope Boundaries: "observable metrics for the new mode are explicitly scoped into PR 4").
- **Visual refinements to Classic mode** (lobby polish, leaderboard styling improvements bundled from the design prototype) → **PR 3** by default, per the design README in `docs/design/2026-04-26-speed-battle/README.md` § "Classic mode improvements — explicitly in scope for PR 3". If the PR 3 diff is too large to review in one pass, the implementer may extract a "Classic visual refresh" sub-PR that lands first — the design README explicitly allows this as a fallback.

### True Non-Goals (PR 1)

- No new WebSocket message types. `UPDATE_CONFIG` and `ROOM_STATE` are unchanged in shape; only their `config` payload gains a field.
- No new dependencies (no library additions, no new `pyproject.toml` / `package.json` entries).
- No frontend test runner setup. The repo currently has none; PR 1 verifies the frontend via `npm run build` (type-check) + manual smoke. Adding a runner is out of scope.
- No `host-config-pattern` SKILL.md update. The skill's example uses CSS Modules and points at `Lobby.tsx`; the actual code uses MUI `sx` and `GameSettings/`. This drift is real but pre-dates PR 1; updating the skill is filed as a follow-up note, not a blocker.

## Context & Research

### Relevant Code and Patterns

**Backend — current `RoomConfig` shape (the data being extended):**
- `backend/src/app/models/room_config.py` — `@dataclass RoomConfig` with `multiple_choice_enabled: bool = True` and `difficulty: str = "enjoyer"` (snake_case, internal mutable state).
- `backend/src/app/models/state.py` — `class RoomConfigData(BaseModel)` with `multipleChoiceEnabled: bool = False` and `difficulty: str = "enjoyer"` (camelCase, wire format). **Default-drift gotcha:** the dataclass default is `True` and the Pydantic default is `False`; the dataclass wins because `state_builder` reads from it. PR 1 must avoid propagating this drift — set both `game_mode` and `gameMode` defaults to `"classic"`.
- `backend/src/app/config/game.py` — home of `DIFFICULTY_RANGES` whitelist; mirror that pattern for `GAME_MODES = ("classic", "speed_battle")`.
- `backend/src/app/services/orchestration/state_builder.py` (lines ~33-45) — builds `RoomConfigData(...)` from `room.config` on every `ROOM_STATE` snapshot. One-line addition: `gameMode=room.config.game_mode`.

**Backend — `UPDATE_CONFIG` handler pattern to mirror:**
- `backend/src/app/services/orchestration/orchestrator.py` `handle_config_update()` (lines ~256-310). Existing host/status gates already cover R3. The `if "difficulty" in config_data:` branch (whitelist + silent drop on invalid) is the exact pattern for a new enum field. The trailing `logger.info(...)` summary line (~302-306) should also include `game_mode={room.config.game_mode}`.
- `backend/src/app/api/websocket_handler.py` (lines ~125-129) — WS routing layer. **No change needed**: `UpdateConfigMessage.config` is `dict = Field(default_factory=dict)`, fully permissive.

**Frontend — toggle pattern to mirror:**
- `frontend/src/features/game/GameSettings/DifficultySelector.tsx` (115 lines) — pill-group pattern with `PILL_SELECTED_STYLES`, host-gating triplet (`disabled={!isHost}`, `opacity: isHost ? 1 : 0.5`, `title={isHost ? undefined : "Only the host can change settings"}`), MUI `Box` + `sx` prop. **This is the canonical pattern for an enum-valued host setting** — `MultipleChoiceToggle.tsx` uses MUI `Switch`, suitable only for booleans.
- `frontend/src/features/game/GameSettings/GameSettings.tsx` (52 lines) — composes the two existing toggles; PR 1 adds a third sibling.
- `frontend/src/types/index.ts` (top of file) — `RoomConfig` interface; add `gameMode: "classic" | "speed_battle"`.
- `frontend/src/contexts/GameContext.tsx` `updateConfig()` — accepts `Partial<RoomConfig>`; **no change needed** once the type is extended, `updateConfig({ gameMode: "speed_battle" })` type-checks automatically.

**Documentation:**
- `docs/EventProtocol.md` documents the `config` block in 3 places (lines ~377-390 for `UPDATE_CONFIG`, ~414-419 for the JS example, ~429-437 for `RoomConfig` server→client). PR 1 must add `gameMode` to all three.

### Institutional Learnings

`docs/solutions/` is effectively empty for PR 1's themes (one unrelated CUDA-config doc). PR 1 is a candidate for capturing a new compound learning afterward — "adding an enum-valued config field via the host-config pattern" — but that's a post-merge action, not a blocker.

### Skill References

- `.claude/skills/type-system-alignment/SKILL.md` — Pydantic ↔ TS sync rules (camelCase wire field names, no `Field(alias=...)`, enum string-value matching). Confirms `Literal["classic", "speed_battle"]` ↔ `"classic" | "speed_battle"`.
- `.claude/skills/host-config-pattern/SKILL.md` — canonical 4-step file list for a new host-only setting. **Note: the skill's frontend example is stale** (uses CSS Modules + `Lobby.tsx`); current code uses MUI `sx` + `GameSettings/`. Mirror what's in the codebase, not the SKILL.md example.

### External References

External research was skipped: the codebase has direct local examples of the exact pattern (`DifficultySelector.tsx`, `MultipleChoiceToggle.tsx`, the existing `difficulty` branch in `handle_config_update`). Two dedicated skills cover the work. No third-party libraries or framework versions are in question.

## Key Technical Decisions

1. **Pill-group UI over MUI `Switch`** — Game Mode is enum-typed; "Classic" is meaningfully not just the off-state of "Speed Battle". `DifficultySelector.tsx`'s pill-group pattern (currently used for the 3-value Difficulty enum) is the natural fit for a 2-value enum. *Rejected:* `MultipleChoiceToggle.tsx`'s `Switch` pattern — only suitable for booleans.

2. **`GAME_MODES` whitelist lives in `backend/src/app/config/game.py`** — mirror `DIFFICULTY_RANGES`. Re-export through `backend/src/app/config/__init__.py` if Difficulty is re-exported there. *Rejected:* inlining `("classic", "speed_battle")` in the orchestrator — couples validation to the handler and breaks symmetry with how Difficulty is validated.

3. **`Literal["classic", "speed_battle"]` (not `str`) on the Pydantic `RoomConfigData`** — gives wire-level type safety and a Pydantic-enforced runtime check on inbound payloads. The internal dataclass `RoomConfig` keeps `str` typing because the orchestrator's whitelist check already gates writes to it; using `Literal` on the dataclass adds nothing and makes future migration to a third mode require an extra annotation update.

4. **No backwards-compat shim** — old clients that don't send `gameMode` in `UPDATE_CONFIG` keep the default (`"classic"`). The Pydantic schema accepts payloads without the field (default applies). Old clients connecting to a room where the host has selected Speed Battle will see `gameMode: "speed_battle"` in `ROOM_STATE` but won't render anything new in PR 1 — and that's correct, because PR 1 has nothing new to render.

5. **Default `"classic"` in both the dataclass and `RoomConfigData`** — explicitly avoids the `multipleChoiceEnabled` default-drift bug (dataclass `True` vs Pydantic `False`). **Important:** `RoomConfigData` Pydantic defaults never reach the wire at runtime — `state_builder.py` always constructs `RoomConfigData(...)` with explicit field values from the dataclass; no code calls `RoomConfigData()` naked. Matching defaults only matters for correctness in tests that construct `RoomConfigData()` directly. The practical consequence for PRs 2–4: any new `RoomConfigData` field added without a corresponding `state_builder.py` wiring line will be silently absent from every `ROOM_STATE` broadcast, regardless of its Pydantic default.

6. **R4a final lobby rules copy:**
   > **3-minute solo race — wrong answers lock you for 5 seconds and reveal the correct answer.**

   Fits inline below the toggle, single sentence, captures the two distinguishing mechanics. Visible to all players regardless of host status. Originally suggested copy in the brainstorm was longer ("3-minute race — answer as many as you can. Wrong answers lock you for 5s and reveal the correct answer."); shortened on the planner's call (origin doc R4a explicitly notes "Final copy is a planning-time call").

## Open Questions

### Resolved During Planning

- **R4a final copy** — committed in Key Technical Decisions § 6.
- **`GAME_MODES` whitelist location** — `backend/src/app/config/game.py` (Decision § 2).
- **Pill-group vs Switch UI** — pill-group (Decision § 1).
- **`Literal` placement** — Pydantic mirror only (Decision § 3).
- **Documentation update scope** — `docs/EventProtocol.md` 3 sections, included in Unit 1's file list. `host-config-pattern/SKILL.md` drift noted as follow-up, not in PR 1 scope.

### Deferred to Implementation

- **Toggle visual placement order in `GameSettings.tsx`** — between Difficulty and Multiple Choice, or below both. Cheap call once the implementer sees the rendered output. Default: place last (below Multiple Choice) so Difficulty stays as the primary above-the-fold setting.
- **Inline rules-copy styling** — exact `sx` values for the muted blurb (color, font-size, margin-top). Match existing muted-text conventions in the codebase; no new tokens needed.

## Implementation Units

- [x] **Unit 1: Backend — add `game_mode` field through the type stack**

**Goal:** Add `game_mode` to the backend `RoomConfig` dataclass, the `RoomConfigData` Pydantic mirror, the `GAME_MODES` whitelist constant, the state-builder wiring, and the EventProtocol documentation. After this unit, every `ROOM_STATE` broadcast includes `config.gameMode`, but no code reads it yet.

**Requirements:** R25 (RoomConfig field), R4 (broadcast — partially: payload-level), foundation for R28.

**Dependencies:** None.

**Files:**
- Modify: `backend/src/app/models/room_config.py`
- Modify: `backend/src/app/models/state.py`
- Modify: `backend/src/app/config/game.py`
- Modify: `backend/src/app/config/__init__.py` — add `GAME_MODES` to the import block and `__all__` (confirmed: `DIFFICULTY_RANGES` is already re-exported here, so this edit is unconditional)
- Modify: `backend/src/app/services/orchestration/state_builder.py`
- Modify: `docs/EventProtocol.md` (3 sections — `UPDATE_CONFIG` example/schema, `RoomConfig` example/schema)
- Test: `backend/tests/unit/test_state_builder.py` *(or wherever `RoomConfigData` Pydantic round-trip is tested; create the test if absent)*

**Approach:**
- `RoomConfig` (dataclass): add `game_mode: str = "classic"` after `difficulty`. Keep `str` typing — orchestrator whitelist gates writes.
- `RoomConfigData` (Pydantic): add `gameMode: Literal["classic", "speed_battle"] = "classic"` after `difficulty`. Use `Literal` for wire-level type safety.
- `config/game.py`: add `GAME_MODES: tuple[str, ...] = ("classic", "speed_battle")` next to `DIFFICULTY_RANGES`.
- `state_builder.py`: add `gameMode=room.config.game_mode` to the `RoomConfigData(...)` constructor call (single line).
- `EventProtocol.md`: add `gameMode` to the `UPDATE_CONFIG` config-keys table, the JS example, and the `RoomConfig` server→client documentation. Document values: `"classic"` (default) | `"speed_battle"`.

**Patterns to follow:**
- `RoomConfig.difficulty` and `RoomConfigData.difficulty` for the dataclass-vs-Pydantic split.
- `DIFFICULTY_RANGES` in `config/game.py` for whitelist constant placement.
- The existing `state_builder.py` `RoomConfigData(multipleChoiceEnabled=..., difficulty=...)` kwargs.

**Test scenarios:**
- *Happy path:* `RoomConfigData(gameMode="speed_battle").model_dump(exclude_none=True)` includes `"gameMode": "speed_battle"`.
- *Happy path:* `RoomConfigData()` default-constructs with `gameMode="classic"`.
- *Edge case:* `RoomConfigData(gameMode="garbage")` raises `pydantic.ValidationError` — the `Literal` enforces the contract at the wire layer.
- *Integration:* `state_builder.build_room_state(room)` where `room.config.game_mode = "speed_battle"` produces a `RoomStateData` whose `config.gameMode == "speed_battle"`.
- *Integration:* fresh `Room` (no explicit config) produces a `ROOM_STATE` snapshot with `config.gameMode == "classic"` (default applied).

**Verification:**
- `uv run pytest ../tests/unit/ -k "room_config or state_builder or game_mode"` from `backend/src/` passes.
- `uv run ruff check .` from `backend/src/` clean.
- `docs/EventProtocol.md` shows `gameMode` in all 3 documented sections.

---

- [x] **Unit 2: Backend — `UPDATE_CONFIG` handler branch + tests**

**Goal:** Wire `handle_config_update()` to read `gameMode` from incoming `UPDATE_CONFIG` payloads, validate against the `GAME_MODES` whitelist, and mutate `room.config.game_mode`. After this unit, the host can change `gameMode` end-to-end on the backend; broadcasts carry the new value.

**Requirements:** R4 (broadcast — fully realized once handler mutates state), R3 (host/status gates — already in place, this unit reuses them).

**Dependencies:** Unit 1.

**Files:**
- Modify: `backend/src/app/services/orchestration/orchestrator.py` (`handle_config_update` — add `gameMode` branch and extend the trailing `logger.info` summary)
- Modify: `backend/tests/unit/test_orchestrator.py`
- Modify: `backend/tests/integration/test_websocket.py`

**Approach:**
- Add a third `if` branch in `handle_config_update` after the `difficulty` branch, mirroring its shape: `if "gameMode" in config_data: ... if game_mode in GAME_MODES: room.config.game_mode = game_mode else: logger.warning(...)`.
- Import `GAME_MODES` from `app.config` (mirror the existing `from app.config import DIFFICULTY_RANGES` line in `orchestrator.py` — the re-export from `__init__.py`, not the module directly).
- Extend the summary `logger.info(...)` line at end of method to include `game_mode={room.config.game_mode}`.
- **Do NOT** modify `app/api/websocket_handler.py` — `UpdateConfigMessage.config: dict` is already permissive.

**Patterns to follow:**
- The existing `if "difficulty" in config_data:` branch in `handle_config_update` (whitelist + silent drop on invalid + warning log).
- `backend/tests/unit/test_orchestrator.py` `test_handle_config_update_non_host_rejected` for the unit-test fixture pattern (uses real fixtures from `conftest.py`, no mocks).
- `backend/tests/integration/test_websocket.py` `test_config_update_changes_difficulty` for the WS round-trip test pattern (uses `TestClient`, `_setup_room`, `_ws_url` helpers at top of file).

**Test scenarios:**
- *Happy path (unit):* Host sends `{"gameMode": "speed_battle"}` → `room.config.game_mode == "speed_battle"`.
- *Happy path (unit):* Host sends `{"gameMode": "classic"}` after previously selecting Speed Battle → `room.config.game_mode == "classic"`.
- *Edge case (unit):* Host sends `{"gameMode": "garbage"}` → `room.config.game_mode` unchanged from default `"classic"`, warning logged.
- *Edge case (unit):* Host sends `UPDATE_CONFIG` with no `gameMode` key (only `difficulty`) → `game_mode` unchanged, `difficulty` updated.
- *Error path (unit):* Non-host player sends `{"gameMode": "speed_battle"}` → `room.config.game_mode` unchanged, host-only warning logged. Mirror `test_handle_config_update_non_host_rejected`.
- *Error path (unit):* Host sends valid `gameMode` after `room.status` has transitioned out of `"waiting"` → `room.config.game_mode` unchanged, status-gate warning logged.
- *Integration:* Host opens WS, sends `{"type": "UPDATE_CONFIG", "config": {"gameMode": "speed_battle"}}`, immediately receives `ROOM_STATE` with `roomState.config.gameMode == "speed_battle"`. Mirror `test_config_update_changes_difficulty`.
- *Integration:* Two-player room — host sends `gameMode: "speed_battle"`, both host's and non-host's WS connections receive the updated `ROOM_STATE`. Verifies R4 broadcast reaches non-host clients.
- *Integration:* Host sets `gameMode="speed_battle"`, game runs to FINISHED, host sends `PLAY_AGAIN` → fresh `ROOM_STATE` in waiting status has `config.gameMode=="speed_battle"`. Confirms `game_mode` persists across a play-again reset (consistent with `difficulty` and `multipleChoiceEnabled` behavior, since `reset_game_state()` does not touch `room.config`). PR 2 will first read this field at `handle_start_game` time — this test proves the assumption before that happens.

**Verification:**
- `uv run pytest ../tests/unit/test_orchestrator.py ../tests/integration/test_websocket.py -k "game_mode"` passes (8 new test cases minimum from scenarios above).
- Existing Classic-mode test suite (`uv run pytest ../tests/`) passes unchanged — no regressions.
- `uv run ruff check .` from `backend/src/` clean.

---

- [x] **Unit 3: Frontend — TS type, `GameModeToggle` component, `GameSettings` integration, R4a rules copy**

**Goal:** Extend the TS `RoomConfig` interface with `gameMode`, add a new `GameModeToggle` pill-group component mirroring `DifficultySelector`, integrate it into `GameSettings.tsx`, and render the R4a rules blurb inline when Speed Battle is selected. After this unit, the host can click the toggle and all clients reflect the change.

**Requirements:** R1 (toggle in GameSettings), R2 (orthogonality — by virtue of being a sibling control with no coupling), R3 (host-only — by virtue of `disabled={!isHost}` mirroring sibling toggles), R4a (inline rules copy).

**Dependencies:** Unit 1, Unit 2 (both must merge first — the frontend reads `config.gameMode` from `ROOM_STATE` and writes it via `UPDATE_CONFIG`, both of which require the backend payload).

**Files:**
- Modify: `frontend/src/types/index.ts` (extend `RoomConfig` interface)
- Create: `frontend/src/features/game/GameSettings/GameModeToggle.tsx`
- Modify: `frontend/src/features/game/GameSettings/GameSettings.tsx`

**Approach:**
- `types/index.ts`: add `gameMode: "classic" | "speed_battle";` to `RoomConfig`. Match the Pydantic `Literal` exactly.
- `GameModeToggle.tsx`: new component. Props `{ isHost: boolean; currentMode: "classic" | "speed_battle"; onSelect: (mode: "classic" | "speed_battle") => void }`. Pill-group with two pills "Classic" / "Speed Battle". Apply the canonical host-gating triplet (`disabled={!isHost}`, `opacity: isHost ? 1 : 0.5`, `title={isHost ? undefined : "Only the host can change settings"}`). Below the pill group, conditionally render the R4a rules blurb when `currentMode === "speed_battle"` — visible to all players (no `isHost` gate). Use a const `GAME_MODE_OPTIONS` array mirroring `DIFFICULTY_OPTIONS` in `DifficultySelector.tsx`.
- **Keyboard navigation:** each pill button must have a `:focus-visible` style (e.g., `'&:focus-visible': { outline: '2px solid var(--color-accent-purple)', outlineOffset: '2px' }` in the `sx` block). Tab navigates to the group; Enter/Space activates the focused pill.
- **ARIA:** wrap the pill group in a container with `role="radiogroup"` and `aria-label="Game Mode"`. Each pill renders with `role="radio"` and `aria-checked={currentMode === option.value}` so screen readers can identify the selected mode and the group's purpose.
- **Live region for R4a blurb:** the container element wrapping the conditional rules blurb should have `aria-live="polite"` — screen readers will announce the blurb text when Speed Battle is selected and stay silent when it disappears.
- `GameSettings.tsx`: import `GameModeToggle`, render it as a third sibling after `<MultipleChoiceToggle>` (or after `<DifficultySelector>` — implementer's call; default is after MultipleChoice so Difficulty stays primary above-the-fold). Pass `roomState?.config?.gameMode ?? "classic"` and `(mode) => updateConfig({ gameMode: mode })`.
- **R4a final copy** (Decision § 6): "3-minute solo race — wrong answers lock you for 5 seconds and reveal the correct answer."

**Patterns to follow:**
- `frontend/src/features/game/GameSettings/DifficultySelector.tsx` — pill-group structure, `PILL_SELECTED_STYLES`, host-gating triplet, `DIFFICULTY_OPTIONS` const pattern.
- `frontend/src/features/game/GameSettings/GameSettings.tsx` lines composing `<DifficultySelector>` and `<MultipleChoiceToggle>` — sibling-component style.
- Existing muted-text styling (`color: "var(--color-text-dim)"` or equivalent in current tokens) for the R4a blurb — match conventions, do not introduce new tokens.

**Test scenarios:**
- **Test expectation: no automated tests** — the repo has no frontend test runner (no Vitest, no RTL, no Playwright wired up). Verification is type-check + manual smoke. Per the brainstorm doc's design philosophy and the `host-config-pattern` skill, this is consistent with how the existing Difficulty and Multiple-Choice toggles ship.
- *Type-check:* `npm run build` from `frontend/` passes — Vite's TS plugin enforces `RoomConfig.gameMode` typing across all consumers (`GameContext.updateConfig`, `roomState.config.gameMode` reads, `GameModeToggle` props).
- *Manual smoke (host):* Open the lobby as host. Both pills visible, `"Classic"` selected by default. Click `"Speed Battle"` → pill swaps, R4a blurb appears below. Click `"Classic"` → blurb disappears, pill swaps back.
- *Manual smoke (non-host):* Open the lobby as a second player. Pills visible but greyed out (opacity 0.5), hover shows the "Only the host can change settings" tooltip. When host changes the mode, the non-host's pill state updates and the R4a blurb appears.
- *Manual smoke (broadcast):* Open two browser windows. Host changes mode → non-host sees the update within one frame (driven by `ROOM_STATE` broadcast).
- *Manual smoke (orthogonality, R2):* Host can independently toggle Game Mode, Difficulty, and Multiple Choice in any order — no setting resets another.
- *Manual smoke (post-start lock, R3):* Host starts a Classic round, then attempts to click `"Speed Battle"` mid-round. Pills are visually disabled (room status no longer `"waiting"`) — backend silently drops the update.

**Verification:**
- `npm run build` from `frontend/` succeeds (type-check + Vite build pass).
- `npm run lint` from `frontend/` clean.
- Manual smoke per scenarios above passes in two-window dev test (`npm run dev` + backend running per CLAUDE.md commands).

## System-Wide Impact

- **Interaction graph:** PR 1 touches the existing `UPDATE_CONFIG` → `handle_config_update` → `state_builder.build_room_state` → `connection_manager.broadcast` chain. No new entry points, no new callbacks, no new middleware. The change is additive at every step.
- **Error propagation:** Invalid `gameMode` values are silently dropped at the orchestrator (mirroring `difficulty` invalid-handling) and rejected at the Pydantic wire layer with `ValidationError`. No new error codes; no new client-visible failure modes.
- **State lifecycle risks:** None new. `room.config.game_mode` is a plain field on the existing dataclass; it lives and dies with the `Room` object, cleaned up by the same room-cleanup paths that already handle `difficulty` and `multiple_choice_enabled`.
- **API surface parity:** The WS protocol contract gains one optional field on `UPDATE_CONFIG.config` and one always-present field on `ROOM_STATE.roomState.config`. Old clients connecting to a server that has the field will see it in payloads but won't read it. Old servers receiving payloads with `gameMode` from a new client will route through `UpdateConfigMessage.config: dict` (permissive) and process other keys normally — but PR 1 doesn't ship to clients before servers, so this asymmetry is theoretical.
- **Integration coverage:** Unit 2's two integration tests cover the full WS round-trip (host UPDATE_CONFIG → both connections receive ROOM_STATE). Mocks alone wouldn't prove that the `state_builder` wiring carries `gameMode` end-to-end.
- **Unchanged invariants:** Classic mode flow (`handle_start_game` → game loop → `handle_answer` → results) is **completely untouched**. No code path in PR 1 reads `room.config.game_mode` at runtime — confirms the "Classic test suite passes unchanged" success criterion from the origin doc. PR 2 will be the first PR where this can regress.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| **Default-drift bug regenerates** — implementer copies the existing `multipleChoiceEnabled` mismatch (`True`/`False` between dataclass and Pydantic). | Decision § 5 calls this out explicitly; both new defaults set to `"classic"`. Code review checkpoint. |
| **Skill-doc drift misleads implementer** — `host-config-pattern/SKILL.md` shows CSS Modules + `Lobby.tsx`, current code uses MUI `sx` + `GameSettings/`. | Context & Research § Skill References explicitly flags this; Unit 3 patterns point at the actual files in `GameSettings/`. The skill itself is a follow-up, not a PR 1 blocker. |
| **Backwards compatibility with old clients** — old clients during a deploy window send `UPDATE_CONFIG` without `gameMode`. | Default `"classic"` in the dataclass means absent-field payloads keep current behavior. Pydantic accepts payloads without the optional field. Risk is theoretical and self-resolves on the next client refresh. |
| **`config/__init__.py` re-export** — `GAME_MODES` must be added to the import block and `__all__` alongside `DIFFICULTY_RANGES`. | Confirmed unconditional in Unit 1 file list — no longer conditional. |
| **R4a copy revision after merge** — final copy committed in this plan but may need wordsmithing once seen in context. | Copy is a single string in `GameModeToggle.tsx`; cheap to revise in a follow-up. Not a PR 1 blocker. |

### Dependencies

- **External:** None. No new libraries, no infrastructure changes, no DB schema changes (no DB exists for game state).
- **Internal:** None blocking. The questions-DB extraction work (`docs/plans/2026-04-11-001-...`) is completed and independent.
- **Sequencing:** PR 1 is the foundation for PRs 2–4 of the Speed Battle rollout. PR 2 (`SpeedBattleHandler` + orchestrator delegation seam) reads `room.config.game_mode` to decide whether to delegate; PR 1 must merge first. PR 3 (frontend Speed Battle views) reads `roomState.config.gameMode` from `GameView`; same dependency.

## Documentation / Operational Notes

- **`docs/EventProtocol.md`** — updated in Unit 1's file list (3 sections).
- **`.claude/skills/host-config-pattern/SKILL.md`** — known stale (CSS Modules example, `Lobby.tsx` reference). **Not in PR 1 scope** but worth a follow-up PR to align the skill with the current MUI `sx` + `GameSettings/` codebase. Suggested follow-up issue title: "skill: refresh host-config-pattern to match current MUI sx + GameSettings/ structure".
- **No deployment changes.** PR 1 ships through the standard `./deploy.sh` flow — frontend rebuild, backend systemd reload. No nginx config changes, no environment variable changes, no monitoring impact (R4 broadcast load is identical to existing config updates).
- **No rollout flag.** Behavior is unchanged regardless of `gameMode` value, so a feature flag adds no safety. PR 2 may want one for the actual handler delegation; that's a PR 2 design call.
- **Post-merge follow-up: capture an institutional learning** — `docs/solutions/` has no entry for "adding an enum-valued config field"; PR 1 is a clean opportunity to add one.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-26-speed-battle-game-mode-requirements.md](../brainstorms/2026-04-26-speed-battle-game-mode-requirements.md) — full Speed Battle requirements doc, 30 requirements + 4-PR ship plan + scope boundaries.
- **Design assets:** [docs/design/2026-04-26-speed-battle/README.md](../design/2026-04-26-speed-battle/README.md) — visual designs (PR 3 will lean on these; PR 1 has no UI component beyond the toggle, which mirrors existing patterns).
- **Skills:**
  - `.claude/skills/host-config-pattern/SKILL.md` — host-only setting pattern (note: stale on frontend example).
  - `.claude/skills/type-system-alignment/SKILL.md` — Pydantic ↔ TS sync rules.
  - `.claude/skills/ws-message-checklist/SKILL.md` — useful for verifying the round-trip.
- **Existing code (mirror these):**
  - `backend/src/app/models/room_config.py`, `backend/src/app/models/state.py` — RoomConfig dataclass + RoomConfigData Pydantic mirror.
  - `backend/src/app/services/orchestration/orchestrator.py` `handle_config_update` — UPDATE_CONFIG handler with host/status gates.
  - `backend/src/app/services/orchestration/state_builder.py` lines 33-45 — `RoomConfigData` constructor wire-up.
  - `backend/src/app/config/game.py` — `DIFFICULTY_RANGES` constant pattern.
  - `frontend/src/features/game/GameSettings/DifficultySelector.tsx` — pill-group pattern.
  - `frontend/src/features/game/GameSettings/GameSettings.tsx` — composition of toggle siblings.
- **Test patterns (mirror these):**
  - `backend/tests/unit/test_orchestrator.py` — orchestrator unit-test fixtures (mock-free, real `conftest.py` fixtures).
  - `backend/tests/integration/test_websocket.py` — WS round-trip integration pattern with `TestClient`.
- **Related plans:**
  - `docs/plans/2026-04-11-001-refactor-questions-db-extraction-import-tooling-plan.md` (status: completed) — independent prerequisite that's already shipped.
- **Future plans (placeholder names, to be created):**
  - `docs/plans/YYYY-MM-DD-NNN-feat-speed-battle-handler-backend-plan.md` — PR 2.
  - `docs/plans/YYYY-MM-DD-NNN-feat-speed-battle-frontend-plan.md` — PR 3.
  - `docs/plans/YYYY-MM-DD-NNN-feat-speed-battle-metrics-polish-plan.md` — PR 4.
