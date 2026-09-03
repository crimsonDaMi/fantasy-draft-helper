import { FastifyInstance } from "fastify";
import { z } from "zod";

import { DraftService } from "../services/draft.service.js";

import {
  DraftStateService,
} from "../services/draft-state.service.js";

const availablePlayersQuerySchema =
  z.object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100),
  });

const draftParamsSchema = z.object({
  draftId: z.string().min(1),
});

export function createDraftsRoutes(
  draftService: DraftService,
  draftStateService: DraftStateService,
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

    app.get(
      "/drafts/:draftId/available-players",

      async (request) => {
        const { draftId } =
          draftParamsSchema.parse(
            request.params,
          );

        const { limit } =
          availablePlayersQuerySchema.parse(
            request.query,
          );

        const draftState =
          await draftStateService
            .getDraftState(
              draftId,
            );

        return {
          draftId:
            draftState.draft.id,

          draftedPlayerCount:
            draftState.draftedPlayerIds.size,

          availablePlayerCount:
            draftState.availablePlayers.length,

          lastUpdatedAt:
            draftState.lastUpdatedAt,

          players:
            draftState.availablePlayers.slice(
              0,
              limit,
            ),
        };
      },
    );
  }
}