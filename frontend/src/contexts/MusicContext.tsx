/**
 * MusicContext - Opt-in background music playback.
 *
 * Owns a single HTMLAudioElement at the App-root level so playback survives
 * route changes. Music is off by default (WCAG 1.4.2). The first click of
 * the mute/unmute control serves as both the preference change and the
 * user gesture that satisfies browser autoplay policy.
 *
 * On returning visits with preference "on", an initial play() attempt is
 * made at mount. If the browser blocks autoplay, a one-shot listener
 * (pointerdown + keydown) retries play on the next user gesture and then
 * detaches.
 *
 * Track rotation: shuffle with no-repeat-in-a-row when N >= 2; loop when
 * N = 1; no-op when the manifest is empty.
 *
 * When MUSIC_ENABLED is false, MusicProvider renders a stub context so
 * useMusic() callers never throw, but creates no Audio element and attaches
 * no listeners. This is implemented via a two-component split to respect
 * the Rules of Hooks (no hooks after a conditional return).
 */

import { createContext, useCallback, useEffect, useRef, ReactNode } from "react";
import { TRACKS } from "../assets/music/tracks";
import { MusicPreference, useMusicPreference } from "../hooks/useMusicPreference";
import { MUSIC_ENABLED } from "../config/features";

const VOLUME = 0.4;

export interface MusicContextValue {
  preference: MusicPreference;
  toggle: () => void;
  skip: () => void;
}

// Context must be exported for useMusic hook in separate file
// eslint-disable-next-line react-refresh/only-export-components
export const MusicContext = createContext<MusicContextValue | null>(null);

const STUB_VALUE: MusicContextValue = { preference: "off", toggle: () => {}, skip: () => {} };

interface MusicProviderProps {
  children: ReactNode;
}

function pickNextTrack(current: string | null): string | null {
  if (TRACKS.length === 0) return null;
  if (TRACKS.length === 1) return TRACKS[0];
  // Choose uniformly from tracks that are not the current one.
  const candidates = current ? TRACKS.filter((t) => t !== current) : TRACKS;
  const pool = candidates.length > 0 ? candidates : TRACKS;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/** Inner provider — only rendered when MUSIC_ENABLED is true. Contains all hooks. */
function ActiveMusicProvider({ children }: MusicProviderProps) {
  const { preference, setPreference } = useMusicPreference();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef<string | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);

  // Ensure a single audio element exists and is configured. Returns it.
  const ensureAudio = useCallback((): HTMLAudioElement | null => {
    if (TRACKS.length === 0) return null;
    if (!audioRef.current) {
      const audio = new Audio();
      audio.volume = VOLUME;
      audio.preload = "auto";
      audio.addEventListener("ended", () => {
        const next = pickNextTrack(playingRef.current);
        if (!next || !audioRef.current) return;
        playingRef.current = next;
        audioRef.current.src = next;
        void audioRef.current.play().catch(() => {
          // Autoplay after an 'ended' event only fails if the tab loses
          // audio permission mid-session (rare). No recovery needed; next
          // user interaction will restart playback via toggle.
        });
      });
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const detachGestureListener = useCallback(() => {
    if (gestureCleanupRef.current) {
      gestureCleanupRef.current();
      gestureCleanupRef.current = null;
    }
  }, []);

  const installGestureListener = useCallback(() => {
    detachGestureListener();
    const retry = () => {
      const audio = audioRef.current;
      gestureCleanupRef.current = null;
      document.removeEventListener("pointerdown", retry);
      document.removeEventListener("keydown", retry);
      document.removeEventListener("touchstart", retry);
      if (audio) {
        void audio.play().catch(() => {
          // Give up silently — user can click the mute button to retry.
        });
      }
    };
    document.addEventListener("pointerdown", retry, { once: true });
    document.addEventListener("keydown", retry, { once: true });
    document.addEventListener("touchstart", retry, { once: true });
    gestureCleanupRef.current = () => {
      document.removeEventListener("pointerdown", retry);
      document.removeEventListener("keydown", retry);
      document.removeEventListener("touchstart", retry);
    };
  }, [detachGestureListener]);

  const startPlayback = useCallback(() => {
    const audio = ensureAudio();
    if (!audio) return;
    if (!playingRef.current) {
      const next = pickNextTrack(null);
      if (!next) return;
      playingRef.current = next;
      audio.src = next;
    }
    audio.play().catch(() => {
      // Autoplay blocked — wait for the next user gesture.
      installGestureListener();
    });
  }, [ensureAudio, installGestureListener]);

  const stopPlayback = useCallback(() => {
    detachGestureListener();
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [detachGestureListener]);

  const skip = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || preference !== "on") return;
    const next = pickNextTrack(playingRef.current);
    if (!next) return;
    playingRef.current = next;
    audio.src = next;
    void audio.play().catch(() => {});
  }, [preference]);

  const toggle = useCallback(() => {
    if (preference === "on") {
      setPreference("off");
      stopPlayback();
    } else {
      setPreference("on");
      // A click handler is a valid user gesture; play() should succeed.
      startPlayback();
    }
  }, [preference, setPreference, startPlayback, stopPlayback]);

  // Initial attempt for returning visitors with preference = "on".
  useEffect(() => {
    if (preference === "on") {
      startPlayback();
    }
    return () => {
      detachGestureListener();
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
        audioRef.current = null;
      }
    };
    // Intentionally empty deps — this effect mounts once. Preference changes
    // are handled by toggle(), not by re-running this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: MusicContextValue = { preference, toggle, skip };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function MusicProvider({ children }: MusicProviderProps) {
  if (!MUSIC_ENABLED) {
    return <MusicContext.Provider value={STUB_VALUE}>{children}</MusicContext.Provider>;
  }
  return <ActiveMusicProvider>{children}</ActiveMusicProvider>;
}
