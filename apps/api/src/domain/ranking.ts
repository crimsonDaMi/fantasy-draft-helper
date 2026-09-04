export type FantasyPosition =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DEF";

export interface Ranking {
  rank: number;

  playerName: string;

  team?: string;

  position?: FantasyPosition;

  sleeperPlayerId?: string;

  tier?: string;
}