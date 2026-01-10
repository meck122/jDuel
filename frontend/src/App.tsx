import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { jeopardyTheme } from "./theme";
import { Navigation } from "./components/Navigation/Navigation";
import { GamePage } from "./pages/GamePage";
import { About } from "./components/About/About";

function App() {
  return (
    <ThemeProvider theme={jeopardyTheme}>
      <CssBaseline />
      <Router>
        <div className="app-layout">
          <Navigation />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<GamePage />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
