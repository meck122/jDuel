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

import { FormEvent, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createRoom, joinRoom, ApiError } from "../../services/api";
import { usePlayerName } from "../../hooks";
import styles from "./HomePage.module.css";

export const HomePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { playerName, setPlayerName } = usePlayerName();
  const [roomCode, setRoomCode] = useState<string>("");
  const [activeCard, setActiveCard] = useState<"host" | "join" | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Handle deep link redirect: ?join=XXXX
  useEffect(() => {
    const joinRoomCode = searchParams.get("join");
    if (joinRoomCode) {
      setRoomCode(joinRoomCode.toUpperCase());
      setActiveCard("join");
      // Clear the query param from URL (cleaner UX)
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

      // Step 3: Navigate to the game page
      navigate(
        `/game/${room.roomId}?player=${encodeURIComponent(playerName.trim())}`,
      );
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

      // Navigate to the game page
      navigate(
        `/game/${roomCode.toUpperCase()}?player=${encodeURIComponent(playerName.trim())}`,
      );
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

  return (
    <div className={styles.container}>
      <h1 className={styles.logo}>
        <span className={styles.logoJ}>j</span>
        <span className={styles.logoDuel}>Duel</span>
      </h1>

      <p className={styles.tagline}>Trivia battles with friends</p>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.cards}>
        {/* Host a Game Card */}
        <div
          className={`${styles.card} ${activeCard === "host" ? styles.cardActive : ""}`}
          onClick={() => setActiveCard("host")}
        >
          <h2 className={styles.cardTitle}>🎮 Host a Game</h2>
          <p className={styles.cardDescription}>
            Create a new room and invite your friends
          </p>

          {activeCard === "host" && (
            <form onSubmit={handleCreateRoom} className={styles.form}>
              <input
                type="text"
                placeholder="Your Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                autoFocus
              />
              <button type="submit" disabled={!playerName.trim() || isLoading}>
                {isLoading ? "Creating..." : "Create Room"}
              </button>
            </form>
          )}
        </div>

        {/* Join a Game Card */}
        <div
          className={`${styles.card} ${activeCard === "join" ? styles.cardActive : ""}`}
          onClick={() => setActiveCard("join")}
        >
          <h2 className={styles.cardTitle}>🚀 Join a Game</h2>
          <p className={styles.cardDescription}>
            Enter a room code to join an existing game
          </p>

          {activeCard === "join" && (
            <form onSubmit={handleJoinRoom} className={styles.form}>
              <input
                type="text"
                placeholder="Your Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />
              <input
                type="text"
                placeholder="Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className={styles.roomCodeInput}
                autoFocus
              />
              <button
                type="submit"
                disabled={!playerName.trim() || !roomCode.trim() || isLoading}
              >
                {isLoading ? "Joining..." : "Join Room"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
