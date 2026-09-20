import Fastify from "fastify";

import { describe, expect, it, vi } from "vitest";

import { createRankingEditorRoutes } from "./ranking-editor.routes.js";

const TEST_USER = { id: "test-user", username: "testuser" };

function createTestApp(rankingEditorService: {
  movePlayer?: (...args: unknown[]) => unknown;
  removePlayer?: (...args: unknown[]) => unknown;
  insertTier?: (...args: unknown[]) => unknown;
  removeTier?: (...args: unknown[]) => unknown;
  getUnrankedPlayers?: (...args: unknown[]) => unknown;
}) {
  const app = Fastify();

  app.decorateRequest("user", undefined);
  app.addHook("onRequest", async (request) => {
    request.user = TEST_USER;
  });

  app.register(createRankingEditorRoutes(rankingEditorService as never));

  return app;
}

describe("ranking editor routes", () => {
  it("moves a player and returns the updated ranking", async () => {
    const movePlayer = vi.fn(async () => [
      {
        ranking: { rank: 1, playerName: "Player One", tier: "S" },
        player: { sleeperId: "1", fullName: "Player One" },
        method: "SLEEPER_ID",
      },
    ]);

    const app = createTestApp({ movePlayer });

    const response = await app.inject({
      method: "PATCH",
      url: "/rankings/ranking-1/players/1",
      payload: { rank: 1, tier: "S" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      players: [
        {
          ranking: { rank: 1, playerName: "Player One", tier: "S" },
          player: { sleeperId: "1", fullName: "Player One" },
          method: "SLEEPER_ID",
        },
      ],
    });

    expect(movePlayer).toHaveBeenCalledWith(
      "ranking-1",
      TEST_USER.id,
      "1",
      1,
      "S",
    );

    await app.close();
  });

  it("removes a player and returns the updated ranking", async () => {
    const removePlayer = vi.fn(() => [
      {
        ranking: { rank: 1, playerName: "Player Two" },
        player: { sleeperId: "2", fullName: "Player Two" },
        method: "SLEEPER_ID",
      },
    ]);

    const app = createTestApp({ removePlayer });

    const response = await app.inject({
      method: "DELETE",
      url: "/rankings/ranking-1/players/1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().players).toHaveLength(1);
    expect(removePlayer).toHaveBeenCalledWith("ranking-1", TEST_USER.id, "1");

    await app.close();
  });

  it("inserts a tier and returns the updated tier list", async () => {
    const insertTier = vi.fn(() => [
      { label: "S", position: 1, playerCount: 1 },
      { label: "A", position: 2, playerCount: 0 },
    ]);

    const app = createTestApp({ insertTier });

    const response = await app.inject({
      method: "POST",
      url: "/rankings/ranking-1/tiers",
      payload: { position: 2 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tiers: [
        { label: "S", position: 1, playerCount: 1 },
        { label: "A", position: 2, playerCount: 0 },
      ],
    });

    expect(insertTier).toHaveBeenCalledWith("ranking-1", TEST_USER.id, 2);

    await app.close();
  });

  it("removes a tier and returns the updated tier list", async () => {
    const removeTier = vi.fn(() => [
      { label: "S", position: 1, playerCount: 2 },
    ]);

    const app = createTestApp({ removeTier });

    const response = await app.inject({
      method: "DELETE",
      url: "/rankings/ranking-1/tiers/2",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tiers: [{ label: "S", position: 1, playerCount: 2 }],
    });

    expect(removeTier).toHaveBeenCalledWith("ranking-1", TEST_USER.id, 2);

    await app.close();
  });

  it("returns unranked players", async () => {
    const getUnrankedPlayers = vi.fn(async () => [
      {
        sleeperId: "2",
        fullName: "Player Two",
        active: true,
        fantasyPositions: ["WR"],
      },
    ]);

    const app = createTestApp({ getUnrankedPlayers });

    const response = await app.inject({
      method: "GET",
      url: "/rankings/ranking-1/unranked-players",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      players: [
        {
          sleeperId: "2",
          fullName: "Player Two",
          active: true,
          fantasyPositions: ["WR"],
        },
      ],
    });

    expect(getUnrankedPlayers).toHaveBeenCalledWith("ranking-1", TEST_USER.id);

    await app.close();
  });
});
