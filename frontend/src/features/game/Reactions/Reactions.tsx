/**
 * Reactions - Playful trash-talk emotes during results / game over.
 *
 * Renders two things:
 * - A fixed bottom button bar for firing reactions
 * - A floating feed showing reactions received from all players
 *
 * Reactions arrive via a module-level emitter (reactionEmitter) rather than
 * React context. Context state updates originating from native WebSocket
 * events are deferred by React 19's automatic batching, which would cause
 * reactions to appear one click behind. The emitter notifies this component
 * directly; the resulting local setState is batched and flushed at the end
 * of the same WebSocket onmessage event — fast enough to be imperceptible.
 *
 * Local state is naturally cleared when this component unmounts (i.e. when
 * the game leaves the results/finished phase), so no explicit reset is needed.
 *
 * Cooldown is enforced server-side (3s). The client mirrors it locally
 * to disable buttons as a UX hint.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "../../../contexts";
import { subscribeToReactions } from "../../../services/reactionEmitter";
import { Reaction } from "../../../types";
import styles from "./Reactions.module.css";

const COOLDOWN_MS = 3000;

export function Reactions() {
  const { sendReaction, roomState } = useGame();
  const availableReactions = roomState?.reactions ?? [];
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const lastSentAt = useRef<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Subscribe to incoming reactions from the WebSocket emitter
  useEffect(() => {
    return subscribeToReactions((reaction) => {
      setReactions((prev) => [...prev, reaction]);
    });
  }, []);

  // Cooldown countdown tick — updates button disabled state every 100ms
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        const next = prev - 100;
        return next <= 0 ? 0 : next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const handleReaction = useCallback(
    (id: number) => {
      const now = Date.now();
      if (now - lastSentAt.current < COOLDOWN_MS) return;
      lastSentAt.current = now;
      setCooldownRemaining(COOLDOWN_MS);
      sendReaction(id);
    },
    [sendReaction]
  );

  return (
    <>
      {/* Reaction feed — floating overlay, newest at top */}
      <div className={styles.feed}>
        {[...reactions].reverse().map((r) => {
          const reaction = availableReactions.find((ar) => ar.id === r.reactionId);
          if (!reaction) return null;
          return (
            <div key={`${r.playerId}-${r.receivedAt}`} className={styles.feedItem}>
              <span className={styles.feedPlayer}>{r.playerId}</span>
              <span className={styles.feedLabel}>{reaction.label}</span>
            </div>
          );
        })}
      </div>

      {/* Reaction button bar — fixed bottom */}
      <div className={styles.buttonBar}>
        {availableReactions.map((reaction) => (
          <button
            key={reaction.id}
            className={styles.reactionButton}
            onClick={() => handleReaction(reaction.id)}
            disabled={cooldownRemaining > 0}
          >
            {reaction.label}
          </button>
        ))}
      </div>
    </>
  );
}
