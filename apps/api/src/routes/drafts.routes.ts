import { FastifyInstance } from "fastify";
import { z } from "zod";

import { draftParamsSchema } from "./params.schemas.js";
import { adpFormatFor } from "../domain/adp-format.js";
import { DraftService } from "../services/draft.service.js";

const userDraftsQuerySchema = z.object({
  username: z.string().trim().min(1).max(64),
  season: z
    .string()
    .regex(/^\d{4}$/)
    .default(() => String(new Date().getFullYear())),
});

export function createDraftsRoutes(draftService: DraftService) {
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

      const draft = await draftService.getDraft(draftId);

      // The ADP format recommendations use for this draft, so a ranking
      // can be started from the matching ADP before one exists.
      return { ...draft, adpFormat: adpFormatFor(draft) };
    });
  };
}
