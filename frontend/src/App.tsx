import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { jeopardyTheme } from "./theme";
import { Navigation, About } from "./components";
import { HomePage, RoomPage } from "./pages";

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
              <Route path="/room/:roomId" element={<RoomPage />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
