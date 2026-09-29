import { FastifyInstance } from "fastify";
import { z } from "zod";

import { rankingParamsSchema } from "./params.schemas.js";
import { PLAYER_FLAGS } from "../domain/player-flag.js";
import { RankingEditorService } from "../services/ranking-editor.service.js";
import { requireUser } from "../utils/require-user.js";

const playerParamsSchema = rankingParamsSchema.extend({
  sleeperId: z.string().min(1),
});

const tierParamsSchema = rankingParamsSchema.extend({
  position: z.coerce.number().int().min(1),
});

const unmatchedRowParamsSchema = rankingParamsSchema.extend({
  rank: z.coerce.number().int().min(1),
});

const unmatchedRowQuerySchema = z.object({
  playerName: z.string().min(1),
});

const resolveUnmatchedRowBodySchema = unmatchedRowQuerySchema.extend({
  sleeperId: z.string().min(1),
});

const movePlayerBodySchema = z.object({
  rank: z.number().int().min(1),
  tier: z.string().trim().toUpperCase().min(1),
});

const setFlagBodySchema = z.object({
  flag: z.enum(PLAYER_FLAGS).nullable(),
});

const insertTierBodySchema = z.object({
  position: z.number().int().min(1),
});

export function createRankingEditorRoutes(
  rankingEditorService: RankingEditorService,
) {
  return async function rankingEditorRoutes(app: FastifyInstance) {
    // Full ranking detail — entry state for the ranking editor.
    app.get("/rankings/:rankingId", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId } = rankingParamsSchema.parse(request.params);

      return rankingEditorService.getRanking(rankingId, userId);
    });

    // Move an existing ranked player, or add a previously-unranked one,
    // to a new rank/tier position.
    app.patch("/rankings/:rankingId/players/:sleeperId", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId, sleeperId } = playerParamsSchema.parse(request.params);

      const { rank, tier } = movePlayerBodySchema.parse(request.body);

      const players = await rankingEditorService.movePlayer(
        rankingId,
        userId,
        sleeperId,
        rank,
        tier,
      );

      return { players };
    });

    // Watch/avoid a ranked player, or clear the flag with `null`.
    app.patch(
      "/rankings/:rankingId/players/:sleeperId/flag",
      async (request) => {
        const userId = requireUser(request).id;

        const { rankingId, sleeperId } = playerParamsSchema.parse(
          request.params,
        );

        const { flag } = setFlagBodySchema.parse(request.body);

        const flags = rankingEditorService.setFlag(
          rankingId,
          userId,
          sleeperId,
          flag ?? undefined,
        );

        return { flags };
      },
    );

    // Remove a player from the ranking (returns them to the unranked pool).
    app.delete("/rankings/:rankingId/players/:sleeperId", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId, sleeperId } = playerParamsSchema.parse(request.params);

      const players = rankingEditorService.removePlayer(
        rankingId,
        userId,
        sleeperId,
      );

      return { players };
    });

    // Resolve an unmatched or ambiguous import row to the chosen player,
    // at the same position. `rank` counts every row, matched or not.
    app.patch("/rankings/:rankingId/unmatched/:rank", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId, rank } = unmatchedRowParamsSchema.parse(
        request.params,
      );

      const { playerName, sleeperId } = resolveUnmatchedRowBodySchema.parse(
        request.body,
      );

      const players = await rankingEditorService.resolveUnmatchedRow(
        rankingId,
        userId,
        rank,
        playerName,
        sleeperId,
      );

      return { players };
    });

    // Delete an unmatched or ambiguous import row.
    app.delete("/rankings/:rankingId/unmatched/:rank", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId, rank } = unmatchedRowParamsSchema.parse(
        request.params,
      );

      const { playerName } = unmatchedRowQuerySchema.parse(request.query);

      const players = rankingEditorService.removeUnmatchedRow(
        rankingId,
        userId,
        rank,
        playerName,
      );

      return { players };
    });

    // Insert a new, empty tier boundary at the given 1-based position.
    app.post("/rankings/:rankingId/tiers", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId } = rankingParamsSchema.parse(request.params);

      const { position } = insertTierBodySchema.parse(request.body);

      const tiers = rankingEditorService.insertTier(
        rankingId,
        userId,
        position,
      );

      return { tiers };
    });

    // Remove a tier, merging its players into the tier below (or, for the
    // last tier, the tier above).
    app.delete("/rankings/:rankingId/tiers/:position", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId, position } = tierParamsSchema.parse(request.params);

      const tiers = rankingEditorService.removeTier(
        rankingId,
        userId,
        position,
      );

      return { tiers };
    });

    // Active, fantasy-relevant players not currently part of this ranking —
    // the "unranked" pool for the editor's side panel.
    app.get("/rankings/:rankingId/unranked-players", async (request) => {
      const userId = requireUser(request).id;

      const { rankingId } = rankingParamsSchema.parse(request.params);

      const players = await rankingEditorService.getUnrankedPlayers(
        rankingId,
        userId,
      );

      return { players };
    });
  };
}
