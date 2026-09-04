import {
  FastifyInstance,
} from "fastify";

import {
  z,
} from "zod";

import {
  RecommendationService,
} from "../services/recommendation.service.js";

import {
  RankingStoreService,
} from "../services/ranking-store.service.js";

const draftParamsSchema =
  z.object({
    draftId:
      z.string().min(1),
  });

const recommendationsQuerySchema =
  z.object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10),
  });

export function createRecommendationsRoutes(
  recommendationService:
    RecommendationService,

  rankingStoreService:
    RankingStoreService,
) {
  return async function recommendationsRoutes(
    app: FastifyInstance,
  ) {
    app.get(
      "/drafts/:draftId/recommendations",

      async (
        request,
        reply,
      ) => {
        if (
          !rankingStoreService
            .hasRankings()
        ) {
          return reply
            .status(400)
            .send({
              error:
                "No rankings have been imported",
            });
        }

        const { draftId } =
          draftParamsSchema.parse(
            request.params,
          );

        const { limit } =
          recommendationsQuerySchema.parse(
            request.query,
          );

        const recommendations =
          await recommendationService
            .getRecommendations(
              draftId,
              limit,
            );

        const result =
          await recommendationService
            .getRecommendations(
              draftId,
              limit,
            );

        return {
          draftId,

          draftedPlayerCount:
            result.draftedPlayerCount,

          generatedAt:
            result.generatedAt,

          recommendationCount:
            result.recommendations.length,

          recommendations:
            result.recommendations.map(
              (recommendation) => ({
                rank:
                  recommendation.ranking.rank,

                tier:
                  recommendation.ranking.tier,

                player: {
                  sleeperId:
                    recommendation
                      .player.sleeperId,

                  fullName:
                    recommendation
                      .player.fullName,

                  team:
                    recommendation
                      .player.team,

                  position:
                    recommendation
                      .player.position,
                },
              }),
            ),
        };
      },
    );
  };
}