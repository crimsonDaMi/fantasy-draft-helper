import { FastifyInstance } from "fastify";

import {
  PlayerService,
  RefreshCooldownError,
} from "../services/player.service.js";

export function createPlayersRoutes(playerService: PlayerService) {
  return async function playersRoutes(app: FastifyInstance) {
    app.get(
      "/players",

      async () => {
        await playerService.ensurePlayersLoaded();

        const players = playerService.getAllPlayers();

        return {
          count: players.length,

          updatedAt: playerService.getCacheUpdatedAt(),

          players,
        };
      },
    );

    app.post(
      "/players/refresh",

      async (_request, reply) => {
        try {
          await playerService.refreshPlayersWithCooldown();
        } catch (error) {
          if (error instanceof RefreshCooldownError) {
            return reply.status(429).send({
              error: "REFRESH_COOLDOWN",
              message: error.message,
              retryAfterMs: error.retryAfterMs,
            });
          }

          throw error;
        }

        return {
          status: "ok",

          count: playerService.getPlayerCount(),

          updatedAt: playerService.getCacheUpdatedAt(),
        };
      },
    );

    app.get(
      "/players/cache-status",

      async () => {
        const count = playerService.getPlayerCount();

        return {
          loaded: count > 0,

          count,

          updatedAt: playerService.getCacheUpdatedAt(),
        };
      },
    );
  };
}
