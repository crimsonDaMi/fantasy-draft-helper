import {
  describe,
  expect,
  it,
} from "vitest";

import {
  DraftStateService,
} from "./draft-state.service.js";

describe(
  "DraftStateService",

  () => {
    it(
      "removes drafted players",

      async () => {
        const draftService = {
          getDraft: async () => ({
            id: "draft-1",

            status: "DRAFTING",

            sport: "nfl",

            season: "2026",
          }),

          getDraftPicks: async () => [
            {
              playerId: "2",

              pickNo: 1,
            },
          ],
        };

        const playerService = {
          ensurePlayersLoaded:
            async () => { },

          getAllPlayers: () => [
            {
              sleeperId: "1",

              fullName:
                "Player One",

              active: true,

              fantasyPositions: [
                "QB",
              ],
            },

            {
              sleeperId: "2",

              fullName:
                "Player Two",

              active: true,

              fantasyPositions: [
                "RB",
              ],
            },
          ],
        };

        const service =
          new DraftStateService(
            draftService as never,

            playerService as never,
          );

        const result =
          await service.getDraftState(
            "draft-1",
          );

        expect(
          result.availablePlayers,
        ).toHaveLength(1);

        expect(
          result.availablePlayers[0]
            ?.sleeperId,
        ).toBe("1");
      },
    );
  },
);