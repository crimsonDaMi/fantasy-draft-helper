export const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

export type FantasyPosition = (typeof FANTASY_POSITIONS)[number];

export interface Ranking {
  rank: number;

  playerName: string;

  team?: string;

  position?: FantasyPosition;

  sleeperPlayerId?: string;

  tier?: string;
}
