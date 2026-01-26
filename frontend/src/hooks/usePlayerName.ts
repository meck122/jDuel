/**
 * usePlayerName - Shared hook for managing player name in localStorage.
 *
 * Provides consistent player name persistence across the app.
 */

import { useState } from "react";

const PLAYER_NAME_KEY = "jduel_player_name";

interface UsePlayerNameReturn {
  playerName: string;
  setPlayerName: (name: string) => void;
}

export function usePlayerName(initialValue: string = ""): UsePlayerNameReturn {
  // Initialize synchronously from localStorage to avoid race conditions
  const [playerName, setPlayerNameState] = useState<string>(() => {
    if (initialValue) return initialValue;
    return localStorage.getItem(PLAYER_NAME_KEY) || "";
  });

  // Save to localStorage and update state
  const setPlayerName = (name: string) => {
    setPlayerNameState(name);
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(PLAYER_NAME_KEY, trimmed);
    }
  };

  return {
    playerName,
    setPlayerName,
  };
}
