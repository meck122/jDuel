import { Reaction } from "../types";

type ReactionListener = (reaction: Reaction) => void;

const listeners = new Set<ReactionListener>();

export function emitReaction(reaction: Reaction): void {
  listeners.forEach((fn) => fn(reaction));
}

export function subscribeToReactions(listener: ReactionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
