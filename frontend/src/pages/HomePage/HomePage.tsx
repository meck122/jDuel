/**
 * HomePage - Landing page with options to create or join a game room.
 *
 * This page provides two clear paths for users:
 * 1. "Host a Game" - Create a new room and become the host
 * 2. "Join a Game" - Enter a room code to join an existing game
 *
 * Also handles deep link redirects via ?join=XXXX query param.
 * Player names are persisted in localStorage for convenience.
 */

import { ChangeEvent, FormEvent, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box } from "@mui/material";
import { createRoom, joinRoom, ApiError } from "../../services/api";
import { usePlayerName } from "../../hooks";

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { playerName, setPlayerName } = usePlayerName();

  // Handle deep link redirect: ?join=XXXX (compute initial state synchronously)
  const joinRoomCode = searchParams.get("join");
  const [roomCode, setRoomCode] = useState<string>(() =>
    joinRoomCode ? joinRoomCode.toUpperCase() : ""
  );
  const [activeCard, setActiveCard] = useState<"host" | "join" | null>(() =>
    joinRoomCode ? "join" : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Clear the query param from URL once (cleaner UX)
  useEffect(() => {
    if (joinRoomCode) {
      setSearchParams({}, { replace: true });
    }
  }, [joinRoomCode, setSearchParams]);

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      // Step 1: Create the room via HTTP
      const room = await createRoom();

      // Step 2: Register the creator as a player
      await joinRoom(room.roomId, playerName.trim());

      // Step 3: Navigate to the game page (player name retrieved from localStorage)
      navigate(`/game/${room.roomId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomCode.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      // Register the player via HTTP
      await joinRoom(roomCode.toUpperCase(), playerName.trim());

      // Navigate to the game page (player name retrieved from localStorage)
      navigate(`/game/${roomCode.toUpperCase()}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "ROOM_NOT_FOUND") {
          setError("Room not found. Check the code and try again.");
        } else if (err.code === "NAME_TAKEN") {
          setError("That name is already taken in this room.");
        } else if (err.code === "GAME_STARTED") {
          setError("This game has already started.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred");
      }
      setIsLoading(false);
    }
  };

  const isHostActive = activeCard === "host";
  const isJoinActive = activeCard === "join";

  const cardSx = (isActive: boolean, isSecond?: boolean) => ({
    flex: 1,
    background: isActive ? "var(--color-bg-elevated)" : "var(--color-bg-secondary)",
    borderRadius: "var(--radius-lg)",
    border: isActive
      ? "2px solid var(--color-accent-red)"
      : "2px solid var(--color-border-default)",
    p: { xs: 6, sm: 7 },
    cursor: "pointer",
    transition:
      "border-color var(--transition-base), box-shadow var(--transition-base), transform var(--transition-base), background var(--transition-base)",
    boxShadow: isActive ? "var(--shadow-glow-gold)" : "var(--shadow-md)",
    transform: isActive ? "translateY(-2px)" : "none",
    animation: "cardSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
    ...(isSecond ? { animationDelay: "0.12s" } : {}),
    "&:hover": {
      borderColor: "var(--color-accent-purple)",
      transform: "translateY(-4px)",
      boxShadow: "var(--shadow-glow-purple)",
    },
  });

  return (
    <Box
      sx={{
        minHeight: "calc(100dvh - var(--navbar-height))",
        width: "100%",
        textAlign: "center",
        py: { xs: 7, sm: 8 },
        px: { xs: 4, sm: 6 },
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {/* Logo */}
      <Box
        component="h1"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "5rem", sm: "7rem" },
          fontWeight: 400,
          mb: 5,
          letterSpacing: { xs: "4px", sm: "8px" },
          lineHeight: 1,
          textShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
        }}
      >
        <Box component="span" sx={{ color: "var(--color-accent-purple)" }}>
          j
        </Box>
        <Box component="span" sx={{ color: "var(--color-accent-red)" }}>
          Duel
        </Box>
      </Box>

      {/* Tagline */}
      <Box
        component="p"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "var(--font-size-lg)", sm: "var(--font-size-xl)" },
          color: "var(--color-text-muted)",
          m: 0,
          mb: { xs: 7, sm: 8 },
          fontWeight: 400,
          letterSpacing: "1.5px",
        }}
      >
        Trivia battles with friends :D
      </Box>

      {/* Error banner */}
      {error && (
        <Box
          sx={{
            color: "var(--color-error)",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--color-error)",
            borderRadius: "var(--radius-md)",
            p: 4,
            mb: 6,
            maxWidth: 500,
            mx: "auto",
          }}
        >
          {error}
        </Box>
      )}

      {/* Cards row */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 6,
          maxWidth: { xs: "100%", sm: 500, md: 800 },
          mx: "auto",
        }}
      >
        {/* Host a Game */}
        <Box onClick={() => setActiveCard("host")} sx={cardSx(isHostActive)}>
          <Box
            component="h2"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "var(--font-size-xl)", sm: "var(--font-size-2xl)" },
              mb: 2,
              color: "var(--color-text-primary)",
              letterSpacing: "1px",
            }}
          >
            🎮 Host a Game
          </Box>
          <Box
            component="p"
            sx={{
              color: "var(--color-text-muted)",
              m: 0,
              mb: 5,
              fontSize: "var(--font-size-sm)",
            }}
          >
            Create a new room and invite your friends
          </Box>

          {isHostActive && (
            <Box
              component="form"
              onSubmit={handleCreateRoom}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                mt: 5,
                animation: "formReveal 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
            >
              <Box
                component="input"
                type="text"
                placeholder="Your Name"
                value={playerName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPlayerName(e.target.value)}
                maxLength={20}
                autoFocus
                sx={{
                  textAlign: "center",
                  fontSize: { xs: "1rem", sm: "var(--font-size-md)" },
                  p: { xs: "16px", sm: 4 },
                }}
              />
              <Box
                component="button"
                type="submit"
                disabled={!playerName.trim() || isLoading}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  p: { xs: "16px 32px", sm: undefined },
                  fontSize: { xs: "var(--font-size-lg)", sm: undefined },
                }}
              >
                {isLoading ? "Creating..." : "Create Room"}
              </Box>
            </Box>
          )}
        </Box>

        {/* Join a Game */}
        <Box onClick={() => setActiveCard("join")} sx={cardSx(isJoinActive, true)}>
          <Box
            component="h2"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: { xs: "var(--font-size-xl)", sm: "var(--font-size-2xl)" },
              mb: 2,
              color: "var(--color-text-primary)",
              letterSpacing: "1px",
            }}
          >
            🚀 Join a Game
          </Box>
          <Box
            component="p"
            sx={{
              color: "var(--color-text-muted)",
              m: 0,
              mb: 5,
              fontSize: "var(--font-size-sm)",
            }}
          >
            Enter a room code to join an existing game
          </Box>

          {isJoinActive && (
            <Box
              component="form"
              onSubmit={handleJoinRoom}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                mt: 5,
                animation: "formReveal 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
            >
              <Box
                component="input"
                type="text"
                placeholder="Your Name"
                value={playerName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPlayerName(e.target.value)}
                maxLength={20}
                sx={{
                  textAlign: "center",
                  fontSize: { xs: "1rem", sm: "var(--font-size-md)" },
                  p: { xs: "16px", sm: 4 },
                }}
              />
              <Box
                component="input"
                type="text"
                placeholder="Room Code"
                value={roomCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setRoomCode(e.target.value.toUpperCase())
                }
                maxLength={6}
                autoFocus
                sx={{
                  textAlign: "center",
                  textTransform: "uppercase",
                  letterSpacing: "4px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  fontSize: { xs: "1rem", sm: "var(--font-size-md)" },
                  p: { xs: "16px", sm: 4 },
                }}
              />
              <Box
                component="button"
                type="submit"
                disabled={!playerName.trim() || !roomCode.trim() || isLoading}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  p: { xs: "16px 32px", sm: undefined },
                  fontSize: { xs: "var(--font-size-lg)", sm: undefined },
                }}
              >
                {isLoading ? "Joining..." : "Join Room"}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
