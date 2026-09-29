import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import { createRankingEditorRoutes } from "./ranking-editor.routes.js";
import { errorHandler } from "../utils/error-handler.js";

const TEST_USER = { id: "test-user", username: "testuser" };

function createTestApp(rankingEditorService: {
  getRanking?: (...args: unknown[]) => unknown;
  movePlayer?: (...args: unknown[]) => unknown;
  removePlayer?: (...args: unknown[]) => unknown;
  insertTier?: (...args: unknown[]) => unknown;
  removeTier?: (...args: unknown[]) => unknown;
  getUnrankedPlayers?: (...args: unknown[]) => unknown;
  setFlag?: (...args: unknown[]) => unknown;
  resolveUnmatchedRow?: (...args: unknown[]) => unknown;
  removeUnmatchedRow?: (...args: unknown[]) => unknown;
}) {
  const app = Fastify();

  app.decorateRequest("user", undefined);
  app.addHook("onRequest", async (request) => {
    request.user = TEST_USER;
  });

  app.register(createRankingEditorRoutes(rankingEditorService as never));
  app.setErrorHandler(errorHandler);

  return app;
}

describe("ranking editor routes", () => {
  it("returns ranking detail (players and tiers)", async () => {
    const getRanking = vi.fn(() => ({
      players: [
        {
          ranking: { rank: 1, playerName: "Player One", tier: "S" },
          player: { sleeperId: "1", fullName: "Player One" },
          method: "SLEEPER_ID",
        },
      ],
      tiers: [{ label: "S", position: 1, playerCount: 1 }],
    }));

    const app = createTestApp({ getRanking });

    const response = await app.inject({
      method: "GET",
      url: "/rankings/ranking-1",
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
      tiers: [{ label: "S", position: 1, playerCount: 1 }],
    });

    expect(getRanking).toHaveBeenCalledWith("ranking-1", TEST_USER.id);

    await app.close();
  });

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

  it("normalizes the target tier label before moving a player", async () => {
    const movePlayer = vi.fn(async () => []);

    const app = createTestApp({ movePlayer });

    const response = await app.inject({
      method: "PATCH",
      url: "/rankings/ranking-1/players/1",
      payload: { rank: 1, tier: " a " },
    });

    expect(response.statusCode).toBe(200);
    expect(movePlayer).toHaveBeenCalledWith(
      "ranking-1",
      TEST_USER.id,
      "1",
      1,
      "A",
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

  it.each([
    ["watch", "watch"],
    [null, undefined],
  ])("sets a player's flag to %s", async (flag, expected) => {
    const setFlag = vi.fn(() => ({ "2": "avoid" }));

    const app = createTestApp({ setFlag });

    const response = await app.inject({
      method: "PATCH",
      url: "/rankings/ranking-1/players/1/flag",
      payload: { flag },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ flags: { "2": "avoid" } });
    expect(setFlag).toHaveBeenCalledWith(
      "ranking-1",
      TEST_USER.id,
      "1",
      expected,
    );

    await app.close();
  });

  it("rejects an unknown flag", async () => {
    const setFlag = vi.fn();

    const app = createTestApp({ setFlag });

    const response = await app.inject({
      method: "PATCH",
      url: "/rankings/ranking-1/players/1/flag",
      payload: { flag: "draft" },
    });

    expect(response.statusCode).toBe(400);
    expect(setFlag).not.toHaveBeenCalled();

    await app.close();
  });

  it("resolves an unmatched row", async () => {
    const resolveUnmatchedRow = vi.fn(async () => []);
    const app = createTestApp({ resolveUnmatchedRow });

    const response = await app.inject({
      method: "PATCH",
      url: "/rankings/ranking-1/unmatched/2",
      payload: { playerName: "Nobody", sleeperId: "9" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ players: [] });
    expect(resolveUnmatchedRow).toHaveBeenCalledWith(
      "ranking-1",
      TEST_USER.id,
      2,
      "Nobody",
      "9",
    );

    await app.close();
  });

  it("removes an unmatched row", async () => {
    const removeUnmatchedRow = vi.fn(() => []);
    const app = createTestApp({ removeUnmatchedRow });

    const response = await app.inject({
      method: "DELETE",
      url: "/rankings/ranking-1/unmatched/2?playerName=Jos%C3%A9%20Nobody",
    });

    expect(response.statusCode).toBe(200);
    expect(removeUnmatchedRow).toHaveBeenCalledWith(
      "ranking-1",
      TEST_USER.id,
      2,
      "José Nobody",
    );

    await app.close();
  });
});
