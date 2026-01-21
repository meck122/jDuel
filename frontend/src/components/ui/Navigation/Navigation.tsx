import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import InfoIcon from "@mui/icons-material/Info";
import HomeIcon from "@mui/icons-material/Home";

export function Navigation() {
  const location = useLocation();
  const isAboutPage = location.pathname === "/about";

  return (
    <AppBar
      position="fixed"
      sx={{
        background: "linear-gradient(90deg, #0A2463 0%, #1E3A8A 100%)",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
      }}
    >
      <Toolbar>
        <Typography
          variant="h5"
          component={Link}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: "none",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
          }}
        >
          <Box
            component="span"
            sx={{
              color: "#FFBF00",
              "&:hover": {
                color: "#FFD700",
              },
            }}
          >
            j
          </Box>
          <Box
            component="span"
            sx={{
              color: "#DC143C",
              "&:hover": {
                color: "#FF1744",
              },
            }}
          >
            Duel
          </Box>
        </Typography>
        <Box>
          {isAboutPage ? (
            <Button
              component={Link}
              to="/"
              startIcon={<HomeIcon />}
              sx={{
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(255, 191, 0, 0.1)",
                },
              }}
            >
              Back to Game
            </Button>
          ) : (
            <Button
              component={Link}
              to="/about"
              startIcon={<InfoIcon />}
              sx={{
                color: "white",
                "&:hover": {
                  backgroundColor: "rgba(255, 191, 0, 0.1)",
                },
              }}
            >
              About
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
