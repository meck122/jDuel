import { Box } from "@mui/material";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";

interface Props {
  isHost: boolean;
  enabled: boolean;
  forced?: boolean;
  onToggle: (enabled: boolean) => void;
}

export function MultipleChoiceToggle({ isHost, enabled, forced = false, onToggle }: Props) {
  const isDisabled = !isHost || forced;

  const toggle = (
    <FormControlLabel
      control={
        <Switch
          checked={forced ? true : enabled}
          disabled={isDisabled}
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
      title={isHost && !forced ? undefined : "Only the host can change settings"}
      sx={{
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isHost ? 1 : 0.5,
        userSelect: "none",
        ml: 0,
        gap: 2,
      }}
    />
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {forced && isHost ? (
        <Tooltip title="Required for Speed Battle in v1" placement="top">
          <span>{toggle}</span>
        </Tooltip>
      ) : (
        toggle
      )}
      {forced && isHost && (
        <Box
          component="aside"
          sx={{
            fontSize: "var(--font-size-xs)",
            color: "var(--color-text-muted)",
            ml: 1,
          }}
        >
          Required for Speed Battle
        </Box>
      )}
    </Box>
  );
}
