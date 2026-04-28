import { Box } from "@mui/material";

type GameMode = "classic" | "speed_battle";

const GAME_MODE_OPTIONS: { value: GameMode; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "speed_battle", label: "Speed Battle" },
];

const PILL_SELECTED_STYLES: Record<GameMode, object> = {
  classic: {
    background: "rgba(45, 212, 191, 0.15)",
    borderColor: "var(--color-accent-teal)",
    color: "var(--color-accent-teal)",
    boxShadow: "0 0 8px rgba(45, 212, 191, 0.3)",
  },
  speed_battle: {
    background: "rgba(255, 183, 77, 0.15)",
    borderColor: "var(--color-accent-gold)",
    color: "var(--color-accent-gold)",
    boxShadow: "0 0 8px rgba(255, 183, 77, 0.3)",
  },
};

const RULES_COPY =
  "3-minute solo race — wrong answers lock you for 5 seconds and reveal the correct answer.";

interface Props {
  isHost: boolean;
  currentMode: GameMode;
  onSelect: (mode: GameMode) => void;
}

export function GameModeToggle({ isHost, currentMode, onSelect }: Props) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 4,
      }}
    >
      <Box
        component="span"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--font-size-base)",
          color: "var(--color-text-primary)",
          letterSpacing: "0.5px",
        }}
      >
        Game Mode
      </Box>
      <Box
        role="radiogroup"
        aria-label="Game Mode"
        title={isHost ? undefined : "Only the host can change settings"}
        sx={{
          display: "flex",
          gap: 1,
          background: "var(--color-bg-hover)",
          border: "2px solid var(--color-border-default)",
          borderRadius: "var(--radius-md)",
          p: 1,
          opacity: isHost ? 1 : 0.5,
          cursor: isHost ? undefined : "not-allowed",
          width: { xs: "100%", sm: "auto" },
        }}
      >
        {GAME_MODE_OPTIONS.map((option) => {
          const isSelected = currentMode === option.value;
          return (
            <Box
              key={option.value}
              component="button"
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!isHost}
              onClick={() => onSelect(option.value)}
              sx={{
                flex: { xs: 1, sm: "initial" },
                py: { xs: 2, sm: 4 },
                px: { xs: 1, sm: 4 },
                fontFamily: "var(--font-display)",
                fontSize: { xs: "var(--font-size-xs)", sm: "var(--font-size-sm)" },
                fontWeight: 600,
                letterSpacing: "0.5px",
                background: "rgba(255,255,255,0.04)",
                border: "2px solid rgba(255,255,255,0.08)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                transition: "all var(--transition-base)",
                textAlign: "center",
                "&:hover:not(:disabled)": {
                  color: "var(--color-text-primary)",
                  background: "var(--color-bg-elevated)",
                },
                "&:disabled": {
                  cursor: "not-allowed",
                },
                "&:focus-visible": {
                  outline: "2px solid var(--color-accent-purple)",
                  outlineOffset: "2px",
                },
                ...(isSelected ? PILL_SELECTED_STYLES[option.value] : {}),
              }}
            >
              {option.label}
            </Box>
          );
        })}
      </Box>
      <Box aria-live="polite">
        {currentMode === "speed_battle" && (
          <Box
            component="p"
            sx={{
              m: 0,
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-dim)",
              lineHeight: 1.5,
            }}
          >
            {RULES_COPY}
          </Box>
        )}
      </Box>
    </Box>
  );
}
