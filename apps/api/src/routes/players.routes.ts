import {
  FastifyInstance,
} from "fastify";

import {
  SleeperClient,
} from "../clients/sleeper.client.js";

import {
  PlayerCache,
} from "../cache/player.cache.js";

import {
  PlayerService,
} from "../services/player.service.js";

export function createPlayersRoutes(
  playerService: PlayerService,
) {
  return async function playersRoutes(
    app: FastifyInstance,
  ) {
    app.get(
      "/players",

      async () => {
        await playerService
          .ensurePlayersLoaded();

        return {
          count:
            playerService
              .getAllPlayers()
              .length,

          updatedAt:
            playerService
              .getCacheUpdatedAt(),

          players:
            playerService
              .getAllPlayers(),
        };
      },
    );

    app.post(
      "/players/refresh",

      async () => {
        await playerService
          .refreshPlayers();

        return {
          status: "ok",

          count:
            playerService
              .getAllPlayers()
              .length,

          updatedAt:
            playerService
              .getCacheUpdatedAt(),
        };
      },
    );

    app.get(
      "/players/cache-status",

      async () => {
        return {
          loaded:
            playerService
              .getAllPlayers()
              .length > 0,

          count:
            playerService
              .getAllPlayers()
              .length,

          updatedAt:
            playerService
              .getCacheUpdatedAt(),
        };
      },
    );
  };
}