import {
  Player,
} from "./player.js";

import {
  Ranking,
} from "./ranking.js";

export interface Recommendation {
  ranking: Ranking;

  player: Player;
}

export interface RecommendationResult {
  recommendations: Recommendation[];

  draftedPlayerCount: number;

  generatedAt: string;
}