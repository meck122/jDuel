---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, frontend, typescript]
dependencies: []
---

# difficulty Typed as string Instead of Union — Type Safety Gap

## Problem Statement

`RoomConfig.difficulty` is typed as `string` in `types/index.ts`. `DifficultySelector` defines a `Difficulty` type locally as `"enjoyer" | "master" | "beast"` but this is never enforced at the context boundary. The server can send any string and TypeScript accepts it silently.

## Findings

- File: `frontend/src/types/index.ts` line 3: `difficulty: string`
- File: `frontend/src/features/game/GameSettings/DifficultySelector.tsx` line 13: `currentDifficulty: string`
- The active-pill logic `currentDifficulty === option.value` can silently never match if server sends unexpected value
- `sendMessage` for `UPDATE_CONFIG` also accepts untyped `object`, compounding the gap

## Proposed Solution

```ts
// types/index.ts
export type Difficulty = "enjoyer" | "master" | "beast";

export interface RoomConfig {
  multipleChoiceEnabled: boolean;
  difficulty: Difficulty;
}
```

Update `DifficultySelector` to use `Difficulty` instead of `string`.

## Acceptance Criteria
- [ ] `Difficulty` union type exported from `types/index.ts`
- [ ] `RoomConfig.difficulty` typed as `Difficulty`
- [ ] `DifficultySelector` props use `Difficulty`
- [ ] TypeScript compiler catches invalid difficulty values

## Work Log
- 2026-03-22: Identified by `kieran-typescript-reviewer` review agent
