/**
 * Music track manifest for opt-in background music.
 *
 * Add an entry for each `.mp3` file in this directory. Vite fingerprints
 * and bundles each URL at build time via `new URL(..., import.meta.url)`.
 *
 * Example:
 *   new URL("./ambient-01.mp3", import.meta.url),
 */

export const TRACKS: readonly URL[] = [];
