import { ReactNode } from "react";
import styles from "./PageContainer.module.css";

interface PageContainerProps {
  children: ReactNode;
  centered?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "full";
}

export const PageContainer = ({
  children,
  centered = true,
  maxWidth = "md",
}: PageContainerProps) => {
  const containerClasses = [
    styles.container,
    centered ? styles.centered : "",
    styles[maxWidth],
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={containerClasses}>{children}</div>;
};
