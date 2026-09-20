import { FastifyInstance } from "fastify";

import { z } from "zod";

import { RankingEditorService } from "../services/ranking-editor.service.js";

const rankingParamsSchema = z.object({
  rankingId: z.string().min(1),
});

const playerParamsSchema = rankingParamsSchema.extend({
  sleeperId: z.string().min(1),
});

const tierParamsSchema = rankingParamsSchema.extend({
  position: z.coerce.number().int().min(1),
});

const movePlayerBodySchema = z.object({
  rank: z.number().int().min(1),
  tier: z.string().min(1),
});

const insertTierBodySchema = z.object({
  position: z.number().int().min(1),
});

export function createRankingEditorRoutes(
  rankingEditorService: RankingEditorService,
) {
  return async function rankingEditorRoutes(app: FastifyInstance) {
    // Move an existing ranked player, or add a previously-unranked one,
    // to a new rank/tier position.
    app.patch(
      "/rankings/:rankingId/players/:sleeperId",

      async (request) => {
        const userId = request.user!.id;

        const { rankingId, sleeperId } = playerParamsSchema.parse(
          request.params,
        );

        const { rank, tier } = movePlayerBodySchema.parse(request.body);

        const players = await rankingEditorService.movePlayer(
          rankingId,
          userId,
          sleeperId,
          rank,
          tier,
        );

        return { players };
      },
    );

    // Remove a player from the ranking (returns them to the unranked pool).
    app.delete(
      "/rankings/:rankingId/players/:sleeperId",

      async (request) => {
        const userId = request.user!.id;

        const { rankingId, sleeperId } = playerParamsSchema.parse(
          request.params,
        );

        const players = rankingEditorService.removePlayer(
          rankingId,
          userId,
          sleeperId,
        );

        return { players };
      },
    );

    // Insert a new, empty tier boundary at the given 1-based position.
    app.post(
      "/rankings/:rankingId/tiers",

      async (request) => {
        const userId = request.user!.id;

        const { rankingId } = rankingParamsSchema.parse(request.params);

        const { position } = insertTierBodySchema.parse(request.body);

        const tiers = rankingEditorService.insertTier(
          rankingId,
          userId,
          position,
        );

        return { tiers };
      },
    );

    // Remove a tier, merging its players into the tier below (or, for the
    // last tier, the tier above).
    app.delete(
      "/rankings/:rankingId/tiers/:position",

      async (request) => {
        const userId = request.user!.id;

        const { rankingId, position } = tierParamsSchema.parse(request.params);

        const tiers = rankingEditorService.removeTier(
          rankingId,
          userId,
          position,
        );

        return { tiers };
      },
    );
  };
}
