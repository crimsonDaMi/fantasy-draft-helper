import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RecommendationService,
} from "./recommendation.service.js";

const noopAdpService = {
  getSnapshot: async () => new Map<string, number>(),
};

describe(
  "RecommendationService",

  () => {
    it(
      "returns the highest ranked available players",

      async () => {
        const draftStateService = {
          getDraftState:
            async () => ({
              draft: {
                status: "DRAFTING",
              },

              picks: [],

              draftedPlayerIds:
                new Set([
                  "1",
                ]),

              lastUpdatedAt:
                new Date("2026-01-01T00:00:00.000Z"),
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

            noopAdpService as never,
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

        expect(result.draftStatus).toBe(
          "DRAFTING",
        );

        expect(result.totalPicks).toBe(0);

        expect(result.lastUpdatedAt).toBe(
          "2026-01-01T00:00:00.000Z",
        );
      },
    );

    it(
      "preserves stored ranking order",

      async () => {
        const draftStateService = {
          getDraftState:
            async () => ({
              draft: {
                status: "DRAFTING",
              },

              picks: [],

              draftedPlayerIds:
                new Set(),

              lastUpdatedAt:
                new Date("2026-01-01T00:00:00.000Z"),
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

            noopAdpService as never,
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
          20,
          5,
        ]);
      },
    );

    it(
      "filters recommendations to the requested positions",

      async () => {
        const draftStateService = {
          getDraftState:
            async () => ({
              draft: {
                status: "DRAFTING",
              },

              picks: [],

              draftedPlayerIds:
                new Set(),

              lastUpdatedAt:
                new Date("2026-01-01T00:00:00.000Z"),
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

                position: "QB",
              },

              player: {
                sleeperId: "1",

                fullName:
                  "Player One",

                position: "QB",
              },

              method: "SLEEPER_ID",
            },

            {
              ranking: {
                rank: 2,

                playerName:
                  "Player Two",

                team: "BBB",

                position: "RB",
              },

              player: {
                sleeperId: "2",

                fullName:
                  "Player Two",

                position: "RB",
              },

              method: "SLEEPER_ID",
            },

            {
              ranking: {
                rank: 3,

                playerName:
                  "Player Three",

                team: "CCC",

                position: "RB",
              },

              player: {
                sleeperId: "3",

                fullName:
                  "Player Three",

                position: "RB",
              },

              method: "SLEEPER_ID",
            },
          ],
        };

        const service =
          new RecommendationService(
            draftStateService as never,

            rankingStoreService as never,

            noopAdpService as never,
          );

        const result =
          await service.getRecommendations(
            "draft-1",

            "ranking-1",

            10,

            ["RB"],
          );

        expect(
          result.recommendations.map(
            (recommendation) =>
              recommendation.player.sleeperId,
          ),
        ).toEqual([
          "2",
          "3",
        ]);
      },
    );

    it(
      "treats an empty positions array as no filter",

      async () => {
        const draftStateService = {
          getDraftState:
            async () => ({
              draft: {
                status: "DRAFTING",
              },

              picks: [],

              draftedPlayerIds:
                new Set(),

              lastUpdatedAt:
                new Date("2026-01-01T00:00:00.000Z"),
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

                position: "QB",
              },

              player: {
                sleeperId: "1",

                fullName:
                  "Player One",

                position: "QB",
              },

              method: "SLEEPER_ID",
            },

            {
              ranking: {
                rank: 2,

                playerName:
                  "Player Two",

                team: "BBB",

                position: "RB",
              },

              player: {
                sleeperId: "2",

                fullName:
                  "Player Two",

                position: "RB",
              },

              method: "SLEEPER_ID",
            },
          ],
        };

        const service =
          new RecommendationService(
            draftStateService as never,

            rankingStoreService as never,

            noopAdpService as never,
          );

        const result =
          await service.getRecommendations(
            "draft-1",

            "ranking-1",

            10,

            [],
          );

        expect(
          result.recommendations.map(
            (recommendation) =>
              recommendation.player.sleeperId,
          ),
        ).toEqual([
          "1",
          "2",
        ]);
      },
    );

    it(
      "excludes drafted players even when their position matches the filter",

      async () => {
        const draftStateService = {
          getDraftState:
            async () => ({
              draft: {
                status: "DRAFTING",
              },

              picks: [],

              draftedPlayerIds:
                new Set([
                  "2",
                ]),

              lastUpdatedAt:
                new Date("2026-01-01T00:00:00.000Z"),
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

                position: "RB",
              },

              method: "SLEEPER_ID",
            },

            {
              ranking: {
                rank: 2,

                playerName:
                  "Player Two",

                team: "BBB",

                position: "RB",
              },

              player: {
                sleeperId: "2",

                fullName:
                  "Player Two",

                position: "RB",
              },

              method: "SLEEPER_ID",
            },
          ],
        };

        const service =
          new RecommendationService(
            draftStateService as never,

            rankingStoreService as never,

            noopAdpService as never,
          );

        const result =
          await service.getRecommendations(
            "draft-1",

            "ranking-1",

            10,

            ["RB"],
          );

        expect(
          result.recommendations.map(
            (recommendation) =>
              recommendation.player.sleeperId,
          ),
        ).toEqual([
          "1",
        ]);
      },
    );

    it(
      "attaches ADP diff when the player is in the ADP snapshot",

      async () => {
        const draftStateService = {
          getDraftState: async () => ({
            draft: { status: "DRAFTING" },
            picks: [],
            draftedPlayerIds: new Set(),
            lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        };

        const rankingStoreService = {
          getMatches: () => [
            {
              ranking: {
                rank: 5,
                playerName: "Player One",
                team: "AAA",
                position: "RB",
              },
              player: {
                sleeperId: "1",
                fullName: "Player One",
                position: "RB",
              },
              method: "SLEEPER_ID",
            },
          ],
        };

        const adpService = {
          getSnapshot: async () => new Map([["1", 3.7]]),
        };

        const service = new RecommendationService(
          draftStateService as never,
          rankingStoreService as never,
          adpService as never,
        );

        const result = await service.getRecommendations(
          "draft-1",
          "ranking-1",
          10,
        );

        expect(result.recommendations[0]?.adp).toEqual({
          value: 3.7,
          diff: 1.3,
        });
      },
    );

    it(
      "omits adp when the player is not in the ADP snapshot",

      async () => {
        const draftStateService = {
          getDraftState: async () => ({
            draft: { status: "DRAFTING" },
            picks: [],
            draftedPlayerIds: new Set(),
            lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        };

        const rankingStoreService = {
          getMatches: () => [
            {
              ranking: {
                rank: 1,
                playerName: "Player One",
                team: "AAA",
                position: "RB",
              },
              player: {
                sleeperId: "1",
                fullName: "Player One",
                position: "RB",
              },
              method: "SLEEPER_ID",
            },
          ],
        };

        const adpService = {
          getSnapshot: async () => new Map(),
        };

        const service = new RecommendationService(
          draftStateService as never,
          rankingStoreService as never,
          adpService as never,
        );

        const result = await service.getRecommendations(
          "draft-1",
          "ranking-1",
          10,
        );

        expect(result.recommendations[0]?.adp).toBeUndefined();
      },
    );
  },
);