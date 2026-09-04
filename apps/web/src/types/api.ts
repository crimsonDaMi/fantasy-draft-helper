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
}

export interface RecommendationsResponse {
  draftId: string;

  draftedPlayerCount: number;

  generatedAt: string;

  recommendationCount: number;

  recommendations:
  ApiRecommendation[];
}

export interface RankingImportSummary {
  imported: number;

  matched: number;

  unmatched: number;

  ambiguous: number;

  errors: number;
}

export interface RankingImportResponse {
  summary:
  RankingImportSummary;

  errors: {
    row: number;

    message: string;
  }[];

  unmatched: {
    rank: number;

    name: string;

    team: string;

    position: string;
  }[];

  ambiguous: unknown[];
}