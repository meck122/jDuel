---
title: "feat: Music feature flag, glob discovery, and asset removal"
type: feat
status: active
date: 2026-05-18
origin: docs/brainstorms/2026-05-18-music-feature-flag-requirements.md
---

# feat: Music feature flag, glob discovery, and asset removal

## Summary

Introduce a single hardcoded `MUSIC_ENABLED` constant and refactor `tracks.ts` to discover mp3s via `import.meta.glob` instead of static `new URL(...)` imports. Both switches are independently sufficient to disable the feature. With the const defaulting to `false`, public production builds emit zero music bytes and render no mute/skip UI. Mp3 files are removed from `HEAD`, added to `.gitignore`, and uploaded to the VPS manually via a new `scripts/upload-music.sh`. Git history is left alone.

---

## Problem Frame

Music licensing is unresolved and the 12-track manifest (~64 MB) is tracked in git, bloating clones and shipping audio to anonymous public traffic on every page load that hits the mute toggle. See origin: [docs/brainstorms/2026-05-18-music-feature-flag-requirements.md](../brainstorms/2026-05-18-music-feature-flag-requirements.md) for the full problem narrative and motivations.

---

## Requirements

- R1. Public `npm run build` produces zero music-related bytes in `dist/` (no mp3 assets, no music import refs).
- R2. Mute button and skip control are absent (not greyed-out) when the flag is off.
- R3. Music files are no longer tracked in git; future `git status` lists them as ignored.
- R4. Build succeeds on machines that have no mp3 files on disk (clean clones, CI).
- R5. Re-enabling music is a one-line edit (`MUSIC_ENABLED = true`) + files present + rebuild.
- R6. A manual `scripts/upload-music.sh` exists and is modeled on existing `scripts/upload-questions.sh`.

---

## Scope Boundaries

- External feature-flag services (LaunchDarkly, etc.) — explicitly not added.
- Per-user, per-room, or per-environment music toggles — not built.
- Music selection UI or track picker — not built.
- DRM, signed URLs, anti-download measures beyond not shipping the bytes.
- Git history rewrite via `git filter-repo` — deferred decision.
- Frontend test framework introduction — out of scope; this plan does not introduce vitest/jest.

### Deferred to Follow-Up Work

- **History rewrite (`git filter-repo`)**: separate decision, may never happen. Revisit if licensing concern escalates or repo size starts hurting clone times meaningfully.

---

## Context & Research

### Relevant Code and Patterns

- `frontend/src/assets/music/tracks.ts` — current static manifest using `new URL("./*.mp3", import.meta.url)`. Target of U2.
- `frontend/src/contexts/MusicContext.tsx` — `MusicProvider`, owns the single `HTMLAudioElement`. Already gracefully handles `TRACKS.length === 0` at `ensureAudio` (line 56). Target of U3.
- `frontend/src/contexts/useMusic.ts` — throws if used outside a `MusicProvider`, so the provider must stay mounted even when the feature is off; the provider itself becomes a no-op.
- `frontend/src/components/ui/Navigation/Navigation.tsx` — renders `<ToolbarMuteButton />` and the skip `<IconButton>` unconditionally today. Target of U4.
- `frontend/src/components/ui/MuteButton/ToolbarMuteButton.tsx` and `useMuteToggle.ts` — call `useMusic()`; when flag is off these never get rendered (so they never call the hook).
- `frontend/src/App.tsx` — mounts `<MusicProvider>` around the router; stays unchanged (provider always mounts).
- `scripts/upload-questions.sh` — pattern for U6: `JDUEL_SSH_HOST` / `JDUEL_SSH_USER` resolution, optional `--key` flag, `scripts/.env` fallback. Uses `scp`; we'll use `rsync` for a directory.
- `deploy.sh` — runs `npm run build` on the VPS in-place; no changes needed because the flag, not file presence, is the canonical gate.

### Institutional Learnings

- No relevant `docs/solutions/` entries on feature flags or asset management in this repo.

### External References

- Vite docs: `import.meta.glob` with `{ eager: true }` returns Vite-processed modules; for `.mp3` files the module's `default` export is the fingerprinted asset URL string. Reference: vitejs.dev/guide/features.html#glob-import.

---

## Key Technical Decisions

- **Const lives in a new `frontend/src/config/features.ts`**: a dedicated config module is grep-able, sets a convention for future flags, and keeps `tracks.ts` and `MusicContext.tsx` focused on their existing concerns. Alternative considered (co-locate in `tracks.ts`) was rejected because it hides the flag from non-music code paths that may need to import it (e.g., `Navigation.tsx`).
- **Hardcoded boolean, not `import.meta.env.VITE_*`**: single-developer project; env-var plumbing adds cost without benefit. Promote later only if per-environment differences are needed (see origin).
- **`MusicProvider` stays mounted even when flag is off, but provides a no-op context value**: avoids touching `App.tsx`, keeps `useMusic()` calls safe across the tree, and matches the existing `TRACKS.length === 0` guard pattern.
- **`TRACKS` type changes from `readonly URL[]` to `readonly string[]`**: `import.meta.glob` with `{ eager: true }` yields module objects whose `default` is a string URL. Dropping `URL` simplifies the consumer in `MusicContext.tsx` (no `.href` access).
- **`scripts/upload-music.sh` uses `rsync -av` rather than `scp -r`**: idempotent, faster for repeat uploads, and supports `--delete` if we later want to mirror.
- **Upload script backs up the VPS copy before overwriting**: cheap safety per the deferred question in origin. A timestamped `~/jduel-music-backup-YYYYMMDD-HHMMSS/` directory on the remote.
- **README.md and tracks.ts in `frontend/src/assets/music/` remain tracked**: the manifest code and its README explain the feature; only the binary mp3s leave the repo.

---

## Open Questions

### Resolved During Planning

- **Where does `MUSIC_ENABLED` live?**: `frontend/src/config/features.ts` (new file).
- **Does the upload script back up the VPS copy first?**: yes — `cp -r` on remote before `rsync`.
- **Where does the upload script live?**: `scripts/upload-music.sh`, mirroring `scripts/upload-questions.sh`.
- **Does the `MusicProvider` unmount when the flag is off?**: no — it stays mounted with a no-op context value, so `useMusic()` callers never throw.

### Deferred to Implementation

- Exact shape of the no-op context value (likely `{ preference: "off", toggle: () => {}, skip: () => {} }`) — concrete shape settled at implementation time against the existing `MusicContextValue` interface.
- Whether to also import-guard `useMusic` users that don't render through `Navigation` — none expected today (`useMuteToggle` is only used by `ToolbarMuteButton`), but verify during U4.

---

## Implementation Units

### U1. **Introduce `MUSIC_ENABLED` flag**

**Goal:** Create the single source of truth for the feature flag.

**Requirements:** R1, R2, R5.

**Dependencies:** None.

**Files:**
- Create: `frontend/src/config/features.ts`

**Approach:**
- New module exports `export const MUSIC_ENABLED = false;` as a top-level constant.
- No other exports; this file is single-purpose for now.
- Add a short comment explaining the flag's purpose and how to re-enable music.

**Patterns to follow:**
- No existing `frontend/src/config/` convention to follow — this unit establishes it. Keep the file minimal so future flags slot in cleanly.

**Test scenarios:**
- Test expectation: none — pure constant introduction with no callers yet. Verified by U2/U4 importing it without TS errors.

**Verification:**
- `npm run build` succeeds with the new file in place.
- File grep finds exactly one occurrence: `export const MUSIC_ENABLED = false;`.

---

### U2. **Refactor `tracks.ts` to use `import.meta.glob` and respect the flag**

**Goal:** Replace static mp3 imports with glob discovery; gate the resulting array on `MUSIC_ENABLED`.

**Requirements:** R1, R2, R4.

**Dependencies:** U1.

**Files:**
- Modify: `frontend/src/assets/music/tracks.ts`

**Approach:**
- Replace the 12 hardcoded `new URL("./<name>.mp3", import.meta.url)` lines with a single `import.meta.glob("./*.mp3", { eager: true })` call that yields module objects whose `default` is a string URL.
- Map the glob result to an array of URL strings.
- Wrap in a flag check: when `MUSIC_ENABLED === false`, export `TRACKS` as an empty array — Vite's tree-shaker then drops the glob result entirely from the bundle.
- Change the exported type from `readonly URL[]` to `readonly string[]`.
- Update the module's existing JSDoc to describe the new "drop a file in the dir and rebuild" workflow.

**Technical design:** *(directional guidance, not implementation specification)*

```
// tracks.ts shape (approximate):
//   import { MUSIC_ENABLED } from "../../config/features";
//   const modules = MUSIC_ENABLED
//     ? import.meta.glob<{ default: string }>("./*.mp3", { eager: true })
//     : {};
//   export const TRACKS: readonly string[] = Object.values(modules).map(m => m.default);
//
// When MUSIC_ENABLED is false, the glob expression is unreachable and Vite drops it.
// When the directory is empty, the glob returns {} and TRACKS is [].
```

**Patterns to follow:**
- Existing JSDoc style at the top of `tracks.ts`.

**Test scenarios:**
- Build smoke test: with `MUSIC_ENABLED = false` and mp3s present on disk, `npm run build` succeeds and `grep -c "\\.mp3" frontend/dist/assets/*.js frontend/dist/assets/*.css` returns 0; `ls frontend/dist/assets/*.mp3` returns no matches.
- Build smoke test: with `MUSIC_ENABLED = true` and mp3s present, `npm run build` succeeds and `ls frontend/dist/assets/*.mp3 | wc -l` returns 12.
- Build smoke test: with `MUSIC_ENABLED = true` and the mp3 dir empty (only `README.md` + `tracks.ts`), `npm run build` succeeds with no missing-module errors and no mp3s in `dist/assets/`.

**Verification:**
- All three build smoke tests above pass.
- `tracks.ts` no longer contains any `new URL("./<name>.mp3", ...)` lines.

---

### U3. **Update `MusicContext.tsx` for the new `TRACKS` type and flag-gated no-op**

**Goal:** Adjust the provider to (a) consume `string[]` instead of `URL[]`, and (b) become a no-op pass-through context when `MUSIC_ENABLED` is false.

**Requirements:** R1, R2.

**Dependencies:** U1, U2.

**Files:**
- Modify: `frontend/src/contexts/MusicContext.tsx`

**Approach:**
- Replace all `.href` accesses on track values with the raw string (e.g., `audio.src = next` instead of `audio.src = next.href`; `playingRef.current = next` where `next` is now a string).
- Update `pickNextTrack` signature: `current: string | null -> string | null`; the existing filter `t.href !== current.href` becomes `t !== current`.
- Update `playingRef`'s type to `string | null`.
- At the top of `MusicProvider`, branch on `MUSIC_ENABLED`: when false, return `<MusicContext.Provider value={{ preference: "off", toggle: () => {}, skip: () => {} }}>{children}</MusicContext.Provider>` and skip every effect, ref, and listener.
- Existing `TRACKS.length === 0` early-return in `ensureAudio` stays in place — it remains the correct guard for the on-but-empty case.

**Patterns to follow:**
- Existing `useCallback` and `useRef` style in this file.

**Test scenarios:**
- Build: `npm run build` passes with no TypeScript errors after the type change.
- Manual smoke (flag off): run `npm run dev`, open the app, confirm no `Audio` element exists in DOM, confirm no network requests for `.mp3` files, confirm no console errors from `useMusic` callers.
- Manual smoke (flag on, files present): same as today — music plays on toggle, shuffle/skip work, no regression vs. the current behavior.
- Manual smoke (flag on, empty dir): music UI renders (covered by U4 deciding render gates), but `ensureAudio` no-ops and toggling the mute button is harmless (no crash, no playback).

**Verification:**
- `git diff frontend/src/contexts/MusicContext.tsx` shows no remaining `.href` references.
- With flag off and `npm run dev`, browser devtools shows zero `audio` elements created and zero mp3 network requests across the full user journey (Home → Lobby → Game → GameOver).

---

### U4. **Gate mute and skip controls in `Navigation.tsx`**

**Goal:** Hide the mute and skip buttons entirely when the flag is off — not greyed-out, just absent.

**Requirements:** R2.

**Dependencies:** U1, U3.

**Files:**
- Modify: `frontend/src/components/ui/Navigation/Navigation.tsx`

**Approach:**
- Import `MUSIC_ENABLED` from `frontend/src/config/features.ts`.
- Wrap the `<ToolbarMuteButton />` render in `{MUSIC_ENABLED && ...}`.
- Wrap the skip `<IconButton>` block (lines 57-65) in `{MUSIC_ENABLED && ...}`.
- Leave the `useMusic()` destructure in place — it's harmless under the no-op provider from U3 — but consider lifting it inside a guard if linters complain about unused destructured names.
- Confirm no other component in `frontend/src/` renders a mute/skip control (`grep -r "ToolbarMuteButton\|useMuteToggle" frontend/src/` should return only the Navigation and MuteButton files themselves).

**Patterns to follow:**
- Existing conditional-render style in `Navigation.tsx` (e.g., `{showQCounter && <Box…>}` on line 49).

**Test scenarios:**
- Manual smoke (flag off): open the running app, confirm the navbar has no mute icon and no skip icon. Layout shifts correctly with the items removed (the right-side `Box` collapses cleanly).
- Manual smoke (flag on): mute and skip render in the navbar and behave identically to today.
- Code search: `grep -rn "ToolbarMuteButton\|<IconButton.*skip\|SkipNextIcon" frontend/src/` returns matches only inside files guarded by `MUSIC_ENABLED` or inside the MuteButton component itself.

**Verification:**
- Default build (`MUSIC_ENABLED = false`) renders no mute or skip control across all routes (`/`, `/about`, `/game/:roomId`).
- Lint passes (`npm run lint`).

---

### U5. **Remove tracked mp3 files from git and add `.gitignore` entry**

**Goal:** Stop tracking the 12 binary assets without rewriting history.

**Requirements:** R3, R4.

**Dependencies:** U1, U2, U3, U4 (so the build doesn't break the moment files are absent).

**Files:**
- Modify: `.gitignore`
- Remove from index (keep on disk): `frontend/src/assets/music/*.mp3` (12 files)

**Approach:**
- Append to `.gitignore`:
  ```
  # Music assets are kept outside git; see scripts/upload-music.sh
  frontend/src/assets/music/*.mp3
  ```
- Run `git rm --cached frontend/src/assets/music/*.mp3` to drop them from the index while keeping working-tree copies locally.
- `tracks.ts` and `README.md` remain tracked — only `*.mp3` is ignored.
- Commit the `.gitignore` change and the index removal together.
- **VPS sequencing note** (executed by the user when deploying, not by this plan): on the VPS, run `cp -r frontend/src/assets/music ~/jduel-music-backup/` *before* `git pull`. The pull will delete the mp3 working-tree files because they're transitioning from tracked to ignored. After pull, restore via `cp ~/jduel-music-backup/*.mp3 frontend/src/assets/music/` or via U6's script from the laptop. This sequencing belongs in the commit message and origin doc, not in code.

**Patterns to follow:**
- Existing `.gitignore` section headers (Python, IDEs, Logs, etc.).

**Test scenarios:**
- `git ls-files frontend/src/assets/music/` returns only `README.md` and `tracks.ts`.
- `git status` on a checkout with local mp3 files present shows the directory as clean (ignored files don't appear).
- Fresh clone test (`git clone . /tmp/jduel-clean && cd /tmp/jduel-clean && ls frontend/src/assets/music/`) shows only `README.md` and `tracks.ts`, and `npm install && npm run build` (with `MUSIC_ENABLED = false`) succeeds.

**Verification:**
- All three test scenarios pass.
- Repo size on a fresh clone of `HEAD` (not history) is materially smaller — `du -sh .git/index` and a fresh shallow clone (`git clone --depth=1`) confirm.

---

### U6. **Add `scripts/upload-music.sh` for VPS uploads**

**Goal:** Provide a documented one-command path to push local mp3 files to the VPS.

**Requirements:** R6.

**Dependencies:** None code-wise, but most useful once U5 has landed.

**Files:**
- Create: `scripts/upload-music.sh`

**Approach:**
- Model on `scripts/upload-questions.sh`: same `JDUEL_SSH_HOST`/`JDUEL_SSH_USER`/`JDUEL_SSH_KEY` resolution, same `--key` flag handling, same `scripts/.env` fallback.
- Differences from `upload-questions.sh`:
  - Local source: defaults to `./frontend/src/assets/music/` (overridable as first positional arg).
  - Remote destination: `~/dev/jDuel/frontend/src/assets/music/`.
  - Uses `rsync -av --include='*.mp3' --exclude='*'` rather than `scp`, so it doesn't overwrite the tracked `tracks.ts` or `README.md`.
  - Before rsync: `ssh ... cp -r <remote-music-dir> ~/jduel-music-backup-$(date +%Y%m%d-%H%M%S)/` for the safety net.
  - Refuses to run if the local source directory has zero mp3s (avoids accidentally wiping the VPS).
- Header comments explain the VPS-side sequencing for the *first* removal-pull scenario from U5.
- Chmod +x and document in `deploy.sh` comments or the file's own header.

**Patterns to follow:**
- `scripts/upload-questions.sh` lines 1-90 (arg parsing, env loading, key resolution).

**Test scenarios:**
- Dry-run test: invoke `scripts/upload-music.sh --help` (if implemented) or with bad args; confirms usage output without making remote changes.
- Zero-mp3 refusal: rename the local music dir empty, run the script, confirm it exits with a clear error before any remote operation.
- Live upload (manual, by the operator): after running, `ssh ... ls ~/dev/jDuel/frontend/src/assets/music/*.mp3 | wc -l` shows 12.
- Backup check: after running, `ssh ... ls -d ~/jduel-music-backup-*/` shows at least one backup directory with the previous copy.

**Verification:**
- The script is executable (`chmod +x`), passes `shellcheck` if available, and the live upload + backup scenarios both pass once exercised against the VPS.

---

## System-Wide Impact

- **Interaction graph:** Only the music subsystem and Navigation are affected. No backend, no WebSocket, no game logic touched.
- **Error propagation:** With the flag off and the no-op provider, `useMusic()` returns a valid stub; no exceptions can escape music code paths.
- **State lifecycle risks:** `MusicProvider`'s effect cleanup in `useEffect` (line 156-167 of current MusicContext) detaches gesture listeners and clears the audio ref; the flag-off branch skips this whole effect, so there's nothing to clean up. No partial-state risk.
- **API surface parity:** No public APIs change. `useMusic()`'s return shape is unchanged. `TRACKS`'s element type narrows from `URL` to `string`, but the only consumer is `MusicContext.tsx` (verified by grep).
- **Integration coverage:** The "flag off → zero mp3 bytes in dist" claim is the load-bearing check; verified by grep on the build output (U2 test scenarios).
- **Unchanged invariants:** `MusicProvider` remains mounted in `App.tsx`. `useMusic()` still throws if called outside a provider. The WCAG 1.4.2 "music off by default" behavior is preserved (and now extends to "music absent by default").

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| First `git pull` on the VPS after U5 deletes the live mp3 files. | Origin doc and the U5/U6 prose flag the backup step explicitly; commit message will repeat the warning; `upload-music.sh` exists as a recovery path. |
| Vite's tree-shaker fails to drop the glob result when `MUSIC_ENABLED = false`, leaking mp3 references into the bundle. | U2's first test scenario grep-checks the built JS/CSS for `.mp3` references; if tree-shaking misses, fall back to wrapping the glob result with an explicit `if (!MUSIC_ENABLED) return [];` early-return so the glob call is in dead code unreachable from the export. |
| `import.meta.glob`'s eager option behavior changes between Vite minor versions. | Pinned Vite version in `package.json`. If a future upgrade changes glob behavior, U2's build smoke tests catch it. |
| Some other consumer of `useMuteToggle` exists that wasn't surfaced in research. | U4 verifies via `grep -r "useMuteToggle"` before completing; if a hit appears, gate that consumer the same way. |
| Force-pushing or branch surgery on `main` is not part of this plan, but a future history rewrite (deferred) would invalidate every existing clone. | Out of scope; documented as a deferred decision in origin and Scope Boundaries. |

---

## Documentation / Operational Notes

- Origin doc already documents the VPS sequencing (backup-before-pull). No new docs/guide needed.
- The U6 upload script's header is the canonical operator runbook.
- If the user wants this surfaced more prominently, a one-liner in `docs/guides/deployment-workflow.md` linking to the script would suffice — but that's a "nice to have," not a requirement.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-18-music-feature-flag-requirements.md](../brainstorms/2026-05-18-music-feature-flag-requirements.md)
- Music feature commits: `7ce55b8` (initial), `9fcb6e9` (navbar + skip)
- Vite `import.meta.glob`: https://vitejs.dev/guide/features.html#glob-import
- Related script pattern: `scripts/upload-questions.sh`
