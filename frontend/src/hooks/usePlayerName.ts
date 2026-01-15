/**
 * usePlayerName - Shared hook for managing player name in localStorage.
 *
 * Provides consistent player name persistence across the app.
 */

import { useState, useEffect, useCallback } from "react";

const PLAYER_NAME_KEY = "jduel_player_name";

interface UsePlayerNameReturn {
  playerName: string;
  setPlayerName: (name: string) => void;
  savedName: string | null;
}

export function usePlayerName(initialValue: string = ""): UsePlayerNameReturn {
  const [playerName, setPlayerNameState] = useState<string>(initialValue);
  const [savedName, setSavedName] = useState<string | null>(null);

  // Load saved name on mount
  useEffect(() => {
    const saved = localStorage.getItem(PLAYER_NAME_KEY);
    setSavedName(saved);
    if (saved && !initialValue) {
      setPlayerNameState(saved);
    }
  }, [initialValue]);

  // Save to localStorage and update state
  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(PLAYER_NAME_KEY, trimmed);
      setSavedName(trimmed);
    }
  }, []);

  return {
    playerName,
    setPlayerName,
    savedName,
  };
}
