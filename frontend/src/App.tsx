import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, Box, Typography } from "@mui/material";
import { jeopardyTheme } from "./theme";
import "./App.css";
import { JoinForm } from "./components/JoinForm/JoinForm";
import { GameRoom } from "./components/GameRoom/GameRoom";
import { About } from "./components/About/About";
import { Navigation } from "./components/Navigation/Navigation";
import { useWebSocket } from "./hooks/useWebSocket";

function Game() {
  const [roomId, setRoomId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [joined, setJoined] = useState<boolean>(false);

  const { roomState, sendMessage } = useWebSocket(
    roomId,
    playerId,
    joined,
    () => {
      // Room was closed, reset to join form
      setJoined(false);
      setRoomId("");
      setPlayerId("");
    },
  );

  const handleJoin = (newRoomId: string, newPlayerId: string) => {
    setRoomId(newRoomId);
    setPlayerId(newPlayerId);
    setJoined(true);
  };

  const handleStartGame = () => {
    sendMessage({ type: "START_GAME" });
  };

  const handleSubmitAnswer = (answer: string) => {
    sendMessage({
      type: "ANSWER",
      answer: answer,
    });
  };

  if (!joined) {
    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <JoinForm onJoin={handleJoin} />
      </Box>
    );
  }

  if (!roomState) {
    return (
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "calc(100vh - 64px)",
        }}
      >
        <Typography variant="h5" sx={{ color: "white" }}>
          Connecting...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <GameRoom
        roomId={roomId}
        playerId={playerId}
        roomState={roomState}
        onStartGame={handleStartGame}
        onSubmitAnswer={handleSubmitAnswer}
      />
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={jeopardyTheme}>
      <CssBaseline />
      <Router>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
            width: "100%",
          }}
        >
          <Navigation />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              pt: 8,
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Routes>
              <Route path="/" element={<Game />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
