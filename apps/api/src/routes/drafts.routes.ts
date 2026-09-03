import { FastifyInstance } from "fastify";

import { SleeperClient } from "../clients/sleeper.client.js";

import { DraftService } from "../services/draft.service.js";

import { z } from "zod";

const draftParamsSchema = z.object({
  draftId: z.string().min(1),
});

export async function draftsRoutes(
  app: FastifyInstance,
) {
  const sleeperClient =
    new SleeperClient();

  const draftService =
    new DraftService(
      sleeperClient,
    );

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