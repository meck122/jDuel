import { Box } from "@mui/material";

const DIFFICULTY_OPTIONS = [
  { value: "enjoyer", label: "Enjoyer" },
  { value: "master", label: "Master" },
  { value: "beast", label: "BEAST" },
] as const;

type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]["value"];

// Per-difficulty selected pill styles
const PILL_SELECTED_STYLES: Record<Difficulty, object> = {
  enjoyer: {
    background: "rgba(45, 212, 191, 0.15)",
    borderColor: "var(--color-accent-teal)",
    color: "var(--color-accent-teal)",
    boxShadow: "0 0 8px rgba(45, 212, 191, 0.3)",
  },
  master: {
    background: "rgba(139, 92, 246, 0.15)",
    borderColor: "var(--color-accent-purple)",
    color: "var(--color-accent-purple)",
    boxShadow: "0 0 8px rgba(139, 92, 246, 0.3)",
  },
  beast: {
    background: "rgba(255, 183, 77, 0.15)",
    borderColor: "var(--color-accent-gold)",
    color: "var(--color-accent-gold)",
    boxShadow: "0 0 8px rgba(255, 183, 77, 0.3)",
  },
};

interface Props {
  isHost: boolean;
  currentDifficulty: string;
  onSelect: (difficulty: Difficulty) => void;
}

export function DifficultySelector({ isHost, currentDifficulty, onSelect }: Props) {
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
        Difficulty
      </Box>
      <Box
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
        {DIFFICULTY_OPTIONS.map((option) => {
          const isSelected = currentDifficulty === option.value;
          return (
            <Box
              key={option.value}
              component="button"
              type="button"
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
                background: "transparent",
                border: "2px solid transparent",
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
                ...(isSelected ? PILL_SELECTED_STYLES[option.value] : {}),
              }}
            >
              {option.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
