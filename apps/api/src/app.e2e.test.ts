import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

import { AppDependencies } from "./app-dependencies.js";

import { PlayerCache } from "./cache/player.cache.js";

import { SleeperClient } from "./clients/sleeper.client.js";

import { AuthService } from "./services/auth.service.js";

import { DraftService } from "./services/draft.service.js";

import { DraftStateService } from "./services/draft-state.service.js";

import { PlayerService } from "./services/player.service.js";

import { RankingStoreService } from "./services/ranking-store.service.js";

import { RecommendationService } from "./services/recommendation.service.js";

import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayersResponse,
} from "./types/sleeper.js";

function createFixtureClient() {
  return {
    getDraft: async () =>
      ({
        draft_id: "draft-1",
        status: "drafting",
        sport: "nfl",
        season: "2026",
      }) satisfies SleeperDraft,

    getDraftPicks: async () => [] as SleeperDraftPick[],

    getNFLPlayers: async () =>
      ({
        "1": {
          player_id: "1",
          full_name: "Player One",
          position: "QB",
          team: "BUF",
          active: true,
          fantasy_positions: ["QB"],
        },
        "2": {
          player_id: "2",
          full_name: "Player Two",
          position: "RB",
          team: "MIA",
          active: true,
          fantasy_positions: ["RB"],
        },
      }) satisfies SleeperPlayersResponse,
  } as unknown as SleeperClient;
}

function createTestDependencies(): AppDependencies {
  const sleeperClient = createFixtureClient();

  const playerCache = new PlayerCache();
  const playerService = new PlayerService(sleeperClient, playerCache);
  const draftService = new DraftService(sleeperClient);
  const draftStateService = new DraftStateService(draftService, playerService);

  const authService = new AuthService(":memory:", ["alice", "bob"]);
  const rankingStoreService = new RankingStoreService(":memory:");

  const noopAdpService = {
    getSnapshot: async () => new Map<string, number>(),
  };

  const recommendationService = new RecommendationService(
    draftStateService,
    rankingStoreService,
    noopAdpService as never,
  );

  return {
    sleeperClient,
    authService,
    adpService: noopAdpService as never,
    draftService,
    playerCache,
    playerService,
    draftStateService,
    rankingImportService: {} as never, // not exercised by this test
    rankingStoreService,
    recommendationService,
  };
}

async function registerUser(
  app: Awaited<ReturnType<typeof buildApp>>,
  username: string,
) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { username, password: "correct horse battery" },
  });

  const sessionCookie = response.cookies.find((c) => c.name === "session");

  return {
    userId: response.json().user.id as string,
    cookie: `session=${sessionCookie?.value}`,
  };
}

describe("multi-user isolation (end to end)", () => {
  it("prevents one user from reading another user's ranking via recommendations", async () => {
    const dependencies = createTestDependencies();
    const app = await buildApp(dependencies);

    const alice = await registerUser(app, "alice");
    const bob = await registerUser(app, "bob");

    const aliceRankingId = dependencies.rankingStoreService.setMatches(
      [
        {
          ranking: {
            rank: 1,
            playerName: "Player One",
            team: "BUF",
            position: "QB",
          },
          player: {
            sleeperId: "1",
            fullName: "Player One",
            team: "BUF",
            position: "QB",
            active: true,
            fantasyPositions: ["QB"],
          },
          method: "SLEEPER_ID",
        },
        {
          ranking: {
            rank: 2,
            playerName: "Player Two",
            team: "MIA",
            position: "RB",
          },
          player: {
            sleeperId: "2",
            fullName: "Player Two",
            team: "MIA",
            position: "RB",
            active: true,
            fantasyPositions: ["RB"],
          },
          method: "SLEEPER_ID",
        },
      ],
      alice.userId,
    );

    const bobRankingId = dependencies.rankingStoreService.setMatches(
      [
        {
          ranking: {
            rank: 1,
            playerName: "Player Two",
            team: "MIA",
            position: "RB",
          },
          player: {
            sleeperId: "2",
            fullName: "Player Two",
            team: "MIA",
            position: "RB",
            active: true,
            fantasyPositions: ["RB"],
          },
          method: "SLEEPER_ID",
        },
      ],
      bob.userId,
    );

    // Alice can read her own ranking's recommendations.
    const aliceOwn = await app.inject({
      method: "GET",
      url: `/drafts/draft-1/recommendations?rankingId=${aliceRankingId}`,
      headers: { cookie: alice.cookie },
    });

    expect(aliceOwn.statusCode).toBe(200);
    expect(
      aliceOwn
        .json()
        .recommendations.map(
          (r: { player: { sleeperId: string } }) => r.player.sleeperId,
        ),
    ).toEqual(["1", "2"]);

    // Bob can read his own, different ranking.
    const bobOwn = await app.inject({
      method: "GET",
      url: `/drafts/draft-1/recommendations?rankingId=${bobRankingId}`,
      headers: { cookie: bob.cookie },
    });

    expect(bobOwn.statusCode).toBe(200);
    expect(
      bobOwn
        .json()
        .recommendations.map(
          (r: { player: { sleeperId: string } }) => r.player.sleeperId,
        ),
    ).toEqual(["2"]);

    // Bob cannot read Alice's ranking, even though he's authenticated
    // and has rankings of his own.
    const bobReadingAlice = await app.inject({
      method: "GET",
      url: `/drafts/draft-1/recommendations?rankingId=${aliceRankingId}`,
      headers: { cookie: bob.cookie },
    });

    expect(bobReadingAlice.statusCode).toBe(404);
    expect(bobReadingAlice.json()).toEqual({
      error: "Ranking was not found",
    });

    // Symmetric check: Alice cannot read Bob's either.
    const aliceReadingBob = await app.inject({
      method: "GET",
      url: `/drafts/draft-1/recommendations?rankingId=${bobRankingId}`,
      headers: { cookie: alice.cookie },
    });

    expect(aliceReadingBob.statusCode).toBe(404);

    dependencies.rankingStoreService.close();
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const dependencies = createTestDependencies();
    const app = await buildApp(dependencies);

    const response = await app.inject({
      method: "GET",
      url: "/drafts/draft-1/recommendations?rankingId=anything",
    });

    expect(response.statusCode).toBe(401);

    dependencies.rankingStoreService.close();
  });
});
