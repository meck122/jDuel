import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import InfoIcon from "@mui/icons-material/Info";
import HomeIcon from "@mui/icons-material/Home";
import styles from "./Navigation.module.css";

export function Navigation() {
  const location = useLocation();
  const isAboutPage = location.pathname === "/about";

  return (
    <AppBar position="fixed" className={styles.appBar}>
      <Toolbar>
        <Typography
          variant="h5"
          component={Link}
          to="/"
          className={styles.logoLink}
        >
          <Box component="span" className={styles.logoJ}>
            j
          </Box>
          <Box component="span" className={styles.logoDuel}>
            Duel
          </Box>
        </Typography>
        <Box>
          {isAboutPage ? (
            <Button
              component={Link}
              to="/"
              startIcon={<HomeIcon />}
              className={styles.navButton}
            >
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
