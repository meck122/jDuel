/**
 * Components module exports.
 *
 * Organized by type:
 * - common: Reusable UI components (Timer, etc.)
 * - layout: Page layout components (PageContainer, etc.)
 * - ui: Standalone UI components (About, Navigation)
 *
 * Game-specific components are in src/features/game/
 */

// Common components
export { Timer } from "./common/Timer/Timer";

// Layout components
export { PageContainer } from "./layout/PageContainer/PageContainer";

// UI components
export * from "./ui";
