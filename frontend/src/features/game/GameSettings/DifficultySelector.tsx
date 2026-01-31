import styles from "./DifficultySelector.module.css";

const DIFFICULTY_OPTIONS = [
  { value: "enjoyer", label: "Enjoyer" },
  { value: "master", label: "Master" },
  { value: "beast", label: "BEAST" },
] as const;

type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]["value"];

interface Props {
  isHost: boolean;
  currentDifficulty: string;
  onSelect: (difficulty: Difficulty) => void;
}

export function DifficultySelector({ isHost, currentDifficulty, onSelect }: Props) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>Difficulty</span>
      <div
        className={`${styles.track} ${!isHost ? styles.trackDisabled : ""}`}
        title={isHost ? undefined : "Only the host can change settings"}
      >
        {DIFFICULTY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.pill} ${
              currentDifficulty === option.value
                ? styles[`pill${option.value.charAt(0).toUpperCase()}${option.value.slice(1)}`]
                : ""
            }`}
            disabled={!isHost}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
