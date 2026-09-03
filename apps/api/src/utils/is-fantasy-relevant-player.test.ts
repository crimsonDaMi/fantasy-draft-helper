import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isFantasyRelevantPlayer,
} from "./is-fantasy-relevant-player.js";

describe(
  "isFantasyRelevantPlayer",

  () => {
    it(
      "accepts an active fantasy player",

      () => {
        expect(
          isFantasyRelevantPlayer({
            sleeperId: "1",

            fullName:
              "Josh Allen",

            active: true,

            fantasyPositions: [
              "QB",
            ],
          }),
        ).toBe(true);
      },
    );

    it(
      "rejects an inactive player",

      () => {
        expect(
          isFantasyRelevantPlayer({
            sleeperId: "1",

            fullName:
              "Retired Player",

            active: false,

            fantasyPositions: [
              "QB",
            ],
          }),
        ).toBe(false);
      },
    );

    it(
      "rejects a player without fantasy positions",

      () => {
        expect(
          isFantasyRelevantPlayer({
            sleeperId: "1",

            fullName:
              "Non Fantasy Player",

            active: true,

            fantasyPositions: [],
          }),
        ).toBe(false);
      },
    );
  },
);