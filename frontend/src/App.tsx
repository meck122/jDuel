import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { appTheme } from "./theme";
import { Navigation, FloatingMuteButton } from "./components";
import { HomePage, GamePage, AboutPage } from "./pages";
import { GameProvider, MusicProvider } from "./contexts";

/**
 * Redirect component for deep links.
 * Converts /room/:roomId to /?join=:roomId
 */
function RoomRedirect() {
  const { roomId } = useParams<{ roomId: string }>();
  return <Navigate to={`/?join=${roomId}`} replace />;
}

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <GameProvider>
        <MusicProvider>
          <Router>
            <div className="app-layout">
              <Navigation />
              <FloatingMuteButton />
              <main className="app-main">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/room/:roomId" element={<RoomRedirect />} />
                  <Route path="/game/:roomId" element={<GamePage />} />
                  <Route path="/about" element={<AboutPage />} />
                </Routes>
              </main>
            </div>
          </Router>
        </MusicProvider>
      </GameProvider>
    </ThemeProvider>
  );
}

export default App;
