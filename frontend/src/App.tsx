import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { jeopardyTheme } from "./theme";
import { Navigation, About } from "./components";
import { HomePage, GamePage } from "./pages";

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
    <ThemeProvider theme={jeopardyTheme}>
      <CssBaseline />
      <Router>
        <div className="app-layout">
          <Navigation />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/room/:roomId" element={<RoomRedirect />} />
              <Route path="/game/:roomId" element={<GamePage />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
