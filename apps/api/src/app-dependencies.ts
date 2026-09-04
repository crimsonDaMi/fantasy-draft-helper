import {
  PlayerCache,
} from "./cache/player.cache.js";

import {
  SleeperClient,
} from "./clients/sleeper.client.js";

import {
  DraftService,
} from "./services/draft.service.js";

import {
  PlayerService,
} from "./services/player.service.js";

import {
  DraftStateService,
} from "./services/draft-state.service.js";

import {
  RankingCsvService,
} from "./services/ranking-csv.service.js";

import {
  PlayerMatchingService,
} from "./services/player-matching.service.js";

import {
  RankingImportService,
} from "./services/ranking-import.service.js";

import {
  RankingStoreService,
} from "./services/ranking-store.service.js";

import {
  RecommendationService,
} from "./services/recommendation.service.js";

export interface AppDependencies {
  sleeperClient: SleeperClient;

  draftService: DraftService;

  playerCache: PlayerCache;

  playerService: PlayerService;

  draftStateService: DraftStateService;

  rankingImportService: RankingImportService;

  rankingStoreService: RankingStoreService;

  recommendationService: RecommendationService;
}

export function createAppDependencies():
  AppDependencies {
  const sleeperClient =
    new SleeperClient();

  const playerCache =
    new PlayerCache();

  const draftService =
    new DraftService(
      sleeperClient,
    );

  const playerService =
    new PlayerService(
      sleeperClient,
      playerCache,
    );

  const draftStateService =
    new DraftStateService(
      draftService,
      playerService,
    );

  const rankingCsvService =
    new RankingCsvService();

  const playerMatchingService =
    new PlayerMatchingService(
      playerService,
    );

  const rankingImportService =
    new RankingImportService(
      rankingCsvService,

      playerMatchingService,

      playerService,
    );

  const rankingStoreService =
    new RankingStoreService(
      process.env
        .RANKINGS_DATABASE_PATH,
    );

  const recommendationService =
    new RecommendationService(
      draftStateService,

      rankingStoreService,
    );

  return {
    sleeperClient,

    draftService,

    playerCache,

    playerService,

    draftStateService,

    rankingImportService,

    rankingStoreService,

    recommendationService,
  };
}