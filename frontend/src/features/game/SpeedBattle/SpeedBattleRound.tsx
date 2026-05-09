/**
 * SpeedBattleRound - Main in-round component for Speed Battle game mode.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { SBBadge } from "./SBBadge";
import { MatchTimerBar } from "./MatchTimerBar";
import { CountdownOverlay } from "./CountdownOverlay";
import { CooldownRing } from "./CooldownRing";
import { LiveLeaderboard } from "./LiveLeaderboard";

// Match is 3 minutes; countdown is ~3.2s.
// If the match has been running for longer than the countdown duration when
// we mount, we're reconnecting mid-round — skip the countdown.
const MATCH_TIME_MS = 180_000;
const COUNTDOWN_DURATION_MS = 3_200;

export function SpeedBattleRound() {
  const { roomState, submitAnswer } = useGame();

  const speedBattle = roomState?.speedBattle;
  const playerState = speedBattle?.playerState;
  const questionIndex = playerState?.questionIndex ?? 0;
  const serverMatchMs = speedBattle?.matchRemainingMs ?? 0;
  const serverCooldownMs = playerState?.cooldownRemainingMs ?? null;

  // ── Countdown gate ───────────────────────────────────────────────────────
  // Skip countdown on reconnect (match already underway) by checking how much
  // time has elapsed. Fresh starts have matchRemainingMs ≈ MATCH_TIME_MS.
  const [countdownDone, setCountdownDone] = useState<boolean>(() => {
    const remaining = roomState?.speedBattle?.matchRemainingMs ?? MATCH_TIME_MS;
    return remaining < MATCH_TIME_MS - COUNTDOWN_DURATION_MS;
  });

  const handleCountdownDone = useCallback(() => setCountdownDone(true), []);

  // ── Match timer ──────────────────────────────────────────────────────────
  // Re-seed from server on every broadcast, tick down 100ms between updates.
  // The server broadcasts on each player answer, so drift is bounded to the
  // inter-answer window. useEffect re-seed avoids calling impure time functions
  // in the render/effect body (React Compiler purity rule).
  const [localMatchMs, setLocalMatchMs] = useState<number>(serverMatchMs);
  useEffect(() => {
    setLocalMatchMs(serverMatchMs);
  }, [serverMatchMs]);
  useEffect(() => {
    const id = setInterval(() => {
      setLocalMatchMs((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Cooldown timer ───────────────────────────────────────────────────────
  const [localCooldownMs, setLocalCooldownMs] = useState<number>(serverCooldownMs ?? 0);
  useEffect(() => {
    setLocalCooldownMs(serverCooldownMs ?? 0);
  }, [serverCooldownMs]);
  useEffect(() => {
    if (serverCooldownMs === null) return;
    const id = setInterval(() => {
      setLocalCooldownMs((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => clearInterval(id);
  }, [serverCooldownMs]);

  // ── Correct-answer feedback ──────────────────────────────────────────────
  // When the player submits a correct answer, snapshot their selection and the
  // current options so we can show a green highlight for 600ms BEFORE the new
  // question appears (the server advances questionIndex almost instantly).
  const [submittedFlash, setSubmittedFlash] = useState<{
    options: string[];
    selected: string;
  } | null>(null);

  const [hasSubmittedThisQuestion, setHasSubmittedThisQuestion] = useState(false);

  // Detect question advance. submittedFlash is in the dep array so the effect
  // reads the current value without needing a render-time ref write.
  const prevQuestionIndexRef = useRef(questionIndex);
  useEffect(() => {
    if (questionIndex === prevQuestionIndexRef.current) return;
    prevQuestionIndexRef.current = questionIndex;

    if (submittedFlash) {
      // Submitted + question advanced → correct answer. Hold the green flash
      // for 600ms so the player sees confirmation before the next question loads.
      const t = setTimeout(() => {
        setSubmittedFlash(null);
        setHasSubmittedThisQuestion(false);
      }, 600);
      return () => clearTimeout(t);
    } else {
      // Cooldown ended (or no answer) → just advance
      setHasSubmittedThisQuestion(false);
    }
  }, [questionIndex, submittedFlash]);

  // Clear the flash immediately if a cooldown starts (wrong answer confirmed)
  useEffect(() => {
    if (serverCooldownMs !== null && submittedFlash) {
      setSubmittedFlash(null);
    }
  }, [serverCooldownMs, submittedFlash]);

  // ── Guard ────────────────────────────────────────────────────────────────
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

  // During the correct-answer flash, show the snapshot options so the player
  // sees their selection highlighted even after the server has advanced.
  const displayOptions = submittedFlash?.options ?? currentQuestion?.options;
  const showingCorrectFlash = submittedFlash !== null && !inCooldown;

  const handleOptionClick = (option: string) => {
    if (hasSubmittedThisQuestion || inCooldown) return;
    submitAnswer(option, questionIndex);
    setHasSubmittedThisQuestion(true);
    if (currentQuestion?.options) {
      setSubmittedFlash({ options: currentQuestion.options, selected: option });
    }
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
      {!countdownDone && <CountdownOverlay onDone={handleCountdownDone} />}

      {/* Top bar */}
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
          Q{questionIndex + 1}
        </Box>
      </Box>

      {/* Mobile leaderboard strip */}
      <LiveLeaderboard />

      {/* Main content */}
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
        {/* Question area */}
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
            <Box
              sx={{
                p: 6,
                background: "var(--color-bg-elevated)",
                border: "2px solid var(--color-accent-teal)",
                borderRadius: "var(--radius-lg)",
                textAlign: "center",
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
                All questions answered!
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
          ) : currentQuestion || showingCorrectFlash ? (
            <>
              {/* Category */}
              {!showingCorrectFlash && (
                <Box
                  sx={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-muted)",
                    textAlign: "left",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                  }}
                >
                  {currentQuestion?.category}
                </Box>
              )}

              {/* Question card */}
              <Box
                sx={{
                  position: "relative",
                  p: { xs: 4, sm: 5 },
                  background: showingCorrectFlash
                    ? "rgba(34, 197, 94, 0.06)"
                    : "var(--color-bg-elevated)",
                  border: "2px solid var(--color-border-default)",
                  borderRadius: "var(--radius-lg)",
                  borderTopWidth: "3px",
                  borderTopColor: showingCorrectFlash ? "var(--color-success)" : cardBorderTopColor,
                  boxShadow: showingCorrectFlash
                    ? "0 -3px 12px rgba(34, 197, 94, 0.25)"
                    : inCooldown
                      ? "0 -3px 12px rgba(239, 68, 68, 0.2)"
                      : "0 -3px 12px rgba(139, 92, 246, 0.15)",
                  transition: "border-top-color 0.3s, box-shadow 0.3s, background 0.3s",
                }}
              >
                {inCooldown && (
                  <Box sx={{ position: "absolute", top: 12, right: 12 }}>
                    <CooldownRing remainingMs={localCooldownMs} totalMs={5000} size={48} />
                  </Box>
                )}

                {showingCorrectFlash ? (
                  <Box
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontSize: { xs: "var(--font-size-xl)", sm: "var(--font-size-2xl)" },
                      color: "var(--color-success-light)",
                      letterSpacing: "2px",
                      textAlign: "center",
                    }}
                  >
                    ✓ Correct!
                  </Box>
                ) : (
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
                    {currentQuestion?.text}
                  </Box>
                )}
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
              {displayOptions ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: { xs: 2, sm: 3 },
                  }}
                >
                  {displayOptions.map((option, index) => {
                    const isCorrectReveal = inCooldown && cooldownCorrectAnswer === option;
                    const isSelectedCorrect =
                      showingCorrectFlash && submittedFlash?.selected === option;
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
                          background: isSelectedCorrect
                            ? "rgba(34, 197, 94, 0.12)"
                            : "var(--color-bg-elevated)",
                          border: isCorrectReveal
                            ? "2px solid var(--color-success)"
                            : isSelectedCorrect
                              ? "2px solid var(--color-success)"
                              : "2px solid var(--color-border-default)",
                          borderRadius: "var(--radius-md)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          textAlign: "left",
                          transition: "all var(--transition-base)",
                          width: "100%",
                          opacity: disabled && !isCorrectReveal && !isSelectedCorrect ? 0.55 : 1,
                          boxShadow:
                            isCorrectReveal || isSelectedCorrect
                              ? "0 0 12px rgba(34, 197, 94, 0.3)"
                              : "none",
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
                            color:
                              isCorrectReveal || isSelectedCorrect
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
            </>
          ) : (
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

        {/* Desktop leaderboard panel */}
        <Box
          sx={{
            display: { xs: "none", sm: "flex" },
            flexDirection: "column",
            width: { sm: 220, md: 260 },
            flexShrink: 0,
          }}
        >
          <LiveLeaderboard compact={false} />
        </Box>
      </Box>
    </Box>
  );
}
