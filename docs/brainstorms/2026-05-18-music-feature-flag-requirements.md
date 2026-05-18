# Music Feature Flag & Asset Removal — Requirements

**Date:** 2026-05-18
**Status:** Ready for planning
**Scope:** Standard

## Problem

The opt-in background music feature (PRs `7ce55b8`, `9fcb6e9`) ships 12 mp3 tracks (~64 MB) bundled by Vite into `frontend/dist/assets/`. This is a problem on two axes:

1. **Music licensing is unresolved** — the tracks should not be served to anonymous public traffic until licensing is verified.
2. **Repo bloat** — ~64 MB of tracked binary assets slows clones, bloats history, and is not something git is good at.

We want to hide the feature behind a simple, code-level flag so the public production site stops shipping music entirely, while preserving the implementation and the ability to flip it back on later (e.g., once licensing clears).

## Users & motivation

- **Public visitors** today: download ~5 MB+ of mp3 (per track) any time someone toggles music on, plus see a "Mute" affordance for a feature that is not yet legally sound to ship.
- **After this change:** see no music UI at all. No mp3 bytes are referenced by the bundle, so none are downloaded and none are eligible to be saved.

This is a single-developer project; the flag is a one-line toggle in code, not a runtime/per-user control.

## Goals

- Public `npm run build` produces zero music-related bytes in `dist/` (no mp3 assets, no music import refs).
- Mute button and music UI are absent when the flag is off — not greyed-out or broken-looking, just gone.
- Music files are no longer tracked in git (removed from `HEAD`, added to `.gitignore`).
- Builds succeed cleanly on machines that have **no** mp3 files on disk (clean clones, CI, fresh dev environments).
- Re-enabling music later is a single-file edit (`const MUSIC_ENABLED = true`) + ensuring files are on disk + rebuild.
- A clear, manual way to upload music files to the VPS exists (so we don't lose them after the `git rm` propagates).

## Non-goals

- LaunchDarkly or any external feature-flag service.
- Per-user, per-room, or per-environment music toggles.
- Music track selection UI / track picker.
- Streaming or signed-URL / CDN-based music delivery.
- Hard "prevent saving" measures (technically impossible once a browser plays audio; addressed instead by not shipping the bytes at all).
- Rewriting git history to purge mp3s from past commits (deferred — see Open questions).

## Approach (decided)

**Hybrid: `import.meta.glob` for asset discovery + a hardcoded const for UI gating.**

Two independent off-switches, either of which fully disables the feature:

1. **Asset switch** — `tracks.ts` discovers mp3s via `import.meta.glob("./*.mp3", { eager: true })` instead of the current static `new URL(...)` list. If the dir is empty, `TRACKS = []` and Vite emits no music bytes. No broken imports when files are absent.
2. **Feature switch** — a single `const MUSIC_ENABLED = false` (location TBD in planning; likely a top-level export in `frontend/src/config/features.ts` or co-located in `tracks.ts`). When false, `MusicProvider` short-circuits and the mute button is not rendered.

Flag default in the committed code: **`MUSIC_ENABLED = false`** (public prod off).

Why this shape: with both switches off-by-default, the public site is safe by default; flipping music on requires both a code change *and* files present on disk — a clear, auditable change rather than an accidental side effect of someone scp-ing files.

## Acceptance criteria

- [ ] `npm run build` on a checkout where `frontend/src/assets/music/` is empty succeeds with no errors and no warnings about missing mp3 modules.
- [ ] Inspection of `dist/assets/` after a default (`MUSIC_ENABLED = false`) build shows **zero** `.mp3` files and zero references to mp3 modules in any bundled JS.
- [ ] The navbar in the running app shows no mute button when `MUSIC_ENABLED = false`.
- [ ] `MusicProvider` is either not rendered or is a no-op pass-through when `MUSIC_ENABLED = false` (no `Audio` element constructed, no event listeners attached).
- [ ] Flipping `MUSIC_ENABLED = true` *and* placing mp3 files in `frontend/src/assets/music/` *and* rebuilding restores the feature exactly as it works today (mute button, shuffle, skip).
- [ ] `frontend/src/assets/music/*.mp3` is in `.gitignore`; `git status` on a checkout with files present shows them as ignored, not untracked.
- [ ] The mp3 files are removed from `HEAD` via `git rm` (verifiable: `git ls-files frontend/src/assets/music/` returns only `README.md` or nothing).
- [ ] A `scripts/upload-music.sh` exists, is documented, and rsyncs a local music dir up to the VPS.

## VPS handoff plan (sequencing)

This is the order of operations that protects the existing files on the VPS:

1. **Locally:** implement the flag + glob changes, `git rm` the mp3s, gitignore the path, commit, push.
2. **On the VPS, *before* pulling:** back up the live music files — `cp -r frontend/src/assets/music ~/jduel-music-backup/`. Otherwise `git pull` will delete them from the working tree (they're currently tracked).
3. **On the VPS:** `git pull`. Verify the directory now contains only `README.md` (or is gone).
4. **On the VPS:** restore from backup — `cp ~/jduel-music-backup/*.mp3 frontend/src/assets/music/`. Or from the laptop, run the new `scripts/upload-music.sh`.
5. **Run `./deploy.sh`.** With `MUSIC_ENABLED = false` in code, the production bundle ships no music regardless of whether the files are present — but having them on disk means flipping the flag later is a code-only deploy.

The doc emphasizes that step 2 is non-optional — losing the files on the VPS is recoverable from the laptop, but only if the laptop copy exists. Treat the laptop copy as the source of truth.

## Open questions (deferred to planning or later)

- **Where exactly does the `MUSIC_ENABLED` const live?** Candidates: a new `frontend/src/config/features.ts`, a top-level export in `tracks.ts`, or a top-level export in `MusicContext.tsx`. Planning to pick the most natural location given existing patterns.
- **History rewrite (`git filter-repo`)?** Deferred. Pros: permanently slimmer clones, removes any licensing residue from history. Cons: force-push to `main`, breaks any existing clones, including the VPS unless re-cloned. Revisit if licensing concern escalates or if repo size starts hurting.
- **Should `scripts/upload-music.sh` also back up the VPS copy before overwriting?** Probably yes; cheap safety. Planning to confirm.
- **Should the upload script live alongside `deploy.sh` or in `scripts/`?** Likely `scripts/` given the existing `scripts/upload-questions.sh` precedent.

## Dependencies / assumptions

- The current `MusicProvider` already gracefully handles `TRACKS.length === 0` (early-returns in `ensureAudio`). Verified in `frontend/src/contexts/MusicContext.tsx:56`. A pass-through wrapper around children when the flag is off keeps the React tree shape unchanged.
- The navbar mute button is rendered in `frontend/src/components/ui/Navigation/Navigation.tsx`; gating its render on `MUSIC_ENABLED` is straightforward.
- `import.meta.glob` is a Vite built-in; no new dependency required.
- `frontend/src/assets/music/README.md` (if present) stays tracked — only the `.mp3` files are gitignored.
- Production deploys build on the VPS itself (`deploy.sh` runs `npm run build` in-place), so the build environment has whatever the VPS filesystem has — which is fine because the flag, not file presence, is the canonical gate.

## Related files

- `frontend/src/assets/music/tracks.ts` — replace static `new URL` list with `import.meta.glob`
- `frontend/src/contexts/MusicContext.tsx` — short-circuit when flag is off
- `frontend/src/components/ui/Navigation/Navigation.tsx` — hide mute button when flag is off
- `frontend/src/App.tsx` — possibly skip mounting `MusicProvider` entirely when flag is off (planning to decide)
- `.gitignore` — add `frontend/src/assets/music/*.mp3`
- `scripts/upload-music.sh` (new) — rsync helper, modeled on `scripts/upload-questions.sh`
- `deploy.sh` — no changes expected; the build is flag-aware, not file-aware
