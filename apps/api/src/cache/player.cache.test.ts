import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PlayerCache,
} from "./player.cache.js";

describe(
  "PlayerCache",

  () => {
    it(
      "stores players by Sleeper ID",

      () => {
        const cache =
          new PlayerCache();

        cache.replace([
          {
            sleeperId: "1",

            fullName:
              "Josh Allen",

            active: true,

            fantasyPositions: [
              "QB",
            ],
          },
        ]);

        expect(
          cache.getById("1"),
        ).toMatchObject({
          fullName:
            "Josh Allen",
        });
      },
    );

    it(
      "finds players by normalized name",

      () => {
        const cache =
          new PlayerCache();

        cache.replace([
          {
            sleeperId: "1",

            fullName:
              "D.J. Moore",

            active: true,

            fantasyPositions: [
              "WR",
            ],
          },
        ]);

        const results =
          cache.getByNormalizedName(
            "DJ Moore",
          );

        expect(results).toHaveLength(
          1,
        );

        expect(
          results[0]?.sleeperId,
        ).toBe("1");
      },
    );

    it(
      "supports duplicate names",

      () => {
        const cache =
          new PlayerCache();

        cache.replace([
          {
            sleeperId: "1",

            fullName:
              "John Smith",

            active: true,

            fantasyPositions: [
              "WR",
            ],
          },

          {
            sleeperId: "2",

            fullName:
              "John Smith",

            active: true,

            fantasyPositions: [
              "RB",
            ],
          },
        ]);

        const results =
          cache.getByNormalizedName(
            "John Smith",
          );

        expect(results).toHaveLength(
          2,
        );
      },
    );

    it(
      "clears the cache",

      () => {
        const cache =
          new PlayerCache();

        cache.replace([
          {
            sleeperId: "1",

            fullName:
              "Josh Allen",

            active: true,

            fantasyPositions: [
              "QB",
            ],
          },
        ]);

        cache.clear();

        expect(
          cache.size,
        ).toBe(0);
      },
    );
  },
);