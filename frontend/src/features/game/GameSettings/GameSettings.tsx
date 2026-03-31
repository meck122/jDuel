import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { DifficultySelector } from "./DifficultySelector";
import { MultipleChoiceToggle } from "./MultipleChoiceToggle";

export function GameSettings() {
  const { playerId, roomState, updateConfig } = useGame();
  const isHost = roomState?.hostId === playerId;

  return (
    <Box
      sx={{
        width: { xs: "100%", md: 280 },
        flexShrink: 0,
        p: { xs: 0, md: 5 },
        background: { xs: "transparent", md: "rgba(139, 92, 246, 0.06)" },
        border: { xs: "none", md: "1px solid rgba(139, 92, 246, 0.3)" },
        borderRadius: "var(--radius-lg)",
        boxShadow: { xs: "none", md: "0 4px 16px rgba(139, 92, 246, 0.12)" },
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
        enabled={roomState?.config?.multipleChoiceEnabled ?? false}
        onToggle={(enabled) => updateConfig({ multipleChoiceEnabled: enabled })}
      />
    </Box>
  );
}
