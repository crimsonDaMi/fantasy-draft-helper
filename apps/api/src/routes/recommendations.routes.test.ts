import Fastify from "fastify";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createRecommendationsRoutes,
} from "./recommendations.routes.js";

import {
  HttpError,
} from "../utils/http-error.js";

function createTestApp(
  recommendationResult: unknown,
  options: {
    hasRankings?: boolean;
    hasRanking?: boolean;
  } = {},
) {
  const app = Fastify();

  const recommendationService = {
    getRecommendations: async () =>
      recommendationResult,
  };

  const rankingStoreService = {
    hasRankings: () =>
      options.hasRankings ?? true,

    hasRanking: () =>
      options.hasRanking ?? true,
  };

  app.register(
    createRecommendationsRoutes(
      recommendationService as never,
      rankingStoreService as never,
    ),
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: "SLEEPER_API_ERROR",
        message: error.message,
      });
    }

    return reply.status(500).send({
      error: "INTERNAL_SERVER_ERROR",
    });
  });

  return app;
}

const recommendationResult = {
  recommendations: [
    {
      ranking: {
        rank: 1,
        playerName: "Player One",
        team: "BUF",
        position: "QB",
        tier: "A",
      },
      player: {
        sleeperId: "1",
        fullName: "Player One",
        team: "BUF",
        position: "QB",
      },
    },
  ],
  draftedPlayerCount: 4,
  draftStatus: "DRAFTING",
  totalPicks: 4,
  lastPick: {
    playerId: "9",
    pickNo: 4,
    round: 1,
  },
  lastUpdatedAt: "2026-09-04T12:00:00.000Z",
  generatedAt: "2026-09-04T12:00:00.000Z",
};

describe(
  "recommendations routes",
  () => {
    it(
      "returns draft metadata and recommendations",
      async () => {
        const app = createTestApp(
          recommendationResult,
        );

        const response = await app.inject({
          method: "GET",
          url:
            "/drafts/draft-1/recommendations?rankingId=ranking-1&limit=20",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          draftId: "draft-1",
          draftStatus: "DRAFTING",
          totalPicks: 4,
          draftedPlayerCount: 4,
          lastPick: {
            playerId: "9",
            pickNo: 4,
            round: 1,
          },
          lastUpdatedAt:
            "2026-09-04T12:00:00.000Z",
          generatedAt:
            "2026-09-04T12:00:00.000Z",
          recommendationCount: 1,
          recommendations: [
            {
              rank: 1,
              tier: "A",
              player: {
                sleeperId: "1",
                fullName: "Player One",
                team: "BUF",
                position: "QB",
              },
            },
          ],
        });

        await app.close();
      },
    );

    it(
      "returns 404 for a missing ranking",
      async () => {
        const app = createTestApp(
          recommendationResult,
          {
            hasRanking: false,
          },
        );

        const response = await app.inject({
          method: "GET",
          url:
            "/drafts/draft-1/recommendations?rankingId=missing",
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
          error: "Ranking was not found",
        });

        await app.close();
      },
    );

    it(
      "returns 400 when no rankings have been imported",
      async () => {
        const app = createTestApp(
          recommendationResult,
          {
            hasRankings: false,
          },
        );

        const response = await app.inject({
          method: "GET",
          url:
            "/drafts/draft-1/recommendations?rankingId=ranking-1",
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({
          error: "No rankings have been imported",
        });

        await app.close();
      },
    );

    it(
      "maps an invalid draft error from Sleeper",
      async () => {
        const app = Fastify();

        const recommendationService = {
          getRecommendations: async () => {
            throw new HttpError(
              404,
              "Draft was not found",
            );
          },
        };

        app.register(
          createRecommendationsRoutes(
            recommendationService as never,
            {
              hasRankings: () => true,
              hasRanking: () => true,
            } as never,
          ),
        );

        app.setErrorHandler((error, _request, reply) => {
          if (error instanceof HttpError) {
            return reply.status(error.statusCode).send({
              error: "SLEEPER_API_ERROR",
              message: error.message,
            });
          }

          return reply.status(500).send({
            error: "INTERNAL_SERVER_ERROR",
          });
        });

        const response = await app.inject({
          method: "GET",
          url:
            "/drafts/invalid/recommendations?rankingId=ranking-1",
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
          error: "SLEEPER_API_ERROR",
          message: "Draft was not found",
        });

        await app.close();
      },
    );

    it(
      "returns completed draft status",
      async () => {
        const app = createTestApp({
          ...recommendationResult,
          draftStatus: "COMPLETE",
        });

        const response = await app.inject({
          method: "GET",
          url:
            "/drafts/draft-1/recommendations?rankingId=ranking-1",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().draftStatus).toBe(
          "COMPLETE",
        );

        await app.close();
      },
    );
  },
);
