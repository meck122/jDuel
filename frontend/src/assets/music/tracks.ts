/**
 * Music track manifest for opt-in background music.
 *
 * Drop any .mp3 file into this directory and rebuild — Vite will pick it up
 * automatically via import.meta.glob. When MUSIC_ENABLED is false the glob is
 * skipped entirely and no audio bytes are included in the bundle.
 *
 * To add tracks on the VPS: see scripts/upload-music.sh.
 */

import { MUSIC_ENABLED } from "../../config/features";

const modules = MUSIC_ENABLED
  ? (import.meta.glob<{ default: string }>("./*.mp3", { eager: true }) as Record<
      string,
      { default: string }
    >)
  : {};

export const TRACKS: readonly string[] = Object.values(modules).map((m) => m.default);
