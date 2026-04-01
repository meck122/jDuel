import { Box } from "@mui/material";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";

interface Props {
  isHost: boolean;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function MultipleChoiceToggle({ isHost, enabled, onToggle }: Props) {
  return (
    <FormControlLabel
      control={
        <Switch
          checked={enabled}
          disabled={!isHost}
          onChange={(e) => onToggle(e.target.checked)}
          color="secondary"
          size="small"
        />
      }
      label={
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-base)",
            color: "var(--color-text-primary)",
            letterSpacing: "0.5px",
          }}
        >
          Multiple Choice
        </Box>
      }
      title={isHost ? undefined : "Only the host can change settings"}
      sx={{
        cursor: isHost ? "pointer" : "not-allowed",
        opacity: isHost ? 1 : 0.5,
        userSelect: "none",
        ml: 0,
        gap: 2,
      }}
    />
  );
}
