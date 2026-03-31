import { createTheme } from "@mui/material/styles";

// Module augmentation for custom theme properties
declare module "@mui/material/styles" {
  interface Theme {
    custom: {
      navbarHeight: string;
      reactionsBarHeight: string;
    };
  }
  interface ThemeOptions {
    custom?: {
      navbarHeight?: string;
      reactionsBarHeight?: string;
    };
  }
  interface TypographyVariants {
    displayFamily: string;
  }
  interface TypographyVariantsOptions {
    displayFamily?: string;
  }
}

// Base theme used to reference breakpoints inside typography definitions.
// createTheme() cannot reference its own breakpoints at definition time.
const baseTheme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 768, lg: 1024, xl: 1280 },
  },
});

export const jeopardyTheme = createTheme({
  // Expose all theme values as CSS custom properties on :root
  // (e.g. --mui-palette-primary-main). Safe alongside existing --color-* vars.
  cssVariables: true,

  breakpoints: {
    // Aligned to app's existing layout breakpoints (not MUI defaults).
    // md: 768 means sx={{ display: { xs: 'none', md: 'block' } }} matches
    // the existing @media (max-width: 768px) behaviour.
    values: { xs: 0, sm: 600, md: 768, lg: 1024, xl: 1280 },
  },

  // Custom spacing scale matching variables.css spacing tokens (values in px):
  // spacing(0)=0  spacing(1)=4  spacing(2)=8   spacing(3)=12  spacing(4)=16
  // spacing(5)=24 spacing(6)=32 spacing(7)=48  spacing(8)=64
  // Maps: xs=1  sm=2  md=4  lg=5  xl=6  2xl=7  3xl=8
  spacing: [0, 4, 8, 12, 16, 24, 32, 48, 64],

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
      // Corrected from rgb(18,18,18)/rgb(28,28,28) — variables.css values
      // carry the intentional purple warmth; theme.ts had plain grey.
      default: "rgb(18, 16, 28)", // --color-bg-primary
      paper: "rgb(26, 24, 38)", // --color-bg-secondary
    },
    text: {
      primary: "rgb(235, 235, 235)",
      secondary: "rgba(235, 235, 235, 0.7)",
    },
    error: {
      main: "rgb(239, 68, 68)",
      light: "rgb(248, 113, 113)",
    },
    warning: {
      main: "rgb(251, 146, 60)", // --color-warning
      light: "rgb(251, 191, 36)", // --color-warning-light
    },
    success: {
      main: "rgb(34, 197, 94)",
      light: "rgb(74, 222, 128)",
    },
  },

  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    // Bebas Neue reference for use in components via theme.typography.displayFamily
    displayFamily: '"Bebas Neue", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: "3rem",
      [baseTheme.breakpoints.down("md")]: { fontSize: "2rem" },
    },
    h2: {
      fontWeight: 600,
      fontSize: "2rem",
      [baseTheme.breakpoints.down("md")]: { fontSize: "1.5rem" },
    },
    h3: {
      fontWeight: 600,
      fontSize: "1.5rem",
      [baseTheme.breakpoints.down("md")]: { fontSize: "1.25rem" },
    },
  },

  custom: {
    navbarHeight: "64px", // --navbar-height
    reactionsBarHeight: "52px", // --reactions-bar-height
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
