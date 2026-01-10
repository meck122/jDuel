import { createTheme } from "@mui/material/styles";

// Jeopardy-inspired color palette
// Classic Jeopardy blue background with gold/yellow accents
export const jeopardyTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#0A2463", // Deep Jeopardy blue
      light: "#1E3A8A",
      dark: "#041633",
    },
    secondary: {
      main: "#FFBF00", // Jeopardy gold/yellow
      light: "#FFD700",
      dark: "#CC9900",
    },
    background: {
      default: "#0A2463",
      paper: "#1E3A8A",
    },
    text: {
      primary: "#FFFFFF",
      secondary: "#FFBF00",
    },
  },
  typography: {
    fontFamily: '"Helvetica Neue", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: "3rem",
    },
    h2: {
      fontWeight: 600,
      fontSize: "2rem",
    },
    h3: {
      fontWeight: 600,
      fontSize: "1.5rem",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
          padding: "10px 24px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});
