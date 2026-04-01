import { ReactNode } from "react";
import { Box } from "@mui/material";

interface PageContainerProps {
  children: ReactNode;
  centered?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "full";
}

const maxWidthMap = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  full: "100%",
};

export const PageContainer = ({
  children,
  centered = true,
  maxWidth = "md",
}: PageContainerProps) => {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        width: "100%",
        py: { xs: 2, sm: 7 },
        px: { xs: 2, sm: 6 },
        overflowY: { xs: "auto", sm: "visible" },
        ...(centered && {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }),
        maxWidth: maxWidthMap[maxWidth],
        mx: "auto",
      }}
    >
      {children}
    </Box>
  );
};
