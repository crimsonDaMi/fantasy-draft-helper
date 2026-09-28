import { Player } from "./player.js";
import { Ranking } from "./ranking.js";
import { Draft, DraftPick, DraftStatus } from "./draft.js";

interface Adp {
  value: number;
  diff: number;
}

export interface Recommendation {
  ranking: Ranking;
  player: Player;
  adp?: Adp;
}

/** A made pick, joined with where the player sat in the user's ranking. */
export interface RankedDraftPick extends DraftPick {
  rank?: number;
  tier?: string;
  adp?: number;
}

/** How many of the user's still-undrafted ranked players remain in the
 * best (up to two) tiers that have any left, per position. */
export interface PositionTierCounts {
  position: string;
  tiers: { tier: string; remaining: number }[];
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  draft: Draft;
  picks: RankedDraftPick[];
  tierCounts: PositionTierCounts[];
  draftedPlayerCount: number;
  draftStatus: DraftStatus;
  totalPicks: number;
  lastPick?: DraftPick;
  lastUpdatedAt: string;
  generatedAt: string;
}
