/**
 * Music track manifest for opt-in background music.
 *
 * Add an entry for each `.mp3` file in this directory. Vite fingerprints
 * and bundles each URL at build time via `new URL(..., import.meta.url)`.
 */

export const TRACKS: readonly URL[] = [
  new URL("./brass-button-bounce.mp3", import.meta.url),
  new URL("./brass-button-bounce-2.mp3", import.meta.url),
  new URL("./chrome-riot.mp3", import.meta.url),
  new URL("./drive.mp3", import.meta.url),
  new URL("./drive-2.mp3", import.meta.url),
  new URL("./lonely-signal.mp3", import.meta.url),
  new URL("./lonely-signal-2.mp3", import.meta.url),
  new URL("./lonely-signal-3.mp3", import.meta.url),
  new URL("./neon-ticket.mp3", import.meta.url),
  new URL("./neon-ticket-2.mp3", import.meta.url),
  new URL("./starfall-circuit.mp3", import.meta.url),
  new URL("./starfall-circuit-2.mp3", import.meta.url),
];
