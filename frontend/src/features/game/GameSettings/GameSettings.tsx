import { useGame } from "../../../contexts";
import { DifficultySelector } from "./DifficultySelector";
import { MultipleChoiceToggle } from "./MultipleChoiceToggle";
import styles from "./GameSettings.module.css";

export function GameSettings() {
  const { playerId, roomState, updateConfig } = useGame();
  const isHost = roomState?.hostId === playerId;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Game Settings</h3>
      <DifficultySelector
        isHost={isHost}
        currentDifficulty={roomState?.config?.difficulty ?? "enjoyer"}
        onSelect={(difficulty) => updateConfig({ difficulty })}
      />
      <MultipleChoiceToggle
        isHost={isHost}
        enabled={roomState?.config?.multipleChoiceEnabled ?? false}
        onToggle={(enabled) => updateConfig({ multipleChoiceEnabled: enabled })}
      />
    </div>
  );
}
