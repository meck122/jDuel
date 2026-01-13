/**
 * Components module exports.
 *
 * Components are organized by type:
 * - common: Reusable UI components (Timer, etc.)
 * - layout: Page layout components (PageContainer, etc.)
 * - pages: Standalone page components (About, Navigation)
 *
 * Game-specific components are in src/features/game/
 */

// Common components
export * from "./common";

// Layout components
export { PageContainer } from "./layout/PageContainer";

// Page-level components
export { Navigation } from "./Navigation/Navigation";
export { About } from "./About/About";
