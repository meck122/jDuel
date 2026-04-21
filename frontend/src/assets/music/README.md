# Background music tracks

Drop `.mp3` files into this directory and register each one in `tracks.ts`:

```ts
export const TRACKS: readonly URL[] = [
  new URL("./ambient-01.mp3", import.meta.url),
  new URL("./ambient-02.mp3", import.meta.url),
];
```

Vite fingerprints and bundles each URL at build time — no runtime fetch.

## Volume guidance

Master tracks quietly. There is no volume slider in the UI; the player runs at a fixed 40% volume to stay unobtrusive during gameplay and voice chat. Target around **-12 LUFS integrated** with no brick-walled peaks.

## Rotation

When two or more tracks are present, the player picks randomly with no repeat-in-a-row. With one track, it loops.
