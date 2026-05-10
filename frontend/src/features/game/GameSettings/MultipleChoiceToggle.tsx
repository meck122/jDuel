import { Box } from "@mui/material";

interface Props {
  isHost: boolean;
  enabled: boolean;
  forced?: boolean;
  onToggle: (enabled: boolean) => void;
}

export function MultipleChoiceToggle({ isHost, enabled, forced = false, onToggle }: Props) {
  const isDisabled = !isHost || forced;
  const isOn = forced ? true : enabled;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Section label */}
      <Box
        component="span"
        sx={{
          display: "block",
          textAlign: "left",
          fontFamily: "var(--font-display)",
          fontSize: "11px",
          color: "var(--color-text-muted)",
          letterSpacing: "1px",
        }}
      >
        Multiple Choice
      </Box>

      {/* Toggle row: pill + optional forced note */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          opacity: isHost ? 1 : 0.5,
        }}
      >
        <Box
          onClick={isDisabled ? undefined : () => onToggle(!isOn)}
          title={
            forced
              ? "Required for Speed Battle"
              : isHost
                ? undefined
                : "Only the host can change settings"
          }
          sx={{
            width: 44,
            height: 24,
            background: isOn ? "var(--color-accent-purple)" : "var(--color-bg-hover)",
            borderRadius: "12px",
            cursor: isDisabled ? "not-allowed" : "pointer",
            position: "relative",
            flexShrink: 0,
            transition: "background 250ms var(--transition-base)",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 3,
              left: isOn ? 22 : 3,
              width: 18,
              height: 18,
              background: "white",
              borderRadius: "50%",
              transition: "left 250ms var(--transition-base)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
          />
        </Box>

        {forced && (
          <Box
            component="span"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "10px",
              color: "var(--color-text-muted)",
              letterSpacing: "0.5px",
            }}
          >
            Required for Speed Battle
          </Box>
        )}

        {!forced && (
          <Box
            component="span"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "9px",
              letterSpacing: "1px",
              color: "var(--color-accent-teal)",
              background: "rgba(20, 184, 166, 0.12)",
              border: "1px solid rgba(20, 184, 166, 0.35)",
              borderRadius: "4px",
              px: "5px",
              py: "2px",
              lineHeight: 1,
              opacity: isOn ? 0 : 1,
              transition: "opacity 200ms var(--transition-base)",
              transitionDelay: isOn ? "0ms" : "150ms",
              pointerEvents: "none",
            }}
          >
            BETA
          </Box>
        )}
      </Box>
    </Box>
  );
}
