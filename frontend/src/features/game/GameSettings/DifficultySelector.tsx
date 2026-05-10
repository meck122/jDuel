import { Box } from "@mui/material";

const DIFFICULTY_OPTIONS = [
  { value: "baby", label: "Googoo-Gaga" },
  { value: "enjoyer", label: "Enjoyer" },
  { value: "master", label: "Master" },
  { value: "beast", label: "Beast" },
] as const;

type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]["value"];

interface Props {
  isHost: boolean;
  currentDifficulty: string;
  onSelect: (difficulty: Difficulty) => void;
}

export function DifficultySelector({ isHost, currentDifficulty, onSelect }: Props) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Section label */}
      <Box
        component="span"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: "11px",
          color: "var(--color-text-muted)",
          letterSpacing: "1px",
        }}
      >
        Difficulty
      </Box>

      {/* Segmented control */}
      <Box
        title={isHost ? undefined : "Only the host can change settings"}
        sx={{
          display: "flex",
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-md)",
          p: "2px",
          gap: "2px",
          opacity: isHost ? 1 : 0.5,
          cursor: isHost ? undefined : "not-allowed",
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
                flex: 1,
                py: "5px",
                px: 0,
                fontFamily: "var(--font-display)",
                fontSize: "11px",
                letterSpacing: "0.5px",
                background: isSelected ? "rgba(139,92,246,0.2)" : "transparent",
                border: "none",
                borderRadius: "calc(var(--radius-md) - 2px)",
                color: isSelected ? "var(--color-accent-teal)" : "var(--color-text-muted)",
                cursor: isHost ? "pointer" : "not-allowed",
                transition: "all var(--transition-base)",
                "&:hover:not(:disabled)": {
                  color: "var(--color-text-primary)",
                  background: "rgba(139,92,246,0.1)",
                },
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
