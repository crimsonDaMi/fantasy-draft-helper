import { FastifyInstance } from "fastify";

import { PlayerService, RefreshCooldownError } from "../services/player.service.js";

export function createPlayersRoutes(playerService: PlayerService) {
  return async function playersRoutes(app: FastifyInstance) {
    app.get(
      "/players",

      async () => {
        await playerService.ensurePlayersLoaded();

        return {
          count: playerService.getAllPlayers().length,

          updatedAt: playerService.getCacheUpdatedAt(),

          players: playerService.getAllPlayers(),
        };
      },
    );

    app.post(
      "/players/refresh",

      async (request, reply) => {
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

          count: playerService.getAllPlayers().length,

          updatedAt: playerService.getCacheUpdatedAt(),
        };
      },
    );

    app.get(
      "/players/cache-status",

      async () => {
        return {
          loaded: playerService.getAllPlayers().length > 0,

          count: playerService.getAllPlayers().length,

          updatedAt: playerService.getCacheUpdatedAt(),
        };
      },
    );
  };
}
