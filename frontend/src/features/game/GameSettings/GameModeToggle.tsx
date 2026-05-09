import { Box } from "@mui/material";

type GameMode = "classic" | "speed_battle";

const GAME_MODE_OPTIONS: { value: GameMode; label: string; description: string }[] = [
  {
    value: "classic",
    label: "Classic",
    description: "Take turns, discuss answers, and score together.",
  },
  {
    value: "speed_battle",
    label: "Speed Battle",
    description: "Solo race — wrong answers lock you out for 5 s.",
  },
];

const CARD_SELECTED_STYLES: Record<GameMode, object> = {
  classic: {
    background: "rgba(45, 212, 191, 0.1)",
    borderColor: "var(--color-accent-teal)",
    color: "var(--color-accent-teal)",
    boxShadow: "0 0 10px rgba(45, 212, 191, 0.25)",
  },
  speed_battle: {
    background: "rgba(251, 191, 36, 0.1)",
    borderColor: "var(--color-accent-gold)",
    color: "var(--color-accent-gold)",
    boxShadow: "0 0 10px rgba(251, 191, 36, 0.25)",
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
        gap: 3,
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
          flexDirection: "column",
          gap: 2,
          opacity: isHost ? 1 : 0.5,
          cursor: isHost ? undefined : "not-allowed",
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
                width: "100%",
                py: 3,
                px: 4,
                fontFamily: "var(--font-display)",
                letterSpacing: "0.5px",
                background: "var(--color-bg-hover)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                transition: "all var(--transition-base)",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                "&:hover:not(:disabled)": {
                  color: "var(--color-text-primary)",
                  background: "var(--color-bg-elevated)",
                  borderColor: "var(--color-border-default)",
                },
                "&:disabled": {
                  cursor: "not-allowed",
                },
                "&:focus-visible": {
                  outline: "2px solid var(--color-accent-purple)",
                  outlineOffset: "2px",
                },
                ...(isSelected ? CARD_SELECTED_STYLES[option.value] : {}),
              }}
            >
              <Box
                component="span"
                sx={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                {option.label}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: "var(--font-size-xs)",
                  color: isSelected ? "inherit" : "var(--color-text-dim)",
                  fontFamily: "inherit",
                  fontWeight: 400,
                  lineHeight: 1.4,
                  opacity: 0.85,
                }}
              >
                {option.description}
              </Box>
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
