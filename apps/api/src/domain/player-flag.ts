/** A per-ranking marker on a player: `watch` highlights them in the
 * recommendations, `avoid` hides them there (until shown again). */
export const PLAYER_FLAGS = ["watch", "avoid"] as const;

export type PlayerFlag = (typeof PLAYER_FLAGS)[number];
