/**
 * Question - Displays current question and accepts answers.
 *
 * Shows:
 * - Question number and category
 * - Question text
 * - Timer countdown
 * - Answer input form
 */

import { ChangeEvent, FormEvent, useState, useRef, useEffect } from "react";
import { Box } from "@mui/material";
import { useGame } from "../../../contexts";
import { Timer } from "../../../components";
import { QuestionHeader } from "./QuestionHeader";

export function Question() {
  const { roomState, submitAnswer } = useGame();
  const [answer, setAnswer] = useState<string>("");
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  const questionIndex = roomState?.questionIndex ?? 0;
  const currentQuestion = roomState?.currentQuestion;
  const timeRemainingMs = roomState?.timeRemainingMs ?? 0;

  // Reset submission state when question changes
  const prevQuestionIndexRef = useRef<number>(questionIndex);
  if (prevQuestionIndexRef.current !== questionIndex) {
    prevQuestionIndexRef.current = questionIndex;
    setHasSubmitted(false);
    setAnswer("");
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (answer && !hasSubmitted) {
      submitAnswer(answer);
      setHasSubmitted(true);
    }
  };

  // Lock scroll on mobile while question is visible
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (!currentQuestion) {
    return null;
  }

  return (
    <Box
      sx={{
        width: "100%",
        my: { xs: 0, sm: 6 },
        position: { xs: "fixed", sm: "static" },
        inset: { xs: 0, sm: "auto" },
        py: { xs: 2, sm: 0 },
        px: { xs: 4, sm: 0 },
        overflow: { xs: "hidden", sm: "visible" },
        display: { xs: "flex", sm: "block" },
        flexDirection: "column",
        zIndex: { xs: 1, sm: "auto" },
        background: { xs: "var(--color-bg-primary)", sm: "transparent" },
      }}
    >
      <QuestionHeader
        questionIndex={questionIndex}
        totalQuestions={roomState?.totalQuestions ?? 10}
        category={currentQuestion.category}
      />
      <Timer timeRemainingMs={timeRemainingMs} resetKey={questionIndex} />

      {/* Question text */}
      <Box
        sx={{
          mt: { xs: 1, sm: 2 },
          mb: { xs: 2, sm: 4 },
          mx: { xs: "auto", sm: 0 },
          flexShrink: 0,
          maxWidth: { xs: 340, sm: "none" },
        }}
      >
        <Box
          component="p"
          sx={{
            fontSize: { xs: "var(--font-size-base)", sm: "var(--font-size-2xl)" },
            fontWeight: 500,
            color: "var(--color-text-primary)",
            m: 0,
            p: { xs: 4, sm: 5 },
            background: "var(--color-bg-elevated)",
            borderRadius: "var(--radius-lg)",
            lineHeight: { xs: 1.4, sm: 1.3 },
            border: {
              xs: "1px solid var(--color-border-default)",
              sm: "2px solid var(--color-border-default)",
            },
            borderTopWidth: { xs: "2px", sm: "3px" },
            borderTopColor: "var(--color-accent-purple)",
            boxShadow: {
              xs: "none",
              sm: "var(--shadow-md), 0 -3px 12px rgba(139, 92, 246, 0.15)",
            },
          }}
        >
          {currentQuestion.text}
        </Box>
      </Box>

      {!hasSubmitted ? (
        currentQuestion.options ? (
          /* Multiple choice options grid */
          <Box
            sx={{
              display: { xs: "flex", sm: "grid" },
              flexDirection: "column",
              gridTemplateColumns: { sm: "1fr 1fr" },
              gap: { xs: 2, sm: 4 },
              maxWidth: { xs: "100%", sm: 600 },
              mx: "auto",
              mt: { xs: 2, sm: 5 },
              flex: { xs: 1, sm: "initial" },
              minHeight: { xs: 0, sm: "auto" },
              justifyContent: { xs: "center", sm: "initial" },
              alignItems: { xs: "stretch", sm: "initial" },
            }}
          >
            {currentQuestion.options.map((option, index) => (
              <Box
                key={option}
                component="button"
                onClick={() => {
                  submitAnswer(option);
                  setHasSubmitted(true);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  p: { xs: "16px 24px", sm: 5 },
                  minHeight: { xs: 48, sm: 56 },
                  background: "var(--color-bg-elevated)",
                  border: "2px solid var(--color-border-default)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all var(--transition-base)",
                  width: "100%",
                  flex: { xs: 1, sm: "initial" },
                  "&:hover": {
                    borderColor: "var(--color-accent-purple)",
                    background: "rgba(139, 92, 246, 0.08)",
                    transform: "translateY(-2px)",
                    boxShadow: "var(--shadow-glow-purple)",
                    filter: "none",
                  },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--font-size-xl)",
                    fontWeight: 400,
                    color: "var(--color-accent-teal)",
                    minWidth: 28,
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
            ))}
          </Box>
        ) : (
          /* Free-text answer form */
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: { xs: 2, sm: 4 },
              maxWidth: { xs: "100%", sm: 500 },
              mx: "auto",
              mt: 5,
            }}
          >
            <Box
              component="input"
              type="text"
              placeholder="Your answer"
              value={answer}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAnswer(e.target.value)}
              autoFocus
              sx={{
                flex: 1,
                width: { xs: "100%", sm: "auto" },
                fontSize: { xs: "1rem", sm: undefined },
                p: { xs: "16px", sm: undefined },
              }}
            />
            <Box
              component="button"
              type="submit"
              sx={{
                width: { xs: "100%", sm: "auto" },
                p: { xs: "16px 32px", sm: undefined },
                fontSize: { xs: "var(--font-size-lg)", sm: undefined },
              }}
            >
              Submit
            </Box>
          </Box>
        )
      ) : (
        /* Submitted state */
        <Box
          sx={{
            mt: 6,
            p: 5,
            background: "rgba(34, 197, 94, 0.1)",
            border: "2px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "var(--radius-md)",
            textAlign: "center",
          }}
        >
          <Box
            component="p"
            sx={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-xl)",
              color: "var(--color-success)",
              m: 0,
              mb: 2,
              letterSpacing: "1px",
            }}
          >
            ✓ Answer submitted!
          </Box>
          <Box
            component="p"
            sx={{
              color: "var(--color-text-muted)",
              fontStyle: "italic",
              m: 0,
            }}
          >
            Waiting for next question...
          </Box>
        </Box>
      )}
    </Box>
  );
}
