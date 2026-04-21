import { IconButton } from "@mui/material";
import { useMuteToggle } from "./useMuteToggle";

/**
 * Mute/unmute button rendered inside the Navigation Toolbar on screens
 * that have an AppBar (Home, About, GameOver).
 */
export function ToolbarMuteButton() {
  const { Icon, label, onClick } = useMuteToggle();
  return (
    <IconButton aria-label={label} onClick={onClick} size="small" color="inherit">
      <Icon fontSize="small" />
    </IconButton>
  );
}
