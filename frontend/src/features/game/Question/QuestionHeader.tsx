/**
 * QuestionHeader - Compact inline header for Question view.
 *
 * Displays question number and category on a single line.
 * Height: ~24px (down from ~60px stacked layout)
 */

import { Box } from "@mui/material";

interface QuestionHeaderProps {
  questionIndex: number;
  totalQuestions: number;
  category: string;
}

export function QuestionHeader({ questionIndex, totalQuestions, category }: QuestionHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        fontSize: { xs: "var(--font-size-xs)", sm: "var(--font-size-sm)" },
        color: "var(--color-text-secondary)",
        mb: { xs: 2, sm: 1 },
        flexShrink: 0,
      }}
    >
      <Box
        component="span"
        sx={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-teal)", fontWeight: 600 }}
      >
        Q{questionIndex + 1}/{totalQuestions}
      </Box>
      <Box component="span" sx={{ color: "var(--color-text-muted)" }}>
        •
      </Box>
      <Box component="span" sx={{ color: "var(--color-text-secondary)" }}>
        {category}
      </Box>
    </Box>
  );
}
