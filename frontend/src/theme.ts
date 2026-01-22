import { createTheme } from "@mui/material/styles";

// Modern dark theme with purple/teal accents
export const jeopardyTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "rgb(139, 92, 246)",
      light: "rgb(167, 139, 250)",
      dark: "rgb(109, 40, 217)",
    },
    secondary: {
      main: "rgb(45, 212, 191)",
      light: "rgb(94, 234, 212)",
      dark: "rgb(20, 184, 166)",
    },
    background: {
      default: "rgb(18, 18, 18)",
      paper: "rgb(28, 28, 28)",
    },
    text: {
      primary: "rgb(235, 235, 235)",
      secondary: "rgba(235, 235, 235, 0.7)",
    },
    error: {
      main: "rgb(239, 68, 68)",
      light: "rgb(248, 113, 113)",
    },
    success: {
      main: "rgb(34, 197, 94)",
      light: "rgb(74, 222, 128)",
    },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
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
          backgroundImage: "none",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});
