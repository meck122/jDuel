/**
 * PlayerName - Displays a player name with optional "(You)" badge.
 *
 * Automatically shows "(You)" when the displayed player matches
 * the current user from GameContext.
 */

import { useGame } from "../../../contexts";
import styles from "./PlayerName.module.css";

interface PlayerNameProps {
  /** The player ID to display */
  playerId: string;
  /** Additional CSS class for the container */
  className?: string;
  /** Whether to show the "(You)" badge. Default: true */
  showYouBadge?: boolean;
}

export function PlayerName({ playerId, className, showYouBadge = true }: PlayerNameProps) {
  const { playerId: currentPlayerId } = useGame();
  const isCurrentPlayer = playerId === currentPlayerId;

  return (
    <span className={className}>
      {playerId}
      {showYouBadge && isCurrentPlayer && <span className={styles.youBadge}> (You)</span>}
    </span>
  );
}
