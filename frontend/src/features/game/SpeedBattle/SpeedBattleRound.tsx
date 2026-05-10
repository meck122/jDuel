/**
 * SpeedBattleRound - Main in-round component for Speed Battle game mode.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { useGame } from "../../../contexts";
import { SBBadge } from "./SBBadge";
import { MatchTimerBar } from "./MatchTimerBar";
import { CountdownOverlay } from "./CountdownOverlay";
import { LiveLeaderboard } from "./LiveLeaderboard";

// Match is 3 minutes; countdown is ~3.2s.
// If the match has been running for longer than the countdown duration when
// we mount, we're reconnecting mid-round — skip the countdown.
const MATCH_TIME_MS = 180_000;
const COUNTDOWN_DURATION_MS = 3_200;

export function SpeedBattleRound() {
  const { roomState, submitAnswer } = useGame();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const speedBattle = roomState?.speedBattle;
  const playerState = speedBattle?.playerState;
  const questionIndex = playerState?.questionIndex ?? 0;
  const serverMatchMs = speedBattle?.matchRemainingMs ?? 0;
  const serverCooldownMs = playerState?.cooldownRemainingMs ?? null;

  // ── Countdown gate ───────────────────────────────────────────────────────
  const [countdownDone, setCountdownDone] = useState<boolean>(() => {
    const remaining = roomState?.speedBattle?.matchRemainingMs ?? MATCH_TIME_MS;
    return remaining < MATCH_TIME_MS - COUNTDOWN_DURATION_MS;
  });

  const handleCountdownDone = useCallback(() => setCountdownDone(true), []);

  // ── Match timer ──────────────────────────────────────────────────────────
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
  const [submittedFlash, setSubmittedFlash] = useState<{
    options: string[];
    selected: string;
  } | null>(null);

  const [hasSubmittedThisQuestion, setHasSubmittedThisQuestion] = useState(false);
  // Captures the option the player chose when it turns out to be wrong.
  // submittedFlash is cleared on cooldown start, so we snapshot before that.
  const [wrongSelectedOption, setWrongSelectedOption] = useState<string | null>(null);

  const prevQuestionIndexRef = useRef(questionIndex);
  useEffect(() => {
    if (questionIndex === prevQuestionIndexRef.current) return;
    prevQuestionIndexRef.current = questionIndex;

    if (submittedFlash) {
      const t = setTimeout(() => {
        setSubmittedFlash(null);
        setHasSubmittedThisQuestion(false);
      }, 600);
      return () => clearTimeout(t);
    } else {
      setHasSubmittedThisQuestion(false);
      setWrongSelectedOption(null);
    }
  }, [questionIndex, submittedFlash]);

  useEffect(() => {
    if (serverCooldownMs !== null && submittedFlash) {
      setWrongSelectedOption(submittedFlash.selected);
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

  // Card state colors
  const cardBorderTopColor = inCooldown
    ? "var(--color-error)"
    : showingCorrectFlash
      ? "var(--color-success)"
      : "var(--color-accent-purple)";

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

      {/* Top bar: jDuel · ⚡ Speed Battle · [spacer] · ⏱ Timer · [spacer] · Q{n} */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 1.5, sm: 2 },
          px: { xs: 4, sm: 6 },
          py: 2,
          background: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border-subtle)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* jDuel logo */}
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "1.6rem",
            letterSpacing: "0.15em",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          <Box component="span" sx={{ color: "var(--color-accent-purple)" }}>
            j
          </Box>
          <Box component="span" sx={{ color: "var(--color-accent-gold)" }}>
            Duel
          </Box>
        </Box>

        <SBBadge />

        {/* Spacer — centers the timer */}
        <Box sx={{ flex: 1 }} />

        <MatchTimerBar remainingMs={localMatchMs} totalMs={MATCH_TIME_MS} compact={isMobile} />

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Q counter */}
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

      {/* Mobile leaderboard: top-3 mini-podium strip */}
      <LiveLeaderboard compact={true} />

      {/* Body */}
      <Box
        sx={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: { xs: 0, sm: 4 },
          px: { xs: 3, sm: 5 },
          py: { xs: 1.5, sm: 4 },
        }}
      >
        {/* Question column — vertically centered */}
        <Box
          sx={{
            flex: "1 1 0",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: { xs: "flex-start", sm: "center" },
            gap: { xs: 2, sm: 3 },
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
              {/* Question meta row: Q{n} · category · [locked/correct pill] */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  flexWrap: "nowrap",
                }}
              >
                <Box
                  component="span"
                  sx={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentQuestion?.category}
                </Box>

                {/* Locked pill with countdown */}
                {inCooldown && (
                  <Box
                    component="span"
                    sx={{
                      ml: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--font-size-xs)",
                      letterSpacing: "1px",
                      color: "var(--color-error)",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      px: 2,
                      py: 0.5,
                      borderRadius: "var(--radius-full)",
                      animation: "timerPulse 0.8s ease infinite",
                      flexShrink: 0,
                    }}
                  >
                    🔒 Locked
                    <Box component="span" sx={{ color: "var(--color-border-emphasis)" }}>
                      ·
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        minWidth: 14,
                        textAlign: "center",
                      }}
                    >
                      {Math.ceil(localCooldownMs / 1000)}s
                    </Box>
                  </Box>
                )}

                {/* Correct pill */}
                {showingCorrectFlash && (
                  <Box
                    component="span"
                    sx={{
                      ml: "auto",
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--font-size-xs)",
                      letterSpacing: "1px",
                      color: "var(--color-success)",
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      px: 2,
                      py: 0.5,
                      borderRadius: "var(--radius-full)",
                      flexShrink: 0,
                    }}
                  >
                    ✓ Correct!
                  </Box>
                )}
              </Box>

              {/* Question card — visual anchor. Cooldown bar on top edge. */}
              <Box
                sx={{
                  position: "relative",
                  p: { xs: "22px 22px", sm: "28px 32px" },
                  background: inCooldown
                    ? "var(--color-bg-elevated)"
                    : showingCorrectFlash
                      ? "rgba(34,197,94,0.06)"
                      : "var(--color-bg-elevated)",
                  border: "2px solid",
                  borderColor: inCooldown
                    ? "rgba(239,68,68,0.4)"
                    : showingCorrectFlash
                      ? "rgba(34,197,94,0.4)"
                      : "var(--color-border-default)",
                  borderTopColor: cardBorderTopColor,
                  borderTopWidth: 3,
                  borderRadius: "var(--radius-lg)",
                  boxShadow: inCooldown
                    ? "0 0 12px rgba(239,68,68,0.15)"
                    : showingCorrectFlash
                      ? "0 0 12px rgba(34,197,94,0.15)"
                      : "var(--shadow-lg)",
                  transition: "border-color 0.3s, box-shadow 0.3s, background 0.3s",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {/* Cooldown progress bar — drains across the top edge during 5s lockout */}
                {inCooldown && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: "rgba(239,68,68,0.15)",
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        width: `${(localCooldownMs / 5000) * 100}%`,
                        background: "var(--color-error)",
                        transition: "width 0.1s linear",
                        boxShadow: "0 0 8px rgba(239,68,68,0.5)",
                      }}
                    />
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
                      fontSize: {
                        xs: "clamp(1.1rem, 4.5vw, 1.5rem)",
                        sm: "clamp(1.25rem, 2.8vw, 2rem)",
                      },
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      m: 0,
                      lineHeight: 1.35,
                    }}
                  >
                    {currentQuestion?.text}
                  </Box>
                )}
              </Box>

              {/* Answer options — 2 columns on all sizes */}
              {displayOptions ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: { xs: 2, sm: 3 },
                    gridAutoRows: { xs: "minmax(64px, auto)", sm: "minmax(72px, auto)" },
                  }}
                >
                  {displayOptions.map((option, index) => {
                    const letter = String.fromCharCode(65 + index);
                    const isCorrectReveal = inCooldown && cooldownCorrectAnswer === option;
                    const isWrongSelected =
                      inCooldown &&
                      wrongSelectedOption === option &&
                      cooldownCorrectAnswer !== option;
                    const isSelectedCorrect =
                      showingCorrectFlash && submittedFlash?.selected === option;
                    const disabled = hasSubmittedThisQuestion || inCooldown;

                    const dimmed =
                      disabled && !isCorrectReveal && !isWrongSelected && !isSelectedCorrect;

                    const cardBg =
                      isCorrectReveal || isSelectedCorrect
                        ? "rgba(34,197,94,0.12)"
                        : isWrongSelected
                          ? "rgba(239,68,68,0.1)"
                          : "var(--color-bg-elevated)";

                    const cardBorder =
                      isCorrectReveal || isSelectedCorrect
                        ? "2px solid var(--color-success)"
                        : isWrongSelected
                          ? "2px solid var(--color-error)"
                          : "2px solid var(--color-border-default)";

                    const chipBg =
                      isCorrectReveal || isSelectedCorrect
                        ? "rgba(34,197,94,0.2)"
                        : isWrongSelected
                          ? "rgba(239,68,68,0.2)"
                          : "var(--color-bg-hover)";

                    const chipColor =
                      isCorrectReveal || isSelectedCorrect
                        ? "var(--color-success)"
                        : isWrongSelected
                          ? "var(--color-error)"
                          : "var(--color-accent-teal)";

                    const cardGlow =
                      isCorrectReveal || isSelectedCorrect
                        ? "0 0 12px rgba(34,197,94,0.25)"
                        : isWrongSelected
                          ? "0 0 10px rgba(239,68,68,0.2)"
                          : "none";

                    const resultIcon =
                      isCorrectReveal || isSelectedCorrect ? "✓" : isWrongSelected ? "✗" : "";
                    const resultColor =
                      isCorrectReveal || isSelectedCorrect
                        ? "var(--color-success)"
                        : isWrongSelected
                          ? "var(--color-error)"
                          : "transparent";

                    return (
                      <Box
                        key={option}
                        component="button"
                        onClick={() => handleOptionClick(option)}
                        disabled={disabled}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto",
                          alignItems: "center",
                          gap: { xs: 1.5, sm: 2 },
                          p: { xs: "10px 12px", sm: "12px 16px" },
                          background: cardBg,
                          border: cardBorder,
                          borderRadius: "var(--radius-md)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          width: "100%",
                          textAlign: "center",
                          boxShadow: cardGlow,
                          transition: "all var(--transition-fast)",
                          opacity: dimmed ? 0.45 : 1,
                          "&:hover:not(:disabled)": {
                            borderColor: "var(--color-accent-purple)",
                            background: "rgba(139,92,246,0.08)",
                            transform: "translateY(-2px)",
                            boxShadow: "var(--shadow-glow-purple)",
                          },
                        }}
                      >
                        {/* Circular letter chip */}
                        <Box
                          component="span"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: chipBg,
                            color: chipColor,
                            fontFamily: "var(--font-display)",
                            fontSize: "var(--font-size-base)",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {letter}
                        </Box>

                        {/* Answer text */}
                        <Box
                          component="span"
                          sx={{
                            fontFamily: "var(--font-display)",
                            fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
                            letterSpacing: "0.5px",
                            color:
                              isCorrectReveal || isSelectedCorrect
                                ? "var(--color-success)"
                                : isWrongSelected
                                  ? "var(--color-error)"
                                  : "var(--color-text-primary)",
                            overflowWrap: "anywhere",
                            lineHeight: 1.25,
                            textAlign: "center",
                          }}
                        >
                          {option}
                        </Box>

                        {/* Result icon — invisible spacer when no state */}
                        <Box
                          component="span"
                          sx={{
                            width: 18,
                            display: "flex",
                            justifyContent: "flex-end",
                            color: resultColor,
                            fontSize: "var(--font-size-base)",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {resultIcon}
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

              {/* Wrong answer explanation banner */}
              {inCooldown && cooldownCorrectAnswer && (
                <Box
                  sx={{
                    px: 4,
                    py: 3,
                    mx: { xs: 1, sm: 2 },
                    background: "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    animation: "formReveal 0.3s ease both",
                  }}
                >
                  <Box component="span" sx={{ fontSize: "1.25rem" }}>
                    ⏸
                  </Box>
                  <Box>
                    <Box
                      sx={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-error)",
                        letterSpacing: "1px",
                        mb: 0.5,
                      }}
                    >
                      Wrong Answer — Locked for {Math.ceil(localCooldownMs / 1000)}s
                    </Box>
                    <Box sx={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      Moving to next question automatically.
                    </Box>
                  </Box>
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
