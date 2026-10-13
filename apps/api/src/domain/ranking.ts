export const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

export type FantasyPosition = (typeof FANTASY_POSITIONS)[number];

export function isFantasyPosition(value: string): value is FantasyPosition {
  return (FANTASY_POSITIONS as readonly string[]).includes(value);
}

/** Keeps a note to what fits a draft-day glance. */
export const MAX_NOTE_LENGTH = 500;

export interface Ranking {
  rank: number;
  playerName: string;
  team?: string;
  position?: FantasyPosition;
  sleeperPlayerId?: string;
  tier?: string;
  /** The player's bye week, from the CSV (Sleeper's API has none). */
  bye?: number;
  /** The user's note on the player, from the CSV or the ranking editor. */
  note?: string;
}
