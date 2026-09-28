import { FastifyInstance } from "fastify";
import { z } from "zod";

import { DraftService } from "../services/draft.service.js";
import { DraftStateService } from "../services/draft-state.service.js";

const availablePlayersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

const userDraftsQuerySchema = z.object({
  username: z.string().trim().min(1).max(64),
  season: z
    .string()
    .regex(/^\d{4}$/)
    .default(() => String(new Date().getFullYear())),
});

const draftParamsSchema = z.object({
  draftId: z.string().min(1),
});

export function createDraftsRoutes(
  draftService: DraftService,
  draftStateService: DraftStateService,
) {
  return async function draftsRoutes(app: FastifyInstance) {
    // Find a draft without pasting its ID: a Sleeper user's drafts for a
    // season (defaults to the current year).
    app.get("/drafts", async (request) => {
      const { username, season } = userDraftsQuerySchema.parse(request.query);

      const { sleeperUserId, drafts } = await draftService.findUserDrafts(
        username,
        season,
      );

      return {
        sleeperUserId,
        drafts: drafts.map((draft) => ({
          draftId: draft.id,
          name: draft.name,
          status: draft.status,
          type: draft.type,
          teams: draft.teams,
          season: draft.season,
          startTime: draft.startTime,
          leagueId: draft.leagueId,
        })),
      };
    });

    app.get("/drafts/:draftId", async (request) => {
      const { draftId } = draftParamsSchema.parse(request.params);

      return draftService.getDraft(draftId);
    });

    app.get("/drafts/:draftId/picks", async (request) => {
      const { draftId } = draftParamsSchema.parse(request.params);

      return draftService.getDraftPicks(draftId);
    });

    app.get("/drafts/:draftId/available-players", async (request) => {
      const { draftId } = draftParamsSchema.parse(request.params);

      const { limit } = availablePlayersQuerySchema.parse(request.query);

      const draftState = await draftStateService.getDraftState(draftId);

      return {
        draftId: draftState.draft.id,
        draftedPlayerCount: draftState.draftedPlayerIds.size,
        availablePlayerCount: draftState.availablePlayers.length,
        lastUpdatedAt: draftState.lastUpdatedAt,
        players: draftState.availablePlayers.slice(0, limit),
      };
    });
  };
}
