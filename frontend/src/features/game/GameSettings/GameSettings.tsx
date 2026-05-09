import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { DifficultySelector } from "./DifficultySelector";
import { GameModeToggle } from "./GameModeToggle";
import { MultipleChoiceToggle } from "./MultipleChoiceToggle";

export function GameSettings() {
  const { playerId, roomState, updateConfig } = useGame();
  const isHost = roomState?.hostId === playerId;
  const currentMode = roomState?.config?.gameMode ?? "classic";
  const mcForced = currentMode === "speed_battle";

  return (
    <Box
      sx={{
        width: { xs: "100%", md: 300 },
        flexShrink: 0,
        p: { xs: 0, md: 6 },
        background: { xs: "transparent", md: "var(--color-bg-elevated)" },
        border: { xs: "none", md: "2px solid var(--color-accent-purple)" },
        borderRadius: "var(--radius-lg)",
        boxShadow: { xs: "none", md: "var(--shadow-glow-purple)" },
        display: "flex",
        flexDirection: "column",
        gap: { xs: 4, md: 5 },
      }}
    >
      <Box
        component="h3"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--font-size-lg)",
          color: "var(--color-accent-purple)",
          letterSpacing: "1px",
          m: 0,
          mb: 2,
          pb: 2,
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        Game Settings
      </Box>
      <DifficultySelector
        isHost={isHost}
        currentDifficulty={roomState?.config?.difficulty ?? "enjoyer"}
        onSelect={(difficulty) => updateConfig({ difficulty })}
      />
      <MultipleChoiceToggle
        isHost={isHost}
        enabled={mcForced ? true : (roomState?.config?.multipleChoiceEnabled ?? false)}
        forced={mcForced}
        onToggle={(enabled) => updateConfig({ multipleChoiceEnabled: enabled })}
      />
      <GameModeToggle
        isHost={isHost}
        currentMode={currentMode}
        onSelect={(mode) => {
          if (mode === "speed_battle") {
            const mcCurrentlyOn = roomState?.config?.multipleChoiceEnabled ?? false;
            if (mcCurrentlyOn) {
              updateConfig({ gameMode: "speed_battle" });
            } else {
              updateConfig({ gameMode: "speed_battle", multipleChoiceEnabled: true });
            }
          } else {
            updateConfig({ gameMode: mode });
          }
        }}
      />
    </Box>
  );
}
