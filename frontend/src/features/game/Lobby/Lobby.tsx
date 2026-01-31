/**
 * Lobby - Waiting room displayed before game starts.
 *
 * Shows:
 * - Room code and share link
 * - List of joined players with host badge
 * - Difficulty selector (host only)
 * - Multiple choice toggle (host only)
 * - Start game button (host only)
 */

import { useState } from "react";
import { useGame } from "../../../contexts";
import { PlayerName } from "../../../components";
import { GameSettings } from "../GameSettings";
import styles from "./Lobby.module.css";

export function Lobby() {
  const { roomId, playerId, roomState, startGame } = useGame();
  const [copied, setCopied] = useState(false);

  const players = roomState?.players ?? {};
  const playerCount = Object.keys(players).length;
  const isHost = roomState?.hostId === playerId;
  const hostId = roomState?.hostId;
  const shareUrl = `${window.location.origin}/room/${roomId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={styles.lobbyWrapper}>
      <div className={styles.lobbyContainer}>
        <div className={styles.header}>
          <h2 className={styles.title}>Room {roomId}</h2>
          <div className={styles.playerCount}>
            {playerCount} Player{playerCount !== 1 ? "s" : ""} Joined
          </div>
        </div>

        {/* Share Section */}
        <div className={styles.shareSection}>
          <p className={styles.shareText}>Invite friends to join:</p>
          <div className={styles.shareRow}>
            <code className={styles.shareUrl}>{shareUrl}</code>
            <button onClick={handleCopyLink} className={styles.copyButton} title="Copy invite link">
              {copied ? "✓ Copied!" : "📋 Copy"}
            </button>
          </div>
        </div>

        <div className={styles.playersGrid}>
          {Object.keys(players).map((player) => (
            <div
              key={player}
              className={`${styles.playerCard} ${player === playerId ? styles.currentPlayer : ""}`}
            >
              <div className={styles.playerIcon}>👤</div>
              <div className={styles.playerName}>
                <PlayerName playerId={player} />
                {player === hostId && <span className={styles.hostBadge}>Host</span>}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.waitingSection}>
          <p className={styles.waitingText}>
            {isHost
              ? "Press Start when everyone's ready!"
              : "Waiting for host to start the game..."}
          </p>
          {isHost && (
            <button onClick={startGame} className={styles.startButton}>
              Start Game
            </button>
          )}
        </div>
      </div>

      <GameSettings />
    </div>
  );
}
