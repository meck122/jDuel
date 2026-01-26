/**
 * Game utility functions.
 */

/**
 * Sort players by score in descending order.
 * @param players Record of player names to scores
 * @returns Array of [playerName, score] tuples sorted by score descending
 */
export function sortPlayersByScore(
  players: Record<string, number>,
): [string, number][] {
  return Object.entries(players).sort(([, a], [, b]) => b - a);
}
