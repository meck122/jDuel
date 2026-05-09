/**
 * SpeedBattleRound - Main in-round component for Speed Battle game mode.
 *
 * Layout:
 *   Top bar: SBBadge | MatchTimerBar | Q{n}/100
 *   Mobile strip: LiveLeaderboard (compact)
 *   Main area: Question card (left) + desktop leaderboard panel slot (right, U5)
 *
 * Local state:
 *   - countdownDone: shows 3→2→1→GO! on fresh playing transition
 *   - localMatchMs: ticks down every 100ms, re-seeded from server
 *   - localCooldownMs: ticks down every 100ms during cooldown
 *   - hasSubmittedThisQuestion: prevents double-submit per question
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { SBBadge } from "./SBBadge";
import { MatchTimerBar } from "./MatchTimerBar";
import { CountdownOverlay } from "./CountdownOverlay";
import { CooldownRing } from "./CooldownRing";
import { LiveLeaderboard } from "./LiveLeaderboard";

export function SpeedBattleRound() {
  const { roomState, playerId, submitAnswer } = useGame();

  const speedBattle = roomState?.speedBattle;
  const playerState = speedBattle?.playerState;
  const questionIndex = playerState?.questionIndex ?? 0;
  const serverMatchMs = speedBattle?.matchRemainingMs ?? 0;
  const serverCooldownMs = playerState?.cooldownRemainingMs ?? null;

  // ── Countdown gate ───────────────────────────────────────────────────────
  // Only show countdown on fresh waiting→playing transition, not on reconnect.
  // We track the "seenStatuses" pattern by keeping prevStatus in state so we
  // can compare without reading a ref during render (avoids react-hooks/refs rule).
  const [countdownDone, setCountdownDone] = useState<boolean>(
    // If we mount already in playing (reconnect mid-round), skip the countdown
    () => roomState?.status === "playing"
  );
  const [prevStatus, setPrevStatus] = useState<string | undefined>(roomState?.status);

  if (prevStatus !== roomState?.status) {
    setPrevStatus(roomState?.status);
    if (prevStatus === "waiting" && roomState?.status === "playing") {
      setCountdownDone(false);
    }
  }

  const handleCountdownDone = useCallback(() => {
    setCountdownDone(true);
  }, []);

  // ── Match timer ──────────────────────────────────────────────────────────
  const [localMatchMs, setLocalMatchMs] = useState<number>(serverMatchMs);

  // Re-seed from server when value changes (render-time, same pattern as Question.tsx)
  const prevServerMatchMsRef = useRef<number>(serverMatchMs);
  if (prevServerMatchMsRef.current !== serverMatchMs) {
    prevServerMatchMsRef.current = serverMatchMs;
    setLocalMatchMs(serverMatchMs);
  }

  // Tick match timer down every 100ms
  useEffect(() => {
    const id = setInterval(() => {
      setLocalMatchMs((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Cooldown timer ───────────────────────────────────────────────────────
  const [localCooldownMs, setLocalCooldownMs] = useState<number>(serverCooldownMs ?? 0);

  // Re-seed cooldown when server value changes (render-time pattern)
  const prevCooldownMsRef = useRef<number | null>(serverCooldownMs);
  if (prevCooldownMsRef.current !== serverCooldownMs) {
    prevCooldownMsRef.current = serverCooldownMs;
    setLocalCooldownMs(serverCooldownMs ?? 0);
  }

  // Tick cooldown down every 100ms (only when server says we are in cooldown)
  useEffect(() => {
    if (serverCooldownMs === null) return;
    const id = setInterval(() => {
      setLocalCooldownMs((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(id);
  }, [serverCooldownMs]);

  // ── Per-question submission gate ─────────────────────────────────────────
  const [hasSubmittedThisQuestion, setHasSubmittedThisQuestion] = useState(false);
  // Reset when question index changes (same render-time pattern as Question.tsx lines 27-32)
  const prevQuestionIndexRef = useRef<number>(questionIndex);
  if (prevQuestionIndexRef.current !== questionIndex) {
    prevQuestionIndexRef.current = questionIndex;
    setHasSubmittedThisQuestion(false);
  }

  // ── Guard: need speedBattle state ────────────────────────────────────────
  if (!speedBattle || !playerState) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-lg)",
        }}
      >
        Loading round...
      </Box>
    );
  }

  const { correctCount, wrongCount, cooldownCorrectAnswer, exhausted } = playerState;
  const currentQuestion = roomState?.currentQuestion;
  const inCooldown = serverCooldownMs !== null && serverCooldownMs > 0;
  const cardBorderTopColor = inCooldown ? "var(--color-error)" : "var(--color-accent-purple)";

  const handleOptionClick = (option: string) => {
    if (hasSubmittedThisQuestion || inCooldown) return;
    submitAnswer(option, questionIndex);
    setHasSubmittedThisQuestion(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg-primary)",
        overflow: "hidden",
      }}
    >
      {/* Countdown overlay — shown on fresh round start */}
      {!countdownDone && <CountdownOverlay onDone={handleCountdownDone} />}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: { xs: 3, sm: 5 },
          py: 2,
          background: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-subtle)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <SBBadge />
        <MatchTimerBar remainingMs={localMatchMs} />
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Q{questionIndex + 1}/100
        </Box>
      </Box>

      {/* ── Mobile leaderboard strip ─────────────────────────────────────── */}
      <LiveLeaderboard panelMode={false} />

      {/* ── Main content area ────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: { xs: 0, sm: 4 },
          px: { xs: 3, sm: 5 },
          py: { xs: 3, sm: 4 },
          overflow: "auto",
          alignItems: { xs: "stretch", sm: "flex-start" },
        }}
      >
        {/* ── Left: Question area ──────────────────────────────────────── */}
        <Box
          sx={{
            flex: { xs: "none", sm: 1 },
            display: "flex",
            flexDirection: "column",
            gap: 3,
            minWidth: 0,
          }}
        >
          {exhausted ? (
            /* Exhausted state — answered all 100 questions */
            <Box
              sx={{
                p: 6,
                background: "var(--color-bg-elevated)",
                border: "2px solid var(--color-accent-teal)",
                borderRadius: "var(--radius-lg)",
                textAlign: "center",
                animation: "cardSlideUp 0.4s ease forwards",
              }}
            >
              <Box
                component="p"
                sx={{
                  fontFamily: "var(--font-display)",
                  fontSize: { xs: "var(--font-size-xl)", sm: "var(--font-size-2xl)" },
                  color: "var(--color-accent-teal)",
                  m: 0,
                  mb: 2,
                  letterSpacing: "1px",
                }}
              >
                All 100 questions answered!
              </Box>
              <Box
                component="p"
                sx={{
                  fontSize: "var(--font-size-lg)",
                  color: "var(--color-text-secondary)",
                  m: 0,
                  mb: 1,
                }}
              >
                <Box component="span" sx={{ color: "var(--color-success-light)", fontWeight: 700 }}>
                  {correctCount}
                </Box>{" "}
                correct ·{" "}
                <Box component="span" sx={{ color: "var(--color-error-light)", fontWeight: 700 }}>
                  {wrongCount}
                </Box>{" "}
                wrong
              </Box>
              <Box
                component="p"
                sx={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", m: 0 }}
              >
                Waiting for the match to end...
              </Box>
            </Box>
          ) : currentQuestion ? (
            <>
              {/* Category label */}
              <Box
                sx={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-muted)",
                  textAlign: "left",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                {currentQuestion.category}
              </Box>

              {/* Question card */}
              <Box
                sx={{
                  position: "relative",
                  p: { xs: 4, sm: 5 },
                  background: "var(--color-bg-elevated)",
                  border: "2px solid var(--color-border-default)",
                  borderRadius: "var(--radius-lg)",
                  borderTopWidth: "3px",
                  borderTopColor: cardBorderTopColor,
                  boxShadow: inCooldown
                    ? "0 -3px 12px rgba(239, 68, 68, 0.2)"
                    : "0 -3px 12px rgba(139, 92, 246, 0.15)",
                  transition: "border-top-color 0.3s, box-shadow 0.3s",
                }}
              >
                {/* CooldownRing in top-right corner */}
                {inCooldown && (
                  <Box sx={{ position: "absolute", top: 12, right: 12 }}>
                    <CooldownRing remainingMs={localCooldownMs} totalMs={5000} size={48} />
                  </Box>
                )}

                <Box
                  component="p"
                  sx={{
                    fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-xl)" },
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    m: 0,
                    lineHeight: 1.4,
                    pr: inCooldown ? 7 : 0,
                  }}
                >
                  {currentQuestion.text}
                </Box>
              </Box>

              {/* Cooldown strip */}
              {inCooldown && cooldownCorrectAnswer && (
                <Box
                  sx={{
                    px: 4,
                    py: 2,
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-error-light)",
                    textAlign: "center",
                    animation: "slideInRight 0.3s ease forwards",
                  }}
                >
                  Wrong Answer — Locked for {Math.ceil(localCooldownMs / 1000)}s · Moving to next
                  question automatically
                </Box>
              )}

              {/* Score strip */}
              <Box
                sx={{
                  display: "flex",
                  gap: 3,
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <Box component="span" sx={{ color: "var(--color-success-light)", fontWeight: 700 }}>
                  ✓ {correctCount}
                </Box>
                <Box component="span" sx={{ color: "var(--color-error-light)", fontWeight: 700 }}>
                  ✗ {wrongCount}
                </Box>
              </Box>

              {/* Answer options */}
              {currentQuestion.options ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: { xs: 2, sm: 3 },
                  }}
                >
                  {currentQuestion.options.map((option, index) => {
                    const isCorrectOption = inCooldown && cooldownCorrectAnswer === option;
                    const disabled = hasSubmittedThisQuestion || inCooldown;

                    return (
                      <Box
                        key={option}
                        component="button"
                        onClick={() => handleOptionClick(option)}
                        disabled={disabled}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          p: { xs: "12px 20px", sm: 4 },
                          minHeight: 52,
                          background: "var(--color-bg-elevated)",
                          border: isCorrectOption
                            ? "2px solid var(--color-success)"
                            : "2px solid var(--color-border-default)",
                          borderRadius: "var(--radius-md)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          textAlign: "left",
                          transition: "all var(--transition-base)",
                          width: "100%",
                          opacity: disabled && !isCorrectOption ? 0.55 : 1,
                          boxShadow: isCorrectOption ? "0 0 12px rgba(34, 197, 94, 0.3)" : "none",
                          "&:hover:not(:disabled)": {
                            borderColor: "var(--color-accent-purple)",
                            background: "rgba(139, 92, 246, 0.08)",
                            transform: "translateY(-2px)",
                            boxShadow: "var(--shadow-glow-purple)",
                          },
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            fontFamily: "var(--font-display)",
                            fontSize: "var(--font-size-xl)",
                            fontWeight: 400,
                            color: isCorrectOption
                              ? "var(--color-success)"
                              : "var(--color-accent-teal)",
                            minWidth: 24,
                            flexShrink: 0,
                            letterSpacing: "1px",
                          }}
                        >
                          {String.fromCharCode(65 + index)}
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            color: "var(--color-text-primary)",
                            fontSize: "var(--font-size-base)",
                            fontWeight: 500,
                            lineHeight: 1.4,
                          }}
                        >
                          {option}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                /* No options: shouldn't happen in SB but guard gracefully */
                <Box
                  sx={{
                    p: 4,
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  Answer options loading...
                </Box>
              )}

              {/* Submitted (waiting for server) */}
              {hasSubmittedThisQuestion && !inCooldown && (
                <Box
                  sx={{
                    p: 3,
                    background: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-success-light)",
                  }}
                >
                  Answer submitted — awaiting next question...
                </Box>
              )}
            </>
          ) : (
            /* Brief gap between questions */
            <Box
              sx={{
                p: 6,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: "var(--font-size-base)",
              }}
            >
              Loading next question...
            </Box>
          )}
        </Box>

        {/* ── Right: Desktop leaderboard panel (U5 will extend this) ──────── */}
        <Box
          sx={{
            display: { xs: "none", sm: "flex" },
            flexDirection: "column",
            width: 220,
            flexShrink: 0,
            gap: 2,
          }}
        >
          <Box
            sx={{
              p: 4,
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Box
              sx={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--font-size-base)",
                color: "var(--color-text-muted)",
                letterSpacing: "1px",
                textAlign: "center",
              }}
            >
              LEADERBOARD
            </Box>
            {Object.entries(roomState?.players ?? {})
              .sort(([, a], [, b]) => b - a)
              .map(([pid, score], i) => (
                <Box
                  key={pid}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    px: 2,
                    py: 1,
                    background: pid === playerId ? "rgba(45, 212, 191, 0.08)" : "transparent",
                    borderRadius: "var(--radius-sm)",
                    border:
                      pid === playerId
                        ? "1px solid rgba(45, 212, 191, 0.2)"
                        : "1px solid transparent",
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-xs)",
                      color: i === 0 ? "var(--color-accent-gold)" : "var(--color-text-muted)",
                      fontWeight: i === 0 ? 700 : 400,
                      minWidth: 16,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      flex: 1,
                      fontSize: "var(--font-size-sm)",
                      color:
                        pid === playerId
                          ? "var(--color-accent-teal)"
                          : "var(--color-text-secondary)",
                      fontWeight: pid === playerId ? 700 : 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pid}
                    {pid === playerId && (
                      <Box
                        component="span"
                        sx={{ color: "var(--color-accent-teal)", fontSize: "0.85em" }}
                      >
                        {" "}
                        (You)
                      </Box>
                    )}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 700,
                      color: "var(--color-success-light)",
                    }}
                  >
                    {score}
                  </Box>
                </Box>
              ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
