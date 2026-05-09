import { AppBar, Toolbar, Button, Box } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import InfoIcon from "@mui/icons-material/Info";
import HomeIcon from "@mui/icons-material/Home";
import { useGame } from "../../../contexts";
import styles from "./Navigation.module.css";

export function Navigation() {
  const location = useLocation();
  const isAboutPage = location.pathname === "/about";
  const isGamePage = location.pathname.startsWith("/game/");
  const { roomState } = useGame();

  // Hide navbar on game pages EXCEPT lobby (waiting) and GameOver (finished)
  const isGameFinished = roomState?.status === "finished";
  const isLobby = roomState?.status === "waiting";
  if (isGamePage && !isGameFinished && !isLobby) return null;

  return (
    <AppBar position="fixed" className={styles.appBar}>
      <Toolbar>
        <Box
          component={Link}
          to="/"
          sx={{
            flexGrow: 1,
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
        <Box>
          {isAboutPage ? (
            <Button component={Link} to="/" startIcon={<HomeIcon />} className={styles.navButton}>
              Back to Game
            </Button>
          ) : (
            <Button
              component={Link}
              to="/about"
              startIcon={<InfoIcon />}
              className={styles.navButton}
            >
              About
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
