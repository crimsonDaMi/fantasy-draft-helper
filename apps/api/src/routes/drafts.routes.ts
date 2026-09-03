import { FastifyInstance } from "fastify";
import { z } from "zod";

import { DraftService } from "../services/draft.service.js";

const draftParamsSchema = z.object({
  draftId: z.string().min(1),
});

export function createDraftsRoutes(
  draftService: DraftService,
) {
  return async function draftsRoutes(
    app: FastifyInstance,
  ) {

    app.get(
      "/drafts/:draftId",

      async (request) => {
        const { draftId } =
          draftParamsSchema.parse(
            request.params,
          );

        return draftService.getDraft(
          draftId,
        );
      },
    );

    app.get(
      "/drafts/:draftId/picks",

      async (request) => {
        const { draftId } =
          draftParamsSchema.parse(
            request.params,
          );

        return draftService.getDraftPicks(
          draftId,
        );
      },
    );
  }
}