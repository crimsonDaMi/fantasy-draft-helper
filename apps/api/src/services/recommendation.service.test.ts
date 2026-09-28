import { describe, expect, it } from "vitest";

import { RecommendationService } from "./recommendation.service.js";

const TEST_USER_ID = "test-user";

const noopAdpService = {
  getSnapshot: async () => new Map<string, number>(),
};

const noopPlayerService = {
  getPlayerById: () => undefined,
};

describe("RecommendationService", () => {
  it("returns the highest ranked available players", async () => {
    const draftStateService = {
      getDraftState: async () => ({
        draft: {
          status: "DRAFTING",
        },
        picks: [],
        draftedPlayerIds: new Set(["1"]),
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
          },
          method: "SLEEPER_ID",
        },
        {
          ranking: {
            rank: 2,
            playerName: "Player Two",
            team: "BBB",
            position: "WR",
          },
          player: {
            sleeperId: "2",
            fullName: "Player Two",
          },
          method: "SLEEPER_ID",
        },
      ],
    };

    const service = new RecommendationService(
      draftStateService as never,
      rankingStoreService as never,
      noopAdpService as never,
      noopPlayerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
    );

    expect(result.recommendations).toHaveLength(1);

    expect(result.recommendations[0]?.ranking.rank).toBe(2);

    expect(result.draftedPlayerCount).toBe(1);

    expect(result.draftStatus).toBe("DRAFTING");

    expect(result.totalPicks).toBe(0);

    expect(result.lastUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("preserves stored ranking order", async () => {
    const draftStateService = {
      getDraftState: async () => ({
        draft: {
          status: "DRAFTING",
        },
        picks: [],
        draftedPlayerIds: new Set(),
        lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    };

    const rankingStoreService = {
      getMatches: () => [
        {
          ranking: {
            rank: 20,
            playerName: "Player Twenty",
            team: "AAA",
            position: "RB",
          },
          player: {
            sleeperId: "20",
            fullName: "Player Twenty",
          },
          method: "SLEEPER_ID",
        },
        {
          ranking: {
            rank: 5,
            playerName: "Player Five",
            team: "BBB",
            position: "WR",
          },
          player: {
            sleeperId: "5",
            fullName: "Player Five",
          },
          method: "SLEEPER_ID",
        },
      ],
    };

    const service = new RecommendationService(
      draftStateService as never,
      rankingStoreService as never,
      noopAdpService as never,
      noopPlayerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
    );

    expect(
      result.recommendations.map(
        (recommendation) => recommendation.ranking.rank,
      ),
    ).toEqual([20, 5]);
  });

  it("filters recommendations to the requested positions", async () => {
    const draftStateService = {
      getDraftState: async () => ({
        draft: {
          status: "DRAFTING",
        },
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
            position: "QB",
          },
          player: {
            sleeperId: "1",
            fullName: "Player One",
            position: "QB",
          },
          method: "SLEEPER_ID",
        },
        {
          ranking: {
            rank: 2,
            playerName: "Player Two",
            team: "BBB",
            position: "RB",
          },
          player: {
            sleeperId: "2",
            fullName: "Player Two",
            position: "RB",
          },
          method: "SLEEPER_ID",
        },
        {
          ranking: {
            rank: 3,
            playerName: "Player Three",
            team: "CCC",
            position: "RB",
          },
          player: {
            sleeperId: "3",
            fullName: "Player Three",
            position: "RB",
          },
          method: "SLEEPER_ID",
        },
      ],
    };

    const service = new RecommendationService(
      draftStateService as never,
      rankingStoreService as never,
      noopAdpService as never,
      noopPlayerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
      ["RB"],
    );

    expect(
      result.recommendations.map(
        (recommendation) => recommendation.player.sleeperId,
      ),
    ).toEqual(["2", "3"]);
  });

  it("treats an empty positions array as no filter", async () => {
    const draftStateService = {
      getDraftState: async () => ({
        draft: {
          status: "DRAFTING",
        },
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
            position: "QB",
          },
          player: {
            sleeperId: "1",
            fullName: "Player One",
            position: "QB",
          },
          method: "SLEEPER_ID",
        },
        {
          ranking: {
            rank: 2,
            playerName: "Player Two",
            team: "BBB",
            position: "RB",
          },
          player: {
            sleeperId: "2",
            fullName: "Player Two",
            position: "RB",
          },
          method: "SLEEPER_ID",
        },
      ],
    };

    const service = new RecommendationService(
      draftStateService as never,
      rankingStoreService as never,
      noopAdpService as never,
      noopPlayerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
      [],
    );

    expect(
      result.recommendations.map(
        (recommendation) => recommendation.player.sleeperId,
      ),
    ).toEqual(["1", "2"]);
  });

  it("excludes drafted players even when their position matches the filter", async () => {
    const draftStateService = {
      getDraftState: async () => ({
        draft: {
          status: "DRAFTING",
        },
        picks: [],
        draftedPlayerIds: new Set(["2"]),
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
        {
          ranking: {
            rank: 2,
            playerName: "Player Two",
            team: "BBB",
            position: "RB",
          },
          player: {
            sleeperId: "2",
            fullName: "Player Two",
            position: "RB",
          },
          method: "SLEEPER_ID",
        },
      ],
    };

    const service = new RecommendationService(
      draftStateService as never,
      rankingStoreService as never,
      noopAdpService as never,
      noopPlayerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
      ["RB"],
    );

    expect(
      result.recommendations.map(
        (recommendation) => recommendation.player.sleeperId,
      ),
    ).toEqual(["1"]);
  });

  it("attaches ADP diff when the player is in the ADP snapshot", async () => {
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
      noopPlayerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
    );

    expect(result.recommendations[0]?.adp).toEqual({
      value: 3.7,
      diff: 1.3,
    });
  });

  it("omits adp when the player is not in the ADP snapshot", async () => {
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
      noopPlayerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
    );

    expect(result.recommendations[0]?.adp).toBeUndefined();
  });

  it("filters by a name or team search before applying the limit", async () => {
    const draftStateService = {
      getDraftState: async () => ({
        draft: { status: "DRAFTING" },
        picks: [],
        draftedPlayerIds: new Set(),
        lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    };

    const players = [
      { sleeperId: "1", fullName: "Player One", team: "AAA" },
      { sleeperId: "2", fullName: "Player Two", team: "BBB" },
      { sleeperId: "3", fullName: "Amon-Ra Example", team: "CCC" },
    ];

    const rankingStoreService = {
      getMatches: () =>
        players.map((player, index) => ({
          ranking: { rank: index + 1, playerName: player.fullName },
          player,
          method: "SLEEPER_ID",
        })),
    };

    const service = new RecommendationService(
      draftStateService as never,
      rankingStoreService as never,
      noopAdpService as never,
      noopPlayerService as never,
    );

    const byName = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      1,
      undefined,
      "amonra",
    );
    const byTeam = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
      undefined,
      "bbb",
    );

    expect(byName.recommendations.map((r) => r.player.sleeperId)).toEqual([
      "3",
    ]);
    expect(byTeam.recommendations.map((r) => r.player.sleeperId)).toEqual([
      "2",
    ]);
  });

  it("reports the live injury status of recommended players", async () => {
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
          ranking: { rank: 1, playerName: "Player One" },
          player: {
            sleeperId: "1",
            fullName: "Player One",
            injuryStatus: "Out",
          },
          method: "SLEEPER_ID",
        },
      ],
    };

    const playerService = {
      getPlayerById: (id: string) =>
        id === "1"
          ? {
              sleeperId: "1",
              fullName: "Player One",
              injuryStatus: "Questionable",
            }
          : undefined,
    };

    const service = new RecommendationService(
      draftStateService as never,
      rankingStoreService as never,
      noopAdpService as never,
      playerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      10,
    );

    expect(result.recommendations[0]?.player.injuryStatus).toBe("Questionable");
  });

  it("joins picks with the ranking and counts remaining players per tier", async () => {
    const draftStateService = {
      getDraftState: async () => ({
        draft: { status: "DRAFTING", rosterSlots: {} },
        picks: [
          { playerId: "1", pickNo: 1, draftSlot: 1, playerName: "Player One" },
          { playerId: "99", pickNo: 2, draftSlot: 2 },
        ],
        draftedPlayerIds: new Set(["1", "99"]),
        lastUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    };

    const rankedPlayer = (
      sleeperId: string,
      rank: number,
      position: string,
      tier: string,
    ) => ({
      ranking: { rank, playerName: `Player ${sleeperId}`, tier },
      player: { sleeperId, fullName: `Player ${sleeperId}`, position },
      method: "SLEEPER_ID",
    });

    const rankingStoreService = {
      getMatches: () => [
        rankedPlayer("1", 1, "QB", "S"),
        rankedPlayer("2", 2, "QB", "S"),
        rankedPlayer("3", 3, "WR", "S"),
        rankedPlayer("4", 4, "QB", "A"),
        rankedPlayer("5", 5, "QB", "A"),
        rankedPlayer("6", 6, "QB", "B"),
      ],
    };

    const playerService = {
      getPlayerById: (id: string) =>
        id === "99"
          ? { sleeperId: "99", fullName: "Unranked Pick" }
          : undefined,
    };

    const service = new RecommendationService(
      draftStateService as never,
      rankingStoreService as never,
      { getSnapshot: async () => new Map([["1", 2.5]]) } as never,
      playerService as never,
    );

    const result = await service.getRecommendations(
      "draft-1",
      "ranking-1",
      TEST_USER_ID,
      1,
      ["WR"],
    );

    expect(result.picks).toEqual([
      {
        playerId: "1",
        pickNo: 1,
        draftSlot: 1,
        playerName: "Player One",
        rank: 1,
        tier: "S",
        adp: 2.5,
      },
      {
        playerId: "99",
        pickNo: 2,
        draftSlot: 2,
        playerName: "Unranked Pick",
        rank: undefined,
        tier: undefined,
        adp: undefined,
      },
    ]);

    // Counted over the whole ranking — not limited by `limit` or the
    // position filter — and only the first two tiers with players left.
    expect(result.tierCounts).toEqual([
      {
        position: "QB",
        tiers: [
          { tier: "S", remaining: 1 },
          { tier: "A", remaining: 2 },
        ],
      },
      { position: "WR", tiers: [{ tier: "S", remaining: 1 }] },
    ]);
  });
});
