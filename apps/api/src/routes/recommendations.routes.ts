import { FastifyInstance } from "fastify";
import { z } from "zod";

import { RecommendationService } from "../services/recommendation.service.js";
import { RankingStoreService } from "../services/ranking-store.service.js";
import { mapRecommendationsResponse } from "../services/recommendation.mapper.js";
import { requireUser } from "../utils/require-user.js";

const draftParamsSchema = z.object({
  draftId: z.string().min(1),
});

const recommendationsQuerySchema = z.object({
  rankingId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  positions: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((position) => position.trim().toUpperCase())
            .filter(Boolean)
        : undefined,
    ),
  q: z.string().trim().max(50).optional(),
});

export function createRecommendationsRoutes(
  recommendationService: RecommendationService,
  rankingStoreService: RankingStoreService,
) {
  return async function recommendationsRoutes(app: FastifyInstance) {
    app.get("/drafts/:draftId/recommendations", async (request, reply) => {
      const userId = requireUser(request).id;

      if (!rankingStoreService.hasRankings(userId)) {
        return reply.status(400).send({
          error: "NO_RANKINGS",
          message: "No rankings have been imported",
        });
      }

      const { draftId } = draftParamsSchema.parse(request.params);

      const { rankingId, limit, positions, q } =
        recommendationsQuerySchema.parse(request.query);

      if (!rankingStoreService.hasRanking(rankingId, userId)) {
        return reply.status(404).send({
          error: "RANKING_NOT_FOUND",
          message: "Ranking was not found",
        });
      }

      const result = await recommendationService.getRecommendations(
        draftId,
        rankingId,
        userId,
        limit,
        positions,
        q,
      );

      return mapRecommendationsResponse(draftId, result);
    });
  };
}
