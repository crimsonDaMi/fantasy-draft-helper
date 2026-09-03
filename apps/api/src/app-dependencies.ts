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

export interface AppDependencies {
  sleeperClient: SleeperClient;

  draftService: DraftService;

  playerCache: PlayerCache;

  playerService: PlayerService;

  draftStateService: DraftStateService;
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

  return {
    sleeperClient,

    draftService,

    playerCache,

    playerService,

    draftStateService,
  };
}