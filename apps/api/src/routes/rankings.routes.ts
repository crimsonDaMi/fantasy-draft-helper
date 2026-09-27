import { FastifyInstance } from "fastify";

import { RankingImportService } from "../services/ranking-import.service.js";
import { RankingStoreService } from "../services/ranking-store.service.js";
import { mapRankingImportResponse } from "../services/ranking-import.mapper.js";
import { toRankingCsv } from "../services/ranking-csv-export.js";
import { NotFoundError } from "../utils/domain-errors.js";
import { requireUser } from "../utils/require-user.js";

export function createRankingsRoutes(
  rankingImportService: RankingImportService,
  rankingStoreService: RankingStoreService,
) {
  return async function rankingsRoutes(app: FastifyInstance) {
    app.post("/rankings", async (request, reply) => {
      const userId = requireUser(request).id;

      const file = await request.file();

      if (!file) {
        return reply.status(400).send({
          error: "CSV_FILE_REQUIRED",
          message: "CSV file is required",
        });
      }

      const allowedMimeTypes = new Set([
        "text/csv",
        "application/vnd.ms-excel",
        "application/octet-stream",
      ]);

      if (!allowedMimeTypes.has(file.mimetype)) {
        return reply.status(400).send({
          error: "INVALID_FILE_TYPE",
          message: "File must be a CSV",
        });
      }

      const csvContent = await file.toBuffer();

      const result = await rankingImportService.importCsv(
        csvContent.toString("utf-8"),
      );

      const rankingId = rankingStoreService.createRanking(
        result.matches,
        userId,
      );

      return mapRankingImportResponse(rankingId, result);
    });

    app.post("/rankings/new", async (request) => {
      const userId = requireUser(request).id;

      const rankingId = rankingStoreService.createRanking(
        [],
        userId,
        "New ranking",
      );

      return { rankingId };
    });

    app.get("/rankings/export", async (request, reply) => {
      const userId = requireUser(request).id;

      if (!rankingStoreService.hasRankings(userId)) {
        throw new NotFoundError("No ranking to export", "RANKING_NOT_FOUND");
      }

      const csv = toRankingCsv(rankingStoreService.getMatches(userId));

      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", 'attachment; filename="rankings.csv"')
        .send(csv);
    });

    app.get("/rankings/status", async (request) => {
      const userId = requireUser(request).id;

      const matches = rankingStoreService.getMatches(userId);

      return {
        loaded: rankingStoreService.hasRankings(userId),
        rankingId: rankingStoreService.getLatestRankingId(userId),
        rankingCount: matches.length,
        matchedCount: matches.filter((match) => match.player !== undefined)
          .length,
      };
    });
  };
}
