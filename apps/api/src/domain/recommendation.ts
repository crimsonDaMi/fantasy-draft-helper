import { PlayerFlag } from "./player-flag.js";
import { DepthChart, Player } from "./player.js";
import { Ranking } from "./ranking.js";
import { Draft, DraftPick, DraftStatus } from "./draft.js";

interface Adp {
  value: number;
  diff: number;
  /** The player's place among their position by ADP, e.g. 15 for WR15. */
  positionRank?: number;
}

/** What the user narrowed the recommendations to. Unset filters let
 * every player through; avoided players are hidden unless
 * `showAvoided`. */
export interface RecommendationFilters {
  limit: number;
  positions?: string[];
  /** Name or team search. */
  query?: string;
  showAvoided?: boolean;
  rookiesOnly?: boolean;
}

export interface Recommendation {
  ranking: Ranking;
  player: Player;
  /** The player's place among their position in the full ranking. */
  positionRank?: number;
  adp?: Adp;
  flag?: PlayerFlag;
  /** The only undrafted player of their position left in their tier;
   * omitted otherwise. */
  lastInTier?: true;
}

/** A made pick, joined with where the player sat in the user's ranking. */
export interface RankedDraftPick extends DraftPick {
  /** The player's live place on their team's depth chart. */
  depthChart?: DepthChart;
  rank?: number;
  positionRank?: number;
  tier?: string;
  bye?: number;
  adp?: number;
  adpPositionRank?: number;
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
