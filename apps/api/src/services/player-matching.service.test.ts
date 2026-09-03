import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PlayerMatchingService,
} from "./player-matching.service.js";

describe(
  "PlayerMatchingService",

  () => {
    const players = [
      {
        sleeperId: "9221",

        fullName:
          "Jahmyr Gibbs",

        team: "DET",

        position: "RB",

        active: true,

        fantasyPositions: [
          "RB",
        ],
      },
    ];

    const playerService = {
      getPlayerById: (
        id: string,
      ) =>
        players.find(
          (player) =>
            player.sleeperId === id,
        ),

      findPlayersByName: (
        name: string,
      ) =>
        name === "Jahmyr Gibbs"
          ? players
          : [],
    };

    const service =
      new PlayerMatchingService(
        playerService as never,
      );

    it(
      "matches by Sleeper ID",

      () => {
        const result =
          service.matchRanking({
            rank: 1,

            playerName:
              "Jahmyr Gibbs",

            team: "DET",

            position: "RB",

            sleeperPlayerId:
              "9221",
          });

        expect(
          result.method,
        ).toBe("SLEEPER_ID");

        expect(
          result.player?.fullName,
        ).toBe("Jahmyr Gibbs");
      },
    );

    it(
      "matches by name when ID is absent",

      () => {
        const result =
          service.matchRanking({
            rank: 1,

            playerName:
              "Jahmyr Gibbs",

            team: "DET",

            position: "RB",
          });

        expect(
          result.method,
        ).toBe(
          "NAME_POSITION_TEAM",
        );
      },
    );

    it(
      "returns NONE when no player matches",

      () => {
        const result =
          service.matchRanking({
            rank: 1,

            playerName:
              "Unknown Player",

            team: "XXX",

            position: "QB",
          });

        expect(
          result.method,
        ).toBe("NONE");
      },
    );
  },
);