import Fastify from "fastify";

import multipart from "@fastify/multipart";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createRankingsRoutes,
} from "./rankings.routes.js";

function createTestApp(
  importResult: unknown,
  matches: unknown[] = [],
) {
  const app = Fastify();

  app.register(multipart, {
    limits: {
      fileSize: 1024 * 1024,
    },
  });

  const rankingImportService = {
    importCsv: async () => importResult,
  };

  const rankingStoreService = {
    setMatches: () => "ranking-1",
    getMatches: () => matches,
    hasRankings: () => matches.length > 0,
  };

  app.register(
    createRankingsRoutes(
      rankingImportService as never,
      rankingStoreService as never,
    ),
  );

  return app;
}

describe(
  "rankings routes",
  () => {
    it(
      "returns rankingId, summary, and renamed detail fields",
      async () => {
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
      },
    );

    it(
      "returns 400 when no file is provided",
      async () => {
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
          error: "CSV file is required",
        });

        await app.close();
      },
    );

    it(
      "returns rankings status",
      async () => {
        const app = createTestApp(
          {},
          [
            { player: { sleeperId: "1" } },
            { player: undefined },
          ],
        );

        const response = await app.inject({
          method: "GET",
          url: "/rankings/status",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          loaded: true,
          rankingCount: 2,
          matchedCount: 1,
        });

        await app.close();
      },
    );
  },
);