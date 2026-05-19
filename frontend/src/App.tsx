import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
} from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { appTheme } from "./theme";
import { Navigation, AboutModal } from "./components";
import { HomePage, GamePage } from "./pages";
import { GameProvider, MusicProvider } from "./contexts";

function RoomRedirect() {
  const { roomId } = useParams<{ roomId: string }>();
  return <Navigate to={`/?join=${roomId}`} replace />;
}

function AboutRedirect({ onOpen }: { onOpen: () => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    onOpen();
    navigate("/", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function App() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <GameProvider>
        <MusicProvider>
          <Router>
            <div className="app-layout">
              <Navigation onAboutOpen={() => setAboutOpen(true)} />
              <main className="app-main">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/room/:roomId" element={<RoomRedirect />} />
                  <Route path="/game/:roomId" element={<GamePage />} />
                  <Route
                    path="/about"
                    element={<AboutRedirect onOpen={() => setAboutOpen(true)} />}
                  />
                </Routes>
              </main>
              <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
            </div>
          </Router>
        </MusicProvider>
      </GameProvider>
    </ThemeProvider>
  );
}

export default App;
