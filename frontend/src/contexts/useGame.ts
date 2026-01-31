import { useContext } from "react";
import { GameContext, GameContextValue } from "./GameContext";

/**
 * Hook to access game context.
 * Must be used within a GameProvider.
 */
export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
