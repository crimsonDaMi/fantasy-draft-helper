export interface RankingTier {
  /** Internal alphabetical label — "S" (best), then "A", "B", ... */
  label: string;

  /** 1-based position in the tier sequence; 1 = best (maps to "S"). */
  position: number;

  /** Number of ranked players currently assigned to this tier. */
  playerCount: number;
}
