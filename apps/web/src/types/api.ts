export interface ApiPlayer {
  sleeperId: string;
  fullName: string;
  team?: string;
  position?: string;
  injuryStatus?: string;
}

export type PlayerFlag = "watch" | "avoid";

export interface ApiRecommendation {
  rank: number;
  tier?: string;
  player: ApiPlayer;
  adp?: {
    value: number;
    diff: number;
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
  picks: ApiDraftPick[];
  tierCounts: ApiPositionTierCounts[];
  /** Available players hidden because they're flagged `avoid`. */
  avoidedCount: number;
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
  tier?: string;
  adp?: number;
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
