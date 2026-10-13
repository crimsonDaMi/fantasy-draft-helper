export interface ApiPlayer {
  sleeperId: string;
  fullName: string;
  team?: string;
  position?: string;
  injuryStatus?: string;
  /** From Sleeper, when it has the player's age. */
  age?: number;
  /** From Sleeper's years of experience (0 for a rookie); omitted when
   * unknown. */
  rookie?: boolean;
}

export type PlayerFlag = "watch" | "avoid";

export interface ApiRecommendation {
  rank: number;
  /** Place among the player's position in your full ranking (12 for WR12). */
  positionRank?: number;
  tier?: string;
  /** Bye week from the ranking CSV, when it had one. */
  bye?: number;
  /** The user's note on the player, from the CSV or the ranking editor. */
  note?: string;
  player: ApiPlayer;
  adp?: {
    value: number;
    diff: number;
    /** Place among the player's position by ADP. */
    positionRank?: number;
  };
  flag?: PlayerFlag;
}

export interface RankingSummary {
  id: string;
  name: string;
  createdAt: string;
  playerCount: number;
  matchedCount: number;
}

export type DraftStatus = "PRE_DRAFT" | "DRAFTING" | "COMPLETE" | "UNKNOWN";

export interface RecommendationsResponse {
  draftId: string;
  draftStatus: DraftStatus;
  totalPicks: number;
  draftedPlayerCount: number;
  lastPick?: {
    playerId: string;
    pickNo: number;
    round?: number;
  };
  lastUpdatedAt: string;
  generatedAt: string;
  /** When the player data (and so injury statuses) was last loaded. */
  playersUpdatedAt?: string;
  recommendationCount: number;
  recommendations: ApiRecommendation[];
  draft: ApiDraftInfo;
  /** ADP format matching the draft's league, e.g. `1QB PPR` or `SF`. */
  adpFormat: string;
  picks: ApiDraftPick[];
  tierCounts: ApiPositionTierCounts[];
  /** Available players hidden because they're flagged `avoid`. */
  avoidedCount: number;
}

/** The parts of `GET /drafts/:draftId` the app uses. */
export interface ApiDraft {
  /** The ADP the draft's recommendations use, by sheet column. */
  adpFormat: { column: string; label: string };
}

export interface ApiDraftInfo {
  name?: string;
  /** `snake`, `linear`, or `auction`. */
  type?: string;
  teams?: number;
  rounds?: number;
  reversalRound?: number;
  /** Sleeper user ID → draft slot (1-based). */
  draftOrder?: Record<string, number>;
  /** Draft slot (1-based) → the league roster that owns its picks;
   * missing for drafts without a league (e.g. mocks). */
  slotToRosterId?: Record<string, number>;
  tradedPicks?: ApiTradedPick[];
  /** Auction budget per team. */
  budget?: number;
  /** Lineup slot → count, e.g. `{ QB: 1, SUPER_FLEX: 1, BN: 6 }`. */
  rosterSlots: Record<string, number>;
}

/** A pick that changed hands, by league roster ID. */
interface ApiTradedPick {
  round: number;
  /** Roster the pick originally belonged to. */
  rosterId: number;
  /** Roster that holds the pick now. */
  ownerId: number;
}

export interface ApiDraftPick {
  pickNo: number;
  round?: number;
  draftSlot?: number;
  rosterId?: string;
  pickedBy?: string;
  playerId: string;
  playerName?: string;
  position?: string;
  team?: string;
  /** Where the player sat in your ranking, when they were in it. */
  rank?: number;
  positionRank?: number;
  tier?: string;
  bye?: number;
  adp?: number;
  adpPositionRank?: number;
  /** Winning bid in auctions. */
  amount?: number;
}

export interface ApiPositionTierCounts {
  position: string;
  tiers: { tier: string; remaining: number }[];
}

export interface ApiUserDraft {
  draftId: string;
  name?: string;
  status: DraftStatus;
  type?: string;
  teams?: number;
  season: string;
  startTime?: number | null;
}

export interface UserDraftsResponse {
  sleeperUserId: string;
  drafts: ApiUserDraft[];
}

interface RankingImportSummary {
  imported: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  errors: number;
}

export interface RankingImportResponse {
  rankingId: string;
  summary: RankingImportSummary;
  validationErrors: RankingImportError[];
  unmatchedPlayers: {
    rank: number;
    name: string;
    team?: string;
    position?: string;
    /** Matched a player an earlier row already holds. */
    duplicate?: boolean;
  }[];
  ambiguousPlayers: {
    rank: number;
    name: string;
    candidates?: {
      sleeperId: string;
      fullName: string;
    }[];
  }[];
}

interface RankingImportError {
  row: number;
  message: string;
}

export interface RankingPlayerDto {
  ranking: {
    rank: number;
    playerName: string;
    team?: string;
    position?: string;
    sleeperPlayerId?: string;
    tier?: string;
    bye?: number;
    note?: string;
  };
  player?: ApiPlayer;
  method: string;
  candidates?: ApiPlayer[];
  warnings?: string[];
}

export interface RankingTierDto {
  label: string;
  position: number;
  playerCount: number;
}

export interface RankingDetailResponse {
  players: RankingPlayerDto[];
  tiers: RankingTierDto[];
  /** Sleeper ID → flag, for the flagged players. */
  flags: Record<string, PlayerFlag>;
}
