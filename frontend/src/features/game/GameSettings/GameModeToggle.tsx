import { Box } from "@mui/material";

type GameMode = "classic" | "speed_battle";

const GAME_MODE_OPTIONS: { value: GameMode; label: string; icon: string }[] = [
  { value: "classic", label: "Classic", icon: "🎮" },
  { value: "speed_battle", label: "Speed Battle", icon: "⚡" },
];

const RULES_COPY =
  "3-minute race — answer as many as you can. Wrong answers lock you for 5s and reveal the correct answer.";

interface Props {
  isHost: boolean;
  currentMode: GameMode;
  onSelect: (mode: GameMode) => void;
}

export function GameModeToggle({ isHost, currentMode, onSelect }: Props) {
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
        Game Mode
      </Box>

      <Box
        role="radiogroup"
        aria-label="Game Mode"
        title={isHost ? undefined : "Only the host can change settings"}
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          opacity: isHost ? 1 : 0.5,
          cursor: isHost ? undefined : "not-allowed",
        }}
      >
        {GAME_MODE_OPTIONS.map((option) => {
          const isSelected = currentMode === option.value;
          const isSpeed = option.value === "speed_battle";
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
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: "9px",
                px: 2,
                fontFamily: "var(--font-display)",
                fontSize: "13px",
                letterSpacing: "1px",
                background: isSelected
                  ? isSpeed
                    ? "rgba(251,191,36,0.1)"
                    : "rgba(139,92,246,0.12)"
                  : "var(--color-bg-elevated)",
                border: "2px solid",
                borderColor: isSelected
                  ? isSpeed
                    ? "rgba(251,191,36,0.6)"
                    : "var(--color-accent-purple)"
                  : "var(--color-border-default)",
                borderRadius: "var(--radius-md)",
                color: isSelected
                  ? isSpeed
                    ? "var(--color-accent-gold)"
                    : "var(--color-accent-purple)"
                  : "var(--color-text-muted)",
                cursor: isHost ? "pointer" : "not-allowed",
                textAlign: "left",
                transition: "all var(--transition-base)",
                boxShadow: isSelected
                  ? isSpeed
                    ? "0 0 12px rgba(251,191,36,0.2)"
                    : "var(--shadow-glow-purple)"
                  : "none",
                "&:hover:not(:disabled)": {
                  color: "var(--color-text-primary)",
                  background: "var(--color-bg-hover)",
                  borderColor: "var(--color-border-emphasis)",
                },
                "&:disabled": { cursor: "not-allowed" },
              }}
            >
              <Box component="span" sx={{ fontSize: "15px", lineHeight: 1 }}>
                {option.icon}
              </Box>
              {option.label}
            </Box>
          );
        })}
      </Box>

      {/* Speed Battle rules blurb */}
      {currentMode === "speed_battle" && (
        <Box
          sx={{
            mt: 2,
            py: 2,
            px: 2,
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: "var(--radius-md)",
            animation: "formReveal 0.35s ease both",
          }}
        >
          <Box
            component="p"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "11px",
              color: "var(--color-text-secondary)",
              letterSpacing: "0.5px",
              lineHeight: 1.8,
              m: 0,
            }}
          >
            {RULES_COPY}
          </Box>
        </Box>
      )}
    </Box>
  );
}
