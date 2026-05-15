import { useContext } from "react";
import { MusicContext, MusicContextValue } from "./MusicContext";

/**
 * Hook to access music context.
 * Must be used within a MusicProvider.
 */
export function useMusic(): MusicContextValue {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
}
