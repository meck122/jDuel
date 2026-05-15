/**
 * useMusicPreference - Persist the opt-in music preference in localStorage.
 *
 * Mirrors the shape of usePlayerName: initialized synchronously from
 * localStorage to avoid a visible flicker between default-off and the
 * remembered preference on a returning visit.
 */

import { useState } from "react";

const MUSIC_PREFERENCE_KEY = "jduel_music_preference";

export type MusicPreference = "on" | "off";

interface UseMusicPreferenceReturn {
  preference: MusicPreference;
  setPreference: (value: MusicPreference) => void;
}

function readStoredPreference(): MusicPreference {
  return localStorage.getItem(MUSIC_PREFERENCE_KEY) === "on" ? "on" : "off";
}

export function useMusicPreference(): UseMusicPreferenceReturn {
  const [preference, setPreferenceState] = useState<MusicPreference>(readStoredPreference);

  const setPreference = (value: MusicPreference) => {
    setPreferenceState(value);
    localStorage.setItem(MUSIC_PREFERENCE_KEY, value);
  };

  return { preference, setPreference };
}
