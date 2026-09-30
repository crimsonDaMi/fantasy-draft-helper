import { PlayerFlag } from "./player-flag.js";
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
  flag?: PlayerFlag;
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
  /** Label of the ADP format used, e.g. `1QB PPR` or `SF`. */
  adpFormat: string;
  picks: RankedDraftPick[];
  tierCounts: PositionTierCounts[];
  /** Available players hidden because they're flagged `avoid`. */
  avoidedCount: number;
  draftedPlayerCount: number;
  draftStatus: DraftStatus;
  totalPicks: number;
  lastPick?: DraftPick;
  lastUpdatedAt: string;
  generatedAt: string;
  /** When the player data (and so injury statuses) was last loaded. */
  playersUpdatedAt?: string;
}
