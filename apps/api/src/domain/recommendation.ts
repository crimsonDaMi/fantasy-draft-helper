import {
  Player,
} from "./player.js";

import {
  Ranking,
} from "./ranking.js";

import {
  DraftPick,
  DraftStatus,
} from "./draft.js";

export interface Recommendation {
  ranking: Ranking;

  player: Player;

  adp?: {
    value: number;
    diff: number;
  };
}

export interface RecommendationResult {
  recommendations: Recommendation[];

  draftedPlayerCount: number;

  draftStatus: DraftStatus;

  totalPicks: number;

  lastPick?: DraftPick;

  lastUpdatedAt: string;

  generatedAt: string;
}