import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { describe, expect, it, vi } from "vitest";

import { createRankingsRoutes } from "./rankings.routes.js";
import { errorHandler } from "../utils/error-handler.js";

const TEST_USER = { id: "test-user", username: "testuser" };

function createTestApp(importResult: unknown, matches: unknown[] = []) {
  const app = Fastify();

  app.decorateRequest("user", undefined);
  app.addHook("onRequest", async (request) => {
    request.user = TEST_USER;
  });

  app.register(multipart, {
    limits: {
      fileSize: 1024 * 1024,
    },
  });

  const rankingImportService = {
    importCsv: async () => importResult,
  };

  const rankingStoreService = {
    createRanking: () => "ranking-1",
    getMatches: () => matches,
    hasRankings: () => matches.length > 0,
    getLatestRankingId: () => (matches.length > 0 ? "ranking-1" : undefined),
  };

  app.register(
    createRankingsRoutes(
      rankingImportService as never,
      rankingStoreService as never,
    ),
  );

  return app;
}

describe("rankings routes", () => {
  it("returns rankingId, summary, and renamed detail fields", async () => {
    const importResult = {
      summary: {
        imported: 2,
        matched: 1,
        unmatched: 1,
        ambiguous: 0,
        errors: 0,
      },
      importResult: {
        errors: [],
      },
      matches: [
        {
          method: "SLEEPER_ID",
          ranking: {
            rank: 1,
            playerName: "Player One",
            team: "BUF",
            position: "QB",
          },
          player: {
            sleeperId: "1",
            fullName: "Player One",
          },
        },
        {
          method: "NONE",
          ranking: {
            rank: 2,
            playerName: "Player Two",
            team: "MIA",
            position: "RB",
          },
        },
      ],
    };

    const app = createTestApp(importResult);

    const boundary = "----testboundary123456";
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="rankings.csv"\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      `rank,player\n1,Player One\r\n` +
      `--${boundary}--\r\n`;

    const response = await app.inject({
      method: "POST",
      url: "/rankings",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.rankingId).toBe("ranking-1");
    expect(body.summary).toEqual(importResult.summary);
    expect(body.validationErrors).toEqual([]);
    expect(body.unmatchedPlayers).toEqual([
      {
        rank: 2,
        name: "Player Two",
        team: "MIA",
        position: "RB",
      },
    ]);
    expect(body.ambiguousPlayers).toEqual([]);
    expect(body.playersImported).toBeUndefined();

    await app.close();
  });

  it("returns 400 when no file is provided", async () => {
    const app = createTestApp({});

    const boundary = "----testboundary123456";
    const payload = `--${boundary}--\r\n`;

    const response = await app.inject({
      method: "POST",
      url: "/rankings",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "CSV_FILE_REQUIRED",
      message: "CSV file is required",
    });

    await app.close();
  });

  it("returns rankings status", async () => {
    const app = createTestApp({}, [
      { player: { sleeperId: "1" } },
      { player: undefined },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/rankings/status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      loaded: true,
      rankingId: "ranking-1",
      rankingCount: 2,
      matchedCount: 1,
    });

    await app.close();
  });

  it("exports the current ranking as a CSV download", async () => {
    const app = createTestApp({}, [
      {
        method: "SLEEPER_ID",
        ranking: { rank: 1, playerName: "Player One", tier: "S" },
        player: { sleeperId: "1" },
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/rankings/export",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="rankings.csv"',
    );
    expect(response.body).toBe(
      "rank,player,position,team,tier,player_id\n1,Player One,,,S,1\n",
    );

    await app.close();
  });

  it("returns 404 when exporting without a ranking", async () => {
    const app = createTestApp({});

    app.setErrorHandler(errorHandler);

    const response = await app.inject({
      method: "GET",
      url: "/rankings/export",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "RANKING_NOT_FOUND",
      message: "No ranking to export",
    });

    await app.close();
  });

  it("creates an empty ranking and returns its id", async () => {
    const createRanking = vi.fn(() => "ranking-2");

    const app = Fastify();

    app.decorateRequest("user", undefined);
    app.addHook("onRequest", async (request) => {
      request.user = TEST_USER;
    });

    app.register(
      createRankingsRoutes(
        { importCsv: async () => ({}) } as never,
        {
          createRanking,
          getMatches: () => [],
          hasRankings: () => false,
          getLatestRankingId: () => undefined,
        } as never,
      ),
    );

    const response = await app.inject({
      method: "POST",
      url: "/rankings/new",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ rankingId: "ranking-2" });
    expect(createRanking).toHaveBeenCalledWith([], TEST_USER.id, "New ranking");

    await app.close();
  });

  it.each([
    ["the name field", "League A", "League A"],
    ["the file name", undefined, "my-rankings"],
  ])("names an imported ranking after %s", async (_, nameField, expected) => {
    const createRanking = vi.fn(() => "ranking-1");

    const app = Fastify();

    app.decorateRequest("user", undefined);
    app.addHook("onRequest", async (request) => {
      request.user = TEST_USER;
    });
    app.register(multipart);
    app.register(
      createRankingsRoutes(
        {
          importCsv: async () => ({
            summary: {},
            importResult: { errors: [] },
            matches: [],
          }),
        } as never,
        { createRanking } as never,
      ),
    );

    const boundary = "----testboundary123456";
    const namePart =
      nameField === undefined
        ? ""
        : `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="name"\r\n\r\n` +
          `${nameField}\r\n`;
    const payload =
      namePart +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="my-rankings.csv"\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      `rank,player\n1,Player One\r\n` +
      `--${boundary}--\r\n`;

    const response = await app.inject({
      method: "POST",
      url: "/rankings",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(createRanking).toHaveBeenCalledWith([], TEST_USER.id, expected);

    await app.close();
  });
});
