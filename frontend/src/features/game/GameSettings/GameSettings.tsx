import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { DifficultySelector } from "./DifficultySelector";
import { GameModeToggle } from "./GameModeToggle";
import { MultipleChoiceToggle } from "./MultipleChoiceToggle";

export function GameSettings() {
  const { playerId, roomState, updateConfig } = useGame();
  const isHost = roomState?.hostId === playerId;
  const currentMode = roomState?.config?.gameMode ?? "speed_battle";
  const mcForced = currentMode === "speed_battle";

  return (
    <Box
      sx={{
        width: { xs: "100%", md: 280 },
        flexShrink: 0,
        p: { xs: 0, md: "22px" },
        background: { xs: "transparent", md: "var(--color-bg-elevated)" },
        border: { xs: "none", md: "2px solid var(--color-border-default)" },
        borderRadius: "var(--radius-lg)",
        boxShadow: { xs: "none", md: "var(--shadow-lg)" },
        display: "flex",
        flexDirection: "column",
        gap: { xs: 4, md: 4 },
      }}
    >
      <Box
        component="h3"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--font-size-md)",
          color: "var(--color-accent-purple)",
          letterSpacing: "1px",
          m: 0,
          mb: 1,
          pb: 2,
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        Game Settings
      </Box>
      <DifficultySelector
        isHost={isHost}
        currentDifficulty={roomState?.config?.difficulty ?? "baby"}
        onSelect={(difficulty) => updateConfig({ difficulty })}
      />
      <MultipleChoiceToggle
        isHost={isHost}
        enabled={mcForced ? true : (roomState?.config?.multipleChoiceEnabled ?? false)}
        forced={mcForced}
        onToggle={(enabled) => updateConfig({ multipleChoiceEnabled: enabled })}
      />
      {/* Divider between settings and game mode — matches design */}
      <Box sx={{ height: "1px", background: "var(--color-border-subtle)", mx: "-4px" }} />
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
