import { FastifyInstance } from "fastify";
import { z } from "zod";

import { rankingParamsSchema } from "./params.schemas.js";
import { RankingImportService } from "../services/ranking-import.service.js";
import { RankingStoreService } from "../services/ranking-store.service.js";
import { mapRankingImportResponse } from "../services/ranking-import.mapper.js";
import { toRankingCsv } from "../services/ranking-csv-export.js";
import { NotFoundError } from "../utils/domain-errors.js";
import { HttpError } from "../utils/http-error.js";
import { requireUser } from "../utils/require-user.js";

const rankingNameSchema = z.string().trim().min(1).max(60);

// Browsers report CSV uploads inconsistently, so accept the common ones.
const ALLOWED_CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

const renameBodySchema = z.object({
  name: rankingNameSchema,
});

const exportQuerySchema = z.object({
  rankingId: z.string().min(1).optional(),
});

/** Name for an imported ranking: the form's `name` field when given,
 * else the uploaded file's name without its extension. */
function importedRankingName(
  nameField: unknown,
  filename: string,
): string | undefined {
  const field =
    nameField && typeof nameField === "object" && "value" in nameField
      ? nameField.value
      : undefined;
  const fromField = rankingNameSchema.safeParse(field);

  if (fromField.success) {
    return fromField.data;
  }

  const fromFile = rankingNameSchema.safeParse(
    filename.replace(/\.[^.]*$/, ""),
  );

  return fromFile.success ? fromFile.data : undefined;
}

export function createRankingsRoutes(
  rankingImportService: RankingImportService,
  rankingStoreService: RankingStoreService,
) {
  return async function rankingsRoutes(app: FastifyInstance) {
    app.post("/rankings", async (request) => {
      const userId = requireUser(request).id;

      const file = await request.file();

      if (!file) {
        throw new HttpError(400, "CSV file is required", "CSV_FILE_REQUIRED");
      }

      if (!ALLOWED_CSV_MIME_TYPES.has(file.mimetype)) {
        throw new HttpError(400, "File must be a CSV", "INVALID_FILE_TYPE");
      }

      const csvContent = await file.toBuffer();

      const result = await rankingImportService.importCsv(
        csvContent.toString("utf-8"),
      );

      // Multipart fields sent before the file are available here.
      const rankingId = rankingStoreService.createRanking(
        result.matches,
        userId,
        importedRankingName(file.fields.name, file.filename),
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

    app.get("/rankings", async (request) => {
      const userId = requireUser(request).id;

      return { rankings: rankingStoreService.listRankings(userId) };
    });

    app.patch("/rankings/:rankingId", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId } = rankingParamsSchema.parse(request.params);

      const { name } = renameBodySchema.parse(request.body);

      rankingStoreService.renameRanking(rankingId, userId, name);

      return { rankingId, name };
    });

    app.delete("/rankings/:rankingId", async (request, reply) => {
      const userId = requireUser(request).id;

      const { rankingId } = rankingParamsSchema.parse(request.params);

      rankingStoreService.deleteRanking(rankingId, userId);

      return reply.status(204).send();
    });

    // The given ranking, or the newest one when `rankingId` is omitted.
    app.get("/rankings/export", async (request, reply) => {
      const userId = requireUser(request).id;

      const { rankingId: requestedId } = exportQuerySchema.parse(request.query);
      const rankingId =
        requestedId ?? rankingStoreService.getLatestRankingId(userId);

      if (!rankingId || !rankingStoreService.hasRanking(rankingId, userId)) {
        throw new NotFoundError("No ranking to export", "RANKING_NOT_FOUND");
      }

      const csv = toRankingCsv(
        rankingStoreService.getRankingMatches(rankingId, userId),
      );

      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", 'attachment; filename="rankings.csv"')
        .send(csv);
    });

    app.get("/rankings/status", async (request) => {
      const userId = requireUser(request).id;

      const rankingId = rankingStoreService.getLatestRankingId(userId);
      const matches = rankingId
        ? rankingStoreService.getRankingMatches(rankingId, userId)
        : [];

      return {
        loaded: rankingId !== undefined,
        rankingId,
        rankingCount: matches.length,
        matchedCount: matches.filter((match) => match.player !== undefined)
          .length,
      };
    });
  };
}
