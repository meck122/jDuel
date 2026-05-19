import { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, IconButton, Box } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll="paper"
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: "var(--color-bg-primary)",
          border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 0,
          pt: 3,
          px: 4,
        }}
      >
        <Box
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-2xl)",
            fontWeight: 400,
            letterSpacing: "4px",
            lineHeight: 1,
            textShadow: "0 4px 20px rgba(139,92,246,0.3)",
          }}
        >
          <Box component="span" sx={{ color: "var(--color-accent-purple)" }}>
            j
          </Box>
          <Box component="span" sx={{ color: "var(--color-accent-gold)" }}>
            Duel
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close"
          sx={{ color: "var(--color-text-muted)" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 4, pt: 4, pb: 5, display: "flex", flexDirection: "column", gap: 6 }}>
        <Section title="What is jDuel?">
          <Body>
            A free, real-time multiplayer trivia game — no account required. Create a room, share
            the code with friends, and play instantly in any browser.
          </Body>
        </Section>

        <Section title="Game Modes">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <ModeCard
              icon="🎮"
              name="Classic"
              description="Take turns answering timed questions. Faster correct answers score higher — speed matters."
            />
            <ModeCard
              icon="⚡"
              name="Speed Battle"
              gold
              description="A 3-minute free-for-all. Answer as many as you can. Wrong answers lock you out for 5 seconds and reveal the correct answer."
            />
          </Box>
        </Section>

        <Section title="FAQ">
          <Box component="dl" sx={{ m: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <FaqItem q="How does answer checking work?">
              jDuel uses NLP-powered verification that accepts paraphrased answers and tolerates
              typos — you don't need the exact wording. Numeric answers (dates, counts) require an
              exact match.
            </FaqItem>
            <FaqItem q="How many players can join?">
              Up to 20 per room. The host can start whenever everyone is ready — there's no minimum.
            </FaqItem>
            <FaqItem q="Do I need an account?">
              No account, no sign-up, no app download. Enter a name and a room code and you're in.
            </FaqItem>
          </Box>
        </Section>

        <Box
          component="p"
          sx={{
            m: 0,
            textAlign: "center",
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-disabled)",
            letterSpacing: "1px",
          }}
        >
          Built by{" "}
          <Box component="span" sx={{ color: "var(--color-text-muted)" }}>
            Mark Liao
          </Box>
          , named after his friend{" "}
          <Box component="span" sx={{ color: "var(--color-text-muted)" }}>
            Josh
          </Box>
          .
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box
        component="h2"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "var(--font-size-lg)", sm: "var(--font-size-xl)" },
          fontWeight: 400,
          color: "var(--color-accent-purple)",
          letterSpacing: "2px",
          m: 0,
        }}
      >
        {title}
      </Box>
      {children}
    </Box>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <Box
      component="p"
      sx={{
        m: 0,
        fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
        color: "var(--color-text-secondary)",
        lineHeight: 1.8,
      }}
    >
      {children}
    </Box>
  );
}

function ModeCard({
  icon,
  name,
  description,
  gold,
}: {
  icon: string;
  name: string;
  description: string;
  gold?: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 3,
        alignItems: "flex-start",
        p: { xs: 3, sm: 4 },
        background: gold ? "rgba(251,191,36,0.05)" : "rgba(139,92,246,0.06)",
        border: "1px solid",
        borderColor: gold ? "rgba(251,191,36,0.25)" : "rgba(139,92,246,0.25)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <Box sx={{ fontSize: "1.25rem", flexShrink: 0, lineHeight: 1.4 }}>{icon}</Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-display)",
            fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
            letterSpacing: "1.5px",
            color: gold ? "var(--color-accent-gold)" : "var(--color-accent-purple)",
          }}
        >
          {name}
        </Box>
        <Box
          component="p"
          sx={{
            m: 0,
            fontSize: { xs: "var(--font-size-xs)", sm: "var(--font-size-sm)" },
            color: "var(--color-text-secondary)",
            lineHeight: 1.75,
          }}
        >
          {description}
        </Box>
      </Box>
    </Box>
  );
}

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box
        component="dt"
        sx={{
          fontFamily: "var(--font-display)",
          fontSize: { xs: "var(--font-size-sm)", sm: "var(--font-size-base)" },
          color: "var(--color-text-primary)",
          letterSpacing: "1px",
        }}
      >
        {q}
      </Box>
      <Box
        component="dd"
        sx={{
          m: 0,
          fontSize: { xs: "var(--font-size-xs)", sm: "var(--font-size-sm)" },
          color: "var(--color-text-secondary)",
          lineHeight: 1.8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
