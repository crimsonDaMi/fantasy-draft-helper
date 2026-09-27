import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { AppDependencies } from "./app-dependencies.js";
import { PlayerCache } from "./cache/player.cache.js";
import { SleeperClient } from "./clients/sleeper.client.js";
import { AuthService } from "./services/auth.service.js";
import { DraftService } from "./services/draft.service.js";
import { DraftStateService } from "./services/draft-state.service.js";
import { PlayerService } from "./services/player.service.js";
import { RankingEditorService } from "./services/ranking-editor.service.js";
import { RankingStoreService } from "./services/ranking-store.service.js";
import { RankingRepository } from "./repositories/ranking.repository.js";
import { RecommendationService } from "./services/recommendation.service.js";
import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayersResponse,
} from "./types/sleeper.js";
import { UserRepository } from "./repositories/user.repository.js";

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

  const authService = new AuthService(new UserRepository(":memory:"), [
    "alice",
    "bob",
  ]);
  const rankingRepository = new RankingRepository(":memory:");
  const rankingStoreService = new RankingStoreService(rankingRepository);
  const rankingEditorService = new RankingEditorService(
    rankingRepository,
    playerService,
  );

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
    rankingEditorService,
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

    const aliceRankingId = dependencies.rankingStoreService.createRanking(
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

    const bobRankingId = dependencies.rankingStoreService.createRanking(
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
      error: "RANKING_NOT_FOUND",
      message: "Ranking was not found",
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

describe("error responses (end to end)", () => {
  // Guards the handler registration order in buildApp: a handler set
  // after the route plugins load never reaches them, and a ZodError
  // then falls through to Fastify's default 500.
  it("maps request validation errors to 400 through the real app", async () => {
    const dependencies = createTestDependencies();
    const app = await buildApp(dependencies);

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "alice", password: "short" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "VALIDATION_ERROR",
      message: "Invalid request parameters",
    });

    dependencies.rankingStoreService.close();
  });

  it("returns 4xx with a { error, message } body for invalid tier edits", async () => {
    const dependencies = createTestDependencies();
    const app = await buildApp(dependencies);

    const alice = await registerUser(app, "alice");
    const bob = await registerUser(app, "bob");

    const rankingId = (
      await app.inject({
        method: "POST",
        url: "/rankings/new",
        headers: { cookie: alice.cookie },
      })
    ).json().rankingId as string;

    const missingTier = await app.inject({
      method: "DELETE",
      url: `/rankings/${rankingId}/tiers/5`,
      headers: { cookie: alice.cookie },
    });

    expect(missingTier.statusCode).toBe(404);
    expect(missingTier.json()).toEqual({
      error: "TIER_NOT_FOUND",
      message: "Tier at position 5 does not exist",
    });

    const lastTier = await app.inject({
      method: "DELETE",
      url: `/rankings/${rankingId}/tiers/1`,
      headers: { cookie: alice.cookie },
    });

    expect(lastTier.statusCode).toBe(409);
    expect(lastTier.json()).toEqual({
      error: "LAST_TIER",
      message: "Cannot remove the only remaining tier",
    });

    const othersRanking = await app.inject({
      method: "GET",
      url: `/rankings/${rankingId}`,
      headers: { cookie: bob.cookie },
    });

    expect(othersRanking.statusCode).toBe(404);
    expect(othersRanking.json()).toEqual({
      error: "RANKING_NOT_FOUND",
      message: "Ranking was not found",
    });

    dependencies.rankingStoreService.close();
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404 for unknown paths under an API namespace", async () => {
    const dependencies = createTestDependencies();
    const app = await buildApp(dependencies);

    const response = await app.inject({ method: "GET", url: "/auth/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "NOT_FOUND",
      message: "Route not found",
    });

    dependencies.rankingStoreService.close();
  });
});

describe("CORS (cross-origin dev setup)", () => {
  it.each(["PATCH", "DELETE"])(
    "allows %s in preflight responses",
    async (method) => {
      const dependencies = createTestDependencies();
      const app = await buildApp(dependencies);

      const response = await app.inject({
        method: "OPTIONS",
        url: "/rankings/ranking-1/players/1",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": method,
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:5173",
      );
      expect(response.headers["access-control-allow-methods"]).toContain(
        method,
      );

      dependencies.rankingStoreService.close();
    },
  );
});
