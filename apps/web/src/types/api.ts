export interface ApiPlayer {
  sleeperId: string;

  fullName: string;

  team?: string;

  position?: string;
}

export interface ApiRecommendation {
  rank: number;

  tier?: string;

  player: ApiPlayer;

  adp?: {
    value: number;
    diff: number;
  };
}

export interface RecommendationsResponse {
  draftId: string;

  draftStatus: "PRE_DRAFT" | "DRAFTING" | "COMPLETE" | "UNKNOWN";

  totalPicks: number;

  draftedPlayerCount: number;

  lastPick?: {
    playerId: string;
    pickNo: number;
    round?: number;
  };

  lastUpdatedAt: string;

  generatedAt: string;

  recommendationCount: number;

  recommendations: ApiRecommendation[];
}

export interface RankingImportSummary {
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

    team: string;

    position: string;
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

export interface RankingImportError {
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
}

export interface RankingStatusResponse {
  loaded: boolean;
  rankingId?: string;
  rankingCount: number;
  matchedCount: number;
}
