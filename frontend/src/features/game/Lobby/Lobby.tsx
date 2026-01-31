/**
 * Lobby - Waiting room displayed before game starts.
 *
 * Shows:
 * - Room code and share link
 * - List of joined players
 * - Start game button
 */

import { useState } from "react";
import { useGame } from "../../../contexts";
import { PlayerName } from "../../../components";
import styles from "./Lobby.module.css";

export function Lobby() {
  const { roomId, playerId, roomState, startGame, updateConfig } = useGame();
  const [copied, setCopied] = useState(false);

  const players = roomState?.players ?? {};
  const playerCount = Object.keys(players).length;
  const isHost = roomState?.hostId === playerId;
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
          <button
            onClick={handleCopyLink}
            className={styles.copyButton}
            title="Copy invite link"
          >
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
            </div>
          </div>
        ))}
      </div>

      <div className={styles.configSection}>
        <label
          className={`${styles.configToggle} ${!isHost ? styles.configToggleDisabled : ""}`}
          title={isHost ? undefined : "Only the host can change settings"}
        >
          <input
            type="checkbox"
            className={styles.configCheckbox}
            checked={roomState?.config?.multipleChoiceEnabled ?? false}
            disabled={!isHost}
            onChange={(e) =>
              updateConfig({ multipleChoiceEnabled: e.target.checked })
            }
          />
          <span className={styles.configSlider} />
          <span className={styles.configLabel}>Multiple Choice</span>
        </label>
      </div>

      <div className={styles.waitingSection}>
        <p className={styles.waitingText}>Waiting for players to join...</p>
        <button onClick={startGame} className={styles.startButton}>
          Start Game
        </button>
      </div>
    </div>
  );
}
