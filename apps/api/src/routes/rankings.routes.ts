import {
  FastifyInstance,
} from "fastify";

import {
  RankingImportService,
} from "../services/ranking-import.service.js";

import {
  RankingStoreService,
} from "../services/ranking-store.service.js";

export function createRankingsRoutes(
  rankingImportService:
    RankingImportService,

  rankingStoreService:
    RankingStoreService,
) {
  return async function rankingsRoutes(
    app: FastifyInstance,
  ) {
    app.post(
      "/rankings/import",

      async (request, reply) => {
        const file =
          await request.file();

        if (!file) {
          return reply
            .status(400)
            .send({
              error:
                "CSV file is required",
            });
        }

        const allowedMimeTypes =
          new Set([
            "text/csv",

            "application/vnd.ms-excel",

            "application/octet-stream",
          ]);

        if (
          !allowedMimeTypes.has(
            file.mimetype,
          )
        ) {
          return reply
            .status(400)
            .send({
              error:
                "File must be a CSV",
            });
        }

        const csvContent =
          await file.toBuffer();

        const result =
          rankingImportService.importCsv(
            csvContent.toString(
              "utf-8",
            ),
          );

        rankingStoreService
          .setMatches(
            result.matches,
          );

        return {
          summary:
            result.summary,

          errors:
            result.importResult.errors,

          unmatched:
            result.matches
              .filter(
                (match) =>
                  match.method ===
                  "NONE",
              )
              .map(
                (match) => ({
                  rank:
                    match.ranking.rank,

                  name:
                    match.ranking
                      .playerName,

                  team:
                    match.ranking.team,

                  position:
                    match.ranking
                      .position,
                }),
              ),

          ambiguous:
            result.matches
              .filter(
                (match) =>
                  match.method ===
                  "AMBIGUOUS",
              )
              .map(
                (match) => ({
                  rank:
                    match.ranking.rank,

                  name:
                    match.ranking
                      .playerName,

                  candidates:
                    match.candidates?.map(
                      (player) => ({
                        sleeperId:
                          player.sleeperId,

                        fullName:
                          player.fullName,
                      }),
                    ),
                }),
              ),
        };
      },
    );

    app.get(
      "/rankings/status",

      async () => {
        const matches =
          rankingStoreService
            .getMatches();

        return {
          loaded:
            rankingStoreService
              .hasRankings(),

          rankingCount:
            matches.length,

          matchedCount:
            matches.filter(
              (match) =>
                match.player !== undefined,
            ).length,
        };
      },
    );
  };
}