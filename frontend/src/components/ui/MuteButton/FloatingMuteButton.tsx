import { IconButton } from "@mui/material";
import { useLocation } from "react-router-dom";
import { useGame } from "../../../contexts";
import { useMuteToggle } from "./useMuteToggle";
import styles from "./FloatingMuteButton.module.css";

/**
 * Mute/unmute button rendered at the top-left of the viewport on gameplay
 * screens that hide the Navigation AppBar (Lobby, Question, Results).
 * Returns null on screens where Navigation renders the ToolbarMuteButton,
 * so exactly one mute affordance is visible at any time.
 */
export function FloatingMuteButton() {
  const location = useLocation();
  const { roomState } = useGame();
  const { Icon, label, onClick } = useMuteToggle();

  const isGamePage = location.pathname.startsWith("/game/");
  const isGameFinished = roomState?.status === "finished";
  // Mirror the Navigation gate: render iff Navigation would return null.
  if (!isGamePage || isGameFinished) return null;

  return (
    <div className={styles.floatingWrapper}>
      <IconButton aria-label={label} onClick={onClick} size="small" color="inherit">
        <Icon fontSize="small" />
      </IconButton>
    </div>
  );
}
