import { FastifyInstance } from "fastify";
import { z } from "zod";

import { draftParamsSchema } from "./params.schemas.js";
import { RecommendationService } from "../services/recommendation.service.js";
import { RankingStoreService } from "../services/ranking-store.service.js";
import { mapRecommendationsResponse } from "../services/recommendation.mapper.js";
import { NotFoundError } from "../utils/domain-errors.js";
import { HttpError } from "../utils/http-error.js";
import { requireUser } from "../utils/require-user.js";

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
  showAvoided: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export function createRecommendationsRoutes(
  recommendationService: RecommendationService,
  rankingStoreService: RankingStoreService,
) {
  return async function recommendationsRoutes(app: FastifyInstance) {
    app.get("/drafts/:draftId/recommendations", async (request) => {
      const userId = requireUser(request).id;

      if (!rankingStoreService.hasRankings(userId)) {
        throw new HttpError(
          400,
          "No rankings have been imported",
          "NO_RANKINGS",
        );
      }

      const { draftId } = draftParamsSchema.parse(request.params);

      const { rankingId, limit, positions, q, showAvoided } =
        recommendationsQuerySchema.parse(request.query);

      if (!rankingStoreService.hasRanking(rankingId, userId)) {
        throw new NotFoundError("Ranking was not found", "RANKING_NOT_FOUND");
      }

      const result = await recommendationService.getRecommendations(
        draftId,
        rankingId,
        userId,
        limit,
        positions,
        q,
        showAvoided,
      );

      return mapRecommendationsResponse(draftId, result);
    });
  };
}
