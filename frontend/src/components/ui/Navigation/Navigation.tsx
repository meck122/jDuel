import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import InfoIcon from "@mui/icons-material/Info";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import { useGame, useMusic } from "../../../contexts";
import { ToolbarMuteButton } from "../MuteButton/ToolbarMuteButton";
import { SBBadge } from "../../../features/game/SpeedBattle/SBBadge";
import { MUSIC_ENABLED } from "../../../config/features";
import styles from "./Navigation.module.css";

export function Navigation({ onAboutOpen }: { onAboutOpen: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAboutPage = location.pathname === "/about";
  const isGamePage = location.pathname.startsWith("/game/");
  const { roomState } = useGame();
  const { preference, skip } = useMusic();

  const [leaveOpen, setLeaveOpen] = useState(false);

  const isActiveGameplay =
    isGamePage && roomState?.status !== "finished" && roomState?.status !== "waiting";
  const isInRoom = isGamePage && !!roomState && roomState.status !== "finished";

  const sbQuestionIndex = roomState?.speedBattle?.playerState?.questionIndex;
  const showQCounter = isActiveGameplay && sbQuestionIndex !== undefined;

  const handleLogoClick = () => {
    if (isInRoom) {
      setLeaveOpen(true);
    } else {
      navigate("/");
    }
  };

  const handleLeaveConfirm = () => {
    setLeaveOpen(false);
    navigate("/");
  };

  return (
    <>
      <AppBar position="fixed" className={styles.appBar}>
        <Toolbar>
          <Box
            component="span"
            onClick={handleLogoClick}
            sx={{
              cursor: "pointer",
              fontFamily: "var(--font-display)",
              fontSize: "1.6rem",
              fontWeight: 400,
              letterSpacing: "0.15em",
              lineHeight: 1,
              textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              pl: "var(--spacing-sm)",
              "&:hover": { textShadow: "0 0 20px rgba(139,92,246,0.5)" },
            }}
          >
            <Box component="span" sx={{ color: "var(--color-accent-purple)" }}>
              j
            </Box>
            <Box component="span" sx={{ color: "var(--color-accent-gold)" }}>
              Duel
            </Box>
          </Box>
          {showQCounter && (
            <Box sx={{ ml: 3 }}>
              <SBBadge />
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {MUSIC_ENABLED && <ToolbarMuteButton />}
            {MUSIC_ENABLED && (
              <IconButton
                aria-label="Skip to next track"
                onClick={skip}
                size="small"
                color="inherit"
                disabled={preference !== "on"}
              >
                <SkipNextIcon fontSize="small" />
              </IconButton>
            )}
            {showQCounter && (
              <Box
                component="span"
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-muted)",
                  ml: 1,
                  pr: "var(--spacing-sm)",
                }}
              >
                Q{sbQuestionIndex + 1}
              </Box>
            )}
            {!isActiveGameplay && !isAboutPage && (
              <Box
                component="button"
                onClick={onAboutOpen}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-accent-purple)",
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--font-size-sm)",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  px: 1,
                  py: "2px",
                  borderRadius: "var(--radius-sm)",
                  transition: "opacity 0.2s",
                  "&:hover": { opacity: 0.75 },
                }}
              >
                <InfoIcon fontSize="small" />
                About
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            background: "var(--color-bg-primary)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-lg)",
            letterSpacing: "1.5px",
            color: "var(--color-text-primary)",
            pb: 1,
          }}
        >
          Leave the game?
        </DialogTitle>
        <DialogContent>
          <Box
            component="p"
            sx={{
              m: 0,
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              lineHeight: 1.7,
            }}
          >
            Your room will keep playing without you.
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Box
            component="button"
            onClick={() => setLeaveOpen(false)}
            sx={{
              flex: 1,
              background: "none",
              border: "1px solid rgba(139,92,246,0.4)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              color: "var(--color-accent-purple)",
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-sm)",
              letterSpacing: "1px",
              textTransform: "uppercase",
              py: 1,
              transition: "opacity 0.2s",
              "&:hover": { opacity: 0.75 },
            }}
          >
            Stay
          </Box>
          <Box
            component="button"
            onClick={handleLeaveConfirm}
            sx={{
              flex: 1,
              background: "none",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-sm)",
              letterSpacing: "1px",
              textTransform: "uppercase",
              py: 1,
              transition: "opacity 0.2s",
              "&:hover": { opacity: 0.75 },
            }}
          >
            Leave
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}
