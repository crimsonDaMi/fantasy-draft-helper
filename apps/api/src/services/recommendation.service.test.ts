import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RecommendationService,
} from "./recommendation.service.js";

describe(
  "RecommendationService",

  () => {
    it(
      "returns the highest ranked available players",

      async () => {
        const draftStateService = {
          getDraftState:
            async () => ({
              draftedPlayerIds:
                new Set([
                  "1",
                ]),
            }),
        };

        const rankingStoreService = {
          getMatches: () => [
            {
              ranking: {
                rank: 1,

                playerName:
                  "Player One",

                team: "AAA",

                position: "RB",
              },

              player: {
                sleeperId: "1",

                fullName:
                  "Player One",
              },

              method: "SLEEPER_ID",
            },

            {
              ranking: {
                rank: 2,

                playerName:
                  "Player Two",

                team: "BBB",

                position: "WR",
              },

              player: {
                sleeperId: "2",

                fullName:
                  "Player Two",
              },

              method: "SLEEPER_ID",
            },
          ],
        };

        const service =
          new RecommendationService(
            draftStateService as never,

            rankingStoreService as never,
          );

        const result =
          await service.getRecommendations(
            "draft-1",

            "ranking-1",

            10,
          );

        expect(
          result.recommendations,
        ).toHaveLength(1);

        expect(
          result.recommendations[0]?.ranking.rank,
        ).toBe(2);

        expect(
          result.draftedPlayerCount,
        ).toBe(1);
      },
    );

    it(
      "sorts recommendations by rank",

      async () => {
        const draftStateService = {
          getDraftState:
            async () => ({
              draftedPlayerIds:
                new Set(),
            }),
        };

        const rankingStoreService = {
          getMatches: () => [
            {
              ranking: {
                rank: 20,

                playerName:
                  "Player Twenty",

                team: "AAA",

                position: "RB",
              },

              player: {
                sleeperId: "20",

                fullName:
                  "Player Twenty",
              },

              method: "SLEEPER_ID",
            },

            {
              ranking: {
                rank: 5,

                playerName:
                  "Player Five",

                team: "BBB",

                position: "WR",
              },

              player: {
                sleeperId: "5",

                fullName:
                  "Player Five",
              },

              method: "SLEEPER_ID",
            },
          ],
        };

        const service =
          new RecommendationService(
            draftStateService as never,

            rankingStoreService as never,
          );

        const result =
          await service.getRecommendations(
            "draft-1",

            "ranking-1",

            10,
          );

        expect(
          result.recommendations.map(
            (recommendation) =>
              recommendation.ranking.rank,
          ),
        ).toEqual([
          5,
          20,
        ]);
      },
    );
  },
);