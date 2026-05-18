import { AppBar, Toolbar, Button, Box, IconButton } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import InfoIcon from "@mui/icons-material/Info";
import HomeIcon from "@mui/icons-material/Home";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import { useGame, useMusic } from "../../../contexts";
import { ToolbarMuteButton } from "../MuteButton/ToolbarMuteButton";
import { SBBadge } from "../../../features/game/SpeedBattle/SBBadge";
import { MUSIC_ENABLED } from "../../../config/features";
import styles from "./Navigation.module.css";

export function Navigation() {
  const location = useLocation();
  const isAboutPage = location.pathname === "/about";
  const isGamePage = location.pathname.startsWith("/game/");
  const { roomState } = useGame();
  const { preference, skip } = useMusic();

  const isActiveGameplay =
    isGamePage && roomState?.status !== "finished" && roomState?.status !== "waiting";
  const sbQuestionIndex = roomState?.speedBattle?.playerState?.questionIndex;
  const showQCounter = isActiveGameplay && sbQuestionIndex !== undefined;

  return (
    <AppBar position="fixed" className={styles.appBar}>
      <Toolbar>
        <Box
          component={Link}
          to="/"
          sx={{
            textDecoration: "none",
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
          {!isActiveGameplay &&
            (isAboutPage ? (
              <Button
                component={Link}
                to="/"
                startIcon={<HomeIcon />}
                className={styles.navButton}
                sx={{ fontFamily: "var(--font-display)", letterSpacing: "1.5px" }}
              >
                Back to Game
              </Button>
            ) : (
              <Button
                component={Link}
                to="/about"
                startIcon={<InfoIcon />}
                className={styles.navButton}
                sx={{ fontFamily: "var(--font-display)", letterSpacing: "1.5px" }}
              >
                About
              </Button>
            ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
