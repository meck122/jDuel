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
        background:
          "linear-gradient(90deg, rgb(28, 28, 28) 0%, rgb(38, 38, 38) 100%)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
        borderBottom: "1px solid rgba(235, 235, 235, 0.1)",
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
            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              textShadow: "0 0 20px rgba(139, 92, 246, 0.5)",
            },
          }}
        >
          <Box
            component="span"
            sx={{
              color: "rgb(139, 92, 246)",
              transition: "color 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                color: "rgb(167, 139, 250)",
              },
            }}
          >
            j
          </Box>
          <Box
            component="span"
            sx={{
              color: "rgb(239, 68, 68)",
              transition: "color 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                color: "rgb(248, 113, 113)",
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
                color: "rgb(235, 235, 235)",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  backgroundColor: "rgba(139, 92, 246, 0.1)",
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
                color: "rgb(235, 235, 235)",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  backgroundColor: "rgba(139, 92, 246, 0.1)",
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
