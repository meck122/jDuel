import styles from "./MultipleChoiceToggle.module.css";

interface Props {
  isHost: boolean;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function MultipleChoiceToggle({ isHost, enabled, onToggle }: Props) {
  return (
    <label
      className={`${styles.toggle} ${!isHost ? styles.toggleDisabled : ""}`}
      title={isHost ? undefined : "Only the host can change settings"}
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={enabled}
        disabled={!isHost}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className={styles.slider} />
      <span className={styles.label}>Multiple Choice</span>
    </label>
  );
}
